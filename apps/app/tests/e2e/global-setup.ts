// Antes de las e2e locales: que `dist/` sea la compilación del código de ahora (scripts/dist-al-dia.mjs).
import { fileURLToPath } from "node:url";
import { staleSources } from "../../scripts/dist-al-dia.mjs";

export default function globalSetup() {
  if (process.env.CI) return;
  const stale = staleSources(fileURLToPath(new URL("../../", import.meta.url)));
  if (stale === null) throw new Error("No hay compilación en dist/: ejecute `pnpm build` antes de las e2e.");
  if (stale.length) throw new Error(`dist/ es más vieja que el código (${stale.join(", ")}): ejecute \`pnpm build\` antes de las e2e.`);
}
