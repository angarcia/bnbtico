import type { Hono } from "hono";
import type { Env } from "./app";
import { serializeManualCalendar, type IcalExportSnapshot } from "../domain/ical-export";

export interface IcalExportDeps {
  read(env: Env, token: string): Promise<IcalExportSnapshot | null>;
  now?: () => number;
}

export const ICAL_EXPORT_HEADERS = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "cdn-cache-control": "no-store",
  "cloudflare-cdn-cache-control": "no-store",
};

/** La ruta pública nunca cae al shell ni admite escrituras, aunque no haya enlaces. */
export function registerIcalExport(app: Hono<{ Bindings: Env }>, deps?: IcalExportDeps) {
  app.all("/ical/*", async c => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return c.text("Método no permitido.", 405, { ...ICAL_EXPORT_HEADERS, allow: "GET, HEAD" });
    }
    const match = /^\/ical\/([a-f0-9]{64})\.ics$/.exec(c.req.path);
    if (!match) return c.text("Calendario no disponible.", 404, ICAL_EXPORT_HEADERS);
    if (!deps) return c.text("Calendario no disponible.", 503, ICAL_EXPORT_HEADERS);
    try {
      const snapshot = await deps.read(c.env, match[1]!);
      if (!snapshot) return c.text("Calendario no disponible.", 404, ICAL_EXPORT_HEADERS);
      const body = serializeManualCalendar(snapshot, (deps.now ?? Date.now)());
      return new Response(c.req.method === "HEAD" ? null : body, { status: 200, headers: {
        ...ICAL_EXPORT_HEADERS, "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="bnbtico.ics"',
      } });
    } catch {
      // Sin error remoto, stack, ruta ni secreto en registros o respuesta. Nunca convertir un fallo en vacío válido.
      return c.text("Calendario no disponible.", 503, ICAL_EXPORT_HEADERS);
    }
  });
}
