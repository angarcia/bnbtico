// Casas de prueba para la base LOCAL: `pnpm datos:prueba` (desde la raíz o desde apps/app).
//
// Crea 3 anfitriones, 1 cliente y 10 casas con fotos por el mismo camino que la app: el anfitrión crea el borrador, sube
// las tres variantes de cada foto (480/800/1600) y lo envía a revisión con `submit_listing`; el admin decide con
// `review_listing`. Las casas quedan en estados distintos para probar todas las pantallas:
// 5 activas (una en Guanacaste y una habitación), 1 inactiva, 1 en revisión, 1 con cambios pedidos, 1 rechazada y 1 borrador.
//
// Se puede ejecutar las veces que haga falta: primero borra las casas y fotos que dejó la vez anterior (solo las de estos
// anfitriones). `pnpm test:db` vacía todas las casas de la base: después vuelva a ejecutarlo.
//
// Solo funciona contra Supabase local (127.0.0.1 o localhost). Necesita macOS (`sips` genera las variantes) y Docker.
// Fotos: supabase/datos-de-prueba/fotos (procedencia y licencias en ATRIBUCIONES.md).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = new URL("../../../", import.meta.url).pathname;
const FOTOS = join(root, "supabase/datos-de-prueba/fotos");
const BUCKET = "listings";
const SIZES = [480, 800, 1600];
const CODE = "123456";

const ANFITRIONES = {
  marlen: { phone: "+50688000001", name: "Marlen Prueba" },
  keilor: { phone: "+50688000002", name: "Keilor Prueba" },
  yendry: { phone: "+50688000003", name: "Yendry Prueba" },
};
const CLIENTE = { phone: "+50688000004", name: "Cliente Prueba" };
const ADMIN = { phone: "+50688990001", name: "Admin Prueba" };

const lista = (lat, lng, zone_id) => ({ lat, lng, zone_id, zone: zone_id, zone_source: "list" });

// estado: active | inactive | review | changes | rejected | draft
const CASAS = [
  {
    anfitrion: "marlen", estado: "active", fotos: ["fachada-cocles", "comun-piscina", "comun-sala"],
    casa: {
      title: "Villa Cocles con piscina", kind: "completo", ...lista(9.6475, -82.7365, "704-cocles"),
      capacity: 6, bedrooms: 3, bathrooms: 2, features: ["pool", "wifi", "ac", "parking", "bbq"], parking_paid: false,
      nightly_price_crc: 120000, accepts_monthly: true, monthly_price_crc: 2200000,
      description: "Villa de dos plantas a cinco minutos caminando de Playa Cocles. Piscina privada, rancho con parrilla y jardín con palmeras. Ideal para familias o grupos de amigos.",
    },
  },
  {
    anfitrion: "marlen", estado: "active", fotos: ["fachada-manzanillo", "comun-dormitorio"],
    casa: {
      title: "Cabina en Manzanillo", kind: "completo", ...lista(9.633, -82.656, "704-manzanillo"),
      capacity: 2, bedrooms: 1, bathrooms: 1, features: ["wifi", "pets", "beachfront"],
      nightly_price_crc: 45000, accepts_monthly: false,
      description: "Cabina sencilla frente al mar, a la entrada del refugio de Gandoca-Manzanillo. Se escuchan los monos congos por la mañana. Se aceptan mascotas.",
    },
  },
  {
    anfitrion: "keilor", estado: "active", fotos: ["fachada-playa-negra", "comun-cocina", "comun-dormitorio"],
    casa: {
      title: "Casa blanca en Playa Negra", kind: "completo", ...lista(9.66, -82.77, "704-playa-negra"),
      capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi", "beachfront", "kids_free"],
      nightly_price_crc: 65000, accepts_monthly: true, monthly_price_crc: null,
      description: "Casa de madera pintada de blanco entre cocoteros, a pocos pasos de la arena negra. Cocina equipada y porche con hamacas. Niños pequeños gratis.",
    },
  },
  {
    anfitrion: "keilor", estado: "inactive", fotos: ["fachada-cahuita", "comun-dormitorio"],
    casa: {
      title: "Bungalow en Cahuita", kind: "completo", ...lista(9.7365, -82.842, "704-cahuita"),
      capacity: 2, bedrooms: 1, bathrooms: 1, features: ["wifi", "ac"],
      nightly_price_crc: 38000, accepts_monthly: false,
      description: "Bungalow con hamaca en el corredor, rodeado de jardín, cerca de la entrada del Parque Nacional Cahuita. El anfitrión paró la suscripción: la casa queda inactiva.",
    },
  },
  {
    anfitrion: "yendry", estado: "active", fotos: ["fachada-guanacaste", "comun-piscina", "comun-cocina"],
    casa: {
      title: "Casa de troncos en Tamarindo", kind: "completo", lat: 10.299, lng: -85.836, zone: "Tamarindo", zone_id: null, zone_source: "district",
      capacity: 8, bedrooms: 4, bathrooms: 3, features: ["pool", "parking", "ev", "ac", "bbq"], parking_paid: false,
      nightly_price_crc: 150000, accepts_monthly: false,
      description: "Casa grande de troncos en Guanacaste, fuera del Caribe: sirve para comprobar que su provincia aparece en los filtros de Explorar. Piscina, cargador eléctrico y parqueo.",
    },
  },
  {
    anfitrion: "yendry", estado: "active", fotos: ["fachada-habitacion-bribri", "comun-dormitorio"],
    casa: {
      title: "Habitación en Bribrí", kind: "habitacion", bathroom_shared: true, ...lista(9.626, -82.84, "704-bribri"),
      capacity: 2, bedrooms: 1, bathrooms: 1, features: ["wifi"],
      nightly_price_crc: 18000, accepts_monthly: true, monthly_price_crc: 280000,
      description: "Habitación con entrada propia en una casa de madera en medio del bosque, con baño compartido. Desayuno casero bajo pedido. Acepta alquiler mensual.",
    },
  },
  {
    anfitrion: "marlen", estado: "review", fotos: ["fachada-punta-uva", "comun-sala"],
    casa: {
      title: "Bungalow en Punta Uva", kind: "completo", ...lista(9.641, -82.696, "704-punta-uva"),
      capacity: 3, bedrooms: 1, bathrooms: 1, features: ["beachfront", "wifi", "pets"],
      nightly_price_crc: 55000, accepts_monthly: false,
      description: "Bungalow con hamaca a la sombra, a dos minutos de la playa de Punta Uva. Recién enviado: espera la revisión del admin.",
    },
  },
  {
    anfitrion: "keilor", estado: "changes", nota: "Las fotos no muestran el interior. Añada al menos una del dormitorio y otra del baño.",
    fotos: ["fachada-limon"],
    casa: {
      title: "Casa de madera en Limón", kind: "completo", ...lista(9.993, -83.035, "701-limon-centro"),
      capacity: 5, bedrooms: 2, bathrooms: 1, features: ["parking", "wifi"], parking_paid: true,
      nightly_price_crc: 40000, accepts_monthly: false,
      description: "Casa tradicional de madera con balcón, en el centro de Limón, cerca del parque Vargas y del malecón. El admin pidió cambios en las fotos.",
    },
  },
  {
    anfitrion: "yendry", estado: "rejected", nota: "La descripción incluye un número de teléfono. Quítelo y vuelva a publicar la casa.",
    fotos: ["fachada-hone-creek", "comun-cocina"],
    casa: {
      title: "Casa en la selva, Hone Creek", kind: "completo", ...lista(9.639, -82.826, "704-hone-creek"),
      capacity: 4, bedrooms: 2, bathrooms: 1, features: ["pets", "bbq"],
      nightly_price_crc: 35000, accepts_monthly: false,
      description: "Casa elevada entre árboles, con vista al bosque y rancho con parrilla. El admin la rechazó: sirve para ver el estado «Rechazada».",
    },
  },
  {
    anfitrion: "keilor", estado: "draft", fotos: ["fachada-playa-grande"],
    casa: {
      title: "Casa en Playa Grande", kind: "completo", ...lista(9.752, -82.856, "704-playa-grande"),
      capacity: 4, bedrooms: 2, bathrooms: 1, features: ["wifi"],
      nightly_price_crc: null, accepts_monthly: false,
      description: "",
    },
  },
];

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function localSupabase() {
  let out;
  try {
    out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    fail("Supabase local no está arrancado: pnpm db:start");
  }
  const env = Object.fromEntries(out.split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) fail("Supabase local no está arrancado: pnpm db:start");
  const host = new URL(env.API_URL).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") fail(`Este script solo escribe en Supabase local, no en ${host}.`);
  return { url: env.API_URL, anon: env.ANON_KEY, service: env.SERVICE_ROLE_KEY };
}

const sb = localSupabase();
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(sb.url, sb.service, opts);
const container = `supabase_db_${/^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(join(root, "supabase/config.toml"), "utf8"))?.[1] ?? "bnbtico"}`;

function sql(query) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tAq"], { input: query, encoding: "utf8" }).trim();
}

async function signIn({ phone, name }) {
  const client = createClient(sb.url, sb.anon, opts);
  for (let attempt = 0; ; attempt++) {
    const sent = await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data: { full_name: name } } });
    if (!sent.error) break;
    if (attempt === 5 || !/only request this after|rate/i.test(sent.error.message)) {
      fail(`No se pudo pedir el código de ${phone}: ${sent.error.message}\n  ¿Reinició Supabase tras añadir los números a supabase/config.toml? pnpm db:stop && pnpm db:start`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const { data, error } = await client.auth.verifyOtp({ phone, token: CODE, type: "sms" });
  if (error) fail(`Código rechazado para ${phone}: ${error.message}`);
  return { client, id: data.user.id };
}

const check = (what, { error }) => {
  if (error) fail(`${what}: ${error.message}`);
};

/** Borra las casas (y sus fotos en Storage) de los anfitriones de prueba que dejó una ejecución anterior. */
async function limpiar() {
  const phones = Object.values(ANFITRIONES).map((a) => a.phone);
  const { data: owners } = await service.from("profiles").select("id").in("phone", phones);
  const ids = (owners ?? []).map((o) => o.id);
  if (ids.length === 0) return 0;
  const { data: casas } = await service.from("listings").select("id").in("owner_id", ids);
  const bucket = service.storage.from(BUCKET);
  for (const { id } of casas ?? []) {
    const names = [];
    const { data: carpetas } = await bucket.list(id, { limit: 1000 });
    for (const c of carpetas ?? []) {
      if (c.id !== null) names.push(`${id}/${c.name}`);
      else for (const f of (await bucket.list(`${id}/${c.name}`, { limit: 100 })).data ?? []) names.push(`${id}/${c.name}/${f.name}`);
    }
    if (names.length) await bucket.remove(names);
  }
  if (casas?.length) check("borrar casas anteriores", await service.from("listings").delete().in("owner_id", ids));
  return casas?.length ?? 0;
}

/** Las tres variantes de una foto, como las genera el navegador al subir (lado mayor 480, 800 y 1600 px). */
function variantes(foto, dir) {
  const src = join(FOTOS, `${foto}.jpg`);
  if (!existsSync(src)) fail(`Falta la foto ${src}`);
  return Object.fromEntries(
    SIZES.map((size) => {
      const out = join(dir, `${foto}-${size}.jpg`);
      execFileSync("sips", ["-s", "format", "jpeg", "-Z", String(size), src, "--out", out], { stdio: "ignore" });
      return [size, readFileSync(out)];
    }),
  );
}

async function decidir(adminId, listingId, decision, nota = "") {
  // El admin real necesita el segundo código (aal2). Aquí se llama a la misma RPC como ese admin con aal2 en el JWT, sin
  // tocar su factor TOTP: así quien use la app local puede vincular su propia app de autenticación.
  const claims = JSON.stringify({ sub: adminId, role: "authenticated", aal: "aal2" }).replace(/'/g, "''");
  sql(`begin;
select set_config('request.jwt.claims', '${claims}', true);
set local role authenticated;
select public.review_listing('${listingId}', '${decision}', '${nota.replace(/'/g, "''")}');
commit;`);
}

async function main() {
  console.log(`Supabase local: ${sb.url}`);
  const borradas = await limpiar();
  if (borradas) console.log(`Borradas ${borradas} casas de prueba anteriores.`);

  const anfitriones = {};
  for (const [key, a] of Object.entries(ANFITRIONES)) anfitriones[key] = await signIn(a);
  const cliente = await signIn(CLIENTE);
  const admin = await signIn(ADMIN);
  sql(`select public.seed_admin('${ADMIN.phone}');`);

  const dir = mkdtempSync(join(tmpdir(), "bnbtico-fotos-"));
  const cache = {};
  const creadas = [];
  try {
    for (const def of CASAS) {
      const { client, id: owner } = anfitriones[def.anfitrion];
      const ins = await client
        .from("listings")
        .insert({ owner_id: owner, title: "", description: "", province: "Limón", whatsapp_phone: ANFITRIONES[def.anfitrion].phone, accepts_nightly: true, accepts_monthly: false })
        .select("id, public_id")
        .single();
      check(`crear borrador «${def.casa.title}»`, ins);
      const { id, public_id } = ins.data;
      check(`rellenar «${def.casa.title}»`, await client.from("listings").update(def.casa).eq("id", id));

      for (const foto of def.fotos) {
        cache[foto] ??= variantes(foto, dir);
        const folder = `${id}/${randomUUID()}`;
        for (const size of SIZES) {
          check(`subir ${foto} (${size})`, await client.storage.from(BUCKET).upload(`${folder}/${size}.jpg`, cache[foto][size], { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }));
        }
        check(`añadir ${foto}`, await client.rpc("add_listing_photo", { p_listing: id, p_path: folder }));
      }

      if (def.estado !== "draft") {
        check(`enviar «${def.casa.title}»`, await client.rpc("submit_listing", { p_listing: id }));
        if (def.estado === "changes" || def.estado === "rejected") decidir(admin.id, id, def.estado === "changes" ? "changes" : "reject", def.nota);
        if (def.estado === "active" || def.estado === "inactive") decidir(admin.id, id, "approve");
        if (def.estado === "inactive") check(`parar la suscripción de «${def.casa.title}»`, await client.rpc("stop_subscription", { p_listing: id }));
      }
      const { data } = await service.from("listings").select("status").eq("id", id).single();
      creadas.push({ public_id, title: def.casa.title, anfitrion: ANFITRIONES[def.anfitrion], status: data?.status });
      console.log(`  ${public_id}  ${data?.status.padEnd(8)}  ${def.casa.title}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // El cliente guarda dos casas activas en Favoritos.
  const activas = creadas.filter((c) => c.status === "active").slice(0, 2);
  const { data: favs } = await service.from("listings").select("id").in("public_id", activas.map((c) => c.public_id));
  await service.from("favorites").delete().eq("user_id", cliente.id);
  check("guardar favoritos", await cliente.client.from("favorites").insert((favs ?? []).map((f) => ({ user_id: cliente.id, listing_id: f.id }))));

  console.log(`
Listo: ${creadas.length} casas. Cuentas (código ${CODE}):
  ${ANFITRIONES.marlen.phone.slice(4)}  ${ANFITRIONES.marlen.name}  anfitriona
  ${ANFITRIONES.keilor.phone.slice(4)}  ${ANFITRIONES.keilor.name}  anfitrión
  ${ANFITRIONES.yendry.phone.slice(4)}  ${ANFITRIONES.yendry.name}  anfitriona
  ${CLIENTE.phone.slice(4)}  ${CLIENTE.name}  cliente, con 2 favoritos
  ${ADMIN.phone.slice(4)}  ${ADMIN.name}  admin (la primera vez le pide vincular su app de autenticación)`);
}

main().catch((e) => fail(e?.message ?? String(e)));
