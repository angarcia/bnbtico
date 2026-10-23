import { defineConfig } from "@playwright/test";

// Puerta de Lighthouse (ticket 12): mismo build local y mismo `vite preview` que la e2e, contra Supabase local sembrado.
// pnpm lighthouse (antes pnpm dev:vars y pnpm build). Chrome: CHROMIUM_PATH (en CI, el Google Chrome del runner).
const PORT = 4173;

export default defineConfig({
  testDir: "tests/lighthouse",
  workers: 1,
  timeout: 600_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/robots.txt`,
    reuseExistingServer: !process.env.CI,
  },
});
