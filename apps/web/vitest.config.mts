import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  // Los archivos corren uno tras otro: las pruebas de base comparten números de prueba y Supabase limita los códigos a uno por segundo.
  test: { include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"], testTimeout: 30_000, environment: "node", fileParallelism: false },
});
