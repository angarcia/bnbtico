import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"], testTimeout: 30_000, environment: "node" },
});
