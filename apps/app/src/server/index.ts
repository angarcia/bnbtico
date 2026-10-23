import { createAnonListings } from "../data/postgrest/client";
import { createTelemetryWriter } from "../data/postgrest/telemetry";
import { createApp, type CacheLike, type Env } from "./app";
import { runDaily } from "./cron";

export type { Env } from "./app";

const telemetry = (env: Env) => (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_URL ? createTelemetryWriter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, (i, init) => fetch(i, init)) : null);

const app = createApp({
  listings: (env) => createAnonListings(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
  cache: () => (typeof caches === "undefined" ? null : ((caches as unknown as { default: CacheLike }).default ?? null)),
  purgeFetch: (input, init) => fetch(input, init),
  telemetry,
  // `vite dev` inyecta scripts en línea (React Refresh): la CSP solo se envía en el build (preview y despliegue).
  securityHeaders: !import.meta.env.DEV,
});

export default {
  fetch: app.fetch,
  // Se espera (sin waitUntil): si el keep-alive falla, la ejecución queda como fallida en el panel de Cloudflare.
  async scheduled(controller: { cron: string }, env: Env) {
    await runDaily(env, { fetch: (i, init) => fetch(i, init), log: (l) => console.log(l), now: () => Date.now(), telemetry: telemetry(env) }, controller.cron);
  },
};
