// La e2e local no corre contra una compilación vieja (scripts/dist-al-dia.mjs, tests/e2e/global-setup.ts).
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { staleSources } from "../../scripts/dist-al-dia.mjs";

let root = "";
const write = (path: string, at: number) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), "x");
  utimesSync(join(root, path), at, at);
};
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("dist/ al día", () => {
  it("sin compilación, null", () => {
    root = mkdtempSync(join(tmpdir(), "dist-al-dia-"));
    write("src/main.tsx", 100);
    expect(staleSources(root)).toBeNull();
  });

  it("al día: nada más nuevo que dist/client/index.html", () => {
    root = mkdtempSync(join(tmpdir(), "dist-al-dia-"));
    write("src/client/a.tsx", 100);
    write("vite.config.ts", 100);
    write("dist/client/index.html", 200);
    expect(staleSources(root)).toEqual([]);
  });

  it("con cambios después de compilar, dice cuáles (lo más nuevo primero) y no mira las pruebas", () => {
    root = mkdtempSync(join(tmpdir(), "dist-al-dia-"));
    write("dist/client/index.html", 200);
    write("src/client/a.tsx", 300);
    write("public/portada.html", 400);
    write("tests/e2e/x.spec.ts", 500);
    expect(staleSources(root)).toEqual(["public/portada.html", "src/client/a.tsx"]);
  });
});
