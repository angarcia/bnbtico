// Números de WhatsApp en E.164. Sin «+» solo se aceptan móviles de Costa Rica (8 dígitos, con o sin 506 delante);
// cualquier otro país debe llevar su código con «+», para no enviar el código a un número ajeno.
const CR = "+506";
const CR_MOBILE = /^[5-8]\d{7}$/;

export function normalizePhone(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("506") && digits.length === 11) return CR_MOBILE.test(digits.slice(3)) ? "+" + digits : null;
  if (!hasPlus) return digits.length === 8 && CR_MOBILE.test(digits) ? CR + digits : null;
  if (digits.startsWith("506")) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}

/** Selector de país de la pantalla de ingresar: Costa Rica primero; después los países más probables en el Caribe tico. */
export const PHONE_COUNTRIES: readonly { code: string; name: string }[] = [
  { code: "506", name: "Costa Rica" },
  { code: "1", name: "Estados Unidos / Canadá" },
  { code: "505", name: "Nicaragua" },
  { code: "507", name: "Panamá" },
  { code: "52", name: "México" },
  { code: "57", name: "Colombia" },
  { code: "58", name: "Venezuela" },
  { code: "54", name: "Argentina" },
  { code: "34", name: "España" },
  { code: "49", name: "Alemania" },
  { code: "33", name: "Francia" },
  { code: "39", name: "Italia" },
  { code: "44", name: "Reino Unido" },
  { code: "31", name: "Países Bajos" },
  { code: "41", name: "Suiza" },
];
export const DEFAULT_COUNTRY = "506";
export const OTHER_COUNTRY = "other";

/**
 * País elegido + número escrito → E.164, o null si no es válido. Si el número empieza por «+» manda lo escrito.
 * Costa Rica: solo móviles. Estados Unidos y Canadá: 10 dígitos. Resto: 6–14 dígitos nacionales sin el 0 de marcación interna (salvo Italia, que lo conserva).
 */
export function composePhone(country: string, local: string): string | null {
  const raw = String(local ?? "").trim();
  if (raw.startsWith("+")) return normalizePhone(raw);
  if (country === OTHER_COUNTRY) return raw ? normalizePhone("+" + raw) : null;
  if (country === DEFAULT_COUNTRY) return normalizePhone(raw);
  let national = raw.replace(/\D/g, "");
  if (country !== "39" && national.startsWith("0")) national = national.slice(1);
  if (national.length < 6 || national.length > 14 || country.length + national.length > 15) return null;
  if (country === "1" && national.length === 11 && national.startsWith("1")) national = national.slice(1);
  if (country === "1" && national.length !== 10) return null;
  return normalizePhone("+" + country + national);
}

// Prefijos de país E.164: los de una cifra son 1 y 7; los de dos cifras, estos; el resto tiene tres.
const TWO_DIGIT = new Set("20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98".split(" "));

function countryCodeLength(digits: string): number {
  if (digits[0] === "1" || digits[0] === "7") return 1;
  return TWO_DIGIT.has(digits.slice(0, 2)) ? 2 : 3;
}

function group(rest: string): string {
  if (rest.length === 8) return `${rest.slice(0, 4)} ${rest.slice(4)}`;
  const parts = rest.match(/\d{1,3}/g) ?? [];
  if (parts.length > 1 && parts.at(-1)!.length === 1) parts.splice(-2, 2, parts.at(-2)! + parts.at(-1)!);
  return parts.join(" ");
}

export function formatPhone(e164: string): string {
  if (/^\+506\d{8}$/.test(e164)) return `+506 ${e164.slice(4, 8)} ${e164.slice(8)}`;
  if (!/^\+\d{8,15}$/.test(e164)) return e164;
  const digits = e164.slice(1);
  const n = countryCodeLength(digits);
  return `+${digits.slice(0, n)} ${group(digits.slice(n))}`;
}
