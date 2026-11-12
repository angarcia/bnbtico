// Tipo de cambio de referencia USD→CRC (ticket 21). Solo para mostrar precios en dólares: los propietarios fijan y cobran
// en colones. El cron diario del worker lo pide a una fuente gratuita y lo guarda en `fx_rates`; aquí, las reglas sin
// red: parsers de cada fuente, rango plausible, orden de las fuentes, atribución y cómo se muestra.

export type FxSource = "fawazahmed0" | "exchangerate-api" | "constante";

export interface FxRate {
  /** Colones por dólar (4 decimales, como la columna). */
  crcPerUsd: number;
  /** `YYYY-MM-DD`: el día del tipo según la fuente. */
  day: string;
  source: FxSource;
}

/** La fila inicial de la migración: la constante que usaba la app, para que todo funcione antes del primer cron. */
export const FX_INITIAL: FxRate = { crcPerUsd: 510, day: "2026-10-26", source: "constante" };

/** Fuera de este rango la respuesta se trata como errónea (la base tiene el mismo check). */
export const FX_RANGE = { min: 300, max: 900 } as const;

export function isPlausibleRate(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= FX_RANGE.min && n <= FX_RANGE.max;
}

type Quote = Omit<FxRate, "source">;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** fawazahmed0/exchange-api: `{ date: "2026-10-26", usd: { crc: 455.07, … } }`. */
export function parseFawazahmed0(json: unknown): Quote | null {
  if (!isObject(json) || typeof json.date !== "string" || !DAY.test(json.date) || !isObject(json.usd)) return null;
  const crc = json.usd.crc;
  return isPlausibleRate(crc) ? { crcPerUsd: round4(crc), day: json.date } : null;
}

/** ExchangeRate-API (acceso abierto): `{ result: "success", base_code: "USD", time_last_update_unix, rates: { CRC } }`. */
export function parseExchangeRateApi(json: unknown): Quote | null {
  if (!isObject(json) || json.result !== "success" || json.base_code !== "USD" || !isObject(json.rates)) return null;
  const crc = json.rates.CRC;
  const unix = json.time_last_update_unix;
  if (!isPlausibleRate(crc) || typeof unix !== "number" || !Number.isFinite(unix)) return null;
  return { crcPerUsd: round4(crc), day: new Date(unix * 1000).toISOString().slice(0, 10) };
}

export interface FxSourceDef {
  source: Exclude<FxSource, "constante">;
  url: string;
  parse(json: unknown): Quote | null;
}

/**
 * En orden. Principal: fawazahmed0 (CC0, sin atribución), por jsDelivr y, si falla, por el dominio de respaldo que
 * documenta el propio proyecto. Respaldo: ExchangeRate-API, que exige atribución (FX_ATTRIBUTION).
 */
export const FX_SOURCES: readonly FxSourceDef[] = [
  { source: "fawazahmed0", url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", parse: parseFawazahmed0 },
  { source: "fawazahmed0", url: "https://latest.currency-api.pages.dev/v1/currencies/usd.json", parse: parseFawazahmed0 },
  { source: "exchangerate-api", url: "https://open.er-api.com/v6/latest/USD", parse: parseExchangeRateApi },
];

export const FX_TIMEOUT_MS = 8_000;

/** Prueba las fuentes en orden y se queda con la primera respuesta válida y plausible; null si ninguna (se conserva el
 *  último tipo guardado). `failures`: por qué falló cada una de las anteriores, para el log del cron. */
export async function fetchFxRate(fetcher: typeof fetch, sources: readonly FxSourceDef[] = FX_SOURCES): Promise<{ rate: FxRate | null; failures: string[] }> {
  const failures: string[] = [];
  for (const s of sources) {
    try {
      const res = await fetcher(s.url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
      if (!res.ok) {
        failures.push(`${s.url}: HTTP ${res.status}`);
        continue;
      }
      const quote = s.parse(await res.json().catch(() => null));
      if (!quote) {
        failures.push(`${s.url}: respuesta no válida`);
        continue;
      }
      return { rate: { ...quote, source: s.source }, failures };
    } catch (e) {
      failures.push(`${s.url}: ${String(e)}`);
    }
  }
  return { rate: null, failures };
}

/** Atribución que exige cada fuente (texto y enlace que pide ExchangeRate-API en su documentación); null si no exige. */
export const FX_ATTRIBUTION: Record<FxSource, { text: string; href: string } | null> = {
  fawazahmed0: null,
  "exchangerate-api": { text: "Rates By Exchange Rate API", href: "https://www.exchangerate-api.com" },
  constante: null,
};

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** «26 oct.» a partir de `YYYY-MM-DD`, sin zona horaria (igual en el worker y en el navegador). */
export function fxDayLabel(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  const month = m ? SHORT_MONTHS[Number(m[1]) - 1] : undefined;
  return m && month ? `${Number(m[2])} ${month}.` : day;
}

const SOURCES: readonly FxSource[] = ["fawazahmed0", "exchangerate-api", "constante"];

/** Fila de `fx_rates` (la fuente la limita un check; una desconocida se trata como la constante). */
export function fromFxRow(row: { day: string; crc_per_usd: number | string; source: string }): FxRate {
  const source = (SOURCES as readonly string[]).includes(row.source) ? (row.source as FxSource) : "constante";
  return { crcPerUsd: Number(row.crc_per_usd), day: row.day, source };
}

/** «₡456»: el tipo redondeado al colón, para las notas. */
export function fxRateLabel(crcPerUsd: number): string {
  return `₡${Math.round(crcPerUsd)}`;
}
