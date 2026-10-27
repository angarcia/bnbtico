// Casas del admin (fase 5, ticket 07, diseño 23): todas las casas aprobadas alguna vez con su propietario, su zona y su
// suscripción. Solo lectura: los chips, los recuentos y el buscador se resuelven en el navegador.
import type { ListingStatus, Photo } from "./listing";
import { formatCRC } from "./money";
import { cardDate, shortDate, type HouseSubscription } from "./subscription";

export interface AdminHouse {
  listingId: string;
  publicId: string;
  title: string;
  status: ListingStatus;
  ownerName: string;
  zone: string;
  /** La portada (la foto en la posición 0), o null sin fotos. */
  cover: Photo | null;
  subscription: HouseSubscription;
}

export interface AdminHouses {
  /** La aprobada más recientemente primero. */
  houses: AdminHouse[];
  /** «Hoy» de Costa Rica con el que se escriben las líneas de suscripción. */
  today: string;
}

export type HouseChip = "todas" | "activas" | "por-pagar" | "inactivas";
export const HOUSE_CHIPS = ["todas", "activas", "por-pagar", "inactivas"] as const satisfies readonly HouseChip[];
export const CHIP_LABELS: Record<HouseChip, string> = { todas: "Todas", activas: "Activas", "por-pagar": "Por pagar", inactivas: "Inactivas" };

/** El chip de cada estado; las publicadas que se están editando o revisando solo salen en Todas. */
export function houseChip(status: ListingStatus): Exclude<HouseChip, "todas"> | null {
  return status === "active" ? "activas" : status === "payment_due" ? "por-pagar" : status === "inactive" ? "inactivas" : null;
}

/** Insignias del diseño 23: Activa salvia claro, Por pagar ocre, Inactiva arena. */
export const HOUSE_BADGES: Record<ListingStatus, { label: string; badge: string }> = {
  /** Publicada alguna vez y reabierta para editar (las nunca publicadas no salen en esta lista). */
  draft: { label: "En edición", badge: "badge-review" },
  review: { label: "En revisión", badge: "badge-review" },
  changes: { label: "Cambios pedidos", badge: "badge-review" },
  rejected: { label: "Rechazada", badge: "badge-bad" },
  payment_due: { label: "Por pagar", badge: "badge-sun" },
  active: { label: "Activa", badge: "badge-ok" },
  inactive: { label: "Inactiva", badge: "badge-mute" },
};

export function countHouses(houses: readonly AdminHouse[]): Record<HouseChip, number> {
  const counts: Record<HouseChip, number> = { todas: houses.length, activas: 0, "por-pagar": 0, inactivas: 0 };
  for (const h of houses) {
    const chip = houseChip(h.status);
    if (chip) counts[chip]++;
  }
  return counts;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Las casas del chip que contienen el texto en el nombre, el CT-#### o el nombre del propietario (sin tildes ni mayúsculas). */
export function filterHouses(houses: readonly AdminHouse[], chip: HouseChip, query: string): AdminHouse[] {
  const q = norm(query);
  return houses.filter(
    (h) => (chip === "todas" || houseChip(h.status) === chip) && (!q || [h.title, h.publicId, h.ownerName].some((field) => norm(field).includes(q))),
  );
}

/** La línea de suscripción del diseño 23 («Gratis hasta 14 oct 2027», «Oferta vencida el 14 oct · sin método de pago»,
 *  «Parada por el propietario el 9 oct»). Distinta de la del propietario (subscriptionLine): habla de la casa, no a usted. */
export function adminHouseLine(sub: HouseSubscription, today: string): string {
  if (sub.status === "inactive" || sub.stoppedOn) return sub.stoppedOn ? `Parada por el propietario el ${shortDate(sub.stoppedOn, today)}` : "Parada por el propietario";
  if (sub.status === "payment_due")
    return sub.promoEndsOn ? `Oferta vencida el ${shortDate(sub.promoEndsOn, today)} · sin método de pago` : "Sin oferta de lanzamiento · sin método de pago";
  if (sub.plan === "promo" && sub.promoEndsOn && (today <= sub.promoEndsOn || !sub.hasMethod)) return `Gratis hasta ${cardDate(sub.promoEndsOn)}`;
  const since = sub.paidSince ?? (sub.promoEndsOn ? nextDay(sub.promoEndsOn) : null);
  const price = `${formatCRC(sub.monthlyPriceCrc)} al mes`;
  return since ? `Pagando desde el ${cardDate(since)} · ${price}` : `Plan de pago · ${price}`;
}

const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
