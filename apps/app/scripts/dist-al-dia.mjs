// ¿Está `dist/` al día con el código? Las e2e sirven la compilación que haya en `dist/` (vite preview) y no compilan: si
// se cambia el código y no se vuelve a compilar, prueban lo de antes y pueden pasar sin querer (2026-11-24, con el
// catálogo de componentes). La e2e local falla antes de empezar si algo de lo que entra en la compilación es más nuevo
// que `dist/client/index.html` (tests/e2e/global-setup.ts). En CI no se mira: allí siempre se compila antes.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Lo que entra en la compilación de la app y del worker. */
const INPUTS = ["src", "public", "index.html", "vite.config.ts", "wrangler.jsonc", "tsconfig.json"];

function newest(path) {
  const info = statSync(path);
  if (!info.isDirectory()) return [{ path, mtime: info.mtimeMs }];
  return readdirSync(path).flatMap((name) => newest(join(path, name)));
}

/** Los archivos más nuevos que la compilación, relativos a `root` (como mucho `limit`); `null` si no hay compilación. */
export function staleSources(root, limit = 5) {
  const built = join(root, "dist", "client", "index.html");
  if (!existsSync(built)) return null;
  const at = statSync(built).mtimeMs;
  return INPUTS.map((p) => join(root, p))
    .filter((p) => existsSync(p))
    .flatMap(newest)
    .filter((f) => f.mtime > at)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((f) => relative(root, f.path));
}
