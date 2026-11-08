import type { Hono } from "hono";
import type { AirbnbService } from "../domain/airbnb";
import { isRecord } from "../domain/airbnb";
import { DomainError } from "../domain/errors";
import { IcalError, validateAirbnbUrl } from "../domain/ical";
import type { Env } from "./app";
import { readAirbnbCalendar } from "./ical-download";

export interface AirbnbDeps { service(env: Env): AirbnbService | null; fetch: typeof fetch }
const NO_STORE = { "cache-control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Motor único de ingestión: primera conexión, arnés y futuras #7/#8 llaman a este mismo camino. */
export async function runAirbnbImport(service: AirbnbService, listingId: string, requestId: string, download: Pick<AirbnbDeps, "fetch">): Promise<void> {
  const context = await service.context(listingId, requestId);
  if (!context) return;
  try {
    const blocks = await readAirbnbCalendar(context.url, download);
    await service.finish(listingId, requestId, blocks, null);
  } catch (error) {
    // Nada de String(error), stack remoto ni URL en registros/respuesta.
    await service.finish(listingId, requestId, null, error instanceof IcalError ? error.code : "download");
  }
}

export function registerAirbnb(app: Hono<{ Bindings: Env }>, deps: AirbnbDeps) {
  app.post("/api/calendarios/airbnb", async c => {
    c.header("cache-control", "no-store");
    if (c.req.header("origin") && c.req.header("origin") !== new URL(c.req.url).origin) return c.json({ error: "No autorizado." }, 403, NO_STORE);
    const jwt = /^Bearer (\S+)$/.exec(c.req.header("authorization") ?? "")?.[1];
    if (!jwt) return c.json({ error: "Su sesión venció. Ingrese de nuevo." }, 401, NO_STORE);
    const service = deps.service(c.env);
    if (!service) return c.json({ error: "Calendarios no disponibles." }, 503, NO_STORE);
    // Leer con límite real; no confiar solo en Content-Length de un cliente.
    const reader = c.req.raw.body?.getReader();
    if (!reader) return c.json({ error: "Revise los datos del calendario." }, 400, NO_STORE);
    let text = "";
    let size = 0;
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4096) return c.json({ error: "Revise los datos del calendario." }, 413, NO_STORE);
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch { return c.json({ error: "Revise los datos del calendario." }, 400, NO_STORE); }
    finally { try { await reader.cancel(); } catch { /* Sin datos de errores remotos. */ } reader.releaseLock(); }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return c.json({ error: "Revise los datos del calendario." }, 400, NO_STORE); }
    if (!isRecord(raw) || typeof raw.listingId !== "string" || !UUID.test(raw.listingId) || typeof raw.requestId !== "string" || !UUID.test(raw.requestId) || typeof raw.url !== "string") {
      return c.json({ error: "Revise los datos del calendario." }, 400, NO_STORE);
    }
    try {
      const url = validateAirbnbUrl(raw.url);
      const attempt = await service.begin(jwt, raw.listingId, url, raw.requestId);
      if (attempt.run) await runAirbnbImport(service, raw.listingId, raw.requestId, deps);
      const summary = await service.overview(jwt, raw.listingId);
      // Error de lectura no es éxito de conexión aunque la reserva SQL se haya completado.
      if (summary.errorCode) return c.json({ code: summary.errorCode }, 422, NO_STORE);
      return c.json(summary, 200, NO_STORE);
    } catch (error) {
      if (error instanceof IcalError) return c.json({ code: error.code }, 400, NO_STORE);
      if (error instanceof DomainError) return c.json({ error: error.message }, error.kind === "session" ? 401 : 409, NO_STORE);
      return c.json({ error: "No pudimos conectar Airbnb. Intente de nuevo." }, 502, NO_STORE);
    }
  });
}
