// Fotos: qué formatos aceptamos y a qué tamaño se redimensionan en el navegador antes de subirlas a Storage.
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
export const UNSUPPORTED_MESSAGE = "Ese formato no se puede subir. Usá JPG o PNG.";
export const MAX_PHOTOS_MESSAGE = "Máximo 15 fotos.";

/** Por tipo MIME o, si el navegador no lo informa, por extensión. HEIC/HEIF de iPhone no se puede decodificar con canvas. */
export function acceptsImage(file: { type: string; name: string }): boolean {
  if ((ACCEPTED_TYPES as readonly string[]).includes(file.type)) return true;
  if (file.type) return false;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
}

/** Escala proporcional para que el lado mayor no pase de `maxSide`; nunca agranda. */
export function targetSize(w: number, h: number, maxSide = MAX_SIDE): { w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export function photoPath(listingId: string, uuid: string): string {
  return `${listingId}/${uuid}.jpg`;
}
