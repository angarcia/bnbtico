// Fotos: qué formatos aceptamos y a qué tamaño se redimensionan en el navegador antes de subirlas a Storage.
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const MAX_SIDE = 1600;
export const UNSUPPORTED_MESSAGE = "Ese formato no se puede subir. Use JPG o PNG.";
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

/** Variantes que genera el navegador al subir (ticket 08): lado mayor 480, 800 y 1600 px. */
export const VARIANT_SIZES = [480, 800, 1600] as const;
export type VariantSize = (typeof VARIANT_SIZES)[number];

/** Las fotos anteriores son un único archivo (`<casa>/<uuid>.jpg`); las nuevas, una carpeta con las tres variantes. */
export const isLegacyPhotoPath = (path: string) => /\.(jpe?g|png|webp)$/i.test(path);

export function variantPath(path: string, size: VariantSize): string {
  return isLegacyPhotoPath(path) ? path : `${path}/${size}.jpg`;
}

/** `srcset` de 480 y 800 para tarjetas y hero; null para una foto anterior (un solo tamaño). */
export function photoSrcSet(path: string, url: (path: string) => string): string | null {
  if (isLegacyPhotoPath(path)) return null;
  return `${url(variantPath(path, 480))} 480w, ${url(variantPath(path, 800))} 800w`;
}

/** Otra variante a partir de la URL de la foto (la de 800 en una foto nueva; el único archivo en una anterior). */
export function variantUrl(photo: { path: string; url: string }, size: VariantSize): string {
  return isLegacyPhotoPath(photo.path) ? photo.url : photo.url.replace(/\/\d+\.jpg$/, `/${size}.jpg`);
}

// ---------- Subida (ticket 08): tres JPEG por foto, generados en el navegador ----------
export const VARIANT_QUALITY = 0.8;
/** Los objetos no cambian nunca (cada foto tiene su uuid): caché de un año. */
export const PHOTO_CACHE_SECONDS = 31_536_000;

/** Medidas de cada variante; nunca agranda (una foto de 640 px queda en 640 en la de 800 y en la de 1600). */
export function variantTargets(w: number, h: number): { size: VariantSize; w: number; h: number }[] {
  return VARIANT_SIZES.map((size) => ({ size, ...targetSize(w, h, size) }));
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** La carpeta de una foto nueva: `<casa>/<uuid>`; dentro van 480.jpg, 800.jpg y 1600.jpg. */
export const photoFolder = (listingId: string, uuid: string) => `${listingId}/${uuid}`;

/** Lo que acepta add_listing_photo: una carpeta de esa casa. */
export const isPhotoFolder = (listingId: string, path: string) => path.startsWith(`${listingId}/`) && new RegExp(`^${UUID}/${UUID}$`).test(path);

/** Los objetos de Storage de una foto: las tres variantes, o el único archivo de una foto anterior. */
export function photoObjectPaths(path: string): string[] {
  return isLegacyPhotoPath(path) ? [path] : VARIANT_SIZES.map((size) => variantPath(path, size));
}
