import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const script = fileURLToPath(new URL("../../scripts/ci-artifacts.mjs", import.meta.url));
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const secret = "ci-wiring-fictitious-bearer-88442";
async function inspect(bytes: Buffer): Promise<void> {
  for (const value of [secret, encodeURIComponent(secret), Buffer.from(secret).toString("base64")]) {
    expect(bytes.includes(Buffer.from(value)), "un canario llegó a publish").toBe(false);
  }
  if (bytes.subarray(0, 2).toString() === "PK") {
    const zip = await require("yauzl").fromBufferPromise(bytes);
    try {
      for await (const entry of zip.eachEntry()) {
        if (entry.fileName.endsWith("/")) continue;
        const stream = await zip.openReadStreamPromise(entry);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        await inspect(Buffer.concat(chunks));
      }
    } finally {
      zip.close();
    }
  } else {
    for (const match of bytes.toString().matchAll(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/g)) {
      await inspect(Buffer.from(match[1]!, "base64"));
    }
  }
}
async function inspectDirectory(directory: string): Promise<void> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await inspectDirectory(file);
    else await inspect(readFileSync(file));
  }
}
function execute(mode: string) {
  const dir = mkdtempSync(join(tmpdir(), "ci-artifacts-test-"));
  roots.push(dir);
  const root = join(dir, "private");
  const output = join(dir, "outputs.txt");
  const cli = require.resolve("@playwright/test/cli");
  const executablePath = process.env.CHROMIUM_PATH ??
    (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
  const config = join(dir, "playwright.config.cjs");
  writeFileSync(config, `module.exports = {
    testDir: ${JSON.stringify(dir)}, testMatch: "*.spec.cjs", workers: 1, retries: ${mode === "flaky" ? 1 : 0},
    metadata: { commit: ${JSON.stringify(mode === "metadata" ? "wrong" : "sha-fixture")},
      shard: { current: Number(process.env.CI_SHARD_CURRENT), total: Number(process.env.CI_SHARD_TOTAL) } },
    use: { trace: "retain-on-failure", launchOptions: ${JSON.stringify({ executablePath })} }
  };`);
  for (const file of ["a", "b"]) writeFileSync(join(dir, `${file}.spec.cjs`), `
    const { test, expect } = require(${JSON.stringify(require.resolve("@playwright/test"))});
    test("diagnóstico ${file}", async ({ page }, info) => {
      console.log("Authorization: Bearer ${secret}");
      console.error("copia ${secret}");
      await page.route("**/*", route => route.abort());
      await page.goto("data:text/html,<h1>Diagnóstico</h1>");
      if (${JSON.stringify(mode)} === "sanitize") await page.setContent("<h1>${secret}</h1>");
      if (${JSON.stringify(mode)} === "interrupted") {
        process.kill(process.ppid, "SIGINT");
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      expect(!["failing", "sanitize"].includes(${JSON.stringify(mode)}) && (${JSON.stringify(mode)} !== "flaky" || info.retry > 0)).toBe(true);
    });
  `);
  const pnpm = join(dir, "pnpm");
  writeFileSync(pnpm, `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
let args = process.argv.slice(2);
if (args[0] !== "exec" || args[1] !== "playwright") process.exit(96);
args = args.slice(2);
const isTest = args[0] === "test";
const isList = args.includes("--list");
if (isTest) args.push("--config", ${JSON.stringify(config)});
if (!isTest && ${JSON.stringify(mode)} === "renderer") process.exit(42);
const result = spawnSync(process.execPath, [${JSON.stringify(cli)}, ...args], { encoding: "utf8", env: process.env });
if (isList && ${JSON.stringify(mode)} === "incomplete") {
  const report = JSON.parse(result.stdout);
  const spec = report.suites[0].specs[0];
  report.suites[0].specs.push({ ...spec, id: "missing-id", title: "missing case" });
  result.stdout = JSON.stringify(report);
}
if (!isTest && ${JSON.stringify(mode)} === "normalizer" && result.status === 0) {
  const report = JSON.parse(readFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, "utf8"));
  report.stats.duration = "invalid";
  writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify(report));
}
if (!isTest && ${JSON.stringify(mode)} === "publish-sanitize" && result.status === 0)
  writeFileSync(require("node:path").join(require("node:path").dirname(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE), "unsupported.bin"), Buffer.from([255, 254, 250]));
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (isTest && !isList && ${JSON.stringify(mode)} === "stderr")
  process.stderr.write("Error externo sintético\\nAuthorization: Bearer ${secret}\\n");
if (isTest && !isList && ${JSON.stringify(mode)} === "stderr-ambiguous")
  process.stderr.write('{"password":"${secret}"}\\nError externo sintético\\n');
process.exit(isTest && !isList && ${JSON.stringify(mode)} === "exit7" ? 7 : (result.status ?? 1));
`, { mode: 0o700 });
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !name.startsWith("PLAYWRIGHT_") && !name.startsWith("PW_") && name !== "PWDEBUG"));
  const result = spawnSync(process.execPath, [script, "e2e", root, "1", "2"], {
    encoding: "utf8",
    env: {
      ...env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`, GITHUB_SHA: "sha-fixture", GITHUB_OUTPUT: output,
      PLAYWRIGHT_JSON_OUTPUT_FILE: join(dir, "unwanted.json"),
    },
  });
  const outputs = existsSync(output) ? readFileSync(output, "utf8") : "";
  return { result, outputs, root };
}

describe("conexión privada de artefactos", () => {
  it.each(["passing", "failing", "interrupted", "incomplete", "exit7", "stderr"])(
    "publica diagnóstico saneado de %s sin ocultar el resultado original", async mode => {
      const { result, outputs, root } = execute(mode);
      expect(outputs, result.stderr).toContain("safe_to_upload=true\n");
      expect(outputs.trim().endsWith("safe_to_upload=true")).toBe(true);
      expect(outputs).toContain(`publish=${root}/publish\n`);
      expect(result.status).toBe(["passing", "stderr"].includes(mode) ? 0 : mode === "exit7" ? 7 : mode === "interrupted" ? 130 : 1);
      expect(result.stdout + result.stderr).not.toContain(secret);
      const rawJson = readFileSync(join(root, "raw/runner.json"), "utf8");
      expect(rawJson).toContain(secret);
      const raw = JSON.parse(rawJson);
      expect(raw.config.reporter).toEqual([["blob"], ["json"]]);
      expect(raw.suites[0].specs[0].tests[0].results[0].stdout).toEqual([{ text: `Authorization: Bearer ${secret}\n` }]);
      expect(raw.suites[0].specs[0].tests[0].results[0].stderr).toEqual([{ text: `copia ${secret}\n` }]);
      const rawLog = readFileSync(join(root, "raw/runner.log"), "utf8");
      expect(rawLog).toBe(mode === "stderr" ? `Error externo sintético\nAuthorization: Bearer ${secret}\n` : "");
      const publish = join(root, "publish");
      await inspectDirectory(publish);
      expect(readFileSync(join(publish, "runner.log"), "utf8")).not.toContain(secret);
      expect(JSON.parse(readFileSync(join(publish, "runner.json"), "utf8")).stats).toEqual(raw.stats);
      expect(readFileSync(join(publish, "runner.json"), "utf8"))
        .toBe(readFileSync(join(root, "clean/runner.json"), "utf8"));
      if (mode === "stderr") expect(readFileSync(join(publish, "runner.log"), "utf8")).toContain("Error externo sintético");
      const native = JSON.parse(readFileSync(join(publish, "e2e.json"), "utf8"));
      const normalized = JSON.parse(readFileSync(join(publish, "e2e-normalized.json"), "utf8"));
      expect(normalized.stats).toEqual(native.stats);
      expect(normalized.suites).toEqual(native.suites);
      expect(normalized.config.shard).toEqual({ current: 1, total: 2 });
      expect(readFileSync(join(publish, "test-results/e2e.json"), "utf8"))
        .toBe(readFileSync(join(publish, "e2e-normalized.json"), "utf8"));
      expect(readFileSync(join(publish, "e2e-normalized.json"), "utf8")).not.toContain(secret);
      expect(existsSync(join(publish, "html"))).toBe(false);
      expect(readdirSync(publish, { recursive: true }).some(name => String(name).endsWith(".html"))).toBe(false);
      if (mode === "failing") expect(native.stats.unexpected).toBeGreaterThan(0);
      if (mode === "incomplete") expect(readFileSync(join(publish, "gate-exit.txt"), "utf8").trim()).not.toBe("0");
    }, 60_000,
  );

  it("rechaza stderr ambiguo sin mezclarlo con JSON ni autorizar su publicación", () => {
    const { result, outputs, root } = execute("stderr-ambiguous");
    expect(JSON.parse(readFileSync(join(root, "raw/runner.json"), "utf8")).stats.expected).toBe(1);
    expect(readFileSync(join(root, "raw/runner.log"), "utf8")).toBe(`{"password":"${secret}"}\nError externo sintético\n`);
    expect(result.status).toBe(1);
    expect(outputs).not.toContain("safe_to_upload=true");
    expect(existsSync(join(root, "clean"))).toBe(false);
    expect(existsSync(join(root, "publish"))).toBe(false);
    expect(result.stdout + result.stderr).not.toContain(secret);
  }, 60_000);

  it.each(["sanitize", "publish-sanitize", "renderer", "normalizer", "metadata", "flaky"])(
    "bloquea publicación y éxito ante %s", mode => {
      const { result, outputs, root } = execute(mode);
      expect(result.status).not.toBe(0);
      expect(outputs).not.toContain("safe_to_upload=true");
      expect(existsSync(join(root, "publish"))).toBe(false);
      expect(result.stdout + result.stderr).not.toContain(secret);
      expect(existsSync(join(root, "clean"))).toBe(mode !== "sanitize");
      if (mode === "flaky") {
        expect(readFileSync(join(root, "raw/e2e-exit.txt"), "utf8").trim()).toBe("0");
        expect(JSON.parse(readFileSync(join(root, "render/e2e.json"), "utf8")).stats.flaky).toBe(1);
      }
      if (mode === "publish-sanitize") expect(existsSync(join(root, "render/e2e-normalized.json"))).toBe(true);
    }, 60_000,
  );

  it("conserva el fallo del informe combinado sin publicarlo antes de sanear", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-report-test-"));
    roots.push(dir);
    const root = join(dir, "private");
    const output = join(dir, "outputs");
    const summary = join(dir, "summary");
    mkdirSync(join(dir, "downloads"));
    const result = spawnSync(process.execPath, [script, "report", root, join(dir, "absent.json"), join(dir, "downloads"), "2"], {
      encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    });
    expect(result.status).toBe(1);
    expect(readFileSync(output, "utf8")).toContain("safe_to_upload=true");
    const published = readFileSync(join(root, "publish/summary.md"), "utf8");
    expect(readFileSync(summary, "utf8")).toBe(published);
    expect(published).toContain("Falta inventario");
  });
});
