"use client";
import { useState, useTransition } from "react";
import { addPhotoAction, removePhotoAction, setCoverAction, signPhotoUploadAction } from "@/actions/listings";
import { I } from "@/components/icons";
import { JPEG_QUALITY, MAX_PHOTOS_MESSAGE, UNSUPPORTED_MESSAGE, acceptsImage, targetSize } from "@/lib/image";
import { MAX_PHOTOS, MIN_PHOTOS, type Photo } from "@/lib/listings/schema";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PHOTO_BUCKET } from "@/lib/supabase/storage";

/** Pantalla 7 del formulario: portada grande, miniaturas y «Añadir»; la rejilla hace scroll por dentro, la pantalla no. Redimensiona en el navegador y sube con URL firmada por el servidor. */
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
        setError(e instanceof Error && /decod|sin imagen/i.test(e.message) ? UNSUPPORTED_MESSAGE : "No pudimos subir esa foto. Intente de nuevo.");
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
    <div className="stack grow-col" style={{ gap: 12 }}>
      <input type="hidden" name="photoCount" value={photos.length} />
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2>Fotos</h2>
        <span className="small primary num" role="status" style={{ fontWeight: 700 }}>{photos.length} de {MIN_PHOTOS}–{MAX_PHOTOS}</span>
      </div>
      <div className="photos-scroll">
      <div className="photos-grid">
        {photos.map((p, i) => (
          <div key={p.id} className={`photo${i === 0 ? " cover" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={i === 0 ? "Portada" : `Foto ${i + 1}`} />
            {i === 0 ? <span className="tag">Portada</span> : null}
            {i > 0 ? (
              <button type="button" className="tag" style={{ border: 0, cursor: "pointer" }} disabled={pending} onClick={() => cover(p)}>Hacer portada</button>
            ) : null}
            <button type="button" className="remove" aria-label={`Quitar foto ${i + 1}`} disabled={pending} onClick={() => remove(p)}><I.x size={18} /></button>
          </div>
        ))}
        {!full ? (
          <label className="add" style={{ opacity: busy > 0 ? 0.6 : 1 }}>
            <input type="file" accept="image/*" multiple hidden disabled={busy > 0} onChange={(e) => upload(e.currentTarget.files)} aria-label="Agregar fotos" />
            <I.plus />
            {busy > 0 ? "Subiendo…" : "Añadir"}
          </label>
        ) : null}
      </div>
      </div>
      {full ? <p className="xs muted">{MAX_PHOTOS_MESSAGE}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
