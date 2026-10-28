// Enlaces wa.me: los usan la hoja de contacto, Actividad y el soporte de bnbtico.

/** Enlace de WhatsApp a un número (solo dígitos); sin texto abre el chat a secas. */
export function waUrl(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text === undefined ? base : `${base}?text=${encodeURIComponent(text)}`;
}
