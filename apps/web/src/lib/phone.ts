// Números de WhatsApp en E.164. Costa Rica (+506) por defecto para números de 8 dígitos.
const CR = "+506";

export function normalizePhone(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    if (digits.startsWith("506") && digits.length !== 11) return null;
    return "+" + digits;
  }
  if (digits.length === 8) return CR + digits;
  if (digits.length === 11 && digits.startsWith("506")) return "+" + digits;
  if (digits.length >= 10 && digits.length <= 15) return "+" + digits;
  return null;
}

export function formatPhone(e164: string): string {
  if (/^\+506\d{8}$/.test(e164)) return `+506 ${e164.slice(4, 8)} ${e164.slice(8)}`;
  return e164;
}
