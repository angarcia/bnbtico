// Worker Hono: la única ruta con SSR (/casa/CT-####), sitemap, robots, purga de la ficha y el shell para lo demás.
import { Hono, type Context } from "hono";
import type { PublicListingsApi } from "../domain/api";
import { robotsTxt, shareBase, type Environment } from "../domain/seo";
import { parsePublicId, publicPath, publicUrl } from "../domain/share";
import type { SsrData } from "../shared/ssr-data";
import { escapeHtml, renderDocument } from "./render";

export type Env = {
  ENVIRONMENT: Environment;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PURGE_SECRET?: string;
  CF_ZONE_ID?: string;
  CF_PURGE_TOKEN?: string;
  CF_VERSION_METADATA?: { id: string };
  ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
};

export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface Deps {
  listings(env: Env): PublicListingsApi;
  cache(): CacheLike | null;
  purgeFetch: typeof fetch;
}

const LISTING_CACHE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";
const STATUS_CACHE = "public, max-age=0, s-maxage=60";
const SITEMAP_CACHE = "public, max-age=3600, s-maxage=3600";

/** La clave de caché lleva la versión del despliegue: un HTML cacheado nunca apunta a JS de otro despliegue. */
const cacheKey = (origin: string, publicId: string, env: Env) => `${origin}${publicPath(publicId)}?__v=${env.CF_VERSION_METADATA?.id ?? "dev"}`;

/** Comparación en tiempo constante del secreto de purga. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createApp(deps: Deps) {
  const app = new Hono<{ Bindings: Env }>();

  async function template(c: Context<{ Bindings: Env }>) {
    return (await c.env.ASSETS.fetch(new URL("/", c.req.url))).text();
  }

  async function page(c: Context<{ Bindings: Env }>, data: SsrData, status: 200 | 404 | 410 | 503, cacheControl: string) {
    return c.html(renderDocument(await template(c), data), status, { "cache-control": cacheControl });
  }

  app.get("/robots.txt", (c) => c.text(robotsTxt(c.env.ENVIRONMENT)));

  app.get("/sitemap.xml", async (c) => {
    const base = shareBase(c.env.ENVIRONMENT, new URL(c.req.url).origin);
    const entries = await deps.listings(c.env).sitemap();
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

    const api = deps.listings(c.env);
    try {
      const listing = await api.getPublic(publicId);
      if (!listing) {
        const state = await api.linkState(publicId);
        return state === "blocked" ? page(c, { page: "blocked" }, 410, STATUS_CACHE) : page(c, { page: "missing" }, 404, STATUS_CACHE);
      }
      const res = await page(c, { page: "listing", listing, base: shareBase(c.env.ENVIRONMENT, origin) }, 200, LISTING_CACHE);
      if (cache) {
        const stored = cache.put(key, res.clone());
        try {
          c.executionCtx.waitUntil(stored);
        } catch {
          await stored; // sin ExecutionContext (pruebas en proceso)
        }
      }
      return res;
    } catch {
      return page(c, { page: "error" }, 503, "no-store");
    }
  });

  app.post("/_purge/:publicId", async (c) => {
    const secret = c.env.PURGE_SECRET;
    const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!secret || !sameSecret(given, secret)) return c.json({ error: "No autorizado." }, 401);
    const publicId = parsePublicId(c.req.param("publicId"));
    if (!publicId) return c.json({ error: "Id de casa no válido." }, 400);
    if (!c.env.CF_ZONE_ID || !c.env.CF_PURGE_TOKEN) return c.json({ error: "La purga no está configurada." }, 503);
    const key = cacheKey(new URL(c.req.url).origin, publicId, c.env);
    await deps.cache()?.delete(key);
    const res = await deps.purgeFetch(`https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${c.env.CF_PURGE_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ files: [key] }),
    });
    return res.ok ? c.json({ purged: key }) : c.json({ error: "Cloudflare rechazó la purga." }, 502);
  });

  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

