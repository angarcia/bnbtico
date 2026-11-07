import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lo que usa la base de Supabase local la pone antes al día con supabase/migrations (scripts/base-local.mjs). Sin esto, una
// migración nueva llega con un git pull y la app y las pruebas siguen contra el esquema viejo (2026-11-06).
const scripts = (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> }).scripts;
const setup = readFileSync(new URL("../../../../docs/preparar-entorno-local.sh", import.meta.url), "utf8");

describe("base local al día con las migraciones", () => {
  it.each(["dev", "test:e2e", "test:db", "datos:prueba"])("pnpm %s la pone al día antes de nada", (name) => {
    expect(scripts[name]).toMatch(/^node scripts\/base-local\.mjs && /);
  });

  it("pnpm db:al-dia la pone al día a mano", () => {
    expect(scripts["db:al-dia"]).toBe("node scripts/base-local.mjs");
  });

  it("preparar-entorno-local.sh pasa por db:al-dia y no aplica migraciones por su cuenta", () => {
    expect(setup).toContain("pnpm --silent db:al-dia ||");
    expect(setup).not.toMatch(/migration up/);
  });
});
