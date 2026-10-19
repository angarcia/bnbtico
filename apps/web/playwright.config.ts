import { defineConfig, devices } from "@playwright/test";

// Variables locales (Supabase local y clave de servicio para preparar datos). Sin el archivo, se sigue sin ellas.
try {
  process.loadEnvFile(`${__dirname}/.env.local`);
} catch {
  /* sin .env.local */
}

// Flujos siempre en viewport móvil: la v1 es móvil primero.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  // Un solo worker: las pruebas comparten la base local y los números de prueba (1 s entre códigos al mismo número).
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    ...devices["Pixel 7"],
    // Permite usar un Chromium ya instalado (CI/contenedores) sin descargar navegadores.
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "pnpm dev --port 3000", url: "http://127.0.0.1:3000", reuseExistingServer: true, timeout: 120_000 },
});
