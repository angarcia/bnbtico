// Pone la base de Supabase LOCAL al día con supabase/migrations: `pnpm db:al-dia` (desde la raíz o desde apps/app).
//
// Las migraciones son la única fuente del esquema. Supabase local solo las aplica al crear la base (`supabase start` la
// primera vez o `pnpm db:reset`); una base ya creada se queda como estaba aunque un `git pull` traiga migraciones nuevas, y
// entonces la app y las pruebas fallan contra un esquema viejo (2026-11-06: así le fallaron a Ana las e2e tras save_edit_full).
// Por eso `pnpm dev`, `pnpm test:e2e`, `pnpm test:db`, `pnpm datos:prueba` y docs/preparar-entorno-local.sh pasan antes
// por aquí. Si ya está al día no hace nada (un par de segundos). En CI la base es nueva y tampoco hace nada.
//
// Casos:
// - Migraciones nuevas: las aplica. Si alguna es más antigua que la última aplicada (pasa al juntar ramas: la de otra
//   persona llega con fecha anterior a una suya), la aplica igual (--include-all) y avisa de que el orden no es el del
//   repositorio.
// - La base tiene migraciones que ya no están en supabase/migrations (una suya que renombró, borró o rehízo con otra
//   fecha): no la toca y explica cómo dejarla igual que el repositorio. Con `--reset` lo hace: pnpm db:reset (borra todo)
//   y vuelve a crear las casas de prueba.
import { spawnSync } from "node:child_process";

const root = new URL("../../../", import.meta.url).pathname;
const RESET = process.argv.includes("--reset");

const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const ocre = (s) => `\x1b[33m${s}\x1b[0m`;

function supabase(args, { show = false } = {}) {
  return spawnSync("pnpm", ["exec", "supabase", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", show ? "inherit" : "pipe", show ? "inherit" : "pipe"] });
}

function fail(msg) {
  console.error(rojo(`✗ ${msg}`));
  process.exit(1);
}

function state() {
  const r = supabase(["migration", "list", "--local", "--output-format", "json"]);
  if (r.status !== 0) {
    const why = `${r.stderr}${r.stdout}`.split("\n").filter((l) => l && !/new version|recommend updating/i.test(l)).slice(-3).join("\n  ");
    fail(`No pude leer las migraciones de la base local. ¿Está arrancado Supabase? (pnpm db:start)\n  ${why}`);
  }
  const json = r.stdout.slice(r.stdout.indexOf("{"));
  const rows = JSON.parse(json).migrations ?? [];
  const files = rows.map((m) => m.local).filter(Boolean);
  const applied = rows.map((m) => m.remote).filter(Boolean);
  return {
    pending: files.filter((v) => !applied.includes(v)),
    orphan: applied.filter((v) => !files.includes(v)),
    lastApplied: applied.sort().at(-1) ?? "",
  };
}

let s = state();

if (s.orphan.length > 0) {
  if (!RESET) {
    fail(
      `La base local tiene migraciones que no están en supabase/migrations: ${s.orphan.join(", ")}.\n` +
        `  Su esquema ya no es el del repositorio y las pruebas pueden fallar sin motivo.\n` +
        `  Si una es suya y la renombró o rehízo, no pasa nada: déjela igual que el repositorio con\n` +
        `    pnpm db:al-dia --reset     (borra usuarios, casas y fotos locales y vuelve a crear las casas de prueba)`,
    );
  }
  console.log("Reiniciando la base local desde las migraciones (borra los datos locales)…");
  if (supabase(["db", "reset", "--local"], { show: true }).status !== 0) fail("No se pudo reiniciar la base local (pnpm db:reset).");
  if (spawnSync("node", [new URL("./casas-de-prueba.mjs", import.meta.url).pathname], { cwd: root, stdio: "inherit" }).status !== 0)
    fail("La base está al día, pero no se pudieron crear las casas de prueba (pnpm datos:prueba).");
  s = state();
}

if (s.pending.length > 0) {
  const outOfOrder = s.pending.filter((v) => v < s.lastApplied);
  console.log(`Aplicando ${s.pending.length} migración(es) a la base local: ${s.pending.join(", ")}`);
  const r = supabase(["migration", "up", "--local", "--include-all"]);
  if (r.status !== 0) {
    const out = `${r.stdout}\n${r.stderr}`.split("\n").filter((l) => l.trim() && !/new version|recommend updating/i.test(l));
    console.error(out.slice(-15).join("\n"));
    fail(
      "No se pudieron aplicar las migraciones a la base local (arriba, el error de Postgres).\n" +
        "  Si la base local tiene cambios hechos a mano o de una rama vieja, déjela igual que el repositorio con\n" +
        "    pnpm db:al-dia --reset     (borra los datos locales y vuelve a crear las casas de prueba)",
    );
  }
  if (outOfOrder.length > 0)
    console.log(
      ocre(
        `! ${outOfOrder.join(", ")} es anterior a la última aplicada (${s.lastApplied}): se aplicó después, fuera del orden del repositorio.\n` +
          "  Si algo no cuadra, pnpm db:al-dia --reset la deja exactamente como el repositorio (borra los datos locales).",
      ),
    );
  s = state();
  if (s.pending.length > 0) fail(`Siguen sin aplicar: ${s.pending.join(", ")}.`);
}

console.log(`Base local al día con supabase/migrations (última: ${s.lastApplied}).`);
