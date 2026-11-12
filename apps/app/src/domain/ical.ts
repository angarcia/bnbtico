// Subconjunto iCalendar aprobado para Airbnb: bloques de días completos, sin recurrencias.
// Nunca conservar campos libres de huéspedes ni incorporarlos a los errores.
export interface ImportedBlock {
  uid: string;
  start: string;
  /** Fin exclusivo; no es una noche ocupada. */
  end: string;
}

export type IcalErrorCode = "url" | "calendar" | "unsupported" | "download" | "timeout" | "size";
const MESSAGES: Record<IcalErrorCode, string> = {
  url: "Revise el enlace de exportación de Airbnb.",
  calendar: "No pudimos leer el calendario. Revise el enlace e intente de nuevo.",
  unsupported: "Este calendario contiene eventos que todavía no podemos importar. Se conservan las últimas noches importadas.",
  download: "No pudimos leer el calendario. Revise el enlace e intente de nuevo.",
  timeout: "Airbnb tardó demasiado en responder. Intente de nuevo.",
  size: "El calendario supera el tamaño que podemos importar.",
};

export class IcalError extends Error {
  constructor(readonly code: IcalErrorCode) {
    super(MESSAGES[code]);
    this.name = "IcalError";
  }
}

export const ICAL_MAX_BYTES = 1_048_576;
export const ICAL_MAX_EVENTS = 5_000;

export function validateAirbnbUrl(raw: string): string {
  if (raw.length > 2048 || /[\u0000-\u0020\u007f]/.test(raw)) throw new IcalError("url");
  let url: URL;
  try { url = new URL(raw); } catch { throw new IcalError("url"); }
  const keys = [...url.searchParams.keys()];
  const tokens = url.searchParams.getAll("t");
  const locales = url.searchParams.getAll("locale");
  if (
    url.protocol !== "https:" || !["www.airbnb.com", "www.airbnb.ca"].includes(url.hostname) ||
    url.username || url.password || url.port || url.hash ||
    !/^\/calendar\/ical\/[0-9]{1,30}\.ics$/.test(url.pathname) ||
    keys.some(key => key !== "t" && key !== "locale") ||
    tokens.length !== 1 || !/^[a-f0-9]{32}$/i.test(tokens[0] ?? "") ||
    locales.length > 1 || locales.some(locale => !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale))
  ) throw new IcalError("url");
  // El idioma solo afecta a la presentación. La importación usa el enlace con su token.
  url.search = `?t=${tokens[0]}`;
  return url.href;
}

function date(value: string): string {
  if (!/^[0-9]{8}$/.test(value)) throw new IcalError("calendar");
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const t = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t.getTime()) || t.toISOString().slice(0, 10) !== iso) throw new IcalError("calendar");
  return iso;
}

type Property = { params: string[]; value: string };
type Event = Map<string, Property>;

function eventBlock(event: Event): ImportedBlock | null {
  for (const field of ["RRULE", "RDATE", "EXDATE", "RECURRENCE-ID", "DURATION"]) {
    if (event.has(field)) throw new IcalError("unsupported");
  }
  const uid = event.get("UID")?.value;
  const start = event.get("DTSTART");
  const end = event.get("DTEND");
  if (!uid || uid.length > 512 || /[\u0000-\u001f\u007f]/.test(uid) || !start || !end) throw new IcalError("calendar");
  for (const prop of [start, end]) {
    if (prop.params.length !== 1 || prop.params[0]?.toUpperCase() !== "VALUE=DATE") throw new IcalError("unsupported");
  }
  const block = { uid, start: date(start.value), end: date(end.value) };
  if (block.end <= block.start) throw new IcalError("calendar");
  const status = event.get("STATUS")?.value.toUpperCase();
  const transp = event.get("TRANSP")?.value.toUpperCase();
  if (status && !["TENTATIVE", "CONFIRMED", "CANCELLED"].includes(status)) throw new IcalError("calendar");
  if (transp && !["OPAQUE", "TRANSPARENT"].includes(transp)) throw new IcalError("calendar");
  return status === "CANCELLED" || transp === "TRANSPARENT" ? null : block;
}

export function parseAirbnbCalendar(text: string): ImportedBlock[] {
  if (new TextEncoder().encode(text).byteLength > ICAL_MAX_BYTES) throw new IcalError("size");
  // Desplegar antes de interpretar, incluida una línea cortada dentro de UID o DESCRIPTION.
  const lines = text.replace(/^\uFEFF/, "").replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  let calendar = false;
  let ended = false;
  let version = false;
  let event: Event | null = null;
  let count = 0;
  const seen = new Map<string, ImportedBlock | null>();
  // Los campos de texto privados se descartan al leer, no se guardan en Event.
  const kept = new Set(["UID", "DTSTART", "DTEND", "STATUS", "TRANSP", "RRULE", "RDATE", "EXDATE", "RECURRENCE-ID", "DURATION"]);
  for (const line of lines) {
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 1 || /[\u0000\r]/.test(line)) throw new IcalError("calendar");
    const [rawName, ...params] = line.slice(0, colon).split(";");
    const name = rawName!.toUpperCase();
    const value = line.slice(colon + 1);
    if (name === "BEGIN") {
      if (params.length) throw new IcalError("calendar");
      if (value.toUpperCase() === "VCALENDAR" && !calendar && !ended) calendar = true;
      else if (value.toUpperCase() === "VEVENT" && calendar && !ended && !event) {
        if (++count > ICAL_MAX_EVENTS) throw new IcalError("size");
        event = new Map();
      } else throw new IcalError("unsupported");
      continue;
    }
    if (!calendar || ended) throw new IcalError("calendar");
    if (name === "END") {
      if (params.length) throw new IcalError("calendar");
      if (value.toUpperCase() === "VEVENT" && event) {
        const block = eventBlock(event);
        const uid = event.get("UID")!.value;
        if (seen.has(uid) && JSON.stringify(seen.get(uid)) !== JSON.stringify(block)) throw new IcalError("calendar");
        seen.set(uid, block);
        event = null;
      } else if (value.toUpperCase() === "VCALENDAR" && !event) ended = true;
      else throw new IcalError("calendar");
      continue;
    }
    if (event) {
      if (kept.has(name)) {
        if (event.has(name)) throw new IcalError("calendar");
        event.set(name, { params, value });
      }
    } else if (name === "VERSION") {
      if (version || value !== "2.0" || params.length) throw new IcalError("calendar");
      version = true;
    } else if (name === "METHOD" && value.toUpperCase() !== "PUBLISH") {
      // Un mensaje incremental no es una instantánea completa: no reconciliar cancelaciones con él.
      throw new IcalError("unsupported");
    }
  }
  if (!calendar || !ended || event || !version) throw new IcalError("calendar");
  return [...seen.values()].filter((block): block is ImportedBlock => block !== null);
}
