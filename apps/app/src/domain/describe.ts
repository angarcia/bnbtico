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

/** El alquiler mensual: con su precio al mes o «a negociar con el dueño». */
export type MonthlyPrice = { amount: number; unit: "mes" } | { negotiable: true };
export const isNegotiable = (m: MonthlyPrice): m is { negotiable: true } => "negotiable" in m;

export interface ListingDescription {
  /** Precio por noche: toda casa lo tiene al publicarse; null solo en un borrador sin precio todavía. */
  mainPrice: Price | null;
  /** null si no acepta alquiler mensual; negociable si lo acepta sin precio (o con uno no positivo). */
  monthly: MonthlyPrice | null;
  statusLabel: string;
  /** Línea de situación de Mis casas; null para una casa vista por el público. */
  situation: string | null;
  shareUrl: string;
  /** Texto de la vista previa (WhatsApp, Google, compartir). */
  previewText: string;
}

const isOwnerListing = (l: Listing | PublicListing): l is Listing => "ownerId" in l;

function prices(l: Listing | PublicListing): [Price | null, MonthlyPrice | null] {
  const nightly = l.nightlyPriceCrc && l.nightlyPriceCrc > 0 ? { amount: l.nightlyPriceCrc, unit: "noche" as const } : null;
  const monthly = !l.acceptsMonthly ? null : l.monthlyPriceCrc && l.monthlyPriceCrc > 0 ? { amount: l.monthlyPriceCrc, unit: "mes" as const } : { negotiable: true as const };
  return [nightly, monthly];
}

/** El precio de una tarjeta: el de la noche; con el filtro «Alquiler mensual», el del mes o «a negociar». */
export type CardPrice = Price | { negotiable: true } | null;
export function cardPrice(d: Pick<ListingDescription, "mainPrice" | "monthly">, monthlyFilter: boolean): CardPrice {
  return monthlyFilter && d.monthly ? d.monthly : d.mainPrice;
}

export const NEGOTIABLE_CARD = "Precio a negociar";
export const NEGOTIABLE_LINE = "Mensual: precio a negociar con el dueño";

function situation(l: Listing, now: number): string {
  switch (l.status) {
    // Lo de la oferta (tramo, «Gratis hasta…») sale de la suscripción (subscriptionLine): aquí solo lo que dice la casa.
    case "active":
      return l.available ? "Visible en Explorar y con su enlace" : "Pausado: no aparece en Explorar";
    case "review":
      return `Enviada ${relativeDate(l.updatedAt, now)}. Le avisamos por WhatsApp.`;
    case "changes":
      return "Le pedimos cambios. Corríjalos y reenvíe.";
    case "rejected":
      return "Rechazada. Si quiere, publique una nueva.";
    case "payment_due":
      return "La ficha vuelve a verse al pagar.";
    case "inactive":
      return "Parada · no aparece en Explorar";
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
  const [mainPrice, monthly] = prices(l);
  const owner = isOwnerListing(l);
  const status = owner ? l.status : "active";
  return {
    mainPrice,
    monthly,
    statusLabel: status === "active" && !l.available ? "Pausado" : STATUS_LABELS[status].label,
    situation: owner ? situation(l, opts.now ?? Date.now()) : null,
    shareUrl: publicUrl(l.publicId, opts.base),
    previewText: previewText(l, mainPrice),
  };
}
