// El editor de fotos de una casa publicada en escritorio (historia 06, aprobada por Ana el 2026-11-20): una ventana casi a
// pantalla completa con un visor de la foto elegida entera (variante de 1600, con su proporción y al menos al tamaño de la
// ficha) y la franja «Lo que se ve en la ficha», y una columna de miniaturas enteras (480) para elegir, arrastrar y añadir.
// Mover, «Hacer portada» y quitar van al momento (los mismos caminos que la rejilla: usePhotoGrid); quitar una aprobada pide
// confirmación, una nueva en revisión no. No hay «Cancelar»: nada queda sin guardar. Trozo diferido (lo carga editar.tsx).
import { useLayoutEffect, useRef, useState } from "react";
import { variantUrl } from "../../domain/image";
import type { Photo } from "../../domain/listing";
import { fichaBand } from "../../domain/photo-view";
import { Button, TextButton } from "../../shared/ui/button";
import { I } from "../../shared/ui/icons";
import { Dialog } from "../../shared/ui/overlay";
import { fadeIn } from "../../shared/picture";
import { ConfirmSheet } from "../confirm-sheet";
import { UPLOAD_STEPS, progressOf } from "./photo-queue";
import { PHOTOS_HELP_DESKTOP, PhotoCounter, usePhotoGrid, type PhotoSource } from "./photo-grid";

const PHASE = { preparing: "Preparando…", uploading: "Subiendo…", saving: "Guardando…" } as const;
const SAVED = { order: "Orden guardado", removed: "Foto quitada" } as const;
export const REMOVE_TITLE = "¿Quitar esta foto?";
export const REMOVE_BODY = "Deja de verse en su ficha ahora. Si la vuelve a subir, la revisamos otra vez.";

type Item = { photo: Photo; pending: boolean; n: number };

function pendingLabel(p: Photo): string {
  return "status" in p && p.status === "changes" ? "Cambios pedidos" : "En revisión";
}
function pendingNote(p: Photo): string | null {
  return "reviewNote" in p && typeof p.reviewNote === "string" && p.reviewNote ? p.reviewNote : null;
}

export function PhotoEditorDialog({ source, userId, notice, onClose, returnFocus }: {
  source: PhotoSource;
  userId: string;
  notice: string;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const grid = usePhotoGrid(source, userId);
  const { photos, pending } = source;
  const items: Item[] = [
    ...photos.map((photo, i) => ({ photo, pending: false, n: i + 1 })),
    ...pending.map((photo, j) => ({ photo, pending: true, n: photos.length + j + 1 })),
  ];
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.photo.id ?? null);
  // Al quitar la elegida, se elige la que queda en su sitio (o la última).
  const lastIndex = useRef(0);
  const found = items.findIndex((x) => x.photo.id === selectedId);
  const index = found >= 0 ? found : Math.min(lastIndex.current, items.length - 1);
  const selected = index >= 0 ? items[index] : undefined;
  useLayoutEffect(() => {
    lastIndex.current = Math.max(index, 0);
    if (selected && selected.photo.id !== selectedId) setSelectedId(selected.photo.id);
  });
  // Proporción de cada foto: la da su miniatura al cargar (el visor la usa para su caja antes de que llegue la de 1600).
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const learn = (id: string, img: HTMLImageElement) => {
    const r = img.naturalWidth / img.naturalHeight;
    if (Number.isFinite(r) && r > 0) setRatios((all) => (all[id] === r ? all : { ...all, [id]: r }));
  };
  const [asking, setAsking] = useState<Photo | null>(null);

  const ratio = selected ? ratios[selected.photo.id] : undefined;
  const band = ratio ? fichaBand(ratio) : null;
  // Sin atributos style (CSP): la proporción y la franja van por CSSOM, como el arrastre.
  const picRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    picRef.current?.style.setProperty("--ar", String(ratio ?? 1.5));
    const el = bandRef.current;
    if (el && band) {
      el.style.left = `${band.left * 100}%`;
      el.style.top = `${band.top * 100}%`;
      el.style.width = `${band.width * 100}%`;
      el.style.height = `${band.height * 100}%`;
    }
  });
  const quitar = () => {
    if (!selected) return;
    if (selected.pending) grid.remove(selected.photo, true);
    else setAsking(selected.photo);
  };
  const status = grid.busy ? "Guardando…" : grid.saved ? SAVED[grid.saved] : "";

  return (
    <Dialog
      size="wide"
      layout="photos"
      title="Fotos"
      subtitle={<PhotoCounter counter={source.counter} />}
      busy={grid.busy}
      onClose={onClose}
      returnFocus={returnFocus}
      footer={
        <>
          <p className="small muted photo-editor-notice">{notice}</p>
          <span className="small primary photo-editor-saved" role="status">
            {status ? <>{grid.saved && !grid.busy ? <I.check size={16} /> : null}{status}</> : null}
          </span>
          <Button variant="primary" onClick={onClose}>Listo</Button>
        </>
      }
    >
      <div className="photo-editor">
        <section className="photo-view" aria-label="Foto elegida">
          <div className="photo-view-stage" data-testid="photo-viewer">
            {selected ? (
              <div className="photo-view-pic" ref={picRef}>
                <img
                  key={selected.photo.id}
                  src={variantUrl(selected.photo, 1600)}
                  alt={`Foto ${selected.n}`}
                  decoding="async"
                  onLoad={(e) => learn(selected.photo.id, e.currentTarget)}
                />
                {index === 0 ? <span className="tag">Portada</span> : null}
                {selected.pending ? <span className="tag tag-pending">{pendingLabel(selected.photo)}</span> : null}
                {band && band.width * band.height < 0.999 ? (
                  <span className="photo-view-band" ref={bandRef}>
                    <span className="xs">Lo que se ve en la ficha</span>
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="small muted">Añada fotos con «Añadir».</span>
            )}
          </div>
          {selected ? (
            <div className="photo-view-tools">
              <span className="small muted num">
                {selected.pending ? `Foto nueva · ${pendingLabel(selected.photo)}` : `Foto ${selected.n} de ${photos.length}${index === 0 ? " · portada" : ""}`}
              </span>
              {selected.pending ? (
                pendingNote(selected.photo) ? <span className="small">{pendingNote(selected.photo)}</span> : null
              ) : (
                <>
                  <Button variant="secondary" aria-disabled={grid.locked || index === 0 ? true : undefined} onClick={() => grid.move(selected.photo.id, index, "before")}>
                    Mover antes
                  </Button>
                  <Button variant="secondary" aria-disabled={grid.locked || index === photos.length - 1 ? true : undefined} onClick={() => grid.move(selected.photo.id, index, "after")}>
                    Mover después
                  </Button>
                  {index > 0 ? (
                    <Button variant="secondary" aria-disabled={grid.locked ? true : undefined} onClick={() => grid.makeCover(selected.photo.id)}>
                      Hacer portada
                    </Button>
                  ) : null}
                </>
              )}
              {selected.pending && !source.canAdd ? null : (
                <TextButton tone="danger" disabled={grid.busy || grid.drag.dragging} onClick={quitar}>
                  Quitar foto
                </TextButton>
              )}
            </div>
          ) : null}
        </section>

        <section className="photo-rail" aria-label="Todas las fotos">
          {photos.length >= 2 ? <p className="small muted photos-help">{PHOTOS_HELP_DESKTOP}</p> : null}
          <div className="photo-rail-scroll" ref={grid.scroller}>
            <div className={`photos-grid photo-rail-grid${grid.drag.dragging ? " is-dragging" : ""}`} ref={grid.drag.gridRef} aria-busy={grid.locked}>
              {items.map((x) => (
                <button
                  key={x.photo.id}
                  type="button"
                  className={`photo photo-thumb${x.pending ? " is-pending" : ""}${grid.drag.liftedId === x.photo.id ? " is-lifted" : ""}`}
                  data-photo={x.pending ? undefined : x.photo.id}
                  aria-label={`Foto ${x.n}${x.n === 1 && !x.pending ? ", portada" : ""}${x.pending ? `, ${pendingLabel(x.photo).toLowerCase()}` : ""}`}
                  aria-current={x.photo.id === selected?.photo.id ? "true" : undefined}
                  onPointerDown={x.pending ? undefined : (e) => grid.drag.onPointerDown(e, x.photo.id)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => setSelectedId(x.photo.id)}
                >
                  <img draggable={false} src={variantUrl(x.photo, 480)} alt="" loading="lazy" decoding="async" {...fadeIn} onLoad={(e) => {
                    fadeIn.onLoad(e);
                    learn(x.photo.id, e.currentTarget);
                  }} />
                  {x.n === 1 && !x.pending ? <span className="tag">Portada</span> : null}
                  {x.pending ? <span className="tag tag-pending">{pendingLabel(x.photo)}</span> : null}
                </button>
              ))}
              {grid.uploads.map((u) => (
                <div key={`u${u.key}`} className="photo uploading">
                  <span className="xs strong">{PHASE[u.phase]}</span>
                  <div className="upload-bar" role="progressbar" aria-label={`Subiendo ${u.name}`} aria-valuemin={0} aria-valuemax={UPLOAD_STEPS} aria-valuenow={progressOf(u)} data-step={progressOf(u)}>
                    <span />
                  </div>
                </div>
              ))}
              {grid.room ? (
                <label className="add">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-input" aria-label="Añadir fotos" onChange={grid.pick} />
                  <I.plus />
                  Añadir
                </label>
              ) : null}
            </div>
          </div>
          {grid.errors.length ? (
            <p className="field-error" role="alert">
              {grid.errors.join(" ")}
            </p>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {grid.announce}
          </p>
        </section>
      </div>
      {asking ? (
        <ConfirmSheet
          title={REMOVE_TITLE}
          body={REMOVE_BODY}
          confirmLabel="Quitar"
          tone="destructive"
          onClose={() => setAsking(null)}
          onConfirm={() => {
            const photo = asking;
            setAsking(null);
            grid.remove(photo, false);
          }}
        />
      ) : null}
    </Dialog>
  );
}
