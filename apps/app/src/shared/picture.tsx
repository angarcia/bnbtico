import type { SyntheticEvent } from "react";
import type { PublicPhoto } from "../domain/listing";

/** Fundido al cargar para fotos que monta el cliente (`img[data-fade]` en global.css). Si ya estaba en caché, `ref` la
 *  marca al montarla; si falla, se queda oculta y se ve el fondo de su caja. Nunca en la portada de la ficha (es el LCP).
 *  Si llega casi al montarla (caché del service worker: la app instalada), aparece sin fundido: el fundido de 240 ms
 *  retrasaba el LCP del shell instalado de 0,24 s a 0,51 s y una foto que ya está no tiene por qué hacerse esperar. */
const INSTANT_MS = 100;
const mountedAt = new WeakMap<HTMLImageElement, number>();
export const fadeIn = {
  "data-fade": "",
  ref: (el: HTMLImageElement | null) => {
    if (!el) return;
    if (el.complete && el.naturalWidth) el.dataset.loaded = "";
    else mountedAt.set(el, performance.now());
  },
  onLoad: (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const since = mountedAt.get(el);
    if (since !== undefined && performance.now() - since < INSTANT_MS) el.dataset.instant = "";
    el.dataset.loaded = "";
  },
};

/** Foto con variantes 480/800 (`srcset` + `sizes`), dimensiones explícitas para no mover el diseño y carga diferida.
 *  Una foto anterior es un solo archivo: va sin `srcset`. `priority`: la foto que será el LCP (la primera tarjeta de
 *  Explorar): carga en seguida, con prioridad alta y sin fundido. */
export function Picture({ photo, alt, sizes, width, height, priority = false }: { photo: PublicPhoto; alt: string; sizes: string; width: number; height: number; priority?: boolean }) {
  const load = priority ? ({ loading: "eager", fetchPriority: "high" } as const) : ({ loading: "lazy", ...fadeIn } as const);
  return <img src={photo.url} srcSet={photo.srcSet ?? undefined} sizes={photo.srcSet ? sizes : undefined} alt={alt} width={width} height={height} decoding="async" {...load} />;
}
