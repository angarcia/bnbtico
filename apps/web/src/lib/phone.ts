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

export function formatPhone(e164: string): string {
  if (/^\+506\d{8}$/.test(e164)) return `+506 ${e164.slice(4, 8)} ${e164.slice(8)}`;
  return e164;
}
