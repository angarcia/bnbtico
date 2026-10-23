import { useRef, useState, type ReactNode } from "react";
import type { PublicPhoto } from "../domain/listing";

/** Hero de la ficha (pantalla 03): fotos deslizables con contador «1 / 14»; los botones van encima como hijos. */
export function HeroGallery({ photos, title, children }: { photos: PublicPhoto[]; title: string; children?: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const onScroll = () => {
    const el = strip.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(photos.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
  };
  return (
    <div className="hero">
      {photos.length ? (
        <div className="strip" ref={strip} onScroll={onScroll} aria-label={`Fotos de ${title}`}>
          {photos.map((p, i) => (
            <img
              key={p.path}
              src={p.url}
              srcSet={p.srcSet ?? undefined}
              sizes={p.srcSet ? "100vw" : undefined}
              alt={i === 0 ? title : `${title}, foto ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding={i === 0 ? "sync" : "async"}
            />
          ))}
        </div>
      ) : null}
      <div className="top">{children}</div>
      {photos.length > 1 ? (
        <span className="pill pill-sm hero-counter" aria-live="polite">
          {`${index + 1} / ${photos.length}`}
        </span>
      ) : null}
    </div>
  );
}
