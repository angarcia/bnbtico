// Cron diario del worker (triggers.crons en wrangler.jsonc). Hoy: una lectura a PostgREST para que el proyecto gratuito
// de Supabase no se pause por inactividad, el recorte de la telemetría vieja y el tipo de cambio del día (ticket 21). En
// la fase 5, el envío de avisos (outbox).
import { fetchFxRate, type FxRate } from "../domain/fx";
import { landingOnly } from "../domain/seo";
import type { Env } from "./app";

export const TELEMETRY_RETENTION_DAYS = 90;

export interface CronDeps {
  fetch: typeof fetch;
  log(line: string): void;
  now(): number;
  /** Borra la telemetría anterior a `before` y devuelve cuántas filas; null sin clave de servicio. */
  telemetry: { prune(before: string): Promise<number> } | null;
  /** Guarda el tipo de cambio del día con la service role; null (o ausente) sin clave de servicio: no se pide. */
  fx?: { save(rate: FxRate): Promise<void> } | null;
}

/** Pide el tipo a las fuentes (principal y respaldo) y lo guarda. Si fallan todas, no escribe: queda el último guardado.
 *  Nunca lanza: un fallo aquí no debe tapar el keep-alive. */
async function refreshFx(deps: CronDeps): Promise<Record<string, unknown>> {
  const { rate, failures } = await fetchFxRate(deps.fetch);
  if (!rate) return { event: "fx", ok: false, kept: "último guardado", failures };
  try {
    await deps.fx!.save(rate);
  } catch (e) {
    return { event: "fx", ok: false, ...rate, failures, error: String(e) };
  }
  return { event: "fx", ok: true, ...rate, failures };
}

export async function runDaily(env: Env, deps: CronDeps, cron: string): Promise<void> {
  // Producción antes del lanzamiento no tiene Supabase propio todavía: nada que mantener despierto.
  if (landingOnly(env)) {
    deps.log(JSON.stringify({ event: "keepalive", skipped: "solo portada", cron, environment: env.ENVIRONMENT }));
    return;
  }
  const started = deps.now();
  let status = 0;
  let error: string | undefined;
  try {
    const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/listings_public?select=public_id&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    });
    status = res.status;
    await res.body?.cancel();
  } catch (e) {
    error = String(e);
  }
  const ms = deps.now() - started;
  const ok = status >= 200 && status < 300;

  let pruned: number | null = null;
  if (deps.telemetry) {
    try {
      pruned = await deps.telemetry.prune(new Date(started - TELEMETRY_RETENTION_DAYS * 86_400_000).toISOString());
    } catch (e) {
      error = [error, `prune: ${String(e)}`].filter(Boolean).join("; ");
    }
  }

  const fx = deps.fx ? await refreshFx(deps) : null;

  deps.log(JSON.stringify({ event: "keepalive", ok, status, ms, cron, environment: env.ENVIRONMENT, pruned, ...(error ? { error } : {}) }));
  if (fx) deps.log(JSON.stringify(fx));
  if (!ok) throw new Error(`keep-alive a PostgREST falló (${status || error})`);
}
