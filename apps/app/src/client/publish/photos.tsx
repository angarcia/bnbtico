// Pantalla 7 del asistente: fotos. La rejilla, el recuento y el orden salen siempre de la lista del servidor: tras subir,
// quitar o reordenar se relee la casa (nada se reordena en el navegador por su cuenta). Las fotos en curso se ven aparte,
// con su progreso. El código de canvas (resize.ts) se carga al elegir fotos.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import type { PhotosApi } from "../../domain/api";
import { DomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { MAX_PHOTOS, MIN_PHOTOS, type Listing } from "../../domain/listing";
import { asCover, moveBy } from "../../domain/photo-order";
import { I } from "../../shared/icons";
import { photosApi } from "../owner";
import { UPLOAD_STEPS, createUploadQueue, progressOf, type UploadItem, type UploadQueue } from "./photo-queue";

/** Una cola por casa, fuera de la pantalla: sobrevive a ir al paso 8 y volver. */
const queues = new Map<string, UploadQueue>();
const queueFor = (id: string) => {
  let q = queues.get(id);
  if (!q) queues.set(id, (q = createUploadQueue()));
  return q;
};

const PHASE: Record<UploadItem["phase"], string> = { preparing: "Preparando…", uploading: "Subiendo…", saving: "Guardando…" };
const message = (e: unknown) => (e instanceof DomainError ? e.message : "No pudimos cambiar las fotos. Intente de nuevo.");

export function PhotoUploader({ listing, userId }: { listing: Listing; userId: string }) {
  const client = useQueryClient();
  const queue = queueFor(listing.id);
  const uploads = useSyncExternalStore(queue.subscribe, queue.items, queue.items);
  const notices = useSyncExternalStore(queue.subscribe, queue.notices, queue.notices);
  const [selected, setSelected] = useState<string | null>(null);
  const photos = listing.photos;
  const ids = photos.map((p) => p.id);

  const reread = async () => {
    void client.invalidateQueries({ queryKey: ["own-listings", userId] });
    await client.invalidateQueries({ queryKey: ["own-listing", userId, listing.id] });
  };

  // Quitar y reordenar: la mutación sigue «en curso» hasta que llega la lista nueva del servidor.
  const change = useMutation({
    mutationFn: async (run: (api: PhotosApi) => Promise<void>) => run(await photosApi()),
    onSettled: reread,
  });

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;
    change.reset();
    void queue.start(files, MAX_PHOTOS - photos.length - queue.inFlight(), {
      prepare: async (file) => (await import("./resize")).makeVariants(file),
      upload: async (variants, onUploaded) => (await photosApi()).upload(listing.id, variants, onUploaded),
      add: async (folder) => (await photosApi()).add(listing.id, folder),
      discard: async (folder) => (await photosApi()).discard(folder),
      refresh: reread,
    });
  }

  const reorder = (order: string[]) => change.mutate((api) => api.reorder(listing.id, order));
  const current = selected && ids.includes(selected) ? selected : null;
  const index = current ? ids.indexOf(current) : -1;
  const busy = change.isPending;
  const room = photos.length + uploads.length < MAX_PHOTOS;
  const errors = [...notices, ...(change.isError ? [message(change.error)] : [])];

  return (
    <div className="stack grow-col gap-12">
      <div className="row between baseline">
        <h2>Fotos</h2>
        <span className="small primary num photos-count" role="status">
          {photos.length} de {MIN_PHOTOS}–{MAX_PHOTOS}
        </span>
      </div>
      <div className="photos-scroll">
        <div className="photos-grid" aria-busy={busy || uploads.length > 0}>
          {photos.map((p, i) => (
            <div key={p.id} className={`photo${i === 0 ? " cover" : ""}${p.id === current ? " is-selected" : ""}`}>
              <button type="button" className="photo-pick" aria-pressed={p.id === current} aria-label={i === 0 ? "Portada" : `Foto ${i + 1}`} onClick={() => setSelected(p.id === current ? null : p.id)}>
                <img src={variantUrl(p, i === 0 ? 800 : 480)} alt="" loading="lazy" decoding="async" />
              </button>
              {i === 0 ? <span className="tag">Portada</span> : null}
              <button type="button" className="remove" aria-label={`Quitar foto ${i + 1}`} disabled={busy} onClick={() => change.mutate((api) => api.remove(p.id))}>
                <I.x size={16} />
              </button>
            </div>
          ))}
          {uploads.map((u) => (
            <div key={`u${u.key}`} className="photo uploading">
              <span className="xs strong">{PHASE[u.phase]}</span>
              <progress className="upload-bar" max={UPLOAD_STEPS} value={progressOf(u)} aria-label={`Subiendo ${u.name}`} />
            </div>
          ))}
          {room ? (
            <label className="add">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-input" aria-label="Añadir fotos" onChange={pick} />
              <I.plus />
              Añadir
            </label>
          ) : null}
        </div>
      </div>
      {current ? (
        <div className="row gap-8 photo-actions" role="group" aria-label={`Foto ${index + 1}`}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || index === 0} onClick={() => reorder(asCover(ids, current))}>
            Hacer portada
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || index === 0} aria-label="Mover antes" onClick={() => reorder(moveBy(ids, current, -1))}>
            ← Antes
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || index === ids.length - 1} aria-label="Mover después" onClick={() => reorder(moveBy(ids, current, 1))}>
            Después →
          </button>
        </div>
      ) : null}
      {errors.length ? (
        <p className="field-error" role="alert">
          {errors.join(" ")}
        </p>
      ) : null}
      {photos.length < MIN_PHOTOS ? <span className="small strong">Añada al menos {MIN_PHOTOS} fotos.</span> : null}
    </div>
  );
}
