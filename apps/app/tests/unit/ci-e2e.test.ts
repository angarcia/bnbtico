import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci-e2e.mjs", import.meta.url));
const temporary: string[] = [];
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "bnbtico-ci-test-"));
  temporary.push(dir);
  return dir;
};
afterEach(() => temporary.splice(0).forEach((dir) => rmSync(dir, { recursive: true })));
const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
const report = (ids: string[]) => ({
  suites: [{ title: "cuenta.spec.ts", specs: ids.map((id) => ({
    id, title: `caso ${id}`, file: "cuenta.spec.ts", line: 10, column: 1,
    tests: [{ projectName: "", results: [], status: "expected" }],
  })) }],
});
function check(full: unknown, parts: unknown[]) {
  const dir = fixture();
  const files = [full, ...parts].map((data, i) => {
    const path = join(dir, `${i}.json`);
    writeFileSync(path, JSON.stringify(data));
    return path;
  });
  return run("check", ...files);
}

describe("inventario de particiones", () => {
  it("conserva IDs, títulos y archivo de todos los casos", () => {
    const result = check(report(["a", "b", "c"]), [report(["a"]), report(["b", "c"])]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).parts[1].tests[0]).toMatchObject({ id: "b", title: ["cuenta.spec.ts", "caso b"], file: "cuenta.spec.ts" });
  });

  it.each([
    [["a"], ["b"]],
    [["a", "b"], ["b", "c"]],
    [["a", "b"], ["c", "unknown"]],
    [["a", "a"], ["b", "c"]],
    [[], ["a", "b", "c"]],
  ])("rechaza ausentes, duplicados, extraños o shard vacío: %j", (...parts) => {
    expect(check(report(["a", "b", "c"]), parts.map((ids) => report(ids as string[]))).status).not.toBe(0);
  });

  it("rechaza identidad cambiada, errores de descubrimiento y fuente duplicada", () => {
    const changed = report(["b"]);
    changed.suites[0]!.specs[0]!.title = "otro caso";
    expect(check(report(["a", "b"]), [report(["a"]), changed]).status).not.toBe(0);
    expect(check({ ...report(["a", "b"]), errors: [{ message: "fallo" }] }, [report(["a"]), report(["b"])]).status).not.toBe(0);
    expect(check(report(["a", "a"]), [report(["a"]), report(["a"])]).status).not.toBe(0);
  });

  it("genera únicamente matrices de dos o tres shards", () => {
    for (const total of [2, 3]) {
      const result = run("matrix", String(total));
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ include: Array.from({ length: total }, (_, i) => ({ shard: i + 1, total })) });
    }
    for (const total of ["1", "4", "", "2;echo secreto"]) expect(run("matrix", total).status).not.toBe(0);
  });

  it("escribe diagnóstico y falla si falta el inventario o los informes", () => {
    const dir = fixture();
    const inventory = join(dir, "inventory.json");
    writeFileSync(inventory, JSON.stringify({ commit: "sha", total: 2, configurations: [{ total: 2, parts: [{ shard: 1, tests: [] }, { shard: 2, tests: [] }] }] }));
    expect(run("report", inventory, dir, "2", dir).status).not.toBe(0);
    expect(readFileSync(join(dir, "summary.md"), "utf8")).toContain("Falta");
  });
});

describe("comando inventory", () => {
  type Listing = ReturnType<typeof report> & { errors?: { message: string }[] };
  function listings(total: number): Record<string, Listing> {
    const ids = Array.from({ length: total }, (_, index) => `id-${index}`);
    return Object.fromEntries([
      ["full", report(ids)],
      ...[2, 3].flatMap((count) => Array.from({ length: count }, (_, index) =>
        [`${index + 1}/${count}`, report(ids.filter((_, position) => position % count === index))])),
    ]);
  }
  function inventory(input: Record<string, Listing>) {
    const dir = fixture();
    const output = join(dir, "output");
    const calls = join(dir, "calls.jsonl");
    const pnpm = join(dir, "pnpm");
    writeFileSync(pnpm, `#!${process.execPath}
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
const prefix = ["exec", "playwright", "test", "--list", "--reporter=json"];
if (JSON.stringify(args.slice(0, 5)) !== JSON.stringify(prefix) || args.length > 6) process.exit(1);
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + "\\n");
const input = ${JSON.stringify(input)};
const key = args[5]?.replace("--shard=", "") ?? "full";
if (!input[key]) process.exit(1);
console.log(JSON.stringify(input[key]));
`, { mode: 0o700 });
    const result = spawnSync(process.execPath, [script, "inventory", output], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`, GITHUB_SHA: "commit-fixture" },
    });
    return { result, output: join(output, "inventory.json"), calls };
  }

  it.each([336, 6])("descubre %i casos del commit y valida ambos repartos completos", (total) => {
    const { result, output, calls } = inventory(listings(total));
    expect(result.status, result.stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.commit).toBe("commit-fixture");
    expect(manifest.total).toBe(total);
    expect(manifest.tests).toHaveLength(total);
    expect(new Set(manifest.tests.map((test: { id: string }) => test.id)).size).toBe(total);
    expect(manifest.tests[0]).toMatchObject({ id: "id-0", file: "cuenta.spec.ts", title: ["cuenta.spec.ts", "caso id-0"] });
    expect(manifest.configurations.map((config: { total: number }) => config.total)).toEqual([2, 3]);
    for (const config of manifest.configurations) {
      expect(config.parts).toHaveLength(config.total);
      const tests = config.parts.flatMap((part: { tests: { id: string }[] }) => part.tests);
      expect(tests).toHaveLength(total);
      expect(new Set(tests.map((test: { id: string }) => test.id)).size).toBe(total);
      expect(tests).toEqual(expect.arrayContaining(manifest.tests));
    }
    expect(readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line)[5] ?? "full"))
      .toEqual(["full", "--shard=1/2", "--shard=2/2", "--shard=1/3", "--shard=2/3", "--shard=3/3"]);
  });

  it.each([
    ["empty", "Inventario vacío"],
    ["duplicate", "IDs duplicados"],
    ["error", "contiene errores"],
    ["missing", "Faltan casos"],
    ["overlap", "duplicado entre shards"],
    ["unknown", "Caso desconocido"],
    ["shard-error", "contiene errores"],
  ])("rechaza %s sin publicar un manifiesto", (fault, message) => {
    const input = listings(6);
    if (fault === "empty") input.full = report([]);
    if (fault === "duplicate") input.full!.suites[0]!.specs.push(input.full!.suites[0]!.specs[0]!);
    if (fault === "error") input.full!.errors = [{ message: "fallo de descubrimiento" }];
    if (fault === "missing") input["3/3"]!.suites[0]!.specs.pop();
    if (fault === "overlap") input["3/3"]!.suites[0]!.specs.push(input["1/3"]!.suites[0]!.specs[0]!);
    if (fault === "unknown") input["3/3"]!.suites[0]!.specs.push(report(["unknown"]).suites[0]!.specs[0]!);
    if (fault === "shard-error") input["3/3"]!.errors = [{ message: "fallo de shard" }];
    const { result, output } = inventory(input);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
    expect(() => readFileSync(output)).toThrow();
  });
});

describe("resumen combinado", () => {
  function reports() {
    const dir = fixture();
    const files: string[] = [];
    const listed = JSON.parse(check(report(["a", "b"]), [report(["a"]), report(["b"])]).stdout);
    const inventory = join(dir, "inventory.json");
    writeFileSync(inventory, JSON.stringify({
      commit: process.env.GITHUB_SHA ?? "local", total: 2,
      tests: listed.parts.flatMap((part: { tests: unknown[] }) => part.tests),
      configurations: [listed],
    }));
    for (let shard = 1; shard <= 2; shard++) {
      const result = {
        ...report([shard === 1 ? "a" : "b"]),
        config: { workers: 1, projects: [{ retries: 0 }], shard: { current: shard, total: 2 }, metadata: { commit: process.env.GITHUB_SHA ?? "local" } },
        stats: { duration: 2000 },
      };
      Object.assign(result.suites[0]!.specs[0]!.tests[0]!, {
        status: shard === 1 ? "expected" : "skipped",
        results: [{ retry: 0, duration: shard === 1 ? 1000 : 0 }],
      });
      const location = join(dir, `playwright-${shard}-of-2`, "test-results");
      mkdirSync(location, { recursive: true });
      const file = join(location, "e2e.json");
      writeFileSync(file, JSON.stringify(result));
      files.push(file);
      const prep = join(dir, `e2e-preparation-${shard}-of-2`);
      mkdirSync(prep);
      writeFileSync(join(prep, "e2e-preparation.tsv"), "paso\tsegundos\tcodigo\n" +
        ["dependencias", "supabase", "variables-locales", "build-local", "navegador"].map((step) => `${step}\t1.5\t0\n`).join(""));
    }
    return { dir, inventory, files };
  }

  it("combina inventario, omisiones y tiempos sin afirmar minutos facturados", () => {
    const { dir, inventory } = reports();
    const result = run("report", inventory, dir, "2", dir);
    expect(result.status, result.stderr).toBe(0);
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
    expect(summary.errors).toEqual([]);
    expect(summary.shards[0].files).toEqual([{ file: "cuenta.spec.ts", durationMs: 1000 }]);
    expect(summary.shards[1].tests[0].status).toBe("skipped");
    expect(readFileSync(join(dir, "summary.md"), "utf8")).toContain("No son minutos facturados");
  });

  it("conserva tiempos y estados fallidos en el resumen, pero mantiene roja la puerta", () => {
    const { dir, inventory, files } = reports();
    const data = JSON.parse(readFileSync(files[0]!, "utf8"));
    data.suites[0].specs[0].tests[0].status = "unexpected";
    writeFileSync(files[0]!, JSON.stringify(data));
    const result = run("report", inventory, dir, "2", dir);
    expect(result.status).not.toBe(0);
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
    expect(summary.errors).not.toEqual([]);
    expect(summary.shards[0].tests[0]).toMatchObject({ id: "a", status: "unexpected", durationMs: 1000 });
    expect(summary.shards[0].durationMs).toBe(2000);
    expect(summary.shards[0].files).toEqual([{ file: "cuenta.spec.ts", durationMs: 1000 }]);
  });

  it("exige artefactos del intento actual y no usa los anteriores como sustituto", () => {
    const { dir, inventory } = reports();
    const current = () => spawnSync(process.execPath, [script, "report", inventory, dir, "2", dir], {
      encoding: "utf8", env: { ...process.env, CI_ARTIFACT_ATTEMPT: "2" },
    });
    expect(current().status).not.toBe(0);
    for (const name of ["playwright-1-of-2", "playwright-2-of-2", "e2e-preparation-1-of-2", "e2e-preparation-2-of-2"]) {
      renameSync(join(dir, name), join(dir, `${name}-attempt-2`));
    }
    const result = current();
    expect(result.status, result.stderr).toBe(0);
  });

  it("acepta JSON nativo de Playwright sin navegador, servidor ni base", () => {
    const dir = fixture();
    const playwright = createRequire(import.meta.url).resolve("@playwright/test");
    const config = join(dir, "playwright.config.cjs");
    writeFileSync(config, `module.exports = ${JSON.stringify({
      testDir: ".", testMatch: "*.spec.cjs", workers: 1, retries: 0, reporter: [["json"]],
      metadata: { commit: process.env.GITHUB_SHA ?? "local" },
    })}`);
    for (const name of ["a", "b"]) writeFileSync(join(dir, `${name}.spec.cjs`),
      `const { test } = require(${JSON.stringify(playwright)}); test(${JSON.stringify(name)}, () => {});`);
    const native = (...args: string[]) => {
      const result = spawnSync(process.execPath, [join(dirname(playwright), "cli.js"), "test", "--config", config, ...args], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    const parts = [1, 2].map((shard) => native("--list", `--shard=${shard}/2`));
    const listed = JSON.parse(check(native("--list"), parts).stdout);
    const inventory = join(dir, "inventory.json");
    writeFileSync(inventory, JSON.stringify({
      commit: process.env.GITHUB_SHA ?? "local", total: 2,
      tests: listed.parts.flatMap((part: { tests: unknown[] }) => part.tests),
      configurations: [listed],
    }));
    for (const shard of [1, 2]) {
      const location = join(dir, `playwright-${shard}-of-2`, "test-results");
      mkdirSync(location, { recursive: true });
      writeFileSync(join(location, "e2e.json"), JSON.stringify(native(`--shard=${shard}/2`)));
      const prep = join(dir, `e2e-preparation-${shard}-of-2`);
      mkdirSync(prep);
      writeFileSync(join(prep, "e2e-preparation.tsv"), "paso\tsegundos\tcodigo\n" +
        ["dependencias", "supabase", "variables-locales", "build-local", "navegador"].map((step) => `${step}\t0\t0\n`).join(""));
    }
    const result = run("report", inventory, dir, "2", dir);
    expect(result.status, `${result.stderr}\n${readFileSync(join(dir, "summary.md"), "utf8")}`).toBe(0);
  }, 20_000);

  it.each(["missing", "sha", "shard", "workers", "retries", "retry", "flaky", "failure", "duplicate", "identity", "preparation"])(
    "rechaza %s aunque los otros informes sean válidos", (fault) => {
      const { dir, inventory, files } = reports();
      const file = files[0]!;
      const data = JSON.parse(readFileSync(file, "utf8"));
      if (fault === "sha") data.config.metadata.commit = "otro";
      if (fault === "shard") data.config.shard.current = 2;
      if (fault === "workers") data.config.workers = 2;
      if (fault === "retries") data.config.projects[0].retries = 1;
      if (fault === "retry") data.suites[0].specs[0].tests[0].results[0].retry = 1;
      if (fault === "flaky") data.suites[0].specs[0].tests[0].status = "flaky";
      if (fault === "failure") data.suites[0].specs[0].tests[0].status = "unexpected";
      if (fault === "duplicate") data.suites[0].specs.push(data.suites[0].specs[0]);
      if (fault === "identity") data.suites[0].specs[0].title = "otro título";
      writeFileSync(file, JSON.stringify(data));
      if (fault === "missing") rmSync(file);
      if (fault === "preparation") writeFileSync(join(dir, "e2e-preparation-1-of-2/e2e-preparation.tsv"), "paso\tsegundos\tcodigo\nbuild-local\t2\t1\n");
      const result = run("report", inventory, dir, "2", dir);
      expect(result.status).not.toBe(0);
      expect(JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")).errors.length).toBeGreaterThan(0);
    },
  );
});
