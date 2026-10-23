// Documento HTML del worker: la plantilla index.html de Vite con la cabecera y el cuerpo de la página inyectados.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe } from "../domain/describe";
import type { PublicListing } from "../domain/listing";
import { SITE_URL } from "../domain/seo";
import { publicUrl } from "../domain/share";
import { ListingScreen } from "../shared/listing-page";
import { listingQuery } from "../shared/listing-query";
import { SSR_DATA_ID, type SsrData } from "../shared/ssr-data";
import { BlockedPage, ErrorPage, MissingPage } from "../shared/status-pages";

const HEAD = /<!--app-head-->[\s\S]*?<!--\/app-head-->/;
const ROOT = "<!--app-html-->";

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** JSON dentro de <script type="application/json">: sin «<» no puede cerrar la etiqueta ni abrir un comentario. */
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

function listingHead(l: PublicListing): string[] {
  const d = describe(l, { base: SITE_URL });
  const canonical = escapeHtml(publicUrl(l.publicId, SITE_URL));
  const title = escapeHtml(l.title);
  const description = escapeHtml(d.previewText);
  const cover = l.photos[0];
  return [
    `<title>${title} · bnbtico</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="bnbtico" />`,
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
      ? [`<link rel="preload" as="image" href="${escapeHtml(cover.url)}" fetchpriority="high"${cover.srcSet ? ` imagesrcset="${escapeHtml(cover.srcSet)}" imagesizes="100vw"` : ""} />`]
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
    client.setQueryData(listingQuery(data.listing.publicId).queryKey, data.listing);
    return renderToString(
      <QueryClientProvider client={client}>
        <ListingScreen publicId={data.listing.publicId} base={data.base} />
      </QueryClientProvider>,
    );
  }
  const Page = { missing: MissingPage, blocked: BlockedPage, error: ErrorPage }[data.page];
  return renderToString(<Page />);
}

export function renderDocument(template: string, data: SsrData): string {
  const head =
    data.page === "listing" ? listingHead(data.listing) : [`<title>${STATUS_HEAD[data.page]} · bnbtico</title>`, `<meta name="robots" content="noindex" />`];
  head.push(`<script type="application/json" id="${SSR_DATA_ID}">${jsonForScript(data)}</script>`);
  return template.replace(HEAD, () => head.join("\n    ")).replace(ROOT, () => body(data));
}
