// Documento HTML del worker: la plantilla index.html de Vite con la cabecera y el cuerpo de la página inyectados.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe } from "../domain/describe";
import type { PublicListing } from "../domain/listing";
import { SITE_URL } from "../domain/seo";
import { publicUrl } from "../domain/share";
import { ListingScreen } from "../shared/listing-page";
import { seedListing } from "../shared/listing-query";
import { SSR_DATA_ID, type SsrData } from "../shared/ssr-data";
import { BlockedPage, ErrorPage, MissingPage } from "../shared/status-pages";

const HEAD = /<!--app-head-->[\s\S]*?<!--\/app-head-->/;
const ROOT = "<!--app-html-->";

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** JSON dentro de <script type="application/json">: sin «<» no puede cerrar la etiqueta ni abrir un comentario. */
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Tamaño con que se muestra la portada: el mismo en la precarga (HTML y cabecera Link) y en el `<img>` del hero. */
const HERO_SIZES = "100vw";

/**
 * Cabecera `Link` con la precarga de la portada. Cloudflare la convierte en 103 Early Hints: el navegador empieza a
 * pedir la foto (otro origen, Supabase Storage) mientras el worker aún responde. Null si la casa no tiene fotos.
 */
export function heroLinkHeader(l: PublicListing): string | null {
  const cover = l.photos[0];
  if (!cover) return null;
  const srcset = cover.srcSet ? `; imagesrcset="${cover.srcSet}"; imagesizes="${HERO_SIZES}"` : "";
  return `<${cover.url}>; rel=preload; as=image; fetchpriority=high${srcset}`;
}

function listingHead(l: PublicListing): string[] {
  const d = describe(l, { base: SITE_URL });
  const canonical = escapeHtml(publicUrl(l.publicId, SITE_URL));
  const title = escapeHtml(l.title);
  const description = escapeHtml(d.previewText);
  const cover = l.photos[0];
  return [
    `<title>${title} · 3bstays</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="3bstays" />`,
    `<meta property="og:locale" content="es_CR" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    ...(cover ? [`<meta property="og:image" content="${escapeHtml(cover.url)}" />`, `<meta property="og:image:alt" content="${title}" />`] : []),
    `<meta name="twitter:card" content="${cover ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...(cover ? [`<meta name="twitter:image" content="${escapeHtml(cover.url)}" />`] : []),
    ...(cover
      ? [`<link rel="preload" as="image" href="${escapeHtml(cover.url)}" fetchpriority="high"${cover.srcSet ? ` imagesrcset="${escapeHtml(cover.srcSet)}" imagesizes="${HERO_SIZES}"` : ""} />`]
      : []),
  ];
}

const STATUS_HEAD: Record<Exclude<SsrData["page"], "listing">, string> = {
  missing: "Este enlace no existe",
  blocked: "Este enlace ya no está activo",
  error: "No pudimos cargar esta casa",
};

function body(data: SsrData): string {
  if (data.page === "listing") {
    const client = new QueryClient();
    seedListing(client, data.listing, data.days, data.fx);
    return renderToString(
      <QueryClientProvider client={client}>
        <ListingScreen publicId={data.listing.publicId} base={data.base} />
      </QueryClientProvider>,
    );
  }
  if (data.page === "blocked") return renderToString(<BlockedPage reason={data.reason} />);
  const Page = { missing: MissingPage, error: ErrorPage }[data.page];
  return renderToString(<Page />);
}

export function renderDocument(template: string, data: SsrData): string {
  const head =
    data.page === "listing" ? listingHead(data.listing) : [`<title>${STATUS_HEAD[data.page]} · 3bstays</title>`, `<meta name="robots" content="noindex" />`];
  head.push(`<script type="application/json" id="${SSR_DATA_ID}">${jsonForScript(data)}</script>`);
  return template.replace(HEAD, () => head.join("\n    ")).replace(ROOT, () => body(data));
}
