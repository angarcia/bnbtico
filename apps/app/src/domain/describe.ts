// Cómo se cuenta una casa en cualquier pantalla: precio principal, unidad, situación, enlace y texto para compartir.
// Sustituye a las seis copias que tenía la app anterior (tarjetas, ficha, detalle del propietario, admin, metadatos).
import { relativeDate } from "./dates";
import { KIND_LABELS, STATUS_LABELS, type Listing, type PublicListing } from "./listing";
import type { Currency } from "./currency";
import { formatCRC, formatMoney } from "./money";
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

type PriceFields = Pick<PublicListing, "nightlyPriceCrc" | "acceptsMonthly" | "monthlyPriceCrc">;

function prices(l: PriceFields): [Price | null, MonthlyPrice | null] {
  const nightly = l.nightlyPriceCrc && l.nightlyPriceCrc > 0 ? { amount: l.nightlyPriceCrc, unit: "noche" as const } : null;
  const monthly = !l.acceptsMonthly ? null : l.monthlyPriceCrc && l.monthlyPriceCrc > 0 ? { amount: l.monthlyPriceCrc, unit: "mes" as const } : { negotiable: true as const };
  return [nightly, monthly];
}

/** El precio de una tarjeta de Explorar y de su marcador: con llegada y salida (`nights` > 0) y el total que calculó la
 *  búsqueda, el total orientativo de esas noches; si no (sin fechas, alguna noche sin precio o una casa de Favoritos), el de
 *  la noche. */
export type CardPrice = Price | { stayTotalCrc: number; nights: number } | null;
export function cardPrice(l: PriceFields & { stayTotalCrc?: number | null }, nights: number): CardPrice {
  return nights > 0 && l.stayTotalCrc != null ? { stayTotalCrc: l.stayTotalCrc, nights } : prices(l)[0];
}

/** «4 personas · 2 habitaciones», «1 persona · 1 habitación», «2 personas · Estudio» (sin habitaciones aparte). Una
 *  Habitación es 1 habitación, nunca «Estudio» (también con un dato viejo guardado en el teléfono). */
export function cardFacts(l: Pick<PublicListing, "capacity" | "bedrooms"> & { kind?: PublicListing["kind"] }): string {
  const people = `${l.capacity} ${l.capacity === 1 ? "persona" : "personas"}`;
  const bedrooms = l.kind === "habitacion" ? 1 : l.bedrooms;
  const rooms = bedrooms > 0 ? `${bedrooms} ${bedrooms === 1 ? "dormitorio" : "dormitorios"}` : "Estudio";
  return `${people} · ${rooms}`;
}

type CapacityFields = { kind: PublicListing["kind"] | null; capacity: number | null; bedrooms: number | null; bathrooms: number | null; bathroomShared: boolean | null };
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** El baño: en una Habitación (siempre 1) dice si es compartido o privado, y «1 baño» si aún no se eligió; si no, cuántos. */
const bathLabel = (l: CapacityFields): string =>
  l.kind === "habitacion" ? (l.bathroomShared === null ? "1 baño" : l.bathroomShared ? "baño compartido" : "baño privado") : count(l.bathrooms ?? 0, "baño", "baños");

/** La capacidad en la ficha: «5 personas · 2 habitaciones · 2 baños»; una Habitación, «2 personas · 1 habitación · baño
 *  compartido» (ronda de Ana 2026-11-02, ticket 03). */
export function capacityLine(l: CapacityFields): string {
  return [count(l.capacity ?? 0, "persona", "personas"), count(l.kind === "habitacion" ? 1 : (l.bedrooms ?? 0), "dormitorio", "dormitorios"), bathLabel(l)].join(" · ");
}

/** La capacidad en corto, en la fila de «Revisar y enviar»: «5 pers. · 2 hab. · 2 baños»; una Habitación no cuenta
 *  habitaciones: «2 pers. · baño compartido». */
export function capacitySummary(l: CapacityFields): string {
  return [`${l.capacity ?? 0} pers.`, ...(l.kind === "habitacion" ? [] : [`${l.bedrooms ?? 0} hab.`]), bathLabel(l)].join(" · ");
}

/** El marcador del mapa de Explorar: la cifra de la tarjeta sin unidad («₡42 000», «$80»; con fechas, el total sin «por N
 *  noches»); sin precio, «A negociar». */
export function mapPriceLabel(l: PriceFields & { stayTotalCrc?: number | null }, nights: number, currency: Currency, fx: number): string {
  const price = cardPrice(l, nights);
  if (!price) return "A negociar";
  return formatMoney("stayTotalCrc" in price ? price.stayTotalCrc : price.amount, currency, fx);
}
export const NEGOTIABLE_LINE = "Mensual: precio a negociar con el anfitrión";

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
  const what = l.kind ? `${KIND_LABELS[l.kind]}${place ? ` en ${place}` : ""}` : l.title || "Casa en 3bstays";
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

/** Tipo en las tarjetas y la ficha: la cama se reserva para el número de dormitorios. */
export function accommodationLabel(l: Pick<PublicListing, "kind" | "bathroomShared">): string {
  if (l.kind !== "habitacion") return "Alojamiento completo";
  return l.bathroomShared === null ? "Habitación" : `Habitación · baño ${l.bathroomShared ? "compartido" : "privado"}`;
}
