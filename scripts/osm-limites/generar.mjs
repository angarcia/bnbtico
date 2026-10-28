#!/usr/bin/env node
// Genera supabase/datos/distritos-osm-<fecha>.sql con los límites de OpenStreetMap de Costa Rica: 7 provincias, 84 cantones
// y 494 distritos (sin «Conte Burica», que es solo un proyecto de ley). Los polígonos se arman en un esquema temporal
// `osm_staging` de la base local (PostGIS) y se comprueban allí antes de escribir el archivo.
//
// Uso (con `pnpm db:start` arrancado):  node scripts/osm-limites/generar.mjs [--from-cache] [--decimals 6|5]
// No corre en CI. Licencia de los datos: ODbL 1.0 (© colaboradores de OpenStreetMap).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = join(repoRoot, "scripts/osm-limites/.cache");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "bnbtico-limites/1.0 (+https://bnbtico.com)";
const QUERY = `[out:json][timeout:900];
area["ISO3166-1"="CR"][admin_level=2]->.cr;
rel(area.cr)[boundary=administrative][admin_level~"^(4|6|8)$"]->.r;
.r out body;
way(r.r);
out geom;`;
const BACKOFF_S = [30, 60, 120, 240];

const CONTE_BURICA = 14365588; // Proyecto de ley, expediente 25.750: no es distrito. Su área es de Pavón.
const CABAGRA = 18957876; // Distrito de 2025 sin postal_code en OSM: el código se asigna a mano.
// postal_code de OSM que no es el código DTA (relación → código DTA). Colorado de Abangares trae 51201 (no existe el cantón 512);
// en la DTA es el 4.º distrito de Abangares (507).
const DISTRICT_CODE_OVERRIDES = { 6289989: "50704" };
const PROVINCE_DIGIT = { "CR-SJ": "1", "CR-A": "2", "CR-C": "3", "CR-H": "4", "CR-G": "5", "CR-P": "6", "CR-L": "7" };
// Nombre de OSM → nombre oficial (el de apps/app/src/domain/cantones.ts), solo si difieren.
const CANTON_NAME_OVERRIDES = { "Coronado": "Vázquez de Coronado", "León Cortés": "León Cortés Castro" };
const MAX_BYTES = 8 * 1024 * 1024;

// ---------- argumentos ----------
const args = process.argv.slice(2);
const fromCache = args.includes("--from-cache");
const decimalsArg = args.indexOf("--decimals");
const decimals = decimalsArg >= 0 ? Number(args[decimalsArg + 1]) : 6;
if (decimals !== 6 && decimals !== 5) throw new Error("--decimals debe ser 6 o 5");

// ---------- base local ----------
function dbContainer() {
  const id = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(join(repoRoot, "supabase/config.toml"), "utf8"))?.[1] ?? "bnbtico";
  return `supabase_db_${id}`;
}
function sql(query) {
  return execFileSync("docker", ["exec", "-i", dbContainer(), "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tAq", "-F", "\t"], {
    input: query,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
const rows = (out) => (out ? out.split("\n").map((l) => l.split("\t")) : []);

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
      JSON.parse(text); // que no sea un error a medias
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
  const date = /overpass-(\d{4}-\d{2}-\d{2})\.json$/.exec(file)[1];
  return { date, data: JSON.parse(readFileSync(file, "utf8")) };
}

// ---------- nombres oficiales de cantones ----------
function officialCantons() {
  const src = readFileSync(join(repoRoot, "apps/app/src/domain/cantones.ts"), "utf8");
  const out = {};
  for (const m of src.matchAll(/^\s*"?([^":\n]+?)"?:\s*\[([^\]]*)\]/gm)) out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (Object.keys(out).length !== 7) throw new Error("No se pudieron leer las 7 provincias de cantones.ts");
  return out;
}

// ---------- staging ----------
const tsv = (v) => String(v).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n");

function stage(data) {
  const rels = data.elements.filter((e) => e.type === "relation");
  const ways = data.elements.filter((e) => e.type === "way");
  const wayLines = ways
    .filter((w) => w.geometry?.length >= 2)
    .map((w) => `${w.id}\tSRID=4326;LINESTRING(${w.geometry.map((p) => `${p.lon} ${p.lat}`).join(",")})`);
  const relLines = rels.map((r) => {
    const t = r.tags ?? {};
    const wayIds = r.members.filter((m) => m.type === "way" && (m.role === "outer" || m.role === "inner" || m.role === "")).map((m) => m.ref);
    return [r.id, Number(t.admin_level), tsv(t.name ?? ""), t.postal_code ? tsv(t.postal_code) : "\\N", t["ISO3166-2"] ? tsv(t["ISO3166-2"]) : "\\N", `{${wayIds.join(",")}}`].join("\t");
  });
  sql(`create schema osm_staging;
create table osm_staging.ways(id bigint primary key, geom extensions.geometry(LineString,4326));
create table osm_staging.rels(id bigint primary key, level int, name text, postal_code text, iso text, way_ids bigint[]);
copy osm_staging.ways(id, geom) from stdin;
${wayLines.join("\n")}
\\.
copy osm_staging.rels(id, level, name, postal_code, iso, way_ids) from stdin;
${relLines.join("\n")}
\\.
`);
}

function build() {
  // Polígono de cada relación a partir de sus vías.
  sql(`set search_path = osm_staging, extensions, public;
create table areas as
  select r.id, r.level, r.name, r.postal_code, r.iso, null::text as code,
         ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_BuildArea(ST_Union(w.geom))), 3)) as geom
  from rels r join ways w on w.id = any(r.way_ids)
  group by r.id, r.level, r.name, r.postal_code, r.iso;
update areas set code = postal_code where level = 8;
${Object.entries(DISTRICT_CODE_OVERRIDES).map(([id, code]) => `update areas set code = '${code}' where id = ${id} and level = 8;`).join("\n")}
update areas set code = case iso ${Object.entries(PROVINCE_DIGIT).map(([iso, d]) => `when '${iso}' then '${d}'`).join(" ")} end where level = 4;
`);
  const missing = sql(`select count(*) from osm_staging.rels r where not exists (select 1 from osm_staging.areas a where a.id = r.id and not ST_IsEmpty(a.geom))`);
  if (missing !== "0") throw new Error(`${missing} relaciones sin polígono`);

  // Conte Burica fuera; su área va a Pavón (el «Pavón» cuyo código empieza por el prefijo del cantón que contiene a Conte Burica).
  const pavon = rows(sql(`set search_path = osm_staging, extensions, public;
with cb as (select geom from areas where id = ${CONTE_BURICA}),
     canton as (select c.id, c.geom from areas c, cb where c.level = 6 and ST_Contains(c.geom, ST_PointOnSurface(cb.geom)))
select d.id, d.code from areas d, canton c
where d.level = 8 and d.name = 'Pavón' and ST_Contains(c.geom, ST_PointOnSurface(d.geom));`));
  if (pavon.length !== 1) throw new Error(`Se esperaba un Pavón en el cantón de Conte Burica; hay ${pavon.length}`);
  const [pavonId, pavonCode] = pavon[0];
  const leftover = Number(sql(`set search_path = osm_staging, extensions, public;
create table conte_burica as select geom from areas where id = ${CONTE_BURICA};
update areas set geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Union(areas.geom, cb.geom)), 3)) from conte_burica cb where areas.id = ${pavonId};
delete from areas where id = ${CONTE_BURICA};
select ST_Area(ST_Difference(cb.geom, p.geom)::geography) from conte_burica cb, areas p where p.id = ${pavonId};`));

  // Código de cada cantón: el prefijo (3 dígitos) de los distritos con código que caen dentro.
  sql(`set search_path = osm_staging, extensions, public;
update areas c set code = x.prefix from (
  select distinct on (c.id) c.id, left(d.code, 3) as prefix
  from areas c join areas d on d.level = 8 and d.code is not null and ST_Contains(c.geom, ST_PointOnSurface(d.geom))
  where c.level = 6 group by c.id, left(d.code, 3) order by c.id, count(*) desc) x
where c.id = x.id;`);

  // Cabagra: prefijo de su cantón + el siguiente número libre.
  const cabagraCode = sql(`set search_path = osm_staging, extensions, public;
with c as (select a.code from areas a, areas cab where cab.id = ${CABAGRA} and a.level = 6 and ST_Contains(a.geom, ST_PointOnSurface(cab.geom))),
     n as (select c.code || lpad((coalesce(max(right(d.code, 2)::int), 0) + 1)::text, 2, '0') as code
           from c left join areas d on d.level = 8 and left(d.code, 3) = c.code group by c.code)
update areas set code = n.code from n where areas.id = ${CABAGRA} returning areas.code;`);
  return { pavonCode, leftover, cabagraCode };
}

function check(official, { leftover }) {
  const fail = [];
  const q = (s) => sql(`set search_path = osm_staging, extensions, public;\n${s}`);
  const counts = Object.fromEntries(rows(q(`select level, count(*) from areas group by level`)));
  if (counts["4"] !== "7") fail.push(`provincias = ${counts["4"]}, se esperaban 7`);
  if (counts["6"] !== "84") fail.push(`cantones = ${counts["6"]}, se esperaban 84`);
  if (counts["8"] !== "494") fail.push(`distritos = ${counts["8"]}, se esperaban 494`);
  const badCodes = q(`select string_agg(coalesce(code, '∅') || ' ' || name, ', ') from areas where level = 8 and (code is null or code !~ '^[1-7][0-9]{4}$')`);
  if (badCodes) fail.push(`códigos de distrito inválidos: ${badCodes}`);
  const dupCodes = q(`select string_agg(code, ', ') from (select code from areas where level = 8 group by code having count(*) > 1) x`);
  if (dupCodes) fail.push(`códigos de distrito repetidos: ${dupCodes}`);
  const cantonCodes = q(`select count(distinct code) || ' ' || count(*) filter (where code is null) from areas where level = 6`);
  if (cantonCodes !== "84 0") fail.push(`prefijos de cantón distintos / sin código: ${cantonCodes}`);
  const outside = q(`select string_agg(d.code || ' ' || d.name, ', ') from areas d join areas c on c.level = 6 and c.code = left(d.code, 3)
    where d.level = 8 and not ST_Contains(c.geom, ST_PointOnSurface(d.geom))`);
  if (outside) fail.push(`distritos fuera del cantón de su prefijo: ${outside}`);
  const orphan = q(`select string_agg(d.code || ' ' || d.name, ', ') from areas d where d.level = 8 and not exists (select 1 from areas c where c.level = 6 and c.code = left(d.code, 3))`);
  if (orphan) fail.push(`distritos sin cantón: ${orphan}`);
  const wrongProvince = q(`select string_agg(c.code || ' ' || c.name || ' en ' || coalesce(p.code, '∅'), ', ') from areas c
    left join areas p on p.level = 4 and ST_Contains(p.geom, ST_PointOnSurface(c.geom))
    where c.level = 6 and left(c.code, 1) is distinct from p.code`);
  if (wrongProvince) fail.push(`cantones en otra provincia: ${wrongProvince}`);
  if (q(`select count(*) from areas where id = ${CONTE_BURICA}`) !== "0") fail.push("Conte Burica sigue en la lista");
  if (!(leftover < 1000)) fail.push(`Conte Burica no quedó dentro de Pavón: ${leftover} m² fuera`);

  const provinces = Object.fromEntries(rows(q(`select code, name from areas where level = 4`)));
  for (const name of Object.values(provinces)) if (!official[name]) fail.push(`provincia desconocida: ${name}`);
  const used = [];
  const cantons = rows(q(`select id, code, name from areas where level = 6`)).map(([id, code, name]) => {
    const fixed = CANTON_NAME_OVERRIDES[name];
    if (fixed) used.push(`${name} → ${fixed}`);
    const official_ = fixed ?? name;
    const province = provinces[code[0]];
    if (!official[province]?.includes(official_)) fail.push(`cantón ${code} «${official_}» no está en CANTONES[${province}]`);
    return { id, code, name: official_ };
  });
  if (fail.length) throw new Error(`Comprobaciones fallidas:\n- ${fail.join("\n- ")}`);
  return { provinces, cantons, overrides: used };
}

function exportFile({ date, provinces, cantons, pavonCode, cabagraCode, overrides }) {
  const districts = rows(sql(`set search_path = osm_staging, extensions, public;
select code, name, ST_AsText(geom, ${decimals}), ST_IsValid(ST_GeomFromText(ST_AsText(geom, ${decimals}))) from areas where level = 8 order by code`));
  const invalidAfterRounding = districts.filter((d) => d[3] !== "t").map((d) => d[0]);
  const districtFixes = Object.entries(DISTRICT_CODE_OVERRIDES).map(([id, code]) => {
    const [name, osmCode] = rows(sql(`select name, postal_code from osm_staging.rels where id = ${id}`))[0];
    return `${name} (relación ${id}) ${osmCode} → ${code}`;
  });
  const lit = (s) => `'${s.replace(/'/g, "''")}'`;
  const names = [
    ...Object.entries(provinces).sort().map(([code, name]) => `(${lit(code)}, 'province', ${lit(name)})`),
    ...cantons.sort((a, b) => a.code.localeCompare(b.code)).map((c) => `(${lit(c.code)}, 'canton', ${lit(c.name)})`),
    ...districts.map(([code, name]) => `(${lit(code)}, 'district', ${lit(name)})`),
  ];
  const header = `-- Límites administrativos de Costa Rica: 7 provincias, 84 cantones y 494 distritos.
-- Fuente: OpenStreetMap, relaciones boundary=administrative admin_level 4/6/8 dentro de ISO3166-1=CR, descargadas de
--   Overpass (${OVERPASS_URL}) el ${date}.
-- Licencia: ODbL 1.0 — © colaboradores de OpenStreetMap; base de datos derivada interna, los polígonos nunca salen de la base.
--   Atribución: «Límites administrativos © colaboradores de OpenStreetMap, disponibles bajo la Open Database License (ODbL)»,
--   https://www.openstreetmap.org/copyright
-- Excluido: «Conte Burica» (relación ${CONTE_BURICA}), solo un proyecto de ley (expediente 25.750); su área se une a Pavón (${pavonCode}).
-- Cabagra (relación ${CABAGRA}) no tiene postal_code en OSM: código ${cabagraCode} asignado a mano (prefijo de su cantón más el
--   siguiente número libre). COMPROBAR contra la División Territorial Administrativa oficial.
-- Código de distrito = postal_code de OSM (código DTA); cantón = 3 primeros dígitos; provincia = el primero.
-- Corregido a mano porque el postal_code de OSM no es el código DTA (COMPROBAR): ${districtFixes.join("; ")}.
${overrides.length ? `-- Nombres de cantón corregidos a la grafía oficial: ${overrides.join("; ")}.\n` : ""}-- Geometría: resolución completa de OSM, sin simplificar; coordenadas redondeadas a ${decimals} decimales por vértice
--   (los bordes compartidos siguen compartidos).${invalidAfterRounding.length ? ` Inválidos tras redondear (los arregla geo.load_district_shape con ST_MakeValid): ${invalidAfterRounding.join(", ")}.` : ""}
-- Regenerar: node scripts/osm-limites/generar.mjs (con pnpm db:start)
-- Requiere la migración que crea geo.admin_names y geo.load_district_shape(p_code text, p_wkt text).
`;
  const body = [
    `insert into geo.admin_names(code, level, name) values\n  ${names.join(",\n  ")};`,
    ...districts.map(([code, , wkt]) => `select geo.load_district_shape(${lit(code)}, '${wkt}');`),
    `do $$ begin
  assert (select count(*) from geo.admin_names where level = 'province') = 7;
  assert (select count(*) from geo.admin_names where level = 'canton') = 84;
  assert (select count(*) from geo.admin_names where level = 'district') = 494;
  assert (select count(distinct code) from geo.district_shapes) = 494;
end $$;`,
  ];
  const out = join(repoRoot, `supabase/datos/distritos-osm-${date}.sql`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${header}\n${body.join("\n")}\n`);
  return { out, bytes: statSync(out).size, invalidAfterRounding };
}

// ---------- main ----------
const { date, data } = await loadOverpass();
const official = officialCantons();
const hadPostgis = sql(`select count(*) from pg_extension where extname = 'postgis'`) === "1";
sql(`drop schema if exists osm_staging cascade;${hadPostgis ? "" : "\ncreate extension postgis with schema extensions;"}`);
try {
  stage(data);
  const fixes = build();
  const checked = check(official, fixes);
  const { out, bytes } = exportFile({ date, ...checked, ...fixes });
  const mb = (bytes / 1024 / 1024).toFixed(2);
  if (checked.overrides.length) console.log(`Nombres corregidos: ${checked.overrides.join("; ")}`);
  console.log(`Cabagra = ${fixes.cabagraCode} (asignado a mano)`);
  console.log(`Códigos corregidos a mano: ${Object.entries(DISTRICT_CODE_OVERRIDES).map(([id, code]) => `${id} → ${code}`).join("; ")}`);
  console.log(`provincias 7 · cantones 84 · distritos 494 · Conte Burica → Pavón (${fixes.pavonCode}) · Cabagra = ${fixes.cabagraCode} · ${mb} MB`);
  console.log(out);
  if (bytes >= MAX_BYTES) {
    console.error(decimals === 6 ? "El archivo pasa de 8 MB: repetir con --decimals 5." : "El archivo pasa de 8 MB aun con 5 decimales: hace falta simplificar con topología (preguntar).");
    process.exitCode = 1;
  }
} finally {
  sql(`drop schema if exists osm_staging cascade;${hadPostgis ? "" : "\ndrop extension if exists postgis;"}`);
}
