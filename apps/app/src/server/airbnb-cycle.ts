import type { AirbnbCycleService } from "../domain/airbnb";
import { runAirbnbImport } from "./airbnb";

export const AIRBNB_CRON = "17 */3 * * *";
const MAX_DELAY_MS = 60 * 60_000;
const BATCH_SIZE = 12;

type CycleDeps = { fetch: typeof fetch; now(): number; log(line: string): void };

export async function runAirbnbCycle(service: AirbnbCycleService | null, deps: CycleDeps, cron: string, scheduledTime: number): Promise<void> {
  if (cron !== AIRBNB_CRON) return;
  const date = new Date(scheduledTime);
  if (!Number.isFinite(date.getTime()) || date.getUTCHours() % 3 !== 0 || scheduledTime % 3_600_000 !== 17 * 60_000) return;
  const cycle = date.toISOString();
  const startedAt = deps.now();
  const delayMs = startedAt - scheduledTime;
  const log = (details: Record<string, unknown>) => deps.log(JSON.stringify({ event: "airbnb_cycle", cycle, delayMs, ...details }));
  if (!service || delayMs < 0 || delayMs >= MAX_DELAY_MS) {
    log({ skipped: service ? "outside_window" : "disabled_or_unconfigured" });
    return;
  }

  let due: string[];
  try {
    due = await service.due(cycle);
  } catch {
    log({ phase: "selection", ok: false });
    throw new Error("No se pudieron seleccionar calendarios para el ciclo de Airbnb.");
  }
  const counts = { readOk: 0, readError: 0, skipped: 0, serviceError: 0 };
  for (const listingId of due.slice(0, BATCH_SIZE)) {
    try {
      const requestId = crypto.randomUUID();
      const claim = await service.claimCycle(listingId, requestId, cycle);
      const outcome = claim.run ? await runAirbnbImport(service, listingId, requestId, deps) : "skipped";
      counts[outcome]++;
    } catch {
      counts.serviceError++;
    }
  }
  log({ ...counts, backlog: due.length > BATCH_SIZE, durationMs: deps.now() - startedAt });
  if (counts.serviceError > 0) throw new Error("Falló el servicio de importación durante el ciclo de Airbnb.");
}
