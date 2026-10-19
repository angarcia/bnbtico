// Enlace público de una casa y texto de la vista previa (WhatsApp, Google).
import { formatCRC } from "@/lib/money";
import { SITE_URL } from "@/lib/seo";
import { KIND_LABELS, type Kind } from "./schema";

/** `ct-1001` → `CT-1001`; cualquier otra cosa → null (y la ruta responde 404 sin consultar). */
export function parsePublicId(raw: string): string | null {
  const id = raw.trim().toUpperCase();
  return /^CT-\d{4,}$/.test(id) ? id : null;
}

export function publicUrl(publicId: string, base: string): string {
  return `${base.replace(/\/$/, "")}/casa/${publicId}`;
}

/** bnbtico.com en producción; en pruebas y local, el origen desde el que se sirve la página. */
export function shareBase(env: { NEXT_PUBLIC_STAGE?: string; NODE_ENV?: string }, origin: string | null): string {
  const production = env.NODE_ENV === "production" && env.NEXT_PUBLIC_STAGE !== "pruebas";
  return production || !origin ? SITE_URL : origin;
}

export function previewText(l: { kind: Kind; zone: string; province: string; capacity: number; nightlyPriceCrc: number }): string {
  return `${KIND_LABELS[l.kind]} en ${l.zone}, ${l.province} · ${l.capacity} personas · ${formatCRC(l.nightlyPriceCrc)} por noche · orientativo`;
}
