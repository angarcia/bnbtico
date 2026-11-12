import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicPhoto } from "../domain/listing";
import { fadeIn } from "./picture";
import { PhotoDots } from "./photo-dots";

/** Hero de la ficha (pantalla 03): fotos deslizables con puntitos (los de las tarjetas de Explorar); los botones van encima como hijos.
 *  Del servidor solo llega la portada (el LCP); las demás fotos son cajas del mismo tamaño hasta que la página cargó o
 *  se desliza el carrusel. Con `loading="lazy"` Chrome las pedía igual (están a una pantalla en horizontal) y en Slow 4G
 *  le quitaban ancho de banda a la portada y al JS que hidrata (ticket 12). */
export function HeroGallery({ photos, title, children }: { photos: PublicPhoto[]; title: string; children?: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [allPhotos, setAllPhotos] = useState(false);
  useEffect(() => {
    if (allPhotos) return;
    const show = () => setAllPhotos(true);
    if (document.readyState === "complete") return show();
    addEventListener("load", show, { once: true });
    return () => removeEventListener("load", show);
  }, [allPhotos]);
  const onScroll = () => {
    setAllPhotos(true);
    const el = strip.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(photos.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
  };
  return (
    <div className="hero">
      {photos.length ? (
        <div className="strip" ref={strip} onScroll={onScroll} aria-label={`Fotos de ${title}`}>
          {photos.map((p, i) =>
            i > 0 && !allPhotos ? (
              <div key={p.path} className="slot" aria-hidden="true" />
            ) : (
              <img
                key={p.path}
                src={p.url}
                srcSet={p.srcSet ?? undefined}
                sizes={p.srcSet ? "100vw" : undefined}
                alt={i === 0 ? title : `${title}, foto ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding={i === 0 ? "sync" : "async"}
                {...(i === 0 ? {} : fadeIn)}
              />
            ),
          )}
        </div>
      ) : null}
      <div className="top">{children}</div>
      {/* Puntitos, como en las tarjetas de Explorar (2026-11-03); la posición, en texto para el lector de pantalla. */}
      <PhotoDots index={index} count={photos.length} />
      {photos.length > 1 ? (
        <span className="sr-only" aria-live="polite">{`Foto ${index + 1} de ${photos.length}`}</span>
      ) : null}
    </div>
  );
}
