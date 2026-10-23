import type { SyntheticEvent } from "react";
import type { PublicPhoto } from "../domain/listing";

/** Fundido al cargar para fotos que monta el cliente (`img[data-fade]` en global.css). Si ya estaba en caché, `ref` la
 *  marca al montarla; si falla, se queda oculta y se ve el fondo de su caja. Nunca en la portada de la ficha (es el LCP). */
export const fadeIn = {
  "data-fade": "",
  ref: (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth) el.dataset.loaded = "";
  },
  onLoad: (e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.dataset.loaded = "";
  },
};

/** Foto con variantes 480/800 (`srcset` + `sizes`), dimensiones explícitas para no mover el diseño y carga diferida.
 *  Una foto anterior es un solo archivo: va sin `srcset`. */
export function Picture({ photo, alt, sizes, width, height }: { photo: PublicPhoto; alt: string; sizes: string; width: number; height: number }) {
  return <img src={photo.url} srcSet={photo.srcSet ?? undefined} sizes={photo.srcSet ? sizes : undefined} alt={alt} width={width} height={height} loading="lazy" decoding="async" {...fadeIn} />;
}
