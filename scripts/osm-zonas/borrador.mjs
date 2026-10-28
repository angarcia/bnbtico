#!/usr/bin/env node
// Borrador de las zonas del Caribe (spec .scratch/ubicacion-por-punto/spec.md, «zones»): lugares (place=city|town|village|
// hamlet|suburb|neighbourhood) y playas (natural=beach) con nombre en la provincia de Limón, según OpenStreetMap. Cada
// elemento se ubica con `place_at` de la base local y se queda solo si cae en un cantón de Limón (701–706). Escribe
// .scratch/ubicacion-por-punto/zonas.md y, con --sql <archivo>, el insert para la migración.
//
// Uso (con `pnpm db:start` arrancado):  node scripts/osm-zonas/borrador.mjs [--from-cache] [--sql <archivo>]
// No corre en CI. Licencia de los datos: ODbL 1.0 (© colaboradores de OpenStreetMap).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = join(repoRoot, "scripts/osm-zonas/.cache");
const outMd = join(repoRoot, ".scratch/ubicacion-por-punto/zonas.md");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "bnbtico-zonas/1.0 (+https://bnbtico.com)";
const QUERY = `[out:json][timeout:180];
area["ISO3166-2"="CR-L"]->.lim;
( node(area.lim)[place~"^(city|town|village|hamlet|suburb|neighbourhood)$"][name];
  nwr(area.lim)[natural=beach][name]; );
out center tags;`;
const BACKOFF_S = [30, 60, 120, 240];

const LIMON_CANTONS = new Set(["701", "702", "703", "704", "705", "706"]);
const BEACH_NEAR_PLACE_M = 1500; // «Playa X» a 1,5 km o menos de un lugar «X»: sobra
const SAME_NAME_M = 1000; // mismo nombre a 1 km o menos: uno solo
const SAME_BEACH_M = 2000; // dos playas con el mismo nombre (nodo y vía de la misma playa): 2 km
const INCLUDE_TYPES = new Set(["city", "town", "village", "suburb", "beach"]); // el resto (hamlet, neighbourhood): «revisar»

// Las que tienen que estar sí o sí, con el punto de FREQUENT_ZONES (apps/app/src/domain/zones.ts) donde lo hay: entre
// varias con el mismo nombre se queda con el id base la más cercana a ese punto. Si OSM no la trae, entra a mano.
const REQUIRED = [
  { name: "Puerto Viejo", canton: "704", lat: 9.656, lng: -82.754 },
  { name: "Playa Negra", canton: "704", lat: 9.658, lng: -82.772 },
  { name: "Cocles", canton: "704", lat: 9.6438, lng: -82.7306 },
  { name: "Playa Chiquita", canton: "704", lat: 9.6374, lng: -82.7037 },
  { name: "Punta Uva", canton: "704", lat: 9.6409, lng: -82.6863 },
  { name: "Manzanillo", canton: "704", lat: 9.6317, lng: -82.6572 },
  { name: "Cahuita", canton: "704", lat: 9.7385, lng: -82.8408 },
  { name: "Hone Creek", canton: "704" },
  { name: "Bribrí", canton: "704" },
  { name: "Limón centro", canton: "701", lat: 9.9932, lng: -83.0298 },
];

const args = process.argv.slice(2);
const fromCache = args.includes("--from-cache");
const sqlArg = args.indexOf("--sql");
const sqlOut = sqlArg >= 0 ? args[sqlArg + 1] : null;

// ---------- base local ----------
function dbContainer() {
  const id = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(join(repoRoot, "supabase/config.toml"), "utf8"))?.[1] ?? "bnbtico";
  return `supabase_db_${id}`;
}
function sql(query) {
  return execFileSync("docker", ["exec", "-i", dbContainer(), "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tAq", "-F", "\t"], {
    input: query,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

// ---------- descarga ----------
async function download(file) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: QUERY }),
    });
    if (res.ok) {
      const text = await res.text();
      JSON.parse(text);
      writeFileSync(file, text);
      return;
    }
    if (![429, 502, 503, 504].includes(res.status) || attempt >= BACKOFF_S.length) throw new Error(`Overpass respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    console.error(`Overpass ${res.status}; reintento en ${BACKOFF_S[attempt]} s`);
    await new Promise((r) => setTimeout(r, BACKOFF_S[attempt] * 1000));
  }
}

async function loadOverpass() {
  mkdirSync(cacheDir, { recursive: true });
  let file;
  if (fromCache) {
    const cached = readdirSync(cacheDir).filter((f) => /^overpass-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
    if (!cached) throw new Error(`--from-cache: no hay overpass-<fecha>.json en ${cacheDir}`);
    file = join(cacheDir, cached);
  } else {
    file = join(cacheDir, `overpass-${new Date().toISOString().slice(0, 10)}.json`);
    if (!existsSync(file)) {
      console.error("Descargando de Overpass…");
      await download(file);
    }
  }
  return { date: /overpass-(\d{4}-\d{2}-\d{2})\.json$/.exec(file)[1], data: JSON.parse(readFileSync(file, "utf8")) };
}

// ---------- utilidades ----------
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function meters(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const beachBase = (name) => /^playa (de |del |de la )?(.+)$/i.exec(name.trim())?.[2];
const md = (s) => String(s).replace(/\|/g, "\\|");
const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** place_at de muchos puntos en una sola consulta: índice → { canton_code, canton, district }. */
function placeAll(points) {
  if (!points.length) return [];
  const values = points.map((p, i) => `(${i}, ${p.lat}, ${p.lng})`).join(",\n");
  const out = sql(`select v.i, left(p.district_code, 3), p.canton, p.district
    from (values ${values}) v(i, lat, lng) cross join lateral public.place_at(v.lat, v.lng) p;`);
  const res = new Array(points.length).fill(null);
  for (const line of out ? out.split("\n") : []) {
    const [i, canton_code, canton, district] = line.split("\t");
    res[Number(i)] = { canton_code, canton, district };
  }
  return res;
}

// ---------- principal ----------
const { date, data } = await loadOverpass();

// 1. Sin nombre fuera; ubicar cada elemento y quedarse con los cantones de Limón.
let items = data.elements
  .filter((e) => e.tags?.name?.trim())
  .map((e) => ({
    osm: `${e.type}/${e.id}`,
    type: e.tags.place ?? "beach",
    name: e.tags.name.trim(),
    lat: Number((e.lat ?? e.center.lat).toFixed(6)),
    lng: Number((e.lon ?? e.center.lon).toFixed(6)),
  }));
const placed = placeAll(items);
const outsideLimon = items.filter((_, i) => !placed[i] || !LIMON_CANTONS.has(placed[i].canton_code)).length;
items = items.map((it, i) => ({ ...it, ...placed[i] })).filter((it) => it.canton_code && LIMON_CANTONS.has(it.canton_code));

// 2. «Limón» (city) → «Limón centro».
for (const it of items) if (it.type === "city" && norm(it.name) === "limon") it.name = "Limón centro";

// 3. Playas «Playa X» / «Playa de X» a 1,5 km o menos de un lugar «X».
const places = items.filter((it) => it.type !== "beach");
let droppedBeaches = 0;
items = items.filter((it) => {
  if (it.type !== "beach") return true;
  const base = beachBase(it.name);
  const near = base && places.some((p) => norm(p.name) === norm(base) && meters(p, it) <= BEACH_NEAR_PLACE_M);
  if (near) droppedBeaches++;
  return !near;
});

// 4. Mismo nombre normalizado a 1 km o menos (2 km entre dos playas): uno solo, el lugar antes que la playa.
const required = new Map(REQUIRED.map((r) => [norm(r.name), r]));
const rank = (it) => (it.type === "beach" ? 1 : 0);
items.sort((a, b) => rank(a) - rank(b) || a.osm.localeCompare(b.osm));
const kept = [];
let dupes = 0;
for (const it of items) {
  const same = kept.find((k) => norm(k.name) === norm(it.name) && meters(k, it) <= (k.type === "beach" && it.type === "beach" ? SAME_BEACH_M : SAME_NAME_M));
  if (!same) kept.push(it);
  else {
    dupes++;
    // Entre dos playas iguales de una zona obligatoria, la más cercana a su punto conocido.
    const r = required.get(norm(it.name));
    if (r?.lat != null && same.type === it.type && meters(it, r) < meters(same, r)) kept[kept.indexOf(same)] = it;
  }
}
items = kept;

// 5. Las obligatorias: si falta alguna en su cantón, a mano con el punto conocido (comprobado con place_at).
const missing = REQUIRED.filter((r) => !items.some((it) => norm(it.name) === norm(r.name) && it.canton_code === r.canton));
if (missing.some((r) => r.lat == null)) throw new Error(`Faltan en OSM y no hay punto conocido: ${missing.filter((r) => r.lat == null).map((r) => r.name).join(", ")}`);
const manualPlaced = placeAll(missing);
missing.forEach((r, i) => {
  const p = manualPlaced[i];
  if (!p || p.canton_code !== r.canton) throw new Error(`${r.name} a mano: place_at no da el cantón ${r.canton} en ${r.lat}, ${r.lng}`);
  items.push({ osm: "manual", type: "manual", name: r.name, lat: r.lat, lng: r.lng, ...p });
});

// 6. Ids «<cantón>-<slug>»: el id base para la obligatoria (la más cercana a su punto), luego por cantón, nombre y OSM.
const isRequiredHit = (it) => {
  const r = required.get(norm(it.name));
  return r && r.canton === it.canton_code;
};
const distToRequired = (it) => {
  const r = required.get(norm(it.name));
  return r?.lat != null ? meters(it, r) : 0;
};
items.sort(
  (a, b) =>
    a.canton_code.localeCompare(b.canton_code) ||
    norm(a.name).localeCompare(norm(b.name)) ||
    Number(isRequiredHit(b)) - Number(isRequiredHit(a)) ||
    distToRequired(a) - distToRequired(b) ||
    a.osm.localeCompare(b.osm),
);
const used = new Set();
for (const it of items) {
  if (it.name.length > 60) throw new Error(`Nombre de más de 60 caracteres: ${it.name}`);
  const base = `${it.canton_code}-${slug(it.name)}`;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  if (!/^[1-7][0-9]{2}-[a-z0-9-]+$/.test(id)) throw new Error(`id inválido: ${id}`);
  used.add(id);
  it.id = id;
  it.include = INCLUDE_TYPES.has(it.type) || it.type === "manual" || (isRequiredHit(it) && id === base) ? "sí" : "revisar";
}

for (const r of REQUIRED) {
  const id = `${r.canton}-${slug(r.name)}`;
  if (!used.has(id)) throw new Error(`Falta la zona obligatoria ${id}`);
}

// ---------- zonas.md ----------
const review = items.filter((it) => it.include === "revisar").length;
const byCanton = {};
for (const it of items) byCanton[it.canton] = (byCanton[it.canton] ?? 0) + 1;
const lines = [
  "# Zonas del Caribe (borrador de OpenStreetMap)",
  "",
  "> **Status: borrador cargado sin revisar (Daniel no disponible el 2026-10-27). Revisar antes del lanzamiento; los cambios van en una migración nueva.**",
  "",
  "**Borrador sin revisar por Daniel.** Se carga entero en `public.zones` (migración `*_zonas.sql`), también las filas «revisar»: la marca vive aquí, no en la base.",
  "",
  `Generado con \`node scripts/osm-zonas/borrador.mjs\` a partir de OpenStreetMap (Overpass, ${date}; © colaboradores de OpenStreetMap, ODbL 1.0).`,
  "",
  "## Origen y limpieza",
  "",
  "- Consulta: nodos `place=city|town|village|hamlet|suburb|neighbourhood` y `natural=beach` (nodo, vía o relación; el centro) con nombre dentro de `ISO3166-2=CR-L`. **`city` y `town` se añaden a la lista de la spec** para que entren Limón, Guápiles, Siquirres y Bribrí.",
  "- Cada punto se ubica con `place_at` de la base local; solo quedan los cantones 701–706 (Limón, Pococí, Siquirres, Talamanca, Matina, Guácimo). Lo que cae en el mar a más de 500 m (islas, arrecifes) o fuera de Limón no entra.",
  "- Fuera los elementos sin nombre.",
  "- Fuera las playas «Playa X» (o «Playa de X») a 1,5 km o menos de un lugar «X».",
  "- Mismo nombre normalizado (sin tildes ni mayúsculas) a 1 km o menos: uno solo, el `place` antes que la playa. Entre dos playas con el mismo nombre, 2 km (el nodo y la vía de una misma playa).",
  "- El nodo `place=city` «Limón» pasa a llamarse «Limón centro».",
  "- Obligatorias: Puerto Viejo, Playa Negra, Cocles, Playa Chiquita, Punta Uva, Manzanillo, Cahuita, Hone Creek, Bribrí y Limón centro. Si OSM no trae alguna, entra a mano (`OSM` = `manual`) con el punto de `FREQUENT_ZONES`, comprobado con `place_at`. Entre varias con su nombre, el id base es para la más cercana a ese punto.",
  "- Id: `<cantón>-<nombre sin tildes>`; si se repite en el cantón, `-2`, `-3`…",
  "- **Incluir:** «sí» para city, town, village, suburb, playas y las obligatorias; «revisar» para hamlet y neighbourhood (caseríos, fincas y barrios: muchos sobran o se repiten).",
  "",
  `Resultado: **${items.length} zonas (${review} para revisar)**. Descartados: ${outsideLimon} fuera de los cantones de Limón, ${droppedBeaches} playas junto a su pueblo, ${dupes} repetidos.`,
  "",
  `Por cantón: ${Object.entries(byCanton).sort().map(([c, n]) => `${c} ${n}`).join(", ")}.`,
  "",
  "| id | Zona | Cantón | Distrito | lat | lng | OSM | Incluir |",
  "|---|---|---|---|---|---|---|---|",
  ...items.map((it) => `| ${it.id} | ${md(it.name)} | ${md(it.canton)} | ${md(it.district)} | ${it.lat} | ${it.lng} | ${it.osm === "manual" ? "manual" : `${it.osm} (${it.type})`} | ${it.include} |`),
  "",
];
writeFileSync(outMd, lines.join("\n"));

if (sqlOut) {
  const values = items.map((it) => `  (${sqlText(it.id)}, ${sqlText(it.name)}, '${it.canton_code}', extensions.ST_SetSRID(extensions.ST_MakePoint(${it.lng}, ${it.lat}), 4326))`);
  writeFileSync(sqlOut, `insert into public.zones (id, name, canton_code, point) values\n${values.join(",\n")};\n`);
}

console.log(`${items.length} zonas (${review} para revisar)`);
