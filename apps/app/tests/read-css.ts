import { readFileSync } from "node:fs";

export function readCss(file = new URL("../src/styles/global.css", import.meta.url)): string {
  return readFileSync(file, "utf8").replace(
    /^@import "(\.\/[^"]+\.css)";\r?\n/gm,
    (_, path: string) => readCss(new URL(path, file)),
  );
}
