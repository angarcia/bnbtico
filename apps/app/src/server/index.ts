import { createBillingService } from "../data/postgrest/billing-service";
import { createAnonListings } from "../data/postgrest/client";
import { createFxWriter } from "../data/postgrest/fx";
import { createTelemetryWriter } from "../data/postgrest/telemetry";
import { parseAllowlist } from "../domain/whatsapp-sender";
import { createApp, type CacheLike, type Env } from "./app";
import { runHourly } from "./cron";
import { reminderBase, sendReminders, senderFromEnv, type ReminderRuntime } from "./reminders";

export type { Env } from "./app";

const log = (line: string) => console.log(line);

const reminders = (env: Env): ReminderRuntime | null => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) return null;
  const { sender, off } = senderFromEnv(env, (i, init) => fetch(i, init), log);
  const service = createBillingService({ supabaseUrl: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, anonKey: env.SUPABASE_ANON_KEY, fetch: (i, init) => fetch(i, init) });
  return { service, sender, allowlist: parseAllowlist(env.WHATSAPP_ALLOWLIST), ...(off ? { off } : {}) };
};

const telemetry = (env: Env) => (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_URL ? createTelemetryWriter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, (i, init) => fetch(i, init)) : null);

const fxWriter = (env: Env) => (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_URL ? createFxWriter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, (i, init) => fetch(i, init)) : null);

const app = createApp({
  listings: (env) => createAnonListings(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
  cache: () => (typeof caches === "undefined" ? null : ((caches as unknown as { default: CacheLike }).default ?? null)),
  purgeFetch: (input, init) => fetch(input, init),
  reminders,
  telemetry,
  // `vite dev` inyecta scripts en línea (React Refresh): la CSP solo se envía en el build (preview y despliegue).
  securityHeaders: !import.meta.env.DEV,
  billing: {
    service: (env) => (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_URL ? createBillingService({ supabaseUrl: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, anonKey: env.SUPABASE_ANON_KEY, fetch: (i, init) => fetch(i, init) }) : null),
    fetch: (i, init) => fetch(i, init),
    now: () => Date.now(),
    log: (l) => console.log(l),
  },
});

export default {
  fetch: app.fetch,
  // Se espera (sin waitUntil): si el keep-alive falla, la ejecución queda como fallida en el panel de Cloudflare.
  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env) {
    const rt = reminders(env);
    const send = rt ? () => sendReminders(rt, { base: reminderBase(env, null), log }) : null;
    await runHourly(env, { fetch: (i, init) => fetch(i, init), log, now: () => Date.now(), telemetry: telemetry(env), fx: fxWriter(env), reminders: send }, controller.cron, controller.scheduledTime);
  },
};
