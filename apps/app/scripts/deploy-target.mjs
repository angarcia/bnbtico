import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const targets = new Map([
  ["production", { name: "3bstays-production", routes: [{ pattern: "3bstays.com", custom_domain: true }], workers_dev: false, preview_urls: false }], // triggers: los fija «schedule» (Airbnb)
  ["pruebas", { name: "3bstays-pruebas", routes: [{ pattern: "pruebas.3bstays.com", custom_domain: true }], workers_dev: true, preview_urls: true }], // triggers: los fija «schedule» (Airbnb)
  ["refactor", { name: "3bstays-refactor", routes: [{ pattern: "refactor.3bstays.com", custom_domain: true }], workers_dev: false, preview_urls: false, triggers: { crons: [] } }],
]);
const branches = new Map([
  ["main", "production"],
  ["develop", "pruebas"],
  ["refactor/limpieza-segura", "refactor"],
]);
const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Cada cuánto se leen los calendarios de Airbnb (2026-11-17). Igual que src/domain/airbnb-schedule.ts; la prueba
// tests/unit/airbnb-schedule.test.ts compara las dos traducciones con el comando «cron» de abajo.
const SYNC_MINUTES = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440];
const DEFAULT_SYNC_MINUTES = 180;
const SYNC_RANGE = { pruebas: [5, 1440], production: [60, 1440] };
const SYNC_VARIABLE = { pruebas: "AIRBNB_SYNC_MINUTES_PRUEBAS", production: "AIRBNB_SYNC_MINUTES_PRODUCCION" };
const HOURLY_CRON = "17 * * * *";
function airbnbCron(minutes) {
  if (minutes < 60) return `*/${minutes} * * * *`;
  if (minutes === 1440) return "17 0 * * *";
  const hours = minutes / 60;
  return hours === 1 ? HOURLY_CRON : `17 */${hours} * * *`;
}
const cronsFor = (minutes) => [...new Set([HOURLY_CRON, airbnbCron(minutes)])];

/** Los minutos de la variable del entorno: vacía, los de siempre; fuera de la lista o del rango, el despliegue falla. */
function syncMinutes(target, raw) {
  const value = (raw ?? "").trim();
  if (value === "") return DEFAULT_SYNC_MINUTES;
  const [min, max] = SYNC_RANGE[target];
  const minutes = /^\d+$/.test(value) ? Number(value) : NaN;
  ensure(SYNC_MINUTES.includes(minutes) && minutes >= min && minutes <= max,
    `${SYNC_VARIABLE[target]} no es válida: use uno de ${SYNC_MINUTES.filter((m) => m >= min && m <= max).join(", ")} minutos.`);
  return minutes;
}

function select() {
  const env = process.env;
  const result = { environment: "", build: "false", publish: "none" };
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    // Lanzado a mano solo verifica (deploy exige push o pull request; los trabajos de verificación no llevan secretos), así
    // que vale en cualquier rama: sirve para probar un cambio de CI antes de juntarlo (2026-11-16). Sin opciones: desde
    // que las e2e van en un solo trozo ya no hay particiones que elegir.
    const inputs = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).inputs ?? {};
    ensure(env.GITHUB_REF?.startsWith("refs/heads/") && env.GITHUB_REF.length > "refs/heads/".length, "Rama de verificación desconocida.");
    ensure(typeof inputs === "object" && Object.keys(inputs).length === 0, "La verificación manual no admite opciones.");
  } else if (env.GITHUB_EVENT_NAME === "push" && env.GITHUB_REF?.startsWith("refs/heads/")) {
    const target = branches.get(env.GITHUB_REF.slice("refs/heads/".length));
    if (target) Object.assign(result, { environment: target, build: "true", publish: "deploy" });
  } else if (env.GITHUB_EVENT_NAME === "pull_request") {
    const pr = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).pull_request;
    if (pr?.head?.ref && branches.has(pr?.base?.ref)) {
      const refactor = pr.head.ref.startsWith("refactor/") || pr.base.ref === "refactor/limpieza-segura";
      result.environment = refactor ? "refactor" : "pruebas";
      if (env.GITHUB_REPOSITORY && pr.head.repo?.full_name === env.GITHUB_REPOSITORY) {
        result.build = "true";
        result.publish = refactor ? "none" : "preview";
      }
    }
  }
  appendFileSync(env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(""));
}

function validate(file) {
  const target = process.env.DEPLOY_ENV;
  const expected = targets.get(target);
  ensure(expected, "Destino de despliegue no autorizado.");
  const config = JSON.parse(readFileSync(file, "utf8"));
  ensure(config.targetEnvironment === target, "El build pertenece a otro entorno.");
  for (const [key, value] of Object.entries(expected)) {
    ensure(isDeepStrictEqual(config[key], value), `Configuración de destino incorrecta: ${key}.`);
  }
  ensure(config.vars?.ENVIRONMENT === (target === "production" ? "production" : "pruebas"), "ENVIRONMENT incorrecto.");
  if (SYNC_RANGE[target]) {
    // Lo escribió «schedule»: el cron de Airbnb tiene que ser el de esos minutos.
    const minutes = syncMinutes(target, config.vars.AIRBNB_SYNC_MINUTES);
    ensure(isDeepStrictEqual(config.triggers, { crons: cronsFor(minutes) }), "Configuración de destino incorrecta: triggers.");
  }
  if (target === "refactor") {
    ensure(isDeepStrictEqual(config.vars, {
      ENVIRONMENT: "pruebas",
      SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co",
      LISTING_CACHE: "no-store",
    }), "Variables del refactor fuera de la lista permitida.");
    ensure(process.env.VITE_SUPABASE_URL === config.vars.SUPABASE_URL, "Cliente y Worker deben usar el mismo Supabase.");
  } else {
    ensure(config.vars.LISTING_CACHE === undefined, "El entorno habitual debe conservar su caché.");
  }
}

// Límites de las lecturas manuales de Airbnb (2026-11-17): los aplica la base (airbnb_settings), así que este paso los
// valida y los escribe allí con la clave de servicio. Igual que AIRBNB_MANUAL_LIMIT_RANGE en src/domain/airbnb.ts.
const LIMITS = [
  { key: "p_wait_minutes", env: "AIRBNB_MANUAL_WAIT_MINUTES", fallback: 15, min: 1, max: 60, unit: "minutos" },
  { key: "p_per_day", env: "AIRBNB_MANUAL_PER_DAY", fallback: 10, min: 1, max: 50, unit: "lecturas al día" },
];
const LIMIT_SUFFIX = { pruebas: "PRUEBAS", production: "PRODUCCION" };

function manualLimits(target) {
  return Object.fromEntries(LIMITS.map(({ key, env, fallback, min, max, unit }) => {
    const value = (process.env[env] ?? "").trim();
    if (value === "") return [key, fallback];
    const n = /^\d+$/.test(value) ? Number(value) : NaN;
    ensure(n >= min && n <= max, `${env}_${LIMIT_SUFFIX[target]} no es válida: use de ${min} a ${max} ${unit}.`);
    return [key, n];
  }));
}

/** Antes de publicar: valida los límites y, en pruebas, los escribe en la base. Producción aún no tiene base propia. */
async function limits() {
  const target = process.env.DEPLOY_ENV;
  ensure(targets.has(target), "Destino de despliegue no autorizado.");
  if (!LIMIT_SUFFIX[target]) return;
  const values = manualLimits(target);
  const summary = `espera ${values.p_wait_minutes} min, ${values.p_per_day} al día`;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (target === "production" || !url || !key) {
    console.log(`Límites manuales de Airbnb válidos (${summary}); no se escriben: ${target === "production" ? "producción aún no tiene base" : "faltan SUPABASE_URL o la clave de servicio"}.`);
    return;
  }
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/set_airbnb_manual_limits`, {
    method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(values),
  });
  ensure(response.ok, `No se pudieron guardar los límites manuales de Airbnb (HTTP ${response.status}).`);
  console.log(`Límites manuales de Airbnb guardados: ${summary}.`);
}

// Feature flags (historia #58, 2026-11-17). Igual que src/domain/flags.ts; tests/unit/flags.test.ts compara las dos.
// Solo «true», «false» o vacío (= valor inicial). El build las lee del mismo entorno (vite.config.ts) y este paso las
// escribe en la base (feature_flags), donde las consultan las RPCs que no pueden fiarse del navegador.
const FLAGS = [
  { name: "exploreDates", env: "FLAG_EXPLORAR_FECHAS", param: "p_explore_dates", fallback: false },
  { name: "exploreNights", env: "FLAG_EXPLORAR_NOCHES", param: "p_explore_nights", fallback: true },
  { name: "datePrices", env: "FLAG_PRECIOS_POR_FECHA", param: "p_date_prices", fallback: false },
  { name: "externalCalendars", env: "FLAG_ICAL", param: "p_external_calendars", fallback: true },
  { name: "rooms", env: "FLAG_HABITACIONES", param: "p_rooms", fallback: false },
];
const FLAG_SUFFIX = { pruebas: "PRUEBAS", production: "PRODUCCION", refactor: "REFACTOR" };

function featureFlags(target) {
  const bad = FLAGS.filter(({ env }) => !["", "true", "false"].includes((process.env[env] ?? "").trim()));
  ensure(bad.length === 0, `${bad.map(({ env }) => `${env}_${FLAG_SUFFIX[target]}`).join(", ")} no es válida: use «true», «false» o déjela vacía.`);
  return FLAGS.map((flag) => {
    const value = (process.env[flag.env] ?? "").trim();
    return { ...flag, value: value === "" ? flag.fallback : value === "true" };
  });
}

/** Antes de publicar: valida las flags y, en pruebas, las escribe en la base. Producción aún no tiene base propia.
 *  «flags-check» solo imprime los valores (prueba de equivalencia con el dominio). */
async function flags(check) {
  const target = process.env.DEPLOY_ENV;
  ensure(targets.has(target), "Destino de despliegue no autorizado.");
  const values = featureFlags(target);
  if (check) {
    console.log(JSON.stringify(Object.fromEntries(values.map(({ name, value }) => [name, value]))));
    return;
  }
  const summary = values.map(({ env, value }) => `${env}=${value}`).join(", ");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (target !== "pruebas" || !url || !key) {
    const why = target === "production" ? "producción aún no tiene base" : target === "pruebas" ? "faltan SUPABASE_URL o la clave de servicio" : "el refactor no las escribe";
    console.log(`Feature flags válidas (${summary}); no se escriben en la base: ${why}.`);
    return;
  }
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/set_feature_flags`, {
    method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(Object.fromEntries(values.map(({ param, value }) => [param, value]))),
  });
  ensure(response.ok, `No se pudieron guardar las feature flags (HTTP ${response.status}).`);
  console.log(`Feature flags guardadas en la base: ${summary}.`);
}

/** Tras el build: el cron de Airbnb y AIRBNB_SYNC_MINUTES del worker salen de la variable de GitHub del entorno. */
function schedule(file) {
  const target = process.env.DEPLOY_ENV;
  ensure(targets.has(target), "Destino de despliegue no autorizado.");
  if (!SYNC_RANGE[target]) return; // el refactor no tiene crons
  const minutes = syncMinutes(target, process.env.AIRBNB_SYNC_MINUTES);
  const config = JSON.parse(readFileSync(file, "utf8"));
  config.triggers = { crons: cronsFor(minutes) };
  config.vars = { ...config.vars, AIRBNB_SYNC_MINUTES: String(minutes) };
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Airbnb cada ${minutes} minutos: ${airbnbCron(minutes)}.`);
}

function secrets(file) {
  ensure(process.env.DEPLOY_ENV === "refactor", "La lista mínima de secretos solo corresponde al refactor.");
  const anon = process.env.SUPABASE_ANON_KEY;
  ensure(anon?.trim(), "Falta SUPABASE_ANON_KEY.");
  writeFileSync(file, JSON.stringify({ SUPABASE_ANON_KEY: anon }), { mode: 0o600, flag: "wx" });
}

const [command, file] = process.argv.slice(2);
switch (command) {
  case "select": select(); break;
  case "validate": validate(file); break;
  case "secrets": secrets(file); break;
  case "schedule": schedule(file); break;
  case "limits": await limits(); break;
  case "flags": await flags(false); break;
  case "flags-check": await flags(true); break;
  case "cron": console.log(airbnbCron(Number(file))); break;
  default: throw new Error("Comando de despliegue no reconocido.");
}
