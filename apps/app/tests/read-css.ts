import { readFileSync } from "node:fs";

/** global.css con sus @import resueltos y sin el espacio que rodea a `{`, `}` y `;`: el CSS por áreas va sangrado dentro de
 *  @layer y @media, y las pruebas comparan reglas escritas en una línea («@media (…){.x{…}}»). */
export function readCss(file = new URL("../src/styles/global.css", import.meta.url)): string {
  return expand(file).replace(/\s*([{};])\s*/g, "$1");
}

function expand(file: URL): string {
  return readFileSync(file, "utf8").replace(
    /^@import "(\.\.?\/[^"]+\.css)";\r?\n/gm,
    (_, path: string) => expand(new URL(path, file)),
  );
}
