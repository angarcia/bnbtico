// Historia #69: cada foto vive en un solo bucket. `listings` (público, lo sirve Storage sin mirar políticas) solo para las
// fotos aprobadas de casas que se ven; `listings-privadas` para todo lo demás (borradores, ediciones, casas paradas). La
// base dice qué está fuera de sitio (photo_sync_pending) y aquí se mueve con la service role: copiar al bucket nuevo,
// anotarlo (set_photo_bucket) y borrar del viejo. En ese orden, una sincronización cortada a medias deja la foto en los dos
// buckets o sin anotar, y la siguiente la termina; dos a la vez hacen lo mismo dos veces sin daño.
import * as z from "zod/mini";
import { photoObjectPaths } from "../domain/image";

export const PUBLIC_BUCKET = "listings";
export const PRIVATE_BUCKET = "listings-privadas";
const BUCKETS = { public: PUBLIC_BUCKET, private: PRIVATE_BUCKET } as const;
/**
 * Subpeticiones por pasada. El plan gratuito de Workers corta en 50 por invocación (2026-11-21: la primera pasada en
 * pruebas movió 10 de 30 fotos y dejó una a medias). Cada foto cuesta sus copias (3); el lote se anota en una llamada y se
 * borra con una por bucket. Lo que no quepa, en la siguiente pasada.
 */
export const SUBREQUEST_BUDGET = 45;
/** Lo que se guarda para cerrar la pasada: anotar (1) y borrar de los dos buckets (2), con margen para comprobaciones. */
const CLOSING_COST = 5;

const pendingRows = z.array(
  z.object({
    kind: z.enum(["listing", "edit"]),
    id: z.string(),
    listing_id: z.string(),
    path: z.string(),
    from_bucket: z.enum(["public", "private"]),
    to_bucket: z.enum(["public", "private"]),
  }),
);
export type PendingPhoto = z.infer<typeof pendingRows>[number];

export interface PhotoSyncDeps {
  supabaseUrl: string;
  serviceKey: string;
  fetch: typeof fetch;
}

export interface PhotoSyncResult {
  moved: number;
  failed: number;
  /** Fuera de sitio que no cupieron en esta pasada. */
  remaining: number;
  errors: string[];
}

export function createPhotoSync(deps: PhotoSyncDeps) {
  const base = deps.supabaseUrl.replace(/\/$/, "");
  const headers = { apikey: deps.serviceKey, authorization: `Bearer ${deps.serviceKey}`, "content-type": "application/json" };
  let used = 0;
  const fetch: typeof globalThis.fetch = (input, init) => {
    used++;
    return deps.fetch(input, init);
  };

  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /** Copia un objeto. Ya en el destino, o sin origen (otra pasada lo movió), no es un fallo. */
  async function copy(key: string, from: string, to: string): Promise<void> {
    const res = await fetch(`${base}/storage/v1/object/copy`, {
      method: "POST",
      headers,
      body: JSON.stringify({ bucketId: from, sourceKey: key, destinationBucket: to, destinationKey: key }),
    });
    if (res.ok) return void (await res.body?.cancel());
    const text = await res.text();
    if (/already exists|duplicate/i.test(text)) return;
    if (/not.?found/i.test(text)) {
      if (await exists(key, to)) return;
      throw new Error(`${key}: no está en ${from} ni en ${to}`);
    }
    throw new Error(`copiar ${key}: ${res.status} ${text}`);
  }

  async function exists(key: string, bucket: string): Promise<boolean> {
    const res = await fetch(`${base}/storage/v1/object/info/${bucket}/${key}`, { headers });
    await res.body?.cancel();
    return res.ok;
  }

  async function remove(keys: string[], bucket: string): Promise<void> {
    const res = await fetch(`${base}/storage/v1/object/${bucket}`, { method: "DELETE", headers, body: JSON.stringify({ prefixes: keys }) });
    if (!res.ok) throw new Error(`borrar de ${bucket}: ${res.status} ${await res.text()}`);
    await res.body?.cancel();
  }

  return {
    /** Una pasada dentro de `budget` subpeticiones: copiar, anotar el lote y después borrar los originales. */
    async run(budget = SUBREQUEST_BUDGET): Promise<PhotoSyncResult> {
      used = 0;
      const result: PhotoSyncResult = { moved: 0, failed: 0, remaining: 0, errors: [] };
      const parsed = pendingRows.safeParse(await rpc("photo_sync_pending", {}));
      if (!parsed.success) throw new Error("photo_sync_pending: respuesta inesperada");
      const copied: PendingPhoto[] = [];
      let next = 0;
      for (; next < parsed.data.length; next++) {
        const photo = parsed.data[next]!;
        const keys = photoObjectPaths(photo.path);
        if (used + keys.length + CLOSING_COST > budget) break;
        try {
          for (const key of keys) await copy(key, BUCKETS[photo.from_bucket], BUCKETS[photo.to_bucket]);
          copied.push(photo);
        } catch (e) {
          result.failed++;
          if (result.errors.length < 5) result.errors.push(String(e));
        }
      }
      result.remaining = parsed.data.length - next;
      if (copied.length === 0) return result;
      try {
        await rpc("set_photo_buckets", { p_items: copied.map((p) => ({ kind: p.kind, id: p.id, bucket: p.to_bucket })) });
      } catch (e) {
        // Sin anotar no se borra nada: las copias quedan en los dos buckets y la siguiente pasada lo termina.
        result.failed += copied.length;
        result.errors.push(String(e));
        return result;
      }
      result.moved = copied.length;
      for (const from of ["public", "private"] as const) {
        const keys = copied.filter((p) => p.from_bucket === from).flatMap((p) => photoObjectPaths(p.path));
        if (keys.length === 0) continue;
        // Si falla, la foto ya está anotada y photo_sync_pending la devuelve por los restos: se limpia en la siguiente.
        await remove(keys, BUCKETS[from]).catch((e: unknown) => result.errors.push(String(e)));
      }
      return result;
    },
  };
}

/** Una pasada con su línea de log (solo si movió o falló algo). Nunca lanza: la llaman el endpoint, el webhook y el cron. */
export async function runPhotoSync(sync: { run(budget?: number): Promise<PhotoSyncResult> }, source: string, log: (line: string) => void = (l) => console.log(l), budget?: number): Promise<PhotoSyncResult | null> {
  try {
    const result = await sync.run(budget);
    if (result.moved || result.failed || result.remaining) log(JSON.stringify({ event: "photo_sync", source, ...result }));
    return result;
  } catch (e) {
    log(JSON.stringify({ event: "photo_sync", source, ok: false, error: String(e) }));
    return null;
  }
}
