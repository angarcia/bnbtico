import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.{ts,tsx}"], environment: "node" } },
      // Contra Supabase local: archivos en serie (comparten base y números de prueba; un código por segundo y número).
      { extends: true, test: { name: "db", include: ["tests/db/**/*.test.ts"], environment: "node", fileParallelism: false, testTimeout: 30_000, hookTimeout: 90_000 } },
    ],
  },
});
