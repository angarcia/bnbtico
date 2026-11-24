// ¿Cuenta el límite «JS inicial» de .size-limit.json justo lo que se carga al arrancar la SPA? Lo que se carga: la entrada
// de index.html, start-shell (que la entrada pide al abrir una pantalla de la app) y todo lo que importan sin `import()`.
// El límite se escribe como «todos los .js menos los diferidos»; si un trozo diferido nuevo no entra en esa lista, el
// límite lo cuenta como inicial (el 2026-11-24 sumaba así 4,2 KB de más), y si uno del arranque queda excluido, no lo
// cuenta. Lo ejecuta `pnpm size` después de size-limit, en local y en CI.
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const INITIAL = /JS inicial/;

/** Los trozos que carga la SPA al arrancar, siguiendo los `import … from` estáticos desde la entrada y start-shell. */
export function startupChunks(assets) {
  const files = readdirSync(assets);
  const entry = files.find((f) => /^index-[\w-]+\.js$/.test(f));
  const shell = files.find((f) => /^start-shell-[\w-]+\.js$/.test(f));
  if (!entry || !shell) throw new Error(`No encuentro la entrada o start-shell en ${assets}: ¿falta pnpm build?`);
  const seen = new Set();
  const stack = [entry, shell];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of readFileSync(join(assets, f), "utf8").matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) stack.push(m[1]);
  }
  return seen;
}

/** Lo que cuenta el límite: sus globs de inclusión menos los de exclusión (`*` y `?` dentro del nombre). */
export function countedChunks(assets, paths) {
  const toRe = (glob) => new RegExp(`^${basename(glob).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  const include = paths.filter((p) => !p.startsWith("!")).map(toRe);
  const exclude = paths.filter((p) => p.startsWith("!")).map((p) => toRe(p.slice(1)));
  return new Set(readdirSync(assets).filter((f) => include.some((r) => r.test(f)) && !exclude.some((r) => r.test(f))));
}

/** Diferencias en los dos sentidos, con el nombre del trozo sin su hash. */
export function initialMismatch(assets, paths) {
  const startup = startupChunks(assets);
  const counted = countedChunks(assets, paths);
  const name = (f) => f.replace(/-[\w-]{8}\.js$/, "");
  return {
    countedButDeferred: [...counted].filter((f) => !startup.has(f)).map(name).sort(),
    loadedButNotCounted: [...startup].filter((f) => !counted.has(f)).map(name).sort(),
  };
}

if (process.argv[1] && process.argv[1].endsWith("js-inicial.mjs")) {
  const root = new URL("../", import.meta.url).pathname;
  const limits = JSON.parse(readFileSync(join(root, ".size-limit.json"), "utf8"));
  const entry = limits.find((e) => INITIAL.test(e.name));
  const { countedButDeferred, loadedButNotCounted } = initialMismatch(join(root, "dist/client/assets"), entry.path);
  if (countedButDeferred.length || loadedButNotCounted.length) {
    if (countedButDeferred.length) console.error(`✗ El límite del JS inicial cuenta trozos que no se cargan al arrancar (añada su «!dist/client/assets/<nombre>-*.js» a .size-limit.json): ${countedButDeferred.join(", ")}`);
    if (loadedButNotCounted.length) console.error(`✗ Se cargan al arrancar y el límite no los cuenta (quite su exclusión de .size-limit.json): ${loadedButNotCounted.join(", ")}`);
    process.exit(1);
  }
  console.log("✓ El límite del JS inicial cuenta justo lo que se carga al arrancar.");
}
