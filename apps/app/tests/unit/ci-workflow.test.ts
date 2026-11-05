import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../../../../.github/workflows/app.yml", import.meta.url), "utf8");
const jobs = Object.fromEntries([...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|$(?![\s\S]))/gm)]
  .filter((match) => match.index! > workflow.indexOf("jobs:\n"))
  .map((match) => [match[1]!, match[2]!]));
const required = ["plan", "quality", "database", "e2e", "lighthouse", "report"];

function concurrency(block: string, github: Record<string, string | number>, environment = "pruebas", shard = 1) {
  const evaluate = (value: string) => value.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression: string) =>
    String(Function("github", "needs", "matrix", `return (${expression})`)(
      github, { plan: { outputs: { environment } } }, { shard },
    )));
  const group = block.match(/^\s+group: (.+)$/m)?.[1];
  const cancel = block.match(/^\s+cancel-in-progress: (.+)$/m)?.[1];
  expect(group).toBeDefined();
  expect(cancel).toBeDefined();
  return { group: evaluate(group!), cancel: evaluate(cancel!) === "true" };
}

function deployAllows(results: Record<string, { result: string }>, outputs = { build: "true", environment: "refactor" }, event = "push") {
  const condition = jobs.deploy?.match(/^    if: >-\n([\s\S]*?)(?=^    \w)/m)?.[1];
  expect(condition).toBeDefined();
  const expression = condition!.replace(/\$\{\{|\}\}/g, "").trim();
  return Function("needs", "github", "always", `return (${expression})`)(
    { ...Object.fromEntries(required.map((name) => [name, {}])), ...results, plan: { ...results.plan, outputs } }, { event_name: event }, () => true,
  );
}

describe("CI aislada", () => {
  it("declara todas las puertas como dependencias directas del deploy", () => {
    expect(Object.keys(jobs).sort()).toEqual([...required, "deploy"].sort());
    expect(jobs.deploy).toContain(`needs: [${required.join(", ")}]`);
    expect(deployAllows(Object.fromEntries(required.map((job) => [job, { result: "success" }])))).toBe(true);
  });

  it.each(required.flatMap((job) => ["failure", "cancelled", "skipped", ""].map((state) => [job, state])))(
    "bloquea %s con resultado %s", (job, state) => {
      const results = Object.fromEntries(required.map((name) => [name, { result: "success" }]));
      results[job!] = { result: state! };
      expect(deployAllows(results)).toBe(false);
    },
  );

  it("bloquea output desconocido, dispatch y build no autorizado", () => {
    const results = Object.fromEntries(required.map((job) => [job, { result: "success" }]));
    for (const environment of ["", "unknown"]) expect(deployAllows(results, { build: "true", environment })).toBe(false);
    expect(deployAllows(results, { build: "false", environment: "refactor" })).toBe(false);
    expect(deployAllows(results, undefined, "workflow_dispatch")).toBe(false);
    expect(deployAllows(results, undefined, "desconocido")).toBe(false);
    for (const name of required) {
      const missing = { ...results };
      delete missing[name];
      expect(deployAllows(missing)).toBe(false);
    }
  });

  it("usa un runner y una base por shard sin cancelar los demás", () => {
    expect(jobs.e2e).toContain("fail-fast: false");
    expect(jobs.e2e).toContain("matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}");
    expect(jobs.e2e).toContain('node scripts/ci-artifacts.mjs e2e "$RUNNER_TEMP/$CI_ARTIFACT_NAME" "${{ matrix.shard }}" "${{ matrix.total }}"');
    for (const name of ["database", "e2e", "lighthouse"]) {
      expect(jobs[name]).toContain("runs-on: ubuntu-latest");
      expect(jobs[name]).toContain("pnpm exec supabase start");
      expect(jobs[name]).not.toContain("download-artifact");
    }
    expect(jobs.database).toContain("pnpm test:db");
    expect(jobs.database).toContain("pnpm db:types");
    expect(jobs.lighthouse).not.toContain("pnpm test:e2e");
    expect(jobs.e2e).not.toContain("pnpm lighthouse");
    expect(jobs.quality).toContain("pnpm typecheck");
    expect(jobs.quality).toContain("pnpm test\n");
    expect(jobs.quality).toContain("pnpm test:prototype");
    expect(jobs.quality).toContain("node scripts/ci-artifacts.mjs inventory");
    expect(jobs.e2e).toContain("pnpm size");
  });

  it("reconstruye el deploy en checkout limpio sin artefactos ni base local", () => {
    expect(jobs.deploy).toContain("uses: actions/checkout@v4");
    expect(jobs.deploy).toContain("pnpm install --frozen-lockfile");
    expect(jobs.deploy).toContain("pnpm build");
    expect(jobs.deploy).not.toMatch(/download-artifact|supabase start|dev:vars/);
    expect(jobs.deploy).toContain("test ! -e .dev.vars && test ! -e .env.local");
    for (const name of required) expect(jobs[name]).not.toContain("secrets.");
  });

  it("retiene artefactos tres días e identifica cada shard", () => {
    const uploads = [...workflow.matchAll(/uses: actions\/upload-artifact@v4\n([\s\S]*?)(?=\n      - |\n  [\w-]+:|$)/g)];
    expect(uploads.length).toBeGreaterThanOrEqual(5);
    for (const upload of uploads) expect(upload[1]).toContain("retention-days: 3");
    expect(jobs.e2e).toContain("name: playwright-${{ matrix.shard }}-of-${{ matrix.total }}-attempt-${{ github.run_attempt }}");
    expect(jobs.e2e).toContain("name: e2e-preparation-${{ matrix.shard }}-of-${{ matrix.total }}-attempt-${{ github.run_attempt }}");
    expect(jobs.report).toContain("if: always()");
    expect(jobs.report).toContain("needs: [plan, quality, e2e]");
    expect(jobs.report).toContain("ci-artifacts.mjs report");
    expect(workflow).not.toMatch(/continue-on-error|--retries/);
  });

  it("todos los uploads exigen la última señal segura y solo publican publish", () => {
    const uploads = workflow.split(/\n      - /).filter(step => step.includes("uses: actions/upload-artifact@v4"));
    expect(uploads).toHaveLength(5);
    for (const upload of uploads) {
      expect(upload).toMatch(/if: always\(\) && steps\.[\w-]+\.outputs\.safe_to_upload == 'true'/);
      expect(upload).toMatch(/path: \$\{\{ steps\.[\w-]+\.outputs\.publish \}\}/);
      expect(upload).not.toMatch(/path: \||include-hidden-files|apps\/app\/|runner\.temp/);
    }
    for (const job of ["quality", "e2e", "lighthouse", "report"]) {
      expect(jobs[job]).toContain(`CI_ARTIFACT_NAME: pw-\${{ github.run_id }}-\${{ github.run_attempt }}-${job}`);
      expect(jobs[job]).toContain('rm -rf -- "${RUNNER_TEMP:?}/${CI_ARTIFACT_NAME:?}"');
      expect(jobs[job]).not.toContain("PW_ARTIFACT_ROOT:");
    }
    expect(jobs.e2e).toContain("${{ matrix.shard }}-of-${{ matrix.total }}");
    expect(jobs.report).toContain("pattern: playwright-*-attempt-${{ github.run_attempt }}");
    expect(jobs.report).toContain("CI_ARTIFACT_ATTEMPT: ${{ github.run_attempt }}");
  });

  it("no entrega logs de texto libre al saneador ni a los artefactos", () => {
    const calls = workflow.match(/node (?:apps\/app\/)?scripts\/ci-artifacts\.mjs [^\n]+/g) ?? [];
    expect(calls).toHaveLength(5);
    for (const call of calls) expect(call).not.toMatch(/\.log\b/);
    expect(jobs.e2e).toMatch(/run: rm -rf -- [^\n]*"\$\{RUNNER_TEMP:\?\}\/\$\{CI_ARTIFACT_NAME:\?\}-preparation\.log"/);
  });

  it.each(["quality", "e2e", "lighthouse", "report"])("no invoca limpieza de %s con variables vacías o ausentes", job => {
    const cleanup = jobs[job]!.match(/run: (rm -rf -- .+)/)?.[1];
    expect(cleanup).toBeDefined();
    const execute = (env: NodeJS.ProcessEnv) => spawnSync("bash", ["-c", `rm() { printf 'called\\n'; }; ${cleanup}`], {
      encoding: "utf8", env: { PATH: process.env.PATH, ...env },
    });
    for (const env of [
      {}, { RUNNER_TEMP: "/tmp/ci-test" }, { CI_ARTIFACT_NAME: "artifact" },
      { RUNNER_TEMP: "", CI_ARTIFACT_NAME: "artifact" },
      { RUNNER_TEMP: "/tmp/ci-test", CI_ARTIFACT_NAME: "" },
    ]) {
      const result = execute(env);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe("");
    }
    const valid = execute({ RUNNER_TEMP: "/tmp/ci-test", CI_ARTIFACT_NAME: "artifact" });
    expect(valid.status).toBe(0);
    expect(valid.stdout).toBe("called\n");
  });

  it("instala Chromium antes del canario unitario y no en el deploy", () => {
    expect(jobs.quality!.indexOf("pnpm exec playwright install --with-deps chromium")).toBeGreaterThan(0);
    expect(jobs.quality!.indexOf("pnpm exec playwright install --with-deps chromium")).toBeLessThan(jobs.quality!.indexOf("run: pnpm test\n"));
    expect(jobs.deploy).not.toContain("playwright install");
  });

  it("conserva main serial y deja fuera del bloqueo global el resto de ejecuciones", () => {
    const global = workflow.split("jobs:\n")[0]!;
    expect(global).toContain("group: app-${{ github.ref == 'refs/heads/main' && github.ref || github.run_id }}");
    expect(global).toContain("cancel-in-progress: false");
  });

  it("cancela solo verificaciones obsoletas por job, ref y shard", () => {
    for (const name of required) {
      expect(jobs[name]).toContain(`group: app-verify-${name}-\${{ github.ref }}`);
      expect(jobs[name]).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' || (github.event_name == 'push' && (github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/refactor/limpieza-segura')) }}");
    }
    expect(jobs.e2e).toContain("app-verify-e2e-${{ github.ref }}-${{ matrix.shard }}");
    expect(jobs.deploy).toContain("group: app-publish-${{ needs.plan.outputs.environment }}");
    expect(jobs.deploy).toContain("cancel-in-progress: false");
    expect(jobs.deploy).not.toContain("app-verify");
  });

  it.each([
    ["push", "refs/heads/main", false],
    ["workflow_dispatch", "refs/heads/main", false],
    ["push", "refs/heads/develop", true],
    ["push", "refs/heads/refactor/limpieza-segura", true],
    ["pull_request", "refs/pull/5/merge", true],
    ["workflow_dispatch", "refs/heads/develop", false],
  ])("%s %s respeta cancelación %s y no alcanza al deploy", (event, ref, cancel) => {
    const before = { event_name: event, ref, run_id: 1 };
    const after = { ...before, run_id: 2 };
    for (const name of required) {
      const first = concurrency(jobs[name]!, before);
      const second = concurrency(jobs[name]!, after);
      expect(first.group).toBe(second.group);
      expect(second.cancel).toBe(cancel);
      expect(first.group).not.toBe(concurrency(jobs.deploy!, after).group);
    }
    expect(concurrency(jobs.deploy!, before)).toEqual(concurrency(jobs.deploy!, after));
    expect(concurrency(jobs.deploy!, after).cancel).toBe(false);
    const global = workflow.split("jobs:\n")[0]!;
    const oldGlobal = concurrency(global, before);
    const newGlobal = concurrency(global, after);
    expect(oldGlobal.cancel).toBe(false);
    expect(newGlobal.cancel).toBe(false);
    expect(oldGlobal.group === newGlobal.group).toBe(ref === "refs/heads/main");
    if (ref === "refs/heads/main") expect(oldGlobal.group).toBe("app-refs/heads/main");
  });

  it.each([
    ["push", "workflow_dispatch"],
    ["workflow_dispatch", "push"],
    ["workflow_dispatch", "workflow_dispatch"],
  ])("serializa main %s frente a %s sin cancelar ninguna ejecución", (firstEvent, secondEvent) => {
    const global = workflow.split("jobs:\n")[0]!;
    const first = concurrency(global, { event_name: firstEvent, ref: "refs/heads/main", run_id: 1 });
    const second = concurrency(global, { event_name: secondEvent, ref: "refs/heads/main", run_id: 2 });
    expect(first).toEqual({ group: "app-refs/heads/main", cancel: false });
    expect(second).toEqual(first);
  });

  it("no cruza shards, refs ni destinos en los grupos de concurrencia", () => {
    const github = { event_name: "push", ref: "refs/heads/develop", run_id: 1 };
    expect(concurrency(jobs.e2e!, github, "pruebas", 1).group)
      .not.toBe(concurrency(jobs.e2e!, github, "pruebas", 2).group);
    expect(concurrency(jobs.quality!, github).group)
      .not.toBe(concurrency(jobs.quality!, { ...github, ref: "refs/heads/refactor/limpieza-segura" }).group);
    expect(concurrency(jobs.deploy!, github, "pruebas").group)
      .not.toBe(concurrency(jobs.deploy!, github, "production").group);
    expect(concurrency(jobs.deploy!, github, "pruebas").group)
      .toBe(concurrency(jobs.deploy!, { ...github, event_name: "pull_request", ref: "refs/pull/5/merge" }, "pruebas").group);
  });

  it("comprueba SHA dentro del job exclusivo al entrar y antes de secretos/publicación", () => {
    const deploy = jobs.deploy!;
    expect(deploy.match(/run: node scripts\/deploy-freshness.mjs/g)).toHaveLength(2);
    expect(deploy.indexOf("id: freshness-entry")).toBeLessThan(deploy.indexOf("pnpm build"));
    expect(deploy.indexOf("id: freshness-publish")).toBeGreaterThan(deploy.indexOf("run: pnpm size"));
    expect(deploy.indexOf("id: freshness-publish")).toBeLessThan(deploy.indexOf("name: Secreto anon"));
    expect(deploy.match(/GITHUB_TOKEN: \$\{\{ github.token \}\}/g)).toHaveLength(2);
    expect(deploy.match(/steps.freshness-publish.outcome == 'success'/g)).toHaveLength(2);
    expect(deploy).not.toContain("${{ github.head_ref }}");
    expect(deploy).not.toContain("${{ github.event.pull_request.head.ref }}");
  });
});
