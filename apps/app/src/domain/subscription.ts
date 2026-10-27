// Suscripción de cada casa (fase 5): plaza de la oferta de lanzamiento, fin de la oferta, avisos 90/30/7/0, máquina de
// estados (la misma que replican el SQL de fase5_suscripcion y el fake) y los textos de las pantallas y de WhatsApp.
// Fechas como `YYYY-MM-DD` de Costa Rica (costaRicaToday): «hoy» llega siempre como argumento.
// La tarifa sale de MONTHLY_FEE_CRC (₡2 900 desde la decisión del 2026-10-27; la especificación aún decía ₡9 900).
import { longDate } from "./dates";
import type { ListingStatus } from "./listing";
import { formatCRC } from "./money";
import { LAUNCH_TIERS, MONTHLY_FEE_CRC, launchOffer, type LaunchOffer } from "./offer";

export { LAUNCH_TIERS, MONTHLY_FEE_CRC, launchOffer, type LaunchOffer };

/** Días antes del fin de la oferta en que se avisa por WhatsApp; 90 abre también la ventana de la tarjeta en la app. */
export const REMINDER_DAYS = [90, 30, 7, 0] as const;
export type ReminderDays = (typeof REMINDER_DAYS)[number];
export const REMINDER_WINDOW_DAYS = 90;

export type SubscriptionPlan = "promo" | "paid";

/** Lo que las reglas necesitan de una casa y su suscripción (fila de owner_billing). */
export interface HouseSubscription {
  status: ListingStatus;
  plan: SubscriptionPlan;
  /** Último día gratis; null sin oferta (plaza > 200). */
  promoEndsOn: string | null;
  /** Primer día del plan de pago. */
  paidSince: string | null;
  /** Día (Costa Rica) en que el propietario la paró. */
  stoppedOn: string | null;
  monthlyPriceCrc: number;
  /** El propietario tiene método de pago (uno por cuenta, vale para todas sus casas). */
  hasMethod: boolean;
}

/** Mensajes de las RPCs de fase5_suscripcion, repetidos tal cual en la migración y en el fake. */
export const SUBSCRIPTION_MESSAGES = {
  notFound: "No encontramos ese anuncio.",
  inactiveAccount: "Su cuenta está desactivada. Escríbanos por WhatsApp.",
  approve: "Solo se pueden aprobar casas en revisión.",
  stop: "Solo puede parar la suscripción de una casa activa o pendiente de pago.",
  resume: "Solo puede reactivar una casa con la suscripción parada.",
  dayPassed: "Solo cambia con los días una casa activa.",
} as const;

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_MS = 86_400_000;

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** «14 oct 2027» (tarjetas). */
export function cardDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${SHORT_MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

/** «9 oct» si es del año de hoy; si no, «9 oct 2025». */
function shortDate(date: string, today: string): string {
  const full = cardDate(date);
  return date.slice(0, 4) === today.slice(0, 4) ? full.slice(0, -5) : full;
}

/** Meses gratis de la plaza `slot` (1–50 → 12, 51–100 → 6, 101–200 → 3); null fuera de la oferta. */
export function tierForSlot(slot: number): { months: number } | null {
  if (!Number.isInteger(slot) || slot < 1) return null;
  let first = 1;
  for (const tier of LAUNCH_TIERS) {
    if (slot < first + tier.size) return { months: tier.months };
    first += tier.size;
  }
  return null;
}

/** Mismo número de día `months` meses después, ajustado al último día del mes (31 ene + 1 → 28/29 feb): el último día gratis. */
export function promoEndsOn(approvalDay: string, months: number): string {
  const [y, m, d] = approvalDay.split("-").map(Number) as [number, number, number];
  const lastOfMonth = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m - 1 + months, Math.min(d, lastOfMonth)));
}

/** Días hasta el fin de la oferta: 0 el último día gratis, negativo cuando ya terminó. */
export function daysLeft(endsOn: string, today: string): number {
  return Math.round((utc(endsOn) - utc(today)) / DAY_MS);
}

/** El aviso que toca: el umbral más pequeño ≥ días restantes (91 → null, 90…31 → 90, 30…8 → 30, 7…1 → 7, 0 → 0, < 0 → null).
 *  Si el trabajo diario se saltó un día, la casa recibe el umbral en el que está; los anteriores no se mandan. */
export function reminderThreshold(days: number): ReminderDays | null {
  if (!Number.isInteger(days) || days < 0) return null;
  const smallest = [...REMINDER_DAYS].reverse().find((d) => d >= days);
  return smallest ?? null;
}

/** La oferta sigue corriendo hoy (también con la casa parada o en edición). */
export function promoRunning(sub: Pick<HouseSubscription, "plan" | "promoEndsOn">, today: string): boolean {
  return sub.plan === "promo" && sub.promoEndsOn !== null && today <= sub.promoEndsOn;
}

/** Días que quedan de oferta si la casa está dentro de la ventana de aviso (90…0); null fuera. */
export function reminderDaysLeft(sub: Pick<HouseSubscription, "plan" | "promoEndsOn">, today: string): number | null {
  if (sub.plan !== "promo" || !sub.promoEndsOn) return null;
  const left = daysLeft(sub.promoEndsOn, today);
  return reminderThreshold(left) === null ? null : left;
}

export type SubscriptionEvent = "approve" | "dayPassed" | "methodAdded" | "stop" | "resume";

export interface SubscriptionContext {
  promoRunning: boolean;
  hasMethod: boolean;
  /** Para parar/reactivar: la casa es de la sesión (si no, «No encontramos ese anuncio.»). */
  isOwner?: boolean;
  /** Para parar/reactivar: la cuenta del propietario está activa. */
  accountActive?: boolean;
}

export type StatusResult = { ok: true; status: ListingStatus } | { ok: false; message: string };

const ok = (status: ListingStatus): StatusResult => ({ ok: true, status });
const refuse = (message: string): StatusResult => ({ ok: false, message });
const byApproveRule = (ctx: SubscriptionContext) => ok(ctx.promoRunning || ctx.hasMethod ? "active" : "payment_due");

/** Máquina de estados de la suscripción (la del SQL, el fake y las escrituras optimistas).
 *  approve: de revisión → activa con oferta o método, si no pendiente de pago. dayPassed (trabajo diario): una activa cuya
 *  oferta terminó queda activa con método o pasa a pendiente de pago. methodAdded (evento de la cuenta): pendiente de pago →
 *  activa; las demás no cambian. stop: activa o pendiente de pago → inactiva. resume: inactiva → por la regla de approve. */
export function nextStatus(current: ListingStatus, event: SubscriptionEvent, ctx: SubscriptionContext): StatusResult {
  switch (event) {
    case "approve":
      return current === "review" ? byApproveRule(ctx) : refuse(SUBSCRIPTION_MESSAGES.approve);
    case "dayPassed":
      if (current !== "active") return refuse(SUBSCRIPTION_MESSAGES.dayPassed);
      return byApproveRule(ctx);
    case "methodAdded":
      return ok(current === "payment_due" ? "active" : current);
    case "stop":
    case "resume": {
      if (ctx.isOwner === false) return refuse(SUBSCRIPTION_MESSAGES.notFound);
      if (ctx.accountActive === false) return refuse(SUBSCRIPTION_MESSAGES.inactiveAccount);
      if (event === "stop") return current === "active" || current === "payment_due" ? ok("inactive") : refuse(SUBSCRIPTION_MESSAGES.stop);
      return current === "inactive" ? byApproveRule(ctx) : refuse(SUBSCRIPTION_MESSAGES.resume);
    }
  }
}

/** «Añadir método de pago» (en todas las vistas): sin método y pendiente de pago, o activa dentro de los 90 días. */
export function payButtonDue(sub: HouseSubscription, today: string): boolean {
  if (sub.hasMethod) return false;
  return sub.status === "payment_due" || (sub.status === "active" && reminderDaysLeft(sub, today) !== null);
}

/** Línea de la suscripción en las tarjetas y en Cuenta; null en borradores, con cambios pedidos o rechazadas. */
export function subscriptionLine(sub: HouseSubscription, today: string): string | null {
  switch (sub.status) {
    case "review":
      return `En revisión · ${formatCRC(0)}`;
    case "payment_due":
      return "Pendiente de pago";
    case "inactive":
      return sub.stoppedOn ? `Parada el ${shortDate(sub.stoppedOn, today)} · no se cobra` : "Parada · no se cobra";
    case "active": {
      if (sub.plan === "promo" && sub.promoEndsOn && (today <= sub.promoEndsOn || !sub.hasMethod)) return `Gratis hasta el ${cardDate(sub.promoEndsOn)}`;
      const since = sub.paidSince ?? (sub.promoEndsOn ? iso(utc(sub.promoEndsOn) + DAY_MS) : null);
      const price = `${formatCRC(sub.monthlyPriceCrc)} al mes`;
      return since ? `Suscripción activa desde el ${cardDate(since)} · ${price}` : `Suscripción activa · ${price}`;
    }
    default:
      return null;
  }
}

const FEE_LINE = () => `${formatCRC(MONTHLY_FEE_CRC)} al mes por casa, sin permanencia`;

/** Tarjeta de aviso en la app durante los 90 días; null fuera de la ventana. Nunca lleva el texto del WhatsApp. */
export function reminderCard(days: number): { title: string; body: string } | null {
  if (reminderThreshold(days) === null) return null;
  const when = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
  return {
    title: `Su oferta gratuita termina ${when}`,
    body: `No se le cobrará nada hasta entonces. Añada un método de pago antes de esa fecha para que su casa siga saliendo en bnbtico; después, ${FEE_LINE()}. También se lo recordamos por WhatsApp.`,
  };
}

export interface ReminderMessage {
  name: string | null;
  title: string;
  endsOn: string;
  link: string;
  daysBefore: ReminderDays;
}

/** Texto del aviso por WhatsApp; el que guarda la base para el envío debe ser idéntico (tickets 02/03). */
export function reminderWhatsApp(m: ReminderMessage): string {
  const name = m.name?.trim();
  const hello = name ? `Hola, ${name}. Somos bnbtico.` : "Hola. Somos bnbtico.";
  if (m.daysBefore === 0) {
    return `${hello} La oferta gratuita de «${m.title}» termina hoy. Si no añade un método de pago, desde mañana su casa deja de mostrarse en bnbtico: ${m.link} Hoy todavía no se le cobra nada; después, ${FEE_LINE()}; puede pararla cuando quiera.`;
  }
  return `${hello} La oferta gratuita de «${m.title}» termina el ${longDate(m.endsOn) ?? m.endsOn}: hasta entonces no se le cobra nada. Para que su casa siga saliendo en bnbtico después, añada un método de pago aquí: ${m.link} Desde esa fecha, ${FEE_LINE()}; puede pararla cuando quiera.`;
}

/** Enlace del aviso: `<base>/propietario/suscripcion#pago=CT-####`. */
export function payLink(base: string, publicId: string): string {
  return `${base.replace(/\/+$/, "")}/propietario/suscripcion#pago=${publicId}`;
}

/** El `CT-####` de `#pago=CT-####`; null con cualquier otra cosa. */
export function parsePayHash(hash: string): string | null {
  return /^#pago=(CT-\d{4,})$/.exec(hash)?.[1] ?? null;
}

/** Primer día de cobro de una casa activa a partir de hoy: el inicio del plan de pago o su siguiente mensualidad. */
function nextChargeDay(sub: HouseSubscription, today: string): string | null {
  const start = sub.plan === "paid" ? sub.paidSince : sub.promoEndsOn ? iso(utc(sub.promoEndsOn) + DAY_MS) : null;
  if (!start) return null;
  for (let n = 0; ; n++) {
    const day = promoEndsOn(start, n);
    if (day >= today) return day;
  }
}

/** «Próximo cobro» de Cuenta (informativo: en v1 no se cobra nada). */
export function nextCharge(houses: readonly HouseSubscription[], method: object | null, today: string): string {
  if (!method) return `${formatCRC(0)} · sin método de pago`;
  const due = houses.filter((h) => h.status === "active").map((h) => ({ h, day: nextChargeDay(h, today) })).filter((x): x is { h: HouseSubscription; day: string } => x.day !== null);
  if (!due.length) return `${formatCRC(0)} · ninguna casa activa`;
  const first = due.reduce((min, x) => (x.day < min ? x.day : min), due[0]!.day);
  const total = due.filter((x) => x.day === first).reduce((sum, x) => sum + x.h.monthlyPriceCrc, 0);
  return `${formatCRC(total)} · ${cardDate(first)}`;
}

export type BlockedReason = "stopped" | "payment" | "other";

/** Motivo de la página 410 de una ficha que ya no está activa. */
export function blockedReason(reason: BlockedReason | null): string {
  switch (reason) {
    case "stopped":
      return "El propietario paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.";
    case "payment":
      return "Este anuncio está fuera del catálogo hasta que el propietario regularice su suscripción.";
    default:
      return "Este anuncio no está disponible en este momento.";
  }
}
