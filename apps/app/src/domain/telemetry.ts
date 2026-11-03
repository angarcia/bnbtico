// Telemetría de primera parte (ticket 11): qué mandan las balizas del navegador y qué acepta el worker. Solo la ruta (sin
// consulta ni fragmento, con los uuid ocultos): nada que identifique a la persona; el país lo añade el worker.
import * as z from "zod/mini";

export type BeaconKind = "vitals" | "errors" | "events";

/** Tope del cuerpo de una baliza: lo que pase de aquí es un error o un abuso, no telemetría. */
export const BEACON_MAX_BYTES = 8 * 1024;

export const PAGE_TYPES = ["inicio", "explorar", "filtros", "buscar", "ficha", "favoritos", "cuenta", "ayuda", "publicar", "propietario", "admin", "otra"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export function pageType(pathname: string): PageType {
  const p = safePath(pathname);
  if (p === "/") return "inicio";
  if (p === "/explorar/filtros") return "filtros";
  if (p === "/explorar/buscar") return "buscar";
  if (p.startsWith("/explorar")) return "explorar";
  if (p.startsWith("/casa/")) return "ficha";
  if (p.startsWith("/favoritos")) return "favoritos";
  if (p.startsWith("/cuenta")) return "cuenta";
  if (p.startsWith("/ayuda")) return "ayuda";
  if (p.startsWith("/propietario/publicar") || p === "/publicar" || p.startsWith("/publicar/")) return "publicar";
  if (p.startsWith("/propietario")) return "propietario";
  if (p.startsWith("/admin")) return "admin";
  return "otra";
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function safePath(raw: string): string {
  let path = raw;
  try {
    path = new URL(raw, "https://x.invalid").pathname;
  } catch {
    path = raw.split(/[?#]/)[0] ?? "/";
  }
  return path.replace(UUID, ":id").slice(0, 200) || "/";
}

const cut = (max: number) => z.pipe(z.string(), z.transform((s: string) => s.slice(0, max)));
const common = { path: z.string().check(z.maxLength(2000)), build: cut(40) };

const vitals = z.object({
  ...common,
  name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]),
  value: z.number().check(z.gte(0), z.lte(600_000)),
  rating: z.optional(z.enum(["good", "needs-improvement", "poor"])),
  id: cut(80),
  navigationType: z.optional(cut(40)),
});

const errors = z.object({
  ...common,
  kind: z.enum(["error", "rejection"]),
  message: cut(500),
  stack: z.optional(cut(4000)),
  source: z.optional(cut(300)),
  line: z.optional(z.int().check(z.gte(0))),
  col: z.optional(z.int().check(z.gte(0))),
  userAgent: z.optional(cut(300)),
});

const PUBLIC_ID = /^CT-\d{4,}$/;
const events = z.object({
  ...common,
  name: z.enum(["page_view", "listing_view", "whatsapp_tap", "inquiry_created", "wizard_step", "search_help_tap", "monthly_filter_tap", "search_submit", "explore_map_open", "map_marker_tap", "publish_verify"]),
  listing: z.optional(z.string().check(z.regex(PUBLIC_ID))),
  /** Solo en search_submit: qué se indicó en la búsqueda, nunca los valores. */
  flags: z.optional(z.array(z.enum(["zona", "fechas", "personas"])).check(z.maxLength(3))),
});
/** Eventos sin casa: los demás la exigen. */
const NO_LISTING: ReadonlySet<string> = new Set(["page_view", "search_help_tap", "monthly_filter_tap", "search_submit", "explore_map_open", "publish_verify"]);

export type VitalsRow = { name: string; value: number; rating?: string; metric_id: string; navigation_type?: string; page: PageType; path: string; build: string };
export type ErrorRow = {
  kind: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  col?: number;
  user_agent?: string;
  page: PageType;
  path: string;
  build: string;
};
export type EventRow = { name: string; search_flags?: string[]; listing_public_id?: string; page: PageType; path: string; build: string };
export type BeaconRow = VitalsRow | ErrorRow | EventRow;

export type ParsedBeacon = { ok: true; row: BeaconRow } | { ok: false; status: 400 | 413 };

const where = (path: string) => ({ page: pageType(path), path: safePath(path) });
const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function parseBeacon(kind: BeaconKind, body: string): ParsedBeacon {
  if (new TextEncoder().encode(body).length > BEACON_MAX_BYTES) return { ok: false, status: 413 };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, status: 400 };
  }
  if (kind === "vitals") {
    const r = vitals.safeParse(json);
    if (!r.success) return { ok: false, status: 400 };
    const v = r.data;
    return { ok: true, row: defined({ name: v.name, value: v.value, rating: v.rating, metric_id: v.id, navigation_type: v.navigationType, ...where(v.path), build: v.build }) };
  }
  if (kind === "errors") {
    const r = errors.safeParse(json);
    if (!r.success) return { ok: false, status: 400 };
    const e = r.data;
    return {
      ok: true,
      row: defined({ kind: e.kind, message: e.message, stack: e.stack, source: e.source, line: e.line, col: e.col, user_agent: e.userAgent, ...where(e.path), build: e.build }),
    };
  }
  const r = events.safeParse(json);
  if (!r.success) return { ok: false, status: 400 };
  const e = r.data;
  // Los de una casa la llevan; la vista de página y los toques de Explorar (ayuda, «Alquiler mensual») no.
  if (!NO_LISTING.has(e.name) && !e.listing) return { ok: false, status: 400 };
  if (e.flags && e.name !== "search_submit") return { ok: false, status: 400 };
  return { ok: true, row: defined({ name: e.name, search_flags: e.flags, listing_public_id: e.listing, ...where(e.path), build: e.build }) };
}

export const BEACON_TABLE = { vitals: "web_vitals", errors: "client_errors", events: "events" } as const;
export type BeaconTable = (typeof BEACON_TABLE)[BeaconKind];
