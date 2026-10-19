"use client";
import { useState, useTransition } from "react";
import { addPhotoAction, removePhotoAction, setCoverAction, signPhotoUploadAction } from "@/actions/listings";
import { JPEG_QUALITY, MAX_PHOTOS_MESSAGE, UNSUPPORTED_MESSAGE, acceptsImage, targetSize } from "@/lib/image";
import { MAX_PHOTOS, type Photo } from "@/lib/listings/schema";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PHOTO_BUCKET } from "@/lib/supabase/storage";

/** Redimensiona en el navegador y sube directo a Storage con una URL firmada por el servidor; la fila la crea una Server Action. */
export function PhotoUploader({ listingId, photos: initial }: { listingId: string; photos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(0);
  const [pending, start] = useTransition();
  const full = photos.length >= MAX_PHOTOS;

  async function toJpeg(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const { w, h } = targetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("sin imagen"))), "image/jpeg", JPEG_QUALITY));
  }

  async function upload(files: FileList | null) {
    if (!files) return;
    setError(null);
    const list = Array.from(files);
    if (photos.length + list.length > MAX_PHOTOS) {
      setError(MAX_PHOTOS_MESSAGE);
      return;
    }
    for (const file of list) {
      if (!acceptsImage(file)) {
        setError(UNSUPPORTED_MESSAGE);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const blob = await toJpeg(file);
        const signed = await signPhotoUploadAction(listingId);
        if (!signed.path || !signed.token) throw new Error(signed.error ?? "sin firma");
        const { error: upErr } = await supabaseBrowser().storage.from(PHOTO_BUCKET).uploadToSignedUrl(signed.path, signed.token, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const result = await addPhotoAction(listingId, signed.path);
        if (!result.photo) throw new Error(result.error ?? "sin fila");
        setPhotos((p) => [...p, result.photo!]);
      } catch (e) {
        setError(e instanceof Error && /decod|sin imagen/i.test(e.message) ? UNSUPPORTED_MESSAGE : "No pudimos subir esa foto. Intentá de nuevo.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  const remove = (photo: Photo) =>
    start(async () => {
      const r = await removePhotoAction(listingId, photo.id);
      if (r.error) setError(r.error);
      else setPhotos((p) => p.filter((x) => x.id !== photo.id).map((x, i) => ({ ...x, position: i })));
    });

  const cover = (photo: Photo) =>
    start(async () => {
      const r = await setCoverAction(listingId, photo.id);
      if (r.error) setError(r.error);
      else setPhotos((p) => [photo, ...p.filter((x) => x.id !== photo.id)].map((x, i) => ({ ...x, position: i })));
    });

  return (
    <div className="stack">
      <input type="hidden" name="photoCount" value={photos.length} />
      <label className="btn btn-ghost" style={{ cursor: full ? "not-allowed" : "pointer", opacity: full ? 0.5 : 1 }}>
        <input type="file" accept="image/*" multiple hidden disabled={full || busy > 0} onChange={(e) => upload(e.currentTarget.files)} aria-label="Agregar fotos" />
        {busy > 0 ? "Subiendo…" : "Agregar fotos"}
      </label>
      <p role="status" className="small muted">{photos.length} fotos</p>
      {full ? <p className="xs muted">{MAX_PHOTOS_MESSAGE}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {photos.length > 0 ? (
        <div className="photos-grid">
          {photos.map((p, i) => (
            <figure key={p.id} className="stack" style={{ margin: 0, gap: 4 }}>
              <div className="photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={i === 0 ? "Portada" : `Foto ${i + 1}`} />
                {i === 0 ? <span className="tag">Portada</span> : null}
              </div>
              <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                {i > 0 ? <button type="button" className="btn-link xs" disabled={pending} onClick={() => cover(p)}>Hacer portada</button> : null}
                <button type="button" className="btn-link xs" disabled={pending} onClick={() => remove(p)}>Quitar</button>
              </div>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
