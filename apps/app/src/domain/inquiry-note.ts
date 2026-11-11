import { INQUIRY_GREETING, inquiryMessageTail, type OwnerInquiry } from "./inquiry";

/** Solo Consultas: muestra notas, no un borrador de WhatsApp que pudo cambiar antes de enviarse. */
export function inquiryNote(i: Pick<OwnerInquiry, "source" | "message" | "arrival" | "departure" | "people">): string | null {
  const text = i.message.trim();
  if (!text || i.source === "support") return text || null;
  // Se reconoce la plantilla por sus fechas y personas, incluso si la casa cambió de nombre después.
  const tail = inquiryMessageTail(i);
  return text.startsWith(INQUIRY_GREETING) && text.endsWith(tail) && text.length > INQUIRY_GREETING.length + tail.length ? null : text;
}
