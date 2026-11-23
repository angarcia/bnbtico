// Claves de TanStack Query (estructura del frontend, paso 4): cada clave se escribe en un solo sitio, su fábrica
// (`xQuery(...)`) o su función `xKey(...)`, y quien invalida, lee o siembra la caché usa esa función o `xQuery(...).queryKey`.
// Una clave copiada a mano deja de invalidar en silencio el día que la fábrica cambia de nombre o de forma.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url).pathname;
// Llamadas de QueryClient que reciben una clave, como primer argumento o en `{ queryKey }`.
const CACHE_CALLS = new Set(["getQueryData", "setQueryData", "getQueryState", "removeQueries", "invalidateQueries", "cancelQueries", "refetchQueries", "resetQueries", "isFetching", "findAll", "fetchQuery", "prefetchQuery", "ensureQueryData", "setQueriesData", "getQueriesData"]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Cada `["nombre", …]` que se usa como clave de Query: valor de `queryKey`, primer argumento de una llamada de caché o
 *  cuerpo de una constante o función cuyo nombre acaba en `Key`. */
function keyLiterals(): { name: string; at: string }[] {
  const found: { name: string; at: string }[] = [];
  for (const file of files(SRC)) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("Query") && !text.includes("Key")) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const add = (node: ts.Node) => {
      let e = node;
      while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
      if (!ts.isArrayLiteralExpression(e)) return;
      const first = e.elements[0];
      if (!first || !ts.isStringLiteral(first)) return;
      found.push({ name: first.text, at: `${relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(e.getStart()).line + 1}` });
    };
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.getText() === "queryKey") add(node.initializer);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && CACHE_CALLS.has(node.expression.name.text) && node.arguments[0]) add(node.arguments[0]);
      if (ts.isVariableDeclaration(node) && /(^k|K)ey$/.test(node.name.getText()) && node.initializer) {
        const init = node.initializer;
        add(ts.isArrowFunction(init) && !ts.isBlock(init.body) ? init.body : init);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

describe("claves de Query", () => {
  it("encuentra las claves (si no, la prueba no mira nada)", () => {
    const names = new Set(keyLiterals().map((k) => k.name));
    for (const name of ["listing", "listings", "own-listings", "calendar", "fx"]) expect(names).toContain(name);
  });

  it("cada clave se escribe en un solo sitio (use su función `xKey` o `xQuery(...).queryKey`)", () => {
    const byName = new Map<string, string[]>();
    for (const k of keyLiterals()) byName.set(k.name, [...(byName.get(k.name) ?? []), k.at]);
    const repeated = [...byName].filter(([, at]) => at.length > 1).map(([name, at]) => `"${name}": ${at.join(", ")}`);
    expect(repeated).toEqual([]);
  });
});
