// Consultas por WhatsApp (fase 3): el mensaje que redacta la hoja de contacto, su validación (los mismos mensajes que la
// RPC create_inquiry), la regla de redacción automática, y lo que muestra la tarjeta de una consulta en Actividad.
// `waUrl` vive en su propio módulo para que el soporte (zona privada inicial) no arrastre el resto de este.
import { costaRicaToday, formatInquiryDates, isoParts } from "./dates";
export { waUrl } from "./whatsapp";
export { costaRicaToday, formatInquiryDates } from "./dates";

export const INQUIRY_MAX_PEOPLE = 50;
/** Mensaje cuando se piden más personas de las que admite la casa. */
export const tooManyPeople = (capacity: number) => `Esta casa es para ${capacity} ${capacity === 1 ? "persona" : "personas"} como máximo.`;
export const INQUIRY_MAX_MESSAGE = 1000;

/** Mensajes de create_inquiry / mark_inquiry_opened, repetidos tal cual en la migración fase3_consultas y en el fake. */
export const INQUIRY_MESSAGES = {
  signIn: "Ingrese con su WhatsApp para contactar al anfitrión.",
  inactiveAccount: "Su cuenta está desactivada. Escríbanos por WhatsApp.",
  unverified: "Verifique su WhatsApp para contactar al anfitrión.",
  notPublished: "Esta casa ya no está publicada.",
  ownHouse: "Esta es su propia casa.",
  unavailable: "Esta casa no está disponible para consultas.",
  bothDates: "Indique la llegada y la salida, o deje las dos vacías.",
  badDate: "Revise las fechas.",
  departureAfter: "La salida tiene que ser después de la llegada.",
  arrivalPast: "La llegada no puede ser antes de hoy.",
  people: `Indique entre 1 y ${INQUIRY_MAX_PEOPLE} personas.`,
  messageEmpty: "Escriba un mensaje para el anfitrión.",
  messageLong: `El mensaje no puede pasar de ${INQUIRY_MAX_MESSAGE} caracteres.`,
  rateLimit: "Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.",
  notFound: "No encontramos esa consulta.",
} as const;

/** Lo que el cliente escribe en la hoja. Fechas `YYYY-MM-DD`. */
export interface InquiryDetails {
  arrival: string | null;
  departure: string | null;
  people: number | null;
}

export interface InquiryDraft extends InquiryDetails {
  message: string;
}

export interface InquiryFields {
  arrival?: string | null;
  departure?: string | null;
  people?: number | null;
}

/** Una consulta vista por el propietario (RPC owner_inquiry_details): con el nombre y el WhatsApp del cliente. */
export interface OwnerInquiry {
  id: string;
  listingId: string;
  publicId: string;
  listingTitle: string;
  clientName: string;
  clientPhone: string;
  arrival: string | null;
  departure: string | null;
  people: number | null;
  createdAt: string;
  updatedAt: string;
  /** Cuándo tocó el propietario «Abrir WhatsApp»; null = «Nueva». */
  openedAt: string | null;
  source: "listing" | "support";
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Rango válido: las dos fechas y la salida después de la llegada. */
function validRange(f: InquiryFields): [[number, number, number], [number, number, number]] | null {
  if (!f.arrival || !f.departure || f.departure <= f.arrival) return null;
  const a = isoParts(f.arrival);
  const d = isoParts(f.departure);
  return a && d ? [a, d] : null;
}

/** «del 20 al 23 de diciembre», «del 28 de diciembre al 2 de enero». */
function messageDates(f: InquiryFields): string {
  const range = validRange(f);
  if (!range) return "";
  const [[ay, am, ad], [dy, dm, dd]] = range;
  return am === dm && ay === dy ? `del ${ad} al ${dd} de ${MONTHS[am - 1]}` : `del ${ad} de ${MONTHS[am - 1]} al ${dd} de ${MONTHS[dm - 1]}`;
}

export const INQUIRY_GREETING = "Hola, vi ";

export function inquiryMessageTail(f: InquiryFields): string {
  const dates = messageDates(f);
  const n = f.people && f.people > 0 ? Math.floor(f.people) : 0;
  const people = n > 0 ? `${n} persona${n === 1 ? "" : "s"}` : "";
  const ask = dates && people ? `¿Está disponible ${dates} para ${people}?` : dates ? `¿Está disponible ${dates}?` : people ? `¿Está disponible para ${people}?` : "¿Está disponible?";
  return ` en 3bstays y me interesa. ${ask} Gracias.`;
}

/** El mensaje por defecto de la hoja (prototipo `contactCompose`, mismas frases). */
export function composeInquiryMessage(title: string, f: InquiryFields): string {
  return `${INQUIRY_GREETING}${title}${inquiryMessageTail(f)}`;
}

export type InquiryField = "arrival" | "departure" | "people" | "message";

type InquiryProblem = { field: InquiryField; message: string };

export function validateInquiryDetails(d: InquiryDetails, today: string): InquiryProblem | null {
  if (d.arrival && !d.departure) return { field: "departure", message: INQUIRY_MESSAGES.bothDates };
  if (!d.arrival && d.departure) return { field: "arrival", message: INQUIRY_MESSAGES.bothDates };
  if (d.arrival && d.departure) {
    if (!isoParts(d.arrival)) return { field: "arrival", message: INQUIRY_MESSAGES.badDate };
    if (!isoParts(d.departure)) return { field: "departure", message: INQUIRY_MESSAGES.badDate };
    if (d.departure <= d.arrival) return { field: "departure", message: INQUIRY_MESSAGES.departureAfter };
    if (d.arrival < today) return { field: "arrival", message: INQUIRY_MESSAGES.arrivalPast };
  }
  if (d.people !== null && (!Number.isInteger(d.people) || d.people < 1 || d.people > INQUIRY_MAX_PEOPLE)) return { field: "people", message: INQUIRY_MESSAGES.people };
  return null;
}

export function validateInquiryDraft(d: InquiryDraft, today: string): InquiryProblem | null {
  const problem = validateInquiryDetails(d, today);
  if (problem) return problem;
  const text = d.message.trim();
  if (!text) return { field: "message", message: INQUIRY_MESSAGES.messageEmpty };
  if (text.length > INQUIRY_MAX_MESSAGE) return { field: "message", message: INQUIRY_MESSAGES.messageLong };
  return null;
}

// ---------- Redacción automática ----------

export interface ContactDraftState {
  arrival: string | null;
  departure: string | null;
  people: number | null;
  message: string;
  /** El último texto redactado: mientras `message` sea igual, el mensaje sigue a fechas y personas. */
  composed: string;
  edited: boolean;
}

export type ContactDraftAction = { type: "fields"; patch: InquiryFields } | { type: "message"; text: string };

export function startDraft(title: string, fields: InquiryFields = {}): ContactDraftState {
  const composed = composeInquiryMessage(title, fields);
  return {
    arrival: fields.arrival ?? null,
    departure: fields.departure ?? null,
    people: fields.people ?? null,
    message: composed,
    composed,
    edited: false,
  };
}

/** Reductor puro de la hoja: el texto editado a mano se queda; el redactado se rehace al cambiar fechas o personas. */
export function redraft(s: ContactDraftState, action: ContactDraftAction, title: string): ContactDraftState {
  if (action.type === "message") return { ...s, message: action.text, edited: action.text !== s.composed };
  const next = { ...s, ...action.patch };
  const composed = composeInquiryMessage(title, next);
  const message = s.message === s.composed ? composed : s.message;
  return { ...next, composed, message, edited: message !== composed };
}

/** Personas tal como llegan del campo numérico: vacío = sin indicar; el resto lo juzga `validateInquiryDraft`. */
export function parsePeople(value: string): number | null {
  const v = value.trim();
  return v === "" ? null : Number(v);
}

// firstName e initials viven en person.ts (la ficha los usa sin cargar este módulo).
export { firstName, initials } from "./person";

// ---------- Borrador guardado en la pestaña ----------

/** Lo escrito en la hoja dura 30 minutos en la pestaña (sessionStorage): cerrar, recargar o ir a Ingresar no lo pierde. */
export const CONTACT_DRAFT_TTL_MS = 30 * 60_000;
export { contactDraftKey } from "./contact-return";

/** Sin fechas: son las de la pestaña (`3bstays-fechas`, `shared/stay-dates.ts`), las mismas de Explorar, el calendario de la
 *  ficha y la hoja (ronda de Ana 2 nov, ticket 08). Un borrador guardado antes con fechas vuelve sin ellas. */
interface StoredContactDraft {
  people: number | null;
  message: string;
  edited: boolean;
  open: boolean;
  savedAt: number;
}

export function storeContactDraft(s: ContactDraftState, open: boolean, now: number): string {
  const stored: StoredContactDraft = { people: s.people, message: s.message, edited: s.edited, open, savedAt: now };
  return JSON.stringify(stored);
}

/** El borrador guardado, o null si no hay, caducó o no se entiende. Sin editar, el mensaje se vuelve a redactar. */
export function restoreContactDraft(raw: string | null, title: string, now: number): { state: ContactDraftState; open: boolean } | null {
  if (!raw) return null;
  let v: Partial<Record<keyof StoredContactDraft, unknown>>;
  try {
    v = JSON.parse(raw) as typeof v;
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  if (typeof v.savedAt !== "number" || now - v.savedAt > CONTACT_DRAFT_TTL_MS) return null;
  if (!(v.people === null || typeof v.people === "number")) return null;
  if (typeof v.message !== "string" || typeof v.edited !== "boolean") return null;
  const fresh = startDraft(title, { people: v.people as number | null });
  const state = v.edited ? { ...fresh, message: v.message, edited: v.message !== fresh.composed } : fresh;
  return { state, open: v.open === true };
}

// ---------- Tarjeta del propietario ----------

/** «ahora», «hace 25 min», «hace 2 h» (mismo día en Costa Rica), «ayer», «12 oct», «31 dic 2025». */
export function relativeTime(iso: string, nowMs: number): string {
  const at = Date.parse(iso);
  const diff = nowMs - at;
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  const day = costaRicaToday(at);
  const today = costaRicaToday(nowMs);
  if (day === today) return `hace ${Math.floor(diff / 3_600_000)} h`;
  if (day === costaRicaToday(nowMs - 86_400_000)) return "ayer";
  const [y, m, d] = isoParts(day)!;
  return y === Number(today.slice(0, 4)) ? `${d} ${SHORT_MONTHS[m - 1]}` : `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}


/** Línea de la tarjeta: «20–27 dic · 4 personas»; la casa va en su etiqueta. Sin personas, solo las fechas. */
export function inquirySummary(i: Pick<OwnerInquiry, "arrival" | "departure" | "people">): string {
  const parts = [formatInquiryDates(i.arrival, i.departure)];
  if (i.people) parts.push(i.people === 1 ? "1 persona" : `${i.people} personas`);
  return parts.join(" · ");
}
