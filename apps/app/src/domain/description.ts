// Descripción de la ficha: párrafos separados por líneas en blanco y, si es larga, recortada con «Ver más» (como en Airbnb).
// Se decide con una estimación de líneas en el teléfono, igual en el servidor y en el navegador: sin medir tras hidratar,
// ni avisos de hidratación ni saltos de la página.

/** Líneas que se ven antes de «Ver más». */
export const DESCRIPTION_CLAMP_LINES = 8;
/** Caracteres por línea de la descripción (18 px) en un teléfono de 375 px con 20 px a cada lado. */
const CHARS_PER_LINE = 38;

/** Los párrafos: separados por una o más líneas en blanco; un salto suelto se queda dentro del párrafo. */
export function descriptionParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Líneas que ocupa en el teléfono: cada línea escrita, partida a lo ancho, y una línea de separación entre párrafos. */
function estimatedLines(paragraphs: string[]): number {
  const text = paragraphs.reduce((n, p) => n + p.split("\n").reduce((m, line) => m + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0), 0);
  return text + Math.max(0, paragraphs.length - 1);
}

/** Lleva «Ver más» si pasa de una línea más que las que se ven (con 9 líneas se ve entera: recortar una no compensa). */
export function isLongDescription(text: string): boolean {
  return estimatedLines(descriptionParagraphs(text)) > DESCRIPTION_CLAMP_LINES + 1;
}
