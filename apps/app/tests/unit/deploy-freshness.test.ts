import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/deploy-freshness.mjs", import.meta.url));
const workflow = readFileSync(new URL("../../../../.github/workflows/app.yml", import.meta.url), "utf8");
const oldSha = "a".repeat(40);
const newSha = "b".repeat(40);
const mergeSha = "c".repeat(40);
const baseSha = "d".repeat(40);
const repository = "3bstays/app";
const token = "TOKEN_NO_DEBE_APARECER";
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true })));

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "3bstays-freshness-"));
  directories.push(dir);
  const eventFile = join(dir, "event.json");
  const apiFile = join(dir, "api.json");
  const stub = join(dir, "fetch.mjs");
  writeFileSync(stub, `
    import { readFileSync } from "node:fs";
    globalThis.fetch = async (url, options) => {
      if (!url.startsWith("https://api.github.com/repos/3bstays/app/") ||
          options.method !== "GET" || options.redirect !== "error" ||
          options.headers.Authorization !== "Bearer " + process.env.GITHUB_TOKEN ||
          !options.signal) throw new Error(process.env.GITHUB_TOKEN);
      const replies = JSON.parse(readFileSync(process.env.TEST_API_FILE, "utf8"));
      const reply = replies[url.slice("https://api.github.com/repos/3bstays/app/".length)];
      if (!reply || reply.throw) throw new Error(process.env.GITHUB_TOKEN);
      return { ok: (reply.status ?? 200) === 200, status: reply.status ?? 200,
        json: async () => { if (reply.invalidJson) throw new Error(process.env.GITHUB_TOKEN); return reply.body; } };
    };
  `);
  const env: Record<string, string> = {
    GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/develop",
    GITHUB_REPOSITORY: repository, GITHUB_SHA: oldSha, GITHUB_TOKEN: token,
    GITHUB_EVENT_PATH: eventFile, DEPLOY_ENV: "pruebas", PUBLISH_MODE: "deploy",
    TEST_API_FILE: apiFile,
  };
  const event = (data: unknown) => writeFileSync(eventFile, JSON.stringify(data));
  const api = (data: unknown) => writeFileSync(apiFile, JSON.stringify(data));
  event({ ref: env.GITHUB_REF, after: oldSha, deleted: false, repository: { full_name: repository } });
  api({ "git/ref/heads/develop": { body: { ref: env.GITHUB_REF, object: { type: "commit", sha: oldSha } } } });
  const run = (overrides: Record<string, string | undefined> = {}) => new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, ["--import", stub, script], { env: { ...env, ...overrides } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  return { env, event, api, run, eventFile };
}

function preview() {
  const f = fixture();
  const pr = {
    number: 5, state: "open", merged: false, mergeable: true, merge_commit_sha: mergeSha,
    head: { ref: "feature/cambio", sha: oldSha, repo: { full_name: repository } },
    base: { ref: "develop", sha: baseSha, repo: { full_name: repository } },
  };
  Object.assign(f.env, { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/5/merge", GITHUB_SHA: mergeSha, PUBLISH_MODE: "preview" });
  f.event({ number: 5, repository: { full_name: repository }, pull_request: pr });
  const replies = {
    "pulls/5": { body: pr },
    "git/ref/heads/feature%2Fcambio": { body: { ref: "refs/heads/feature/cambio", object: { type: "commit", sha: oldSha } } },
    "git/ref/heads/develop": { body: { ref: "refs/heads/develop", object: { type: "commit", sha: baseSha } } },
    "git/ref/pull/5/merge": { body: { ref: "refs/pull/5/merge", object: { type: "commit", sha: mergeSha } } },
  };
  f.api(replies);
  return { ...f, pr, replies };
}

async function denied(result: ReturnType<ReturnType<typeof fixture>["run"]>) {
  const output = await result;
  expect(output.status).not.toBe(0);
  expect(output.stdout).toBe("");
  expect(output.stderr).toBe("No se puede promover el candidato: SHA o metadatos no vigentes.\n");
  expect(output.stderr).not.toContain(token);
}

describe("promoción por CLI sin red", () => {
  it.each([["main", "production"], ["develop", "pruebas"], ["refactor/limpieza-segura", "refactor"]])(
    "acepta únicamente el commit vigente de %s", async (branch, target) => {
      const f = fixture();
      const ref = `refs/heads/${branch}`;
      Object.assign(f.env, { GITHUB_REF: ref, DEPLOY_ENV: target });
      f.event({ ref, after: oldSha, deleted: false, repository: { full_name: repository } });
      f.api({ [`git/ref/heads/${encodeURIComponent(branch!)}`]: { body: { ref, object: { type: "commit", sha: oldSha } } } });
      expect((await f.run()).status).toBe(0);
    },
  );

  it.each([
    { GITHUB_TOKEN: "" }, { GITHUB_SHA: "unknown" }, { GITHUB_EVENT_NAME: "workflow_dispatch" },
    { GITHUB_EVENT_NAME: "pull_request_target" }, { GITHUB_REF: "refs/heads/unknown" },
    { GITHUB_REF: "refs/tags/develop" }, { DEPLOY_ENV: "production" }, { DEPLOY_ENV: "" },
    { PUBLISH_MODE: "preview" }, { GITHUB_REPOSITORY: "../fork" },
  ])("cierra ante contexto no autorizado %j", async (override) => {
    await denied(fixture().run(override));
  });

  it.each([
    { status: 403 }, { status: 404 }, { status: 500 }, { throw: true }, { invalidJson: true },
    { body: {} }, { body: { ref: "refs/heads/develop", object: { type: "commit", sha: newSha } } },
    { body: { ref: "refs/heads/other", object: { type: "commit", sha: oldSha } } },
    { body: { ref: "refs/heads/develop", object: { type: "tag", sha: oldSha } } },
  ])("cierra ante API fallida o SHA antiguo %j", async (response) => {
    const f = fixture();
    f.api({ "git/ref/heads/develop": response });
    await denied(f.run());
  });

  it("cierra ante evento ausente, corrupto, borrado o ajeno", async () => {
    const f = fixture();
    for (const data of [
      {}, { ref: f.env.GITHUB_REF, after: oldSha, deleted: true, repository: { full_name: repository } },
      { ref: f.env.GITHUB_REF, after: newSha, deleted: false, repository: { full_name: repository } },
      { ref: f.env.GITHUB_REF, after: oldSha, deleted: false, repository: { full_name: "fork/app" } },
    ]) {
      f.event(data);
      await denied(f.run());
    }
    writeFileSync(f.eventFile, "{");
    await denied(f.run());
    rmSync(f.eventFile);
    await denied(f.run());
  });

  it("acepta PR vigente con SHA merge distinto del SHA head", async () => {
    expect((await preview().run()).status).toBe(0);
  });

  it("rechaza usar el SHA head como si fuera el merge probado", async () => {
    await denied(preview().run({ GITHUB_SHA: oldSha }));
  });

  it.each(["fork", "refactor", "base", "metadata", "number"])("rechaza evento PR %s aunque la API sea válida", async (change) => {
    const f = preview();
    const snapshot = structuredClone(f.pr);
    if (change === "fork") snapshot.head.repo.full_name = "externo/fork";
    if (change === "refactor") snapshot.head.ref = "refactor/limpieza-segura";
    if (change === "base") snapshot.base.ref = "unknown";
    if (change === "metadata") Object.assign(snapshot, { head: null });
    f.event({ number: change === "number" ? "5;echo" : 5, repository: { full_name: repository }, pull_request: snapshot });
    await denied(f.run());
  });

  it.each(["head", "merge", "base", "fork", "closed", "unknown", "refactor", "number", "head-ref", "base-ref", "merge-ref"])(
    "rechaza preview con %s cambiado", async (change) => {
      const f = preview();
      const live = structuredClone(f.pr);
      if (change === "head") live.head.sha = newSha;
      if (change === "merge") live.merge_commit_sha = newSha;
      if (change === "base") live.base.sha = newSha;
      if (change === "fork") live.head.repo.full_name = "externo/fork";
      if (change === "closed") live.state = "closed";
      if (change === "unknown") Object.assign(live, { mergeable: null });
      if (change === "refactor") live.head.ref = "refactor/03-worker";
      if (change === "number") live.number = 6;
      f.replies["pulls/5"].body = live;
      if (change === "head-ref") f.replies["git/ref/heads/feature%2Fcambio"].body.object.sha = newSha;
      if (change === "base-ref") f.replies["git/ref/heads/develop"].body.object.sha = newSha;
      if (change === "merge-ref") f.replies["git/ref/pull/5/merge"].body.object.sha = newSha;
      f.api(f.replies);
      await denied(f.run());
    },
  );

  it("no interpreta el nombre de head como shell ni como ruta API", async () => {
    const f = preview();
    const branch = "feature/$(echo-no-ejecutar)";
    f.pr.head.ref = branch;
    f.event({ number: 5, repository: { full_name: repository }, pull_request: f.pr });
    const replies: Record<string, unknown> = { ...f.replies };
    delete replies["git/ref/heads/feature%2Fcambio"];
    replies[`git/ref/heads/${encodeURIComponent(branch)}`] = {
      body: { ref: `refs/heads/${branch}`, object: { type: "commit", sha: oldSha } },
    };
    f.api(replies);
    expect((await f.run()).status).toBe(0);
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function destinationGroup(environment: string) {
  const expression = workflow.split("\n  deploy:\n")[1]?.match(/^\s+group: (.+)$/m)?.[1];
  expect(expression).toBeDefined();
  return expression!.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, code: string) =>
    String(Function("needs", `return (${code})`)({ plan: { outputs: { environment } } })));
}

describe("dos candidatos concurrentes con CLI real y exclusión por destino", () => {
  it.each(["nuevo-primero", "antiguo-primero", "avance-en-espera"])("%s no publica antiguo después del nuevo", async (order) => {
    const old = fixture();
    const next = fixture();
    next.env.GITHUB_SHA = newSha;
    next.event({ ref: next.env.GITHUB_REF, after: newSha, deleted: false, repository: { full_name: repository } });
    const advance = () => {
      for (const f of [old, next]) f.api({ "git/ref/heads/develop": {
        body: { ref: f.env.GITHUB_REF, object: { type: "commit", sha: newSha } },
      } });
    };
    const locks = new Map<string, Promise<void>>();
    const published: string[] = [];
    const entered = deferred();
    const release = deferred();
    let active = 0;
    let maxActive = 0;
    const promote = (f: ReturnType<typeof fixture>, wait = false, afterPublish = () => {}) => {
      const group = destinationGroup(f.env.DEPLOY_ENV!);
      const previous = locks.get(group) ?? Promise.resolve();
      const task = previous.then(async () => {
        active += 1;
        maxActive = Math.max(active, maxActive);
        try {
          const entry = await f.run();
          entered.resolve();
          if (wait) await release.promise;
          if (entry.status !== 0 || (await f.run()).status !== 0) return;
          published.push(f.env.GITHUB_SHA!);
          afterPublish();
        } finally { active -= 1; }
      });
      locks.set(group, task);
      return task;
    };
    if (order === "antiguo-primero") {
      const first = promote(old, true, advance);
      await entered.promise;
      const second = promote(next);
      release.resolve();
      await Promise.all([first, second]);
    } else if (order === "avance-en-espera") {
      const first = promote(old, true);
      await entered.promise;
      const second = promote(next);
      advance();
      release.resolve();
      await Promise.all([first, second]);
    } else {
      advance();
      const first = promote(next, true);
      await entered.promise;
      const second = promote(old);
      release.resolve();
      await Promise.all([first, second]);
    }
    expect(maxActive).toBe(1);
    expect(published).toEqual(order === "antiguo-primero" ? [oldSha, newSha] : [newSha]);
  });

  it("serializa deploy y preview del mismo worker sin interrumpir la publicación", async () => {
    const push = fixture();
    const pr = preview();
    const gate = deferred();
    const started = deferred();
    const events: string[] = [];
    expect(destinationGroup(push.env.DEPLOY_ENV!)).toBe(destinationGroup(pr.env.DEPLOY_ENV!));
    expect(destinationGroup("production")).not.toBe(destinationGroup("pruebas"));
    expect(destinationGroup("refactor")).not.toBe(destinationGroup("pruebas"));
    const deploy = (async () => {
      expect((await push.run()).status).toBe(0);
      events.push("deploy-start");
      started.resolve();
      await gate.promise;
      events.push("deploy-finish");
    })();
    await started.promise;
    const upload = deploy.then(async () => {
      expect((await pr.run()).status).toBe(0);
      events.push("preview");
    });
    expect(events).toEqual(["deploy-start"]);
    gate.resolve();
    await Promise.all([deploy, upload]);
    expect(events).toEqual(["deploy-start", "deploy-finish", "preview"]);
  });
});
