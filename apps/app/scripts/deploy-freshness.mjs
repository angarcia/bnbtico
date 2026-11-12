import { readFileSync } from "node:fs";

const branches = new Map([
  ["main", "production"],
  ["develop", "pruebas"],
  ["refactor/limpieza-segura", "refactor"],
]);
const ensure = (condition) => {
  if (!condition) throw new Error("Candidato no vigente.");
};
const isSha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const isBranch = (value) => typeof value === "string" && value.length > 0 && value.length <= 255
  && !/[\s\x00-\x1f\x7f~^:?*\\[]/.test(value) && !value.includes("..") && !value.includes("@{")
  && !value.startsWith("/") && !value.endsWith("/") && !value.endsWith(".")
  && value.split("/").every((part) => part && !part.startsWith(".") && !part.endsWith(".lock"));

async function check() {
  const env = process.env;
  const repository = env.GITHUB_REPOSITORY;
  ensure(typeof repository === "string" && /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository));
  ensure(env.GITHUB_TOKEN?.trim() && isSha(env.GITHUB_SHA));
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  ensure(event.repository?.full_name === repository);

  const get = async (path) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    });
    ensure(response.ok && response.status === 200);
    return response.json();
  };
  const currentRef = async (path, ref, sha) => {
    ensure(isSha(sha));
    const data = await get(`git/ref/${path}`);
    ensure(data?.ref === ref && data.object?.type === "commit" && data.object.sha === sha);
  };

  if (env.GITHUB_EVENT_NAME === "push") {
    const branch = env.GITHUB_REF?.slice("refs/heads/".length);
    ensure(env.GITHUB_REF?.startsWith("refs/heads/") && branches.has(branch));
    ensure(env.DEPLOY_ENV === branches.get(branch) && env.PUBLISH_MODE === "deploy");
    ensure(event.ref === env.GITHUB_REF && event.after === env.GITHUB_SHA && event.deleted === false);
    await currentRef(`heads/${encodeURIComponent(branch)}`, env.GITHUB_REF, env.GITHUB_SHA);
    return;
  }

  ensure(env.GITHUB_EVENT_NAME === "pull_request" && env.PUBLISH_MODE === "preview" && env.DEPLOY_ENV === "pruebas");
  const number = event.number;
  ensure(Number.isSafeInteger(number) && number > 0 && env.GITHUB_REF === `refs/pull/${number}/merge`);
  const original = event.pull_request;
  const validPr = (pr) => {
    ensure(pr?.number === number && pr.state === "open" && pr.merged === false);
    ensure(pr.head?.repo?.full_name === repository && pr.base?.repo?.full_name === repository);
    ensure(isBranch(pr.head.ref) && !pr.head.ref.startsWith("refactor/"));
    ensure(["main", "develop"].includes(pr.base.ref) && isSha(pr.head.sha) && isSha(pr.base.sha));
  };
  validPr(original);
  const live = await get(`pulls/${number}`);
  validPr(live);
  ensure(live.mergeable === true && live.merge_commit_sha === env.GITHUB_SHA);
  for (const side of ["head", "base"]) {
    ensure(live[side].ref === original[side].ref && live[side].sha === original[side].sha);
    await currentRef(`heads/${encodeURIComponent(live[side].ref)}`, `refs/heads/${live[side].ref}`, live[side].sha);
  }
  await currentRef(`pull/${number}/merge`, env.GITHUB_REF, env.GITHUB_SHA);
}

try {
  await check();
} catch {
  process.stderr.write("No se puede promover el candidato: SHA o metadatos no vigentes.\n");
  process.exitCode = 1;
}
