// El ocre (`--sun`) es solo para dinero y avisos de pago (acuerdo final de botones, 2026-11-04). Esta prueba recorre
// `src/client` y `src/shared` y falla si una clase `*-sun` o un botón `variant="pay"` (historia 07) aparece fuera de la lista
// de permitidos.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url).pathname;
// Historia 07, paso 5: también el tono ocre de las tarjetas, avisos, filas y etiquetas comunes (`tone="sun"`, `tone: "pay"`).
const OCRE = /\b(?:btn|card|note|tile|badge|list-item)-sun\b|variant=(?:"pay"|\{[^}]*"pay")|tone=(?:"sun"|\{[^}]*"sun")|tone: "pay"/g;
// archivo (relativo a src/) + "#" + la `function Nombre` más cercana declarada antes de la coincidencia; "#*" = todo el archivo.
const ALLOW = new Set([
  "shared/ui/button.tsx#*", // la variante «pay» del botón común
  "shared/ui/structure.tsx#*", // los tonos ocres de Notice y StatusTag
  "shared/ui/card.tsx#*", // los tonos ocres de Card y ListRow
  "client/owner-ui.tsx#PayButton",
  "client/owner-ui.tsx#PayNotice",
  "client/screens/casa-editable.tsx#PaymentDueNote",
  "client/owner-ui.tsx#ActivateButton",
  "client/screens/propietario.tsx#CasasScreen", // casilla «por pagar»
  "client/screens/casa-editable.tsx#StoppedNotice", // «Suscripción parada» en la ficha editable
  "client/screens/suscripcion.tsx#*", // Promoción y suscripción, tarjeta y fila de Cuenta
  "shared/contact-sheet.tsx#*", // «no pague por adelantado»
  "client/comun/publish-promo.tsx#*", // la oferta de lanzamiento: publicar gratis (revisión UX 2026-10-29, A8)
]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Las claves `archivo#función` de cada clase ocre de un archivo. */
function scan(text: string, rel: string): string[] {
  return [...text.matchAll(OCRE)].map((m) => {
    const fns = [...text.slice(0, m.index).matchAll(/\bfunction\s+(\w+)/g)];
    return `${rel}#${fns.length ? fns[fns.length - 1]![1]! : "*"}`;
  });
}

function matches(): string[] {
  return ["client", "shared"].flatMap((root) => files(join(SRC, root)).flatMap((file) => scan(readFileSync(file, "utf8"), relative(SRC, file))));
}

const offending = (keys: string[]) => [...new Set(keys)].filter((k) => !ALLOW.has(k) && !ALLOW.has(`${k.split("#")[0]}#*`));

describe("ocre solo para dinero y avisos de pago", () => {
  it("ninguna clase *-sun fuera de la lista de permitidos", () => {
    const offenders = offending(matches());
    expect(offenders, `Ocre fuera de dinero:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("también la fila ocre de una lista (list-item-sun) fuera de la lista de permitidos", () => {
    const fixture = 'function Fila() {\n  return <Link className="list-item list-item-sun" />;\n}';
    expect(offending(scan(fixture, "client/cuenta/cuenta.tsx"))).toEqual(["client/cuenta/cuenta.tsx#Fila"]);
    expect(offending(scan(fixture, "client/screens/suscripcion.tsx"))).toEqual([]);
  });

  it("también el botón común en ocre (variant=\"pay\") fuera de la lista de permitidos", () => {
    const fixture = 'function Pie() {\n  return <Button variant="pay">Pagar</Button>;\n}\nfunction Otro() {\n  return <Button variant={x ? "secondary" : "pay"} />;\n}';
    expect(offending(scan(fixture, "client/cuenta/cuenta.tsx"))).toEqual(["client/cuenta/cuenta.tsx#Pie", "client/cuenta/cuenta.tsx#Otro"]);
  });
});
