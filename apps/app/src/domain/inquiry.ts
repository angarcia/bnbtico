// Consultas por WhatsApp (fase 3): el mensaje que redacta la hoja de contacto, su validación (los mismos mensajes que la
// RPC create_inquiry), la regla de redacción automática, y lo que muestra la tarjeta de Mis consultas.
// `waUrl` vive en su propio módulo para que el soporte (zona privada inicial) no arrastre el resto de este.
export { waUrl } from "./whatsapp";

export const INQUIRY_MAX_PEOPLE = 50;
export const INQUIRY_MAX_MESSAGE = 1000;

/** Mensajes de create_inquiry / mark_inquiry_opened, repetidos tal cual en la migración fase3_consultas y en el fake. */
export const INQUIRY_MESSAGES = {
  signIn: "Ingrese con su WhatsApp para contactar al propietario.",
  inactiveAccount: "Su cuenta está desactivada. Escríbanos por WhatsApp.",
  unverified: "Verifique su WhatsApp para contactar al propietario.",
  notPublished: "Esta casa ya no está publicada.",
  ownHouse: "Esta es su propia casa.",
  unavailable: "Esta casa no está disponible para consultas.",
  bothDates: "Indique la llegada y la salida, o deje las dos vacías.",
  badDate: "Revise las fechas.",
  departureAfter: "La salida tiene que ser después de la llegada.",
  arrivalPast: "La llegada no puede ser antes de hoy.",
  people: `Indique entre 1 y ${INQUIRY_MAX_PEOPLE} personas.`,
  messageEmpty: "Escriba un mensaje para el propietario.",
  messageLong: `El mensaje no puede pasar de ${INQUIRY_MAX_MESSAGE} caracteres.`,
  rateLimit: "Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.",
  notFound: "No encontramos esa consulta.",
} as const;

/** Lo que el cliente escribe en la hoja. Fechas `YYYY-MM-DD`. */
export interface InquiryDraft {
  arrival: string | null;
  departure: string | null;
  people: number | null;
  message: string;
}

export interface InquiryFields {
  arrival?: string | null;
  departure?: string | null;
  people?: number | null;
}

/** Una consulta vista por el propietario (RPC owner_inquiries): con el nombre y el WhatsApp del cliente. */
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
  message: string;
  createdAt: string;
  updatedAt: string;
  /** Cuándo tocó el propietario «Abrir WhatsApp»; null = «Nueva». */
  openedAt: string | null;
  source: "listing" | "bnbtico";
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Costa Rica no tiene horario de verano: siempre UTC−6. */
const CR_OFFSET_MS = 6 * 3_600_000;

function parts(date: string): [number, number, number] | null {
  const m = ISO_DATE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  return check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? [y, mo, d] : null;
}

/** Rango válido: las dos fechas y la salida después de la llegada. */
function validRange(f: InquiryFields): [[number, number, number], [number, number, number]] | null {
  if (!f.arrival || !f.departure || f.departure <= f.arrival) return null;
  const a = parts(f.arrival);
  const d = parts(f.departure);
  return a && d ? [a, d] : null;
}

/** «del 20 al 23 de diciembre», «del 28 de diciembre al 2 de enero». */
function messageDates(f: InquiryFields): string {
  const range = validRange(f);
  if (!range) return "";
  const [[ay, am, ad], [dy, dm, dd]] = range;
  return am === dm && ay === dy ? `del ${ad} al ${dd} de ${MONTHS[am - 1]}` : `del ${ad} de ${MONTHS[am - 1]} al ${dd} de ${MONTHS[dm - 1]}`;
}

/** El mensaje por defecto de la hoja (prototipo `contactCompose`, mismas frases). */
export function composeInquiryMessage(title: string, f: InquiryFields): string {
  const dates = messageDates(f);
  const n = f.people && f.people > 0 ? Math.floor(f.people) : 0;
  const people = n > 0 ? `${n} persona${n === 1 ? "" : "s"}` : "";
  const ask = dates && people ? `¿Está disponible ${dates} para ${people}?` : dates ? `¿Está disponible ${dates}?` : people ? `¿Está disponible para ${people}?` : "¿Está disponible?";
  return `Hola, vi ${title} en bnbtico y me interesa. ${ask} Gracias.`;
}

/** La fecha de hoy en Costa Rica, `YYYY-MM-DD`. */
export function costaRicaToday(nowMs: number): string {
  return new Date(nowMs - CR_OFFSET_MS).toISOString().slice(0, 10);
}

export type InquiryField = "arrival" | "departure" | "people" | "message";

/** El primer problema del borrador (en el orden de la RPC), o null si se puede enviar. */
export function validateInquiryDraft(d: InquiryDraft, today: string): { field: InquiryField; message: string } | null {
  if (d.arrival && !d.departure) return { field: "departure", message: INQUIRY_MESSAGES.bothDates };
  if (!d.arrival && d.departure) return { field: "arrival", message: INQUIRY_MESSAGES.bothDates };
  if (d.arrival && d.departure) {
    if (!parts(d.arrival)) return { field: "arrival", message: INQUIRY_MESSAGES.badDate };
    if (!parts(d.departure)) return { field: "departure", message: INQUIRY_MESSAGES.badDate };
    if (d.departure <= d.arrival) return { field: "departure", message: INQUIRY_MESSAGES.departureAfter };
    if (d.arrival < today) return { field: "arrival", message: INQUIRY_MESSAGES.arrivalPast };
  }
  if (d.people !== null && (!Number.isInteger(d.people) || d.people < 1 || d.people > INQUIRY_MAX_PEOPLE)) return { field: "people", message: INQUIRY_MESSAGES.people };
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
  return { arrival: fields.arrival ?? null, departure: fields.departure ?? null, people: fields.people ?? null, message: composed, composed, edited: false };
}

/** Reductor puro de la hoja: el texto editado a mano se queda; el redactado se rehace al cambiar fechas o personas. */
export function redraft(s: ContactDraftState, action: ContactDraftAction, title: string): ContactDraftState {
  if (action.type === "message") return { ...s, message: action.text, edited: action.text !== s.composed };
  const next = { ...s, ...action.patch };
  const composed = composeInquiryMessage(title, next);
  const message = s.message === s.composed ? composed : s.message;
  return { ...next, composed, message, edited: message !== composed };
}

// ---------- Tarjeta del propietario ----------

/** «20–27 dic», «28 dic – 2 ene», «sin fechas». */
export function formatInquiryDates(arrival: string | null, departure: string | null): string {
  const range = validRange({ arrival, departure });
  if (!range) return "sin fechas";
  const [[, am, ad], [, dm, dd]] = range;
  return am === dm ? `${ad}–${dd} ${SHORT_MONTHS[am - 1]}` : `${ad} ${SHORT_MONTHS[am - 1]} – ${dd} ${SHORT_MONTHS[dm - 1]}`;
}

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
  const [y, m, d] = parts(day)!;
  return y === Number(today.slice(0, 4)) ? `${d} ${SHORT_MONTHS[m - 1]}` : `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

/** Iniciales para el avatar: primera letra del primer y del último nombre. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toLocaleUpperCase("es");
}
