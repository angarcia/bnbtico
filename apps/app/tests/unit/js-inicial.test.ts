// El límite «JS inicial» cuenta justo lo que se carga al arrancar la SPA (scripts/js-inicial.mjs, en `pnpm size`).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initialMismatch, startupChunks } from "../../scripts/js-inicial.mjs";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** index → start-shell (import() desde la entrada) → react y marco (estáticos); la hoja, solo con import(). */
function assets() {
  dir = mkdtempSync(join(tmpdir(), "js-inicial-"));
  const files: Record<string, string> = {
    "index-AAAAAAAA.js": 'import"./react-BBBBBBBB.js";h(()=>import("./start-shell-CCCCCCCC.js"))',
    "start-shell-CCCCCCCC.js": 'import{a}from"./react-BBBBBBBB.js";import{b}from"./marco-DDDDDDDD.js";const s=()=>import("./sheet-EEEEEEEE.js")',
    "react-BBBBBBBB.js": "export const a=1",
    "marco-DDDDDDDD.js": "export const b=1",
    "sheet-EEEEEEEE.js": 'import{a}from"./react-BBBBBBBB.js"',
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe("JS inicial", () => {
  it("al arrancar: la entrada, start-shell y sus importaciones estáticas; no lo que va con import()", () => {
    expect([...startupChunks(assets())].sort()).toEqual(["index-AAAAAAAA.js", "marco-DDDDDDDD.js", "react-BBBBBBBB.js", "start-shell-CCCCCCCC.js"]);
  });

  it("sin diferencias cuando el límite excluye justo los diferidos", () => {
    expect(initialMismatch(assets(), ["dist/client/assets/*.js", "!dist/client/assets/sheet-*.js"])).toEqual({ countedButDeferred: [], loadedButNotCounted: [] });
  });

  it("dice qué diferido cuenta de más y qué inicial queda fuera", () => {
    expect(initialMismatch(assets(), ["dist/client/assets/*.js", "!dist/client/assets/marco-????????.js"])).toEqual({ countedButDeferred: ["sheet"], loadedButNotCounted: ["marco"] });
  });
});
