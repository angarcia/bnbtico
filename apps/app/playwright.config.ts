import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";

// E2E_PORT: otro puerto si el 4173 está ocupado (p. ej. dos copias del repo probando a la vez).
const PORT = Number(process.env.E2E_PORT ?? 4173);
const chromium = process.env.CHROMIUM_PATH;
const artifacts = process.env.PW_ARTIFACT_ROOT;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  metadata: {
    commit: process.env.GITHUB_SHA ?? "local",
    ...(artifacts ? { shard: { current: Number(process.env.CI_SHARD_CURRENT), total: Number(process.env.CI_SHARD_TOTAL) } } : {}),
    runner: {
      os: process.env.RUNNER_OS ?? process.platform,
      arch: process.env.RUNNER_ARCH ?? process.arch,
      image: process.env.ImageVersion ?? "local",
    },
  },
  ...(artifacts ? { outputDir: join(artifacts, "raw", "results") } : {}),
  reporter: artifacts ? [["blob", { outputDir: join(artifacts, "raw", "blob") }]] : [
    [process.env.CI ? "github" : "list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/e2e.json" }],
  ],
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Con service worker, page.route no ve lo que pide el SW (fotos, teselas): solo app-instalada.spec.ts lo activa.
    serviceWorkers: "block",
    ...(chromium ? { launchOptions: { executablePath: chromium } } : {}),
  },
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/robots.txt`,
    reuseExistingServer: !process.env.CI,
  },
});
