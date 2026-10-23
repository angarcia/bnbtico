// Variables locales desde `supabase status`: .dev.vars para el worker y .env.local para el navegador (ninguno se versiona).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url).pathname;
const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const env = Object.fromEntries(out.split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
if (!env.API_URL || !env.ANON_KEY) throw new Error("Supabase local no está arrancado: pnpm db:start");

const app = new URL("../", import.meta.url);
writeFileSync(new URL(".dev.vars", app), `SUPABASE_URL=${env.API_URL}\nSUPABASE_ANON_KEY=${env.ANON_KEY}\n`);
writeFileSync(new URL(".env.local", app), `VITE_SUPABASE_URL=${env.API_URL}\nVITE_SUPABASE_ANON_KEY=${env.ANON_KEY}\n`);
console.log(`Variables locales apuntando a ${env.API_URL}`);
