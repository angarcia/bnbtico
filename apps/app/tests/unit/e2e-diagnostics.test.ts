import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import config from "../../playwright.config";

const workflow = readFileSync(new URL("../../../../.github/workflows/app.yml", import.meta.url), "utf8");
const step = (name: string) => {
  const block = workflow.split(`      - name: ${name}\n`)[1];
  expect(block, name).toBeDefined();
  return block!.split(/\n      - (?:name:|uses:|run:)/)[0]!;
};

describe("diagnóstico E2E", () => {
  it("conserva el fallo original sin reintentos", () => {
    expect(config.retries).toBe(0);
    expect(config.use?.trace).toBe("retain-on-failure");
  });

  it("ofrece casos y tiempos por archivo en HTML y JSON sin abrir el navegador", () => {
    expect(config.reporter).toEqual([
      [process.env.CI ? "github" : "list"],
      ["html", { open: "never" }],
      ["json", { outputFile: "test-results/e2e.json" }],
    ]);
  });

  it("en la captura privada solo emite blob y conserva shard, worker, retries y trazas", async () => {
    vi.stubEnv("PW_ARTIFACT_ROOT", "/tmp/pw-artifacts-unit");
    vi.stubEnv("CI_SHARD_CURRENT", "2");
    vi.stubEnv("CI_SHARD_TOTAL", "3");
    vi.resetModules();
    try {
      const { default: privateConfig } = await import("../../playwright.config");
      expect(privateConfig.reporter).toEqual([["blob", { outputDir: "/tmp/pw-artifacts-unit/raw/blob" }]]);
      expect(privateConfig.outputDir).toBe("/tmp/pw-artifacts-unit/raw/results");
      expect(privateConfig.metadata?.shard).toEqual({ current: 2, total: 3 });
      expect(privateConfig.workers).toBe(1);
      expect(privateConfig.retries).toBe(0);
      expect(privateConfig.use?.trace).toBe("retain-on-failure");
      expect(privateConfig.testDir).toBe("tests/e2e");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("conserva los informes y las trazas aunque falle la primera ejecución", () => {
    const upload = step("Diagnóstico de Playwright");
    expect(upload).toContain("if: always() && steps.e2e.outputs.safe_to_upload == 'true'");
    expect(upload).toContain("uses: actions/upload-artifact@v7");
    expect(upload).toContain("path: ${{ steps.e2e.outputs.publish }}");
    expect(upload).not.toMatch(/apps\/app\/(?:playwright-report|test-results)|raw\/|clean\/|render\//);
    expect(upload).toContain("retention-days: 3");
    expect(upload).not.toMatch(/\.env|\.dev\.vars|include-hidden-files/);
    const e2e = step("Ficha real, hidratación y shell (Pixel 7)");
    expect(e2e).toContain("id: e2e");
    expect(e2e).toContain('node scripts/ci-artifacts.mjs e2e "$RUNNER_TEMP/$CI_ARTIFACT_NAME"');
    expect(e2e).not.toMatch(/continue-on-error|--retries|\|\|/);
  });

  it("guarda tiempos de preparación y códigos de salida también ante fallo", () => {
    for (const name of [
      "Dependencias",
      "Supabase local (Docker del runner)",
      "Variables locales para las pruebas de navegador",
      "Build local para las pruebas de navegador (contra Supabase local)",
      "Navegador de Playwright",
    ]) {
      expect(step(name)).toContain('/usr/bin/time -a -o "$RUNNER_TEMP/${CI_ARTIFACT_NAME}-preparation.tsv"');
      expect(step(name)).toMatch(/-f '.+\\t%e\\t%x' pnpm /);
      expect(step(name)).toContain('"$RUNNER_TEMP/${CI_ARTIFACT_NAME}-preparation.log" 2>&1');
      expect(step(name)).not.toMatch(/continue-on-error|\|\|/);
    }
    const sanitize = step("Sanear tiempos de preparación");
    expect(sanitize).toContain('node scripts/ci-artifacts.mjs preparation "$RUNNER_TEMP/${CI_ARTIFACT_NAME}-preparation" "$RUNNER_TEMP/${CI_ARTIFACT_NAME}-preparation.tsv"');
    expect(sanitize.trimEnd().endsWith('-preparation.tsv"')).toBe(true);
    expect(sanitize.split("\n").filter(line => line.includes("run:")).join("\n")).not.toContain("preparation.log");
    const e2eJob = workflow.split("\n  e2e:\n")[1]!.split("\n  lighthouse:\n")[0]!;
    expect(e2eJob).toContain('"${RUNNER_TEMP:?}/${CI_ARTIFACT_NAME:?}-preparation.log"');
    const upload = step("Tiempos de preparación E2E");
    expect(upload).toContain("if: always() && steps.preparation.outputs.safe_to_upload == 'true'");
    expect(upload).toContain("path: ${{ steps.preparation.outputs.publish }}");
    expect(upload).toContain("retention-days: 3");
  });

  it("la captura CI no escribe reporters públicos y conserva la puerta del resultado", () => {
    const script = readFileSync(new URL("../../scripts/ci-artifacts.mjs", import.meta.url), "utf8");
    expect(script).toContain('"--reporter=blob,json"');
    expect(script).toContain('"--workers=1"');
    expect(script).toContain('"merge-reports", "--reporter=json"');
    expect(script).not.toMatch(/reporter=html|PLAYWRIGHT_HTML_/);
    expect(script).toContain('output: "clean"');
    expect(script).toContain('input: "render", output: "publish"');
    expect(script).toContain('"normalize"');
    expect(script).toContain('"gate"');
    expect(script).toContain("return code || gateCode");
    expect(script).not.toMatch(/stdio: ["']inherit|continue-on-error/);
    expect(script).toContain('join(root, "logs")');
    expect(script).not.toMatch(/join\((?:raw|render), "[\w-]+\.log"\)|"[\w-]+\.log", "e2e-exit\.txt"/);
  });
});
