// El ocre (`--sun`) es solo para dinero y avisos de pago (spec «Densidad y tarjetas», § 4). Esta prueba recorre
// `src/client` y `src/shared` y falla si una clase `*-sun` aparece fuera de la lista de permitidos.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url).pathname;
const OCRE = /\b(btn|card|note|tile|badge)-sun\b/g;
// archivo (relativo a src/) + "#" + la `function Nombre` más cercana declarada antes de la coincidencia; "#*" = todo el archivo.
const ALLOW = new Set([
  "client/screens/propietario.tsx#PayButton",
  "client/screens/propietario.tsx#PayNotice",
  "client/screens/propietario.tsx#PaymentDueNote",
  "client/screens/propietario.tsx#ActivateButton",
  "client/screens/propietario.tsx#CasasScreen", // casilla «por pagar»
  "client/screens/casa-editable.tsx#StoppedNotice", // «Suscripción parada» en la ficha editable
  "client/screens/suscripcion.tsx#*", // Promoción y suscripción, tarjeta y fila de Cuenta
  "shared/contact-sheet.tsx#*", // «no pague por adelantado»
]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

function matches(): string[] {
  const found: string[] = [];
  for (const root of ["client", "shared"]) {
    for (const file of files(join(SRC, root))) {
      const text = readFileSync(file, "utf8");
      const rel = relative(SRC, file);
      for (const m of text.matchAll(OCRE)) {
        const before = text.slice(0, m.index);
        const fns = [...before.matchAll(/\bfunction\s+(\w+)/g)];
        const fn = fns.length ? fns[fns.length - 1]![1]! : "*";
        found.push(`${rel}#${fn}`);
      }
    }
  }
  return found;
}

describe("ocre solo para dinero y avisos de pago", () => {
  it("ninguna clase *-sun fuera de la lista de permitidos", () => {
    const offenders = [...new Set(matches())].filter((k) => !ALLOW.has(k) && !ALLOW.has(`${k.split("#")[0]}#*`));
    expect(offenders, `Ocre fuera de dinero:\n${offenders.join("\n")}`).toEqual([]);
  });
});
