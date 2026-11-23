// La foto de la ficha en escritorio (historia 06): la ficha la pinta en una caja de 832 × 480 (`.listing-view > .hero`,
// shared/ficha.css; a 1280 la caja mide 797 de ancho) con object-fit: cover centrado. El editor de fotos de escritorio marca
// esa franja sobre la foto entera («Lo que se ve en la ficha»). Módulo de dominio: sin imports de framework.
export const FICHA_PHOTO = { width: 832, height: 480 } as const;

export interface Band {
  /** Fracciones de la foto (0–1), desde la esquina de arriba a la izquierda. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** La parte de una foto de proporción `ratio` (ancho / alto) que se ve en la ficha; null si la proporción no sirve. */
export function fichaBand(ratio: number): Band | null {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const frame = FICHA_PHOTO.width / FICHA_PHOTO.height;
  if (ratio > frame) {
    const width = frame / ratio;
    return { left: (1 - width) / 2, top: 0, width, height: 1 };
  }
  if (ratio < frame) {
    const height = ratio / frame;
    return { left: 0, top: (1 - height) / 2, width: 1, height };
  }
  return { left: 0, top: 0, width: 1, height: 1 };
}
