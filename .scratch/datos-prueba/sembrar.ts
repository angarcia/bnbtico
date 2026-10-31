// Siembra datos de prueba en `bnbtico-pruebas` (ref bpxiggdzgzolcazaaboj) por los caminos reales de la app: sesión del
// propietario o del cliente con supabase-js y los adaptadores de apps/app/src/data/postgrest/*. Las decisiones del admin
// van por SQL con las claims de Daniel (aal2), como pide is_admin(). No guarda ni imprime secretos: el token de la CLI
// sale del llavero y las claves de la API de administración.
//
// Compilar y ejecutar (desde la raíz del repo):
//   ESB=$(ls -d node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | head -1)
//   $ESB .scratch/datos-prueba/sembrar.ts --bundle --platform=node --format=esm --outfile=/tmp/sembrar.mjs \
//        --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"
//   NODE_PATH=apps/app/node_modules node /tmp/sembrar.mjs
//
// Idempotente a medias: una casa cuyo nombre ya existe entre las del propietario se salta entera.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createPostgrestOwnerListings } from "../../apps/app/src/data/postgrest/owner";
import { createPostgrestPhotos } from "../../apps/app/src/data/postgrest/photos";
import { createPostgrestCalendar } from "../../apps/app/src/data/postgrest/calendar";
import { createPostgrestInquiries, createPostgrestFavorites } from "../../apps/app/src/data/postgrest/inquiries";
import { createPostgrestOwnerBilling } from "../../apps/app/src/data/postgrest/billing";
import { createPostgrestPlaces } from "../../apps/app/src/data/postgrest/places";
import type { Database } from "../../apps/app/src/domain/database.types";
import type { Feature, Kind, ListingDraft } from "../../apps/app/src/domain/listing";
import type { PhotoVariants } from "../../apps/app/src/domain/api";
import { DESCRIPTIONS } from "./descripciones";

const REF = "bpxiggdzgzolcazaaboj";
if (REF !== "bpxiggdzgzolcazaaboj") throw new Error("Solo bnbtico-pruebas");
const BASE = `https://${REF}.supabase.co`;
const ROOT = process.cwd();
const FOTOS = `${ROOT}/.scratch/datos-prueba/fotos`;
const MANIFEST: Record<string, string[]> = JSON.parse(readFileSync(`${FOTOS}/manifest.json`, "utf8"));

// ---------- acceso (nada de esto se imprime) ----------
let cli = execSync(`security find-generic-password -s "Supabase CLI" -w`).toString().trim();
if (cli.startsWith("go-keyring-base64:")) cli = Buffer.from(cli.slice("go-keyring-base64:".length), "base64").toString();
const mgmt = (path: string, init: RequestInit = {}) =>
  fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, { ...init, headers: { authorization: `Bearer ${cli}`, "content-type": "application/json", "user-agent": "curl/8", ...(init.headers ?? {}) } });
async function sql<T = unknown>(query: string): Promise<T> {
  const r = await mgmt("/database/query", { method: "POST", body: JSON.stringify({ query }) });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}
const keys = (await (await mgmt("/api-keys?reveal=true")).json()) as { name: string; api_key: string }[];
const ANON = keys.find((k) => k.name === "anon")!.api_key;

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const DANIEL = (await sql<{ id: string }[]>(`select id from profiles where phone = '+17783479837'`))[0]!.id;
const admin = (stmt: string) =>
  sql(`begin; set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub','${DANIEL}','role','authenticated','aal','aal2')::text, true); ${stmt}; commit;`);

type Db = SupabaseClient<Database>;
async function login(phone: string): Promise<Db> {
  const db: Db = createClient<Database>(BASE, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await db.auth.signInWithOtp({ phone });
  if (error) throw new Error(`OTP ${phone}: ${error.message}`);
  const v = await db.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (v.error) throw new Error(`verify ${phone}: ${v.error.message}`);
  return db;
}
const apis = (db: Db) => ({
  db,
  own: createPostgrestOwnerListings(db, { supabaseUrl: BASE }),
  photos: createPostgrestPhotos(db, { supabaseUrl: BASE }),
  cal: createPostgrestCalendar(db),
  inq: createPostgrestInquiries(db),
  fav: createPostgrestFavorites(db),
  bill: createPostgrestOwnerBilling(db),
  places: createPostgrestPlaces(db),
});
type Api = ReturnType<typeof apis>;

// ---------- fechas (Costa Rica) ----------
const crToday = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date());
  return p; // YYYY-MM-DD
};
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const TODAY = crToday();
const rangeDays = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

// ---------- fotos ----------
function variantsOf(name: string): PhotoVariants {
  const blob = (size: number) => new Blob([readFileSync(`${FOTOS}/${name}/${size}.jpg`)], { type: "image/jpeg" });
  return { 480: blob(480), 800: blob(800), 1600: blob(1600) };
}
async function uploadAll(a: Api, listingId: string, names: string[]) {
  for (const n of names) {
    const folder = await a.photos.upload(listingId, variantsOf(n));
    await a.photos.add(listingId, folder);
  }
}

// ---------- casas ----------
type Zone = { zoneId: string; name: string } | { other: string } | { district: true };
interface House {
  key: string;
  owner: "yorleny" | "marco";
  title: string;
  kind: Kind;
  lat: number;
  lng: number;
  zone: Zone;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  bathroomShared?: boolean;
  features: Feature[];
  parkingPaid?: boolean;
  nightly: number | null;
  minNights?: number;
  monthly?: { mode: "amount" | "contact"; price: number | null; minMonths?: number };
  /** Estado final buscado. */
  target: "draft" | "review" | "changes" | "rejected" | "active" | "payment_due" | "inactive" | "paused" | "blocked";
  note?: string;
  extra?: "occupied_special" | "closed" | "edit" | "offer_clock" | "occupied_light";
  incompleteDraft?: boolean;
}

const L = (zoneId: string, name: string): Zone => ({ zoneId, name });
const HOUSES: House[] = [
  { key: "a", owner: "yorleny", title: "Casa Cocles frente al mar", kind: "completo", lat: 9.6437, lng: -82.7313, zone: L("704-cocles", "Cocles"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["pool", "beachfront", "wifi", "ac"], nightly: 85000, minNights: 2, target: "active", extra: "occupied_light" },
  { key: "b", owner: "yorleny", title: "Cabaña Manzanillo con rancho", kind: "completo", lat: 9.6302, lng: -82.6588, zone: L("704-manzanillo", "Manzanillo"), capacity: 6, bedrooms: 3, bathrooms: 2, features: ["pets", "bbq", "wifi", "parking"], parkingPaid: false, nightly: 120000, minNights: 3, monthly: { mode: "amount", price: 900000, minMonths: 1 }, target: "active" },
  { key: "c", owner: "yorleny", title: "Loft Puerto Viejo cerca de todo", kind: "completo", lat: 9.6552, lng: -82.7508, zone: L("704-puerto-viejo", "Puerto Viejo"), capacity: 2, bedrooms: 0, bathrooms: 1, features: ["ac", "wifi", "ev"], nightly: 45000, monthly: { mode: "contact", price: null }, target: "active" },
  { key: "d", owner: "marco", title: "Habitación Playa Chiquita", kind: "habitacion", lat: 9.6367, lng: -82.7058, zone: L("704-playa-chiquita", "Playa Chiquita"), capacity: 2, bedrooms: 1, bathrooms: 1, bathroomShared: true, features: ["wifi"], nightly: 25000, target: "active" },
  { key: "e", owner: "marco", title: "Habitación privada en Cahuita", kind: "habitacion", lat: 9.7377, lng: -82.8413, zone: L("704-cahuita", "Cahuita"), capacity: 2, bedrooms: 1, bathrooms: 1, bathroomShared: false, features: ["kids_free", "wifi", "ac"], nightly: 32000, target: "active" },
  { key: "f", owner: "yorleny", title: "Villa Punta Uva en la selva", kind: "completo", lat: 9.6402, lng: -82.6878, zone: L("704-punta-uva", "Punta Uva"), capacity: 10, bedrooms: 5, bathrooms: 4, features: ["pool", "wifi", "parking", "bbq", "ac", "pets"], parkingPaid: true, nightly: 180000, minNights: 2, target: "active", extra: "occupied_special" },
  { key: "g", owner: "marco", title: "Apartamento Limón centro", kind: "completo", lat: 9.9927, lng: -83.0288, zone: { other: "Barrio Roosevelt" }, capacity: 4, bedrooms: 2, bathrooms: 1, features: ["parking", "wifi", "ac"], parkingPaid: false, nightly: 38000, target: "active" },
  { key: "h", owner: "yorleny", title: "Casa Playa Negra tranquila", kind: "completo", lat: 9.6636, lng: -82.7733, zone: L("704-playa-negra", "Playa Negra"), capacity: 5, bedrooms: 2, bathrooms: 2, features: ["wifi", "pets", "bbq"], nightly: 55000, minNights: 2, target: "active", extra: "closed" },
  { key: "i", owner: "marco", title: "Casa Santa Teresa cerca del mar", kind: "completo", lat: 9.6446, lng: -85.1647, zone: { other: "Santa Teresa" }, capacity: 6, bedrooms: 3, bathrooms: 2, features: ["pool", "wifi", "ac", "parking"], parkingPaid: false, nightly: 95000, target: "active" },
  { key: "j", owner: "yorleny", title: "Casa Jaguar Puerto Viejo", kind: "completo", lat: 9.6583, lng: -82.7527, zone: L("704-puerto-viejo", "Puerto Viejo"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi", "ac", "kids_free"], nightly: 60000, target: "active", extra: "offer_clock" },
  { key: "k", owner: "yorleny", title: "Cabina Hone Creek", kind: "completo", lat: 9.6551, lng: -82.8008, zone: L("704-hone-creek", "Hone Creek"), capacity: 0, bedrooms: 0, bathrooms: 0, features: [], nightly: null, target: "draft", incompleteDraft: true },
  { key: "l", owner: "yorleny", title: "Cabaña Hone Creek con jardín", kind: "completo", lat: 9.6546, lng: -82.8013, zone: L("704-hone-creek", "Hone Creek"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi", "parking"], parkingPaid: false, nightly: 48000, target: "review" },
  { key: "m", owner: "yorleny", title: "Casa Playa Bite con hamaca", kind: "completo", lat: 9.6359, lng: -82.6372, zone: L("704-playa-bite", "Playa Bite"), capacity: 3, bedrooms: 1, bathrooms: 1, features: ["wifi"], nightly: 52000, target: "review" },
  { key: "n", owner: "yorleny", title: "Cabina Playa Grande Cahuita", kind: "completo", lat: 9.7561, lng: -82.8670, zone: L("704-playa-grande", "Playa Grande"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi", "beachfront"], nightly: 70000, target: "changes", note: "Necesitamos una foto del baño." },
  { key: "o", owner: "yorleny", title: "Casa Siquirres vista al río", kind: "completo", lat: 10.0972, lng: -83.5084, zone: L("703-siquirres", "Siquirres"), capacity: 6, bedrooms: 3, bathrooms: 2, features: ["wifi", "parking"], parkingPaid: false, nightly: 40000, target: "rejected", note: "Las fotos no corresponden a la casa." },
  { key: "p", owner: "yorleny", title: "Casa Playa Chiquita jardín", kind: "completo", lat: 9.6378, lng: -82.7066, zone: L("704-playa-chiquita", "Playa Chiquita"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi", "bbq"], nightly: 65000, target: "payment_due" },
  { key: "q", owner: "yorleny", title: "Cabaña Pocora junto al río", kind: "completo", lat: 10.1712, lng: -83.6052, zone: L("706-pocora", "Pocora"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["pets", "wifi"], nightly: 35000, target: "inactive" },
  { key: "r", owner: "marco", title: "Casa Cocles con terraza", kind: "completo", lat: 9.6464, lng: -82.7279, zone: L("704-cocles", "Cocles"), capacity: 5, bedrooms: 2, bathrooms: 2, features: ["wifi", "parking", "ac"], parkingPaid: true, nightly: 78000, target: "paused", note: "Confirme que las fotos son de esta casa." },
  { key: "s", owner: "yorleny", title: "Casa Guápiles con piscina", kind: "completo", lat: 10.2147, lng: -83.7922, zone: L("702-guapiles", "Guápiles"), capacity: 8, bedrooms: 4, bathrooms: 3, features: ["pool", "wifi", "ac", "bbq"], nightly: 90000, target: "blocked", note: "Publica un teléfono dentro de las fotos." },
  { key: "t", owner: "yorleny", title: "Casa Punta Uva bambú", kind: "completo", lat: 9.6393, lng: -82.6904, zone: L("704-punta-uva", "Punta Uva"), capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi", "pool"], nightly: 72000, target: "active", extra: "edit" },
];

const results: Record<string, { publicId: string; id: string; status: string; hold: string | null; owner: string; title: string }> = existsSync(`${ROOT}/.scratch/datos-prueba/resultado.json`)
  ? JSON.parse(readFileSync(`${ROOT}/.scratch/datos-prueba/resultado.json`, "utf8"))
  : {};
const save = () => writeFileSync(`${ROOT}/.scratch/datos-prueba/resultado.json`, JSON.stringify(results, null, 1));

const yorleny = apis(await login("+50687770001"));
const marco = apis(await login("+50687770002"));
const client = apis(await login("+50688881234"));
const ownerApi = (h: House) => (h.owner === "yorleny" ? yorleny : marco);

async function build(h: House) {
  const a = ownerApi(h);
  const existing = (await a.own.listOwn()).find((l) => l.title === h.title || (h.key === "t" && l.title === "Casa Punta Uva bambú"));
  if (existing) {
    console.log(`= ${h.key} ya existe: ${existing.publicId}`);
    results[h.key] = { publicId: existing.publicId, id: existing.id, status: existing.status, hold: existing.adminHold?.kind ?? null, owner: h.owner, title: existing.title };
    return;
  }
  const { id, publicId } = await a.own.createDraft();
  const draftPatch = async (step: Parameters<typeof a.own.saveStep>[1], patch: Partial<ListingDraft>) => {
    await a.own.saveStep(id, step, patch);
  };
  await draftPatch(1, { kind: h.kind, acceptsMonthly: !!h.monthly });
  const place = await a.places.placeAt(h.lat, h.lng);
  if (!place) throw new Error(`${h.key}: el punto no cae en tierra`);
  const z = h.zone;
  const zonePatch: Partial<ListingDraft> =
    "zoneId" in z
      ? { zone: z.name, zoneId: z.zoneId, zoneSource: "list" }
      : "other" in z
        ? { zone: z.other, zoneId: null, zoneSource: "other" }
        : { zone: place.district, zoneId: null, zoneSource: "district" };
  await draftPatch(2, { province: place.province, canton: place.canton, district: place.district, lat: h.lat, lng: h.lng, ...zonePatch });
  if (h.incompleteDraft) {
    await draftPatch(6, { title: h.title });
    console.log(`+ ${h.key} ${publicId} borrador incompleto`);
    results[h.key] = { publicId, id, status: "draft", hold: null, owner: h.owner, title: h.title };
    return;
  }
  await draftPatch(4, { capacity: h.capacity, bedrooms: h.bedrooms, bathrooms: h.bathrooms, bathroomShared: h.bathroomShared ?? null });
  await draftPatch(5, { features: h.features, parkingPaid: h.parkingPaid ?? null });
  await draftPatch(6, { title: h.title, description: DESCRIPTIONS[h.key]! });
  const names = MANIFEST[h.key] ?? [];
  await uploadAll(a, id, names);
  await draftPatch(8, {
    nightlyPriceCrc: h.nightly,
    minNights: h.minNights ?? null,
    acceptsMonthly: !!h.monthly,
    monthlyMode: h.monthly?.mode ?? null,
    monthlyPriceCrc: h.monthly?.price ?? null,
    minMonths: h.monthly?.minMonths ?? null,
  });
  await a.own.submit(id);
  console.log(`+ ${h.key} ${publicId} enviada con ${names.length} fotos`);
  results[h.key] = { publicId, id, status: "review", hold: null, owner: h.owner, title: h.title };
  save();

  const t = h.target;
  if (t === "review") return;
  if (t === "changes") await admin(`select review_listing('${id}','changes',${lit(h.note!)})`);
  else if (t === "rejected") await admin(`select review_listing('${id}','reject',${lit(h.note!)})`);
  else await admin(`select review_listing('${id}','approve','')`);
  results[h.key]!.status = t === "changes" || t === "rejected" ? t : "active";
  save();

  // calendario y extras de una casa activa
  if (h.extra === "occupied_light") {
    const from = addDays(TODAY, 12);
    await a.cal.save(id, { days: rangeDays(from, 3), available: false });
    await a.cal.save(id, { days: [addDays(from, 6)], priceCrc: 110000 });
  }
  if (h.extra === "occupied_special") {
    const nextMonth = addDays(TODAY, 30);
    await a.cal.save(id, { days: [...rangeDays(nextMonth, 4), ...rangeDays(addDays(nextMonth, 9), 5), ...rangeDays(addDays(nextMonth, 18), 3)], available: false });
    await a.cal.save(id, { days: [...rangeDays(addDays(nextMonth, 5), 3), addDays(nextMonth, 24), addDays(nextMonth, 25)], priceCrc: 230000 });
    await a.cal.save(id, { days: rangeDays(addDays(TODAY, 3), 2), priceCrc: 150000 });
  }
  if (h.extra === "closed") await a.own.setAvailable(id, false, addDays(TODAY, 21));
  if (h.extra === "edit") {
    await a.own.saveEdit(id, { title: "Casa Punta Uva Bambú Lodge", description: DESCRIPTIONS.t_edit! });
    const folder = await a.photos.upload(id, variantsOf(MANIFEST.t_edit![0]!));
    await a.photos.addEditPhoto(id, folder);
  }
  if (t === "payment_due") {
    await sql(`select test_set_offer_days_left(${lit(publicId)}, -1)`);
    await sql(`select run_subscription_day()`);
    results[h.key]!.status = "payment_due";
  }
  if (t === "inactive") {
    await a.bill.stop(id);
    results[h.key]!.status = "inactive";
  }
  if (t === "paused") {
    await admin(`select admin_pause_listing('${id}',${lit(h.note!)})`);
    results[h.key]!.hold = "paused";
  }
  if (t === "blocked") {
    await admin(`select admin_block_listing('${id}',${lit(h.note!)})`);
    results[h.key]!.hold = "blocked";
  }
  save();
  console.log(`  ${h.key} -> ${t}`);
}

for (const h of HOUSES) {
  try {
    await build(h);
  } catch (e) {
    console.error(`! ${h.key} ${h.title}:`, (e as Error).message);
    save();
    throw e;
  }
}

// ---------- consultas y favoritos del cliente ----------
const pid = (k: string) => results[k]!.publicId;
const nm = addDays(TODAY, 30);
const wants: { key: string; arrival: string | null; departure: string | null; people: number | null; message: string }[] = [
  { key: "a", arrival: addDays(TODAY, 20), departure: addDays(TODAY, 23), people: 3, message: "Hola, me interesa la casa del 20 al 23. ¿Está disponible? Somos 3 personas." },
  { key: "b", arrival: nm, departure: addDays(nm, 30), people: 2, message: "Buenas, queremos alquilar un mes completo, 30 noches. ¿Aceptan mascotas pequeñas?" },
  { key: "f", arrival: addDays(TODAY, 45), departure: addDays(TODAY, 49), people: 8, message: "Hola, somos un grupo de 8 para una celebración familiar. ¿Cuál sería el precio por las 4 noches?" },
  { key: "c", arrival: null, departure: null, people: null, message: "Buenas tardes, ¿el loft tiene escritorio para trabajar remoto?" },
];
for (const w of wants) {
  try {
    await client.inq.create(pid(w.key), { arrival: w.arrival, departure: w.departure, people: w.people, message: w.message } as never);
    console.log(`+ consulta a ${pid(w.key)}`);
  } catch (e) {
    console.error(`! consulta ${w.key}:`, (e as Error).message);
  }
}
await client.fav.addMany([pid("a"), pid("f"), pid("h")]);
console.log("+ favoritos a, f, h");

save();
console.log("listo");
