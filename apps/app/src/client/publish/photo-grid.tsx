// La rejilla de fotos: la del paso 7 del asistente y la del editor de fotos de una casa publicada (maqueta 08d). La rejilla
// y el recuento salen de la lista del servidor: subir y quitar releen la casa antes de mostrar el cambio. Reordenar
// (arrastrando o con los botones ocultos) se ve al instante (optimista) y vuelve al orden anterior si el servidor lo rechaza;
// después se relee la casa. Las fotos en curso se ven aparte, con su progreso. Las fotos pendientes (las nuevas de una
// edición) van detrás de las demás con «En revisión»: no se arrastran, se pueden quitar. Lo que cambia entre los dos usos
// (registrar, quitar, el contador, si se puede añadir) lo trae `PhotoSource`. El código de canvas (resize.ts) se carga al
// elegir fotos.
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from "react";
import { variantUrl } from "../../domain/image";
import type { Photo } from "../../domain/listing";
import { moveBy } from "../../domain/photo-order";
import { I } from "../../shared/icons";
import { fadeIn } from "../../shared/picture";
import { photosApi } from "../owner";
import { UPLOAD_STEPS, createUploadQueue, progressOf, type UploadItem, type UploadQueue } from "./photo-queue";
import { photoReorderCallbacks, photosErrorMessage } from "./photo-reorder";
import { usePhotoDrag } from "./use-photo-drag";

export interface PhotoSource {
  listingId: string;
  /** Se arrastran, en orden; la primera es la portada. */
  photos: Photo[];
  /** Detrás de las demás, con «En revisión»; no se arrastran (en el asistente, []). */
  pending: Photo[];
  /** «short»: faltan fotos (ocre, asistente); «ok»: verde (asistente); «muted»: gris (editor, maqueta 08d). */
  counter: { text: string; tone: "short" | "ok" | "muted" };
  /** Fotos que aún caben (sin contar las que están subiendo: eso se resta aquí). */
  room: number;
  canAdd: boolean;
  register(folder: string): Promise<unknown>;
  remove(photo: Photo, pending: boolean): Promise<void>;
  reorder(ids: string[]): Promise<void>;
  reread(): Promise<void>;
}

/** Una cola por casa, fuera de la pantalla: sobrevive a ir al paso 8 (o a la ficha) y volver. */
const queues = new Map<string, UploadQueue>();
const queueFor = (id: string) => {
  let q = queues.get(id);
  if (!q) queues.set(id, (q = createUploadQueue()));
  return q;
};

const TONE: Record<PhotoSource["counter"]["tone"], string> = { short: " is-short", ok: " primary", muted: " muted" };

/** La relectura de la casa tras subir, quitar u ordenar (lista de Mis casas y detalle). */
export const rereadOwnListing = (client: QueryClient, userId: string, listingId: string) => async () => {
  void client.invalidateQueries({ queryKey: ["own-listings", userId] });
  await client.invalidateQueries({ queryKey: ["own-listing", userId, listingId] });
};

const PHASE: Record<UploadItem["phase"], string> = { preparing: "Preparando…", uploading: "Subiendo…", saving: "Guardando…" };
const movedTo = (to: number) => (to === 0 ? "Foto movida a la posición 1, portada" : `Foto movida a la posición ${to + 1}`);
type Dir = "before" | "after";

/** El contador del asistente y del editor (con role="status": lo anuncia el lector de pantalla). */
export function PhotoCounter({ counter }: { counter: PhotoSource["counter"] }) {
  return (
    <span className={`small num photos-count${TONE[counter.tone]}`} role="status">
      {counter.text}
    </span>
  );
}

/** `header`: lo que va encima de la ayuda (en el asistente, el título con el contador; en el editor, nada: el contador va
 * en la cabecera de la pantalla). */
export function PhotoGrid({ source, userId, header }: { source: PhotoSource; userId: string; header?: ReactNode }) {
  const client = useQueryClient();
  const queue = queueFor(source.listingId);
  const uploads = useSyncExternalStore(queue.subscribe, queue.items, queue.items);
  const notices = useSyncExternalStore(queue.subscribe, queue.notices, queue.notices);
  const [announce, setAnnounce] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const follow = useRef<{ id: string; dir: Dir } | null>(null);
  const { photos, pending, reread } = source;
  const ids = photos.map((p) => p.id);
  const order = ids.join();

  // Quitar: la mutación sigue «en curso» hasta que llega la lista nueva del servidor.
  const change = useMutation({ mutationFn: (run: () => Promise<void>) => run(), onSettled: reread });
  const optimistic = photoReorderCallbacks(client, userId, source.listingId, reread);
  const reorder = useMutation({
    mutationFn: (next: string[]) => source.reorder(next),
    ...optimistic,
    // El foco sigue a la foto hasta que el orden queda firme (también tras deshacerlo); luego no se vuelve a mover.
    onSettled: async () => {
      await optimistic.onSettled();
      follow.current = null;
    },
    onError: (e, next, ctx) => {
      optimistic.onError(e, next, ctx);
      setAnnounce("");
    },
  });

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;
    change.reset();
    reorder.reset();
    follow.current = null;
    void queue.start(files, source.room - queue.inFlight(), {
      prepare: async (file) => (await import("./resize")).makeVariants(file),
      upload: async (variants, onUploaded) => (await photosApi()).upload(source.listingId, variants, onUploaded),
      add: (folder) => source.register(folder),
      discard: async (folder) => (await photosApi()).discard(folder),
      refresh: reread,
    });
  }

  const busy = change.isPending || reorder.isPending;
  // Soltar en otro sitio: el orden nuevo se ve al instante y se guarda con una sola petición.
  const drag = usePhotoDrag({
    ids,
    enabled: !busy && uploads.length === 0,
    scroller,
    onDrop: (next, id) => {
      follow.current = null;
      setAnnounce(movedTo(next.indexOf(id)));
      change.reset();
      reorder.mutate(next);
    },
  });

  // El foco sigue a la foto movida: React puede mover el botón enfocado con insertBefore, y eso lo desenfoca.
  useLayoutEffect(() => {
    const f = follow.current;
    const active = document.activeElement;
    if (!f || (active && active !== document.body && !drag.gridRef.current?.contains(active))) return;
    drag.gridRef.current?.querySelector<HTMLElement>(`[data-photo="${f.id}"] [data-move="${f.dir}"]`)?.focus();
  }, [order]);

  const room = source.canAdd && uploads.length < source.room;
  const errors = [...notices, ...[change, reorder].flatMap((m) => (m.isError ? [photosErrorMessage(m.error)] : []))];

  function remove(photo: Photo, isPending: boolean) {
    follow.current = null;
    reorder.reset();
    change.mutate(() => source.remove(photo, isPending));
  }

  /** Botones ocultos: con aria-disabled (no disabled) para que el foco no se pierda al llegar a un extremo. */
  function move(id: string, from: number, dir: Dir) {
    const to = from + (dir === "before" ? -1 : 1);
    if (busy || uploads.length > 0 || to < 0 || to >= ids.length) return;
    follow.current = { id, dir };
    setAnnounce(movedTo(to));
    change.reset();
    reorder.mutate(moveBy(ids, id, dir === "before" ? -1 : 1));
  }

  return (
    <div className="stack grow-col gap-12">
      {header}
      {photos.length >= 2 ? <p className="small muted photos-help">Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.</p> : null}
      <div className="photos-scroll" ref={scroller}>
        <div className={`photos-grid${drag.dragging ? " is-dragging" : ""}`} ref={drag.gridRef} aria-busy={busy || uploads.length > 0}>
          {photos.map((p, i) => (
            <div
              key={p.id}
              className={`photo${i === 0 ? " cover" : ""}${drag.liftedId === p.id ? " is-lifted" : ""}`}
              data-photo={p.id}
              onPointerDown={(e) => drag.onPointerDown(e, p.id)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <img draggable={false} src={variantUrl(p, i === 0 ? 800 : 480)} alt="" loading="lazy" decoding="async" {...fadeIn} />
              {i === 0 ? <span className="tag">Portada</span> : null}
              <button type="button" className="remove" aria-label={`Quitar foto ${i + 1}`} disabled={busy || drag.dragging} onClick={() => remove(p, false)}>
                <I.x size={16} />
              </button>
              <button type="button" className="sr-move" data-move="before" aria-disabled={busy || uploads.length > 0 || i === 0 ? true : undefined} onClick={() => move(p.id, i, "before")}>
                Mover foto {i + 1} antes
              </button>
              <button type="button" className="sr-move" data-move="after" aria-disabled={busy || uploads.length > 0 || i === ids.length - 1 ? true : undefined} onClick={() => move(p.id, i, "after")}>
                Mover foto {i + 1} después
              </button>
            </div>
          ))}
          {pending.map((p, j) => (
            <div key={p.id} className="photo is-pending">
              <img draggable={false} src={variantUrl(p, 480)} alt="" loading="lazy" decoding="async" {...fadeIn} />
              <span className="tag tag-pending">En revisión</span>
              {/* Con la edición en revisión, sus fotos nuevas tampoco se quitan (la base lo rechaza). */}
              {source.canAdd ? (
                <button type="button" className="remove" aria-label={`Quitar foto ${photos.length + j + 1}`} disabled={busy || drag.dragging} onClick={() => remove(p, true)}>
                  <I.x size={16} />
                </button>
              ) : null}
            </div>
          ))}
          {uploads.map((u) => (
            <div key={`u${u.key}`} className="photo uploading">
              <span className="xs strong">{PHASE[u.phase]}</span>
              <div
                className="upload-bar"
                role="progressbar"
                aria-label={`Subiendo ${u.name}`}
                aria-valuemin={0}
                aria-valuemax={UPLOAD_STEPS}
                aria-valuenow={progressOf(u)}
                data-step={progressOf(u)}
              >
                <span />
              </div>
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
      {errors.length ? (
        <p className="field-error" role="alert">
          {errors.join(" ")}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
