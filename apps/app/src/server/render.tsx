import { renderToString } from "react-dom/server";
import { type ListingView, listingPath } from "../shared/listing";
import { ListingPage } from "../shared/listing-page";

const HEAD = /<!--app-head-->[\s\S]*?<!--\/app-head-->/;
const ROOT = "<!--app-html-->";

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** JSON dentro de <script type="application/json">: sin «<» no puede cerrar la etiqueta ni abrir un comentario. */
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

function headTags(listing: ListingView, origin: string) {
  const url = origin + listingPath(listing.publicId);
  const image = origin + listing.hero.src;
  const title = escapeAttr(listing.title);
  const description = escapeAttr(listing.summary);
  return [
    `<title>${title} · bnbtico</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="bnbtico" />`,
    `<meta property="og:locale" content="es_CR" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:width" content="${listing.hero.width}" />`,
    `<meta property="og:image:height" content="${listing.hero.height}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(listing.hero.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="preload" as="image" href="${escapeAttr(listing.hero.src)}" fetchpriority="high" />`,
    `<script type="application/json" id="listing-data">${jsonForScript(listing)}</script>`,
  ].join("\n    ");
}

export function renderListingDocument(template: string, listing: ListingView, origin: string) {
  const app = renderToString(<ListingPage listing={listing} />);
  return template.replace(HEAD, () => headTags(listing, origin)).replace(ROOT, () => app);
}
