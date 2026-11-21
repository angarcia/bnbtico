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
/** Lotes de photo_sync_pending (500 filas) por pasada: acota una pasada larga; lo que quede, en la siguiente. */
const MAX_BATCHES = 4;

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
  errors: string[];
}

export function createPhotoSync(deps: PhotoSyncDeps) {
  const base = deps.supabaseUrl.replace(/\/$/, "");
  const headers = { apikey: deps.serviceKey, authorization: `Bearer ${deps.serviceKey}`, "content-type": "application/json" };

  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await deps.fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /** Copia un objeto. Ya en el destino, o sin origen (otra pasada lo movió), no es un fallo. */
  async function copy(key: string, from: string, to: string): Promise<void> {
    const res = await deps.fetch(`${base}/storage/v1/object/copy`, {
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
    const res = await deps.fetch(`${base}/storage/v1/object/info/${bucket}/${key}`, { headers });
    await res.body?.cancel();
    return res.ok;
  }

  async function remove(keys: string[], bucket: string): Promise<void> {
    const res = await deps.fetch(`${base}/storage/v1/object/${bucket}`, { method: "DELETE", headers, body: JSON.stringify({ prefixes: keys }) });
    if (!res.ok) throw new Error(`borrar de ${bucket}: ${res.status} ${await res.text()}`);
    await res.body?.cancel();
  }

  async function move(photo: PendingPhoto): Promise<void> {
    const from = BUCKETS[photo.from_bucket];
    const to = BUCKETS[photo.to_bucket];
    const keys = photoObjectPaths(photo.path);
    for (const key of keys) await copy(key, from, to);
    await rpc("set_photo_bucket", { p_kind: photo.kind, p_id: photo.id, p_bucket: photo.to_bucket });
    await remove(keys, from);
  }

  return {
    async run(): Promise<PhotoSyncResult> {
      const result: PhotoSyncResult = { moved: 0, failed: 0, errors: [] };
      const failedIds = new Set<string>();
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const parsed = pendingRows.safeParse(await rpc("photo_sync_pending", {}));
        if (!parsed.success) throw new Error("photo_sync_pending: respuesta inesperada");
        const todo = parsed.data.filter((p) => !failedIds.has(p.id));
        if (todo.length === 0) break;
        for (const photo of todo) {
          try {
            await move(photo);
            result.moved++;
          } catch (e) {
            failedIds.add(photo.id);
            result.failed++;
            if (result.errors.length < 5) result.errors.push(String(e));
          }
        }
      }
      return result;
    },
  };
}

/** Una pasada con su línea de log (solo si movió o falló algo). Nunca lanza: la llaman el endpoint, el webhook y el cron. */
export async function runPhotoSync(sync: { run(): Promise<PhotoSyncResult> }, source: string, log: (line: string) => void = (l) => console.log(l)): Promise<PhotoSyncResult | null> {
  try {
    const result = await sync.run();
    if (result.moved || result.failed) log(JSON.stringify({ event: "photo_sync", source, ...result }));
    return result;
  } catch (e) {
    log(JSON.stringify({ event: "photo_sync", source, ok: false, error: String(e) }));
    return null;
  }
}
