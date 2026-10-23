import type { PublicPhoto } from "../domain/listing";

/** Foto con variantes 480/800 (`srcset` + `sizes`), dimensiones explícitas para no mover el diseño y carga diferida.
 *  Una foto anterior es un solo archivo: va sin `srcset`. */
export function Picture({ photo, alt, sizes, width, height }: { photo: PublicPhoto; alt: string; sizes: string; width: number; height: number }) {
  return <img src={photo.url} srcSet={photo.srcSet ?? undefined} sizes={photo.srcSet ? sizes : undefined} alt={alt} width={width} height={height} loading="lazy" decoding="async" />;
}
