// Marcadores de precio del mapa de Explorar que se pisan (revisión UX 2026-10-29, C2): con dos píldoras una encima de
// otra se leía «₡95 ᴼᴼᴼ»; las que se tocan se juntan en una («2 casas»), en su punto medio. Sin Leaflet: lo usan el mapa
// (con los puntos en píxeles de Leaflet) y la caja antes de que llegue (con una proyección lineal).

/** Un marcador en píxeles de la caja (su centro) con su texto. */
export interface Pin {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface PinGroup {
  ids: string[];
  x: number;
  y: number;
}

/** Alto de la píldora y ancho medio de una cifra a 13 px (Figtree), con su relleno de 10 px a cada lado. */
const PIN_H = 28;
const CHAR_W = 7.6;
const PAD_X = 20;
/** Aire entre dos píldoras para que se lean separadas. */
const GAP = 4;

export function pinSize(label: string): { w: number; h: number } {
  return { w: Math.ceil(label.length * CHAR_W + PAD_X), h: PIN_H };
}

const overlaps = (a: Pin, b: Pin) => {
  const sa = pinSize(a.label);
  const sb = pinSize(b.label);
  return Math.abs(a.x - b.x) < (sa.w + sb.w) / 2 + GAP && Math.abs(a.y - b.y) < (sa.h + sb.h) / 2 + GAP;
};

/** Agrupa las que se pisan (también en cadena: la que pisa a cualquiera del grupo entra en él). En el orden de llegada. */
export function groupPins(pins: readonly Pin[]): PinGroup[] {
  const groups: Pin[][] = [];
  for (const p of pins) {
    const hit = groups.filter((g) => g.some((q) => overlaps(p, q)));
    if (!hit.length) {
      groups.push([p]);
      continue;
    }
    const merged = [...hit.flat(), p];
    const first = groups.indexOf(hit[0]!);
    for (const g of hit.slice(1)) groups.splice(groups.indexOf(g), 1);
    groups[first] = merged;
  }
  return groups.map((g) => ({ ids: g.map((p) => p.id), x: g.reduce((s, p) => s + p.x, 0) / g.length, y: g.reduce((s, p) => s + p.y, 0) / g.length }));
}

export const groupLabel = (n: number) => `${n} casas`;
