// Enlace público de una casa.
/** `ct-1001` → `CT-1001`; cualquier otra cosa → null (y la ruta responde 404 sin consultar). */
export function parsePublicId(raw: string): string | null {
  const id = raw.trim().toUpperCase();
  return /^CT-\d{4,}$/.test(id) ? id : null;
}

export function publicPath(publicId: string): string {
  return `/casa/${publicId}`;
}

export function publicUrl(publicId: string, base: string): string {
  return `${base.replace(/\/$/, "")}${publicPath(publicId)}`;
}
