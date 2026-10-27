// Variables locales desde `supabase status`: .dev.vars para el worker y .env.local para el navegador (ninguno se versiona).
// La clave de servicio es la local (para que el worker escriba las balizas en Supabase local); Turnstile usa la sitekey de
// prueba de Cloudflare que siempre pasa.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url).pathname;
const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const env = Object.fromEntries(out.split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
if (!env.API_URL || !env.ANON_KEY) throw new Error("Supabase local no está arrancado: pnpm db:start");

const app = new URL("../", import.meta.url);
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
// PURGE_SECRET: el de /_purge en local (las pruebas lo ponen en el Vault local para que pg_net purgue la ficha); se conserva
// entre ejecuciones para no invalidar un vite preview ya arrancado.
const devVars = new URL(".dev.vars", app);
const kept = (name) => (existsSync(devVars) && new RegExp(`^${name}=(.+)$`, "m").exec(readFileSync(devVars, "utf8"))?.[1]) || randomBytes(24).toString("hex");
const purgeSecret = kept("PURGE_SECRET");
// Fase 5: remitente falso de WhatsApp (marca los avisos como enviados con `fake-…`), secreto local del reloj de pruebas
// (/_pruebas/oferta/CT-####) y pasarela de pago falsa (solo vale con ENVIRONMENT=local; firma sus sesiones y eventos con
// FAKE_PAYMENTS_SECRET). Los secretos se conservan entre ejecuciones.
const fase5 = `WHATSAPP_SENDER=fake\nTEST_CLOCK_SECRET=${kept("TEST_CLOCK_SECRET")}\nPAYMENTS=fake\nFAKE_PAYMENTS_SECRET=${kept("FAKE_PAYMENTS_SECRET")}\n`;
writeFileSync(devVars, `SUPABASE_URL=${env.API_URL}\nSUPABASE_ANON_KEY=${env.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}\nPURGE_SECRET=${purgeSecret}\n${fase5}`);
writeFileSync(new URL(".env.local", app), `VITE_SUPABASE_URL=${env.API_URL}\nVITE_SUPABASE_ANON_KEY=${env.ANON_KEY}\nVITE_TURNSTILE_SITE_KEY=${TURNSTILE_TEST_SITE_KEY}\n`);
console.log(`Variables locales apuntando a ${env.API_URL}`);
