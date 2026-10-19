"use client";
import { useState } from "react";
import type { Photo } from "@/lib/listings/schema";

/** Miniaturas con ampliación (anterior / siguiente / cerrar). Sirve en la revisión del admin y en la ficha pública. */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (photos.length === 0) return <div className="photo" style={{ borderRadius: 12 }}><span className="small">Sin fotos</span></div>;
  const label = (i: number) => `Foto ${i + 1} de ${photos.length}${i === 0 ? " · Portada" : ""}`;
  const current = selected !== null ? photos[selected] : undefined;
  return (
    <div className="stack">
      {selected !== null && current ? (
        <div className="stack" aria-live="polite">
          <h3>{label(selected)}</h3>
          <div className="photo" style={{ borderRadius: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={`${title}, ${label(selected)}`} />
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn-ghost" disabled={selected === 0} onClick={() => setSelected(selected - 1)}>Anterior</button>
            <button type="button" className="btn btn-ghost" disabled={selected === photos.length - 1} onClick={() => setSelected(selected + 1)}>Siguiente</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar ampliación</button>
          </div>
        </div>
      ) : null}
      <div className="photos-grid">
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="photo" style={{ padding: 0, border: 0 }} aria-label={`Ampliar foto ${i + 1}${i === 0 ? ", portada" : ""}`} aria-pressed={selected === i} onClick={() => setSelected(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" />
            {i === 0 ? <span className="tag">Portada</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
