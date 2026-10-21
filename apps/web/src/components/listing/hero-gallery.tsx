"use client";
import { useRef, useState } from "react";
import type { Photo } from "@/lib/listings/schema";

/** Hero de la ficha (pantalla 03): fotos deslizables con contador «1 / 14»; los botones van encima, pasados como hijos. */
export function HeroGallery({ photos, title, children }: { photos: Photo[]; title: string; children?: React.ReactNode }) {
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
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt={i === 0 ? title : `${title}, foto ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
          ))}
        </div>
      ) : null}
      <div className="top">{children}</div>
      {photos.length > 1 ? <span className="pill pill-sm" style={{ right: 14, bottom: 14 }} aria-live="polite">{index + 1} / {photos.length}</span> : null}
    </div>
  );
}
