// Worker Hono: la única ruta con SSR (/casa/CT-####), la portada estática, sitemap, robots, purga de la ficha, balizas
// de telemetría y el shell para lo demás.
import { Hono, type Context } from "hono";
import type { PublicListingsApi } from "../domain/api";
import { FX_INITIAL } from "../domain/fx";
import { BEACON_MAX_BYTES, BEACON_TABLE, parseBeacon, type BeaconKind, type BeaconRow, type BeaconTable } from "../domain/telemetry";
import { landingOnly, robotsTxt, shareBase, type Environment } from "../domain/seo";
import { parsePublicId, publicPath, publicUrl } from "../domain/share";
import type { SsrData } from "../shared/ssr-data";
import { escapeHtml, heroLinkHeader, renderDocument } from "./render";
import { securityHeaders } from "../shared/security";
import { registerBilling, type BillingDeps, type PaymentsEnv } from "./billing";

export type Env = {
  ENVIRONMENT: Environment;
  /** Solo producción: "true" abre la app entera; cualquier otro valor (o nada) sirve solo la portada. */
  LAUNCHED?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PURGE_SECRET?: string;
  CF_ZONE_ID?: string;
  CF_PURGE_TOKEN?: string;
  CF_VERSION_METADATA?: { id: string };
  ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
} & PaymentsEnv;

export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/** Escritura de las balizas con la service role (adaptador en src/data/postgrest/telemetry.ts). */
export interface TelemetryWriter {
  insert(table: BeaconTable, row: BeaconRow & { country: string | null }): Promise<void>;
}

export interface Deps {
  listings(env: Env): PublicListingsApi;
  cache(): CacheLike | null;
  purgeFetch: typeof fetch;
  /** null sin clave de servicio: las balizas se aceptan y se descartan. */
  telemetry?(env: Env): TelemetryWriter | null;
  /** CSP y demás cabeceras en el HTML del worker; apagado solo en `vite dev` (inyecta scripts en línea). */
  securityHeaders?: boolean;
  /** Método de pago (src/server/billing.ts): sin esto, sus rutas no existen. */
  billing?: BillingDeps;
}

const LISTING_CACHE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";
const STATUS_CACHE = "public, max-age=0, s-maxage=60";
const SITEMAP_CACHE = "public, max-age=3600, s-maxage=3600";
const LANDING_CACHE = "public, max-age=300, s-maxage=3600";

/** Lo único que responde producción antes del lanzamiento, además de `/`: la portada y lo que ella enlaza. */
const LANDING_FILES = /^\/(robots\.txt|sitemap\.xml|favicon\.ico|og\.jpg|portada\/[\w.-]+|fonts\/[\w.-]+\.woff2|icons\/[\w.-]+\.png)$/;

/** La clave de caché lleva la versión del despliegue: un HTML cacheado nunca apunta a JS de otro despliegue. */
const cacheKey = (origin: string, publicId: string, env: Env) => `${origin}${publicPath(publicId)}?__v=${env.CF_VERSION_METADATA?.id ?? "dev"}`;

/** Comparación en tiempo constante del secreto de purga. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** País de Cloudflare (request.cf o la cabecera CF-IPCountry); solo dos letras, si no null. */
function countryOf(req: Request, header: string | undefined): string | null {
  const value = (req as Request & { cf?: { country?: unknown } }).cf?.country ?? header;
  return typeof value === "string" && /^[A-Z][A-Z0-9]$/.test(value) ? value : null;
}

export function createApp(deps: Deps) {
  const app = new Hono<{ Bindings: Env }>();

  async function template(c: Context<{ Bindings: Env }>) {
    return (await c.env.ASSETS.fetch(new URL("/", c.req.url))).text();
  }

  async function page(c: Context<{ Bindings: Env }>, data: SsrData, status: 200 | 404 | 410 | 503, cacheControl: string) {
    // Las cabeceras van en la respuesta que se guarda en caché: un acierto las lleva igual.
    const security = deps.securityHeaders === false ? {} : securityHeaders({ supabaseUrl: c.env.SUPABASE_URL, turnstile: false });
    const link = data.page === "listing" ? heroLinkHeader(data.listing) : null;
    return c.html(renderDocument(await template(c), data), status, { "cache-control": cacheControl, ...security, ...(link ? { link } : {}) });
  }

  /**
   * Portada estática (public/portada.html; Workers Static Assets la sirve en /portada). CSP propia, más estricta que la del
   * shell: sin Supabase ni Turnstile.
   */
  async function landing(c: Context<{ Bindings: Env }>, status: 200 | 404) {
    const html = await (await c.env.ASSETS.fetch(new URL("/portada", c.req.url))).text();
    const security = deps.securityHeaders === false ? {} : securityHeaders({ turnstile: false });
    return c.html(html, status, { "cache-control": status === 200 ? LANDING_CACHE : STATUS_CACHE, ...security });
  }

  // Producción antes del lanzamiento: todo lo que no sea la portada, robots, sitemap o sus ficheros es 404 con la portada.
  app.use("*", async (c, next) => {
    if (!landingOnly(c.env)) return next();
    const path = new URL(c.req.url).pathname;
    const read = c.req.method === "GET" || c.req.method === "HEAD";
    if (read && (path === "/" || LANDING_FILES.test(path))) return next();
    return landing(c, 404);
  });

  /** Ejecuta trabajo tras responder si hay ExecutionContext; en las pruebas en proceso, antes de responder. */
  async function later(c: Context<{ Bindings: Env }>, work: Promise<unknown>) {
    try {
      c.executionCtx.waitUntil(work);
    } catch {
      await work;
    }
  }

  let warnedNoWriter = false;
  for (const kind of ["vitals", "errors", "events"] as const satisfies readonly BeaconKind[]) {
    app.post(`/${kind}`, async (c) => {
      const origin = c.req.header("origin");
      if (origin && origin !== new URL(c.req.url).origin) return c.body(null, 403);
      if (Number(c.req.header("content-length") ?? 0) > BEACON_MAX_BYTES) return c.body(null, 413);
      const parsed = parseBeacon(kind, await c.req.text());
      if (!parsed.ok) return c.body(null, parsed.status);
      const writer = deps.telemetry?.(c.env) ?? null;
      if (!writer) {
        if (!warnedNoWriter) console.warn(JSON.stringify({ event: "beacon_discarded", reason: "sin SUPABASE_SERVICE_ROLE_KEY" }));
        warnedNoWriter = true;
        return c.body(null, 204);
      }
      const row = { ...parsed.row, country: countryOf(c.req.raw, c.req.header("cf-ipcountry")) };
      await later(
        c,
        writer.insert(BEACON_TABLE[kind], row).catch((error: unknown) => console.error(JSON.stringify({ event: "beacon_write_failed", kind, error: String(error) }))),
      );
      return c.body(null, 204);
    });
  }

  app.get("/robots.txt", (c) => c.text(robotsTxt(c.env.ENVIRONMENT)));

  // `/` es la portada en producción antes del lanzamiento y con `?pronto=1` en cualquier entorno; si no, el shell de la SPA
  // (el router lleva a /explorar).
  app.get("/", (c) => (landingOnly(c.env) || c.req.query("pronto") ? landing(c, 200) : c.env.ASSETS.fetch(c.req.raw)));

  app.get("/sitemap.xml", async (c) => {
    const base = shareBase(c.env.ENVIRONMENT, new URL(c.req.url).origin);
    let entries;
    try {
      entries = landingOnly(c.env) ? [] : await deps.listings(c.env).sitemap();
    } catch (error) {
      console.error("sitemap", error);
      return c.text("No pudimos generar el sitemap.", 503, { "cache-control": "no-store" });
    }
    const urls = [`<url><loc>${escapeHtml(`${base}/`)}</loc></url>`, ...entries.map((e) => `<url><loc>${escapeHtml(publicUrl(e.publicId, base))}</loc><lastmod>${escapeHtml(e.updatedAt.slice(0, 10))}</lastmod></url>`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`;
    return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": SITEMAP_CACHE });
  });

  app.get("/casa/:publicId", async (c) => {
    const raw = c.req.param("publicId");
    const publicId = parsePublicId(raw);
    if (!publicId) return page(c, { page: "missing" }, 404, STATUS_CACHE);
    if (publicId !== raw) return c.redirect(publicPath(publicId), 301);

    const origin = new URL(c.req.url).origin;
    const key = cacheKey(origin, publicId, c.env);
    const cache = deps.cache();
    const hit = await cache?.match(key);
    if (hit) return hit;

    try {
      const api = deps.listings(c.env);
      // A la vez: el calendario y el tipo de cambio no suman vueltas a la base. Si fallan solo los días (un error pasajero,
      // o una base sin la migración del calendario), la ficha sale sin «Disponibilidad»; si falla el tipo, con el inicial.
      // En los dos casos sin caché del borde: la próxima visita lo reintenta.
      const [listing, days, fx] = await Promise.all([api.getPublic(publicId), api.getPublicDays(publicId).catch(() => null), api.fxRate().catch(() => null)]);
      if (!listing) {
        const state = await api.linkState(publicId);
        return state === "blocked" ? page(c, { page: "blocked" }, 410, STATUS_CACHE) : page(c, { page: "missing" }, 404, STATUS_CACHE);
      }
      const complete = days !== null && fx !== null;
      const res = await page(c, { page: "listing", listing, days, fx: fx ?? FX_INITIAL, base: shareBase(c.env.ENVIRONMENT, origin) }, 200, complete ? LISTING_CACHE : "no-store");
      if (cache && complete) await later(c, cache.put(key, res.clone()));
      return res;
    } catch (error) {
      console.error("ficha", publicId, error);
      return page(c, { page: "error" }, 503, "no-store");
    }
  });

  app.post("/_purge/:publicId", async (c) => {
    const secret = c.env.PURGE_SECRET;
    const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!secret || !sameSecret(given, secret)) return c.json({ error: "No autorizado." }, 401);
    const publicId = parsePublicId(c.req.param("publicId"));
    if (!publicId) return c.json({ error: "Id de casa no válido." }, 400);
    const zoned = !!c.env.CF_ZONE_ID && !!c.env.CF_PURGE_TOKEN;
    // En local (vite preview) no hay zona: basta con la caché del worker, y así la base local puede probar la purga.
    if (!zoned && c.env.ENVIRONMENT !== "local") return c.json({ error: "La purga no está configurada." }, 503);
    const key = cacheKey(new URL(c.req.url).origin, publicId, c.env);
    await deps.cache()?.delete(key);
    if (!zoned) return c.json({ purged: key });
    const res = await deps.purgeFetch(`https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${c.env.CF_PURGE_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ files: [key] }),
    });
    return res.ok ? c.json({ purged: key }) : c.json({ error: "Cloudflare rechazó la purga." }, 502);
  });

  if (deps.billing) registerBilling(app, deps.billing, deps.securityHeaders !== false);

  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

