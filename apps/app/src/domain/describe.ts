// Cómo se cuenta una casa en cualquier pantalla: precio principal, unidad, situación, enlace y texto para compartir.
// Sustituye a las seis copias que tenía la app anterior (tarjetas, ficha, detalle del propietario, admin, metadatos).
import { relativeDate } from "./dates";
import { KIND_LABELS, STATUS_LABELS, type Listing, type PublicListing } from "./listing";
import { formatCRC } from "./money";
import { publicUrl } from "./share";

export type PriceUnit = "noche" | "mes";
export interface Price {
  amount: number;
  unit: PriceUnit;
}

export interface ListingDescription {
  /** Precio por noche si es vacacional y lo tiene; si no, el mensual. */
  mainPrice: Price | null;
  /** El mensual cuando además es vacacional. */
  secondaryPrice: Price | null;
  statusLabel: string;
  /** Línea de situación de Mis casas; null para una casa vista por el público. */
  situation: string | null;
  shareUrl: string;
  /** Texto de la vista previa (WhatsApp, Google, compartir). */
  previewText: string;
}

const isOwnerListing = (l: Listing | PublicListing): l is Listing => "ownerId" in l;

function prices(l: Listing | PublicListing): [Price | null, Price | null] {
  const nightly = l.acceptsNightly && l.nightlyPriceCrc ? { amount: l.nightlyPriceCrc, unit: "noche" as const } : null;
  const monthly = l.acceptsMonthly && l.monthlyPriceCrc ? { amount: l.monthlyPriceCrc, unit: "mes" as const } : null;
  return nightly ? [nightly, monthly] : [monthly, null];
}

function situation(l: Listing, now: number): string {
  switch (l.status) {
    case "active":
      return "Gratis 12 meses · oferta de lanzamiento";
    case "review":
      return `Enviada ${relativeDate(l.updatedAt, now)}. Le avisamos por WhatsApp.`;
    case "changes":
      return "Le pedimos cambios. Corríjalos y reenvíe.";
    case "rejected":
      return "Rechazada. Si quiere, publique una nueva.";
    case "payment_due":
      return "Aprobada. Falta el método de pago para publicarla.";
    case "inactive":
      return "Inactiva: no aparece en Explorar.";
    case "draft":
      return l.reviewedAt ? "Estuvo publicada: al enviarla volverá a revisión." : "Borrador sin enviar.";
  }
}

function previewText(l: Listing | PublicListing, main: Price | null): string {
  const place = [l.zone, l.province].filter(Boolean).join(", ");
  const what = l.kind ? `${KIND_LABELS[l.kind]}${place ? ` en ${place}` : ""}` : l.title || "Casa en bnbtico";
  const people = l.capacity ? `${l.capacity} ${l.capacity === 1 ? "persona" : "personas"}` : null;
  const price = main ? `${formatCRC(main.amount)} por ${main.unit} · orientativo` : null;
  return [what, people, price].filter(Boolean).join(" · ");
}

export function describe(l: Listing | PublicListing, opts: { base: string; now?: number }): ListingDescription {
  const [mainPrice, secondaryPrice] = prices(l);
  const owner = isOwnerListing(l);
  const status = owner ? l.status : "active";
  return {
    mainPrice,
    secondaryPrice,
    statusLabel: status === "active" && !l.available ? "No disponible" : STATUS_LABELS[status].label,
    situation: owner ? situation(l, opts.now ?? Date.now()) : null,
    shareUrl: publicUrl(l.publicId, opts.base),
    previewText: previewText(l, mainPrice),
  };
}
