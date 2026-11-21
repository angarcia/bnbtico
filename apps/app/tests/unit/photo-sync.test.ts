// Historia #69: el movimiento de fotos entre buckets (src/server/photo-sync.ts) contra un Storage y un PostgREST en memoria
// que responden como los de Supabase (comprobado a mano con el local: 400 «Duplicate» y «not_found» al copiar, 400 en info
// sin objeto). Lo que decide la base (qué mover) está en tests/db/fotos-privadas.test.ts.
import { describe, expect, it } from "vitest";
import { PRIVATE_BUCKET, PUBLIC_BUCKET, createPhotoSync, type PendingPhoto } from "../../src/server/photo-sync";

const URL_BASE = "http://supabase.test";

function fakeSupabase(pending: PendingPhoto[], objects: Record<string, string[]>, opts: { failCopyOf?: string; failSetFor?: string } = {}) {
  const buckets = new Map(Object.entries(objects).map(([b, keys]) => [b, new Set(keys)]));
  const log: string[] = [];
  const recorded = new Map<string, string>();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (url.pathname === "/rest/v1/rpc/photo_sync_pending") return json(200, pending.filter((p) => recorded.get(p.id) !== p.to_bucket));
    if (url.pathname === "/rest/v1/rpc/set_photo_bucket") {
      if (body.p_id === opts.failSetFor) return json(500, { message: "boom" });
      recorded.set(body.p_id, body.p_bucket);
      log.push(`set ${body.p_id} ${body.p_bucket}`);
      return new Response("", { status: 200 });
    }
    if (url.pathname === "/storage/v1/object/copy") {
      if (body.sourceKey === opts.failCopyOf) return json(500, { message: "storage caído" });
      if (!buckets.get(body.bucketId)?.has(body.sourceKey)) return json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
      if (buckets.get(body.destinationBucket)?.has(body.destinationKey)) return json(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      buckets.get(body.destinationBucket)!.add(body.destinationKey);
      log.push(`copy ${body.sourceKey} ${body.bucketId}→${body.destinationBucket}`);
      return json(200, { Key: body.destinationKey });
    }
    const info = url.pathname.match(/^\/storage\/v1\/object\/info\/([^/]+)\/(.+)$/);
    if (info) return new Response("", { status: buckets.get(info[1]!)?.has(info[2]!) ? 200 : 400 });
    const del = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)$/);
    if (del && init?.method === "DELETE") {
      for (const k of body.prefixes as string[]) buckets.get(del[1]!)!.delete(k);
      log.push(`delete ${del[1]} ${(body.prefixes as string[]).length}`);
      return json(200, []);
    }
    return json(404, { message: `sin ruta ${url.pathname}` });
  };
  const has = (bucket: string) => [...buckets.get(bucket)!].sort();
  return { sync: createPhotoSync({ supabaseUrl: URL_BASE, serviceKey: "service", fetch }), log, has, recorded };
}

const folder = "aaaaaaaa-0000-4000-8000-000000000001/bbbbbbbb-0000-4000-8000-000000000001";
const keys = (f: string) => [480, 800, 1600].map((s) => `${f}/${s}.jpg`);
const photo = (over: Partial<PendingPhoto> = {}): PendingPhoto => ({ kind: "listing", id: "p1", listing_id: "l1", path: folder, from_bucket: "private", to_bucket: "public", ...over });

describe("sincronización de fotos entre buckets (#69)", () => {
  it("al público: copia las tres variantes, anota y después borra del privado", async () => {
    const s = fakeSupabase([photo()], { [PRIVATE_BUCKET]: keys(folder), [PUBLIC_BUCKET]: [] });
    expect(await s.sync.run()).toEqual({ moved: 1, failed: 0, errors: [] });
    expect(s.has(PUBLIC_BUCKET)).toEqual(keys(folder).sort());
    expect(s.has(PRIVATE_BUCKET)).toEqual([]);
    // El orden importa: anotar antes de borrar, y borrar al final.
    expect(s.log.map((l) => l.split(" ")[0])).toEqual(["copy", "copy", "copy", "set", "delete"]);
  });

  it("al privado (casa parada o edición): lo mismo al revés", async () => {
    const s = fakeSupabase([photo({ kind: "edit", from_bucket: "public", to_bucket: "private" })], { [PUBLIC_BUCKET]: keys(folder), [PRIVATE_BUCKET]: [] });
    await s.sync.run();
    expect(s.has(PRIVATE_BUCKET)).toEqual(keys(folder).sort());
    expect(s.has(PUBLIC_BUCKET)).toEqual([]);
    expect(s.recorded.get("p1")).toBe("private");
  });

  it("una pasada cortada a medias (ya copiada a los dos buckets) se termina sin error", async () => {
    const s = fakeSupabase([photo()], { [PRIVATE_BUCKET]: keys(folder), [PUBLIC_BUCKET]: keys(folder).slice(0, 2) });
    expect(await s.sync.run()).toMatchObject({ moved: 1, failed: 0 });
    expect(s.has(PUBLIC_BUCKET)).toEqual(keys(folder).sort());
    expect(s.has(PRIVATE_BUCKET)).toEqual([]);
  });

  it("si otra pasada ya la movió (no está en el origen pero sí en el destino), solo la anota", async () => {
    const s = fakeSupabase([photo()], { [PRIVATE_BUCKET]: [], [PUBLIC_BUCKET]: keys(folder) });
    expect(await s.sync.run()).toMatchObject({ moved: 1, failed: 0 });
    expect(s.recorded.get("p1")).toBe("public");
  });

  it("sin el objeto en ningún bucket no la anota como movida: queda pendiente y se informa", async () => {
    const s = fakeSupabase([photo()], { [PRIVATE_BUCKET]: [], [PUBLIC_BUCKET]: [] });
    const r = await s.sync.run();
    expect(r).toMatchObject({ moved: 0, failed: 1 });
    expect(r.errors[0]).toMatch(/no está en/);
    expect(s.recorded.has("p1")).toBe(false);
  });

  it("si falla copiar o anotar, no borra el original y sigue con las demás", async () => {
    const other = "aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-000000000002";
    const s = fakeSupabase([photo(), photo({ id: "p2", path: other })], { [PRIVATE_BUCKET]: [...keys(folder), ...keys(other)], [PUBLIC_BUCKET]: [] }, { failCopyOf: `${folder}/800.jpg` });
    expect(await s.sync.run()).toMatchObject({ moved: 1, failed: 1 });
    expect(s.has(PRIVATE_BUCKET)).toEqual(keys(folder).sort());
    expect(s.has(PUBLIC_BUCKET)).toEqual([`${folder}/480.jpg`, ...keys(other)].sort());

    const t = fakeSupabase([photo()], { [PRIVATE_BUCKET]: keys(folder), [PUBLIC_BUCKET]: [] }, { failSetFor: "p1" });
    expect(await t.sync.run()).toMatchObject({ moved: 0, failed: 1 });
    expect(t.has(PRIVATE_BUCKET)).toEqual(keys(folder).sort());
  });

  it("una foto anterior (un solo archivo .jpg) se mueve como un objeto", async () => {
    const legacy = "aaaaaaaa-0000-4000-8000-000000000001/dddddddd-0000-4000-8000-000000000003.jpg";
    const s = fakeSupabase([photo({ path: legacy })], { [PRIVATE_BUCKET]: [legacy], [PUBLIC_BUCKET]: [] });
    await s.sync.run();
    expect(s.has(PUBLIC_BUCKET)).toEqual([legacy]);
  });

  it("nada pendiente: una sola lectura y nada más", async () => {
    const s = fakeSupabase([], { [PRIVATE_BUCKET]: [], [PUBLIC_BUCKET]: [] });
    expect(await s.sync.run()).toEqual({ moved: 0, failed: 0, errors: [] });
    expect(s.log).toEqual([]);
  });
});
