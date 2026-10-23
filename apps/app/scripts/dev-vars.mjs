// Variables locales desde `supabase status`: .dev.vars para el worker y .env.local para el navegador (ninguno se versiona).
// La clave de servicio es la local (para que el worker escriba las balizas en Supabase local); Turnstile usa la sitekey de
// prueba de Cloudflare que siempre pasa.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url).pathname;
const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const env = Object.fromEntries(out.split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
if (!env.API_URL || !env.ANON_KEY) throw new Error("Supabase local no está arrancado: pnpm db:start");

const app = new URL("../", import.meta.url);
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
writeFileSync(new URL(".dev.vars", app), `SUPABASE_URL=${env.API_URL}\nSUPABASE_ANON_KEY=${env.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}\n`);
writeFileSync(new URL(".env.local", app), `VITE_SUPABASE_URL=${env.API_URL}\nVITE_SUPABASE_ANON_KEY=${env.ANON_KEY}\nVITE_TURNSTILE_SITE_KEY=${TURNSTILE_TEST_SITE_KEY}\n`);
console.log(`Variables locales apuntando a ${env.API_URL}`);
