// Historia #69 (segv1-fotos), contrato aprobado el 2026-11-20 (.scratch/seguridad-2026-11-17/01-contrato-privacidad.md),
// con dos ajustes de Ana del mismo día: cada foto vive en un solo bucket (público si está aprobada y su casa se ve; privado
// si no) y la mueve el worker con un endpoint de sincronización. Aquí, lo que garantiza la base: se sube solo al privado, lo
// privado no lo lee nadie más que el dueño y el admin con segundo factor (ni con la ruta), la ficha pública solo enseña lo
// que ya está en el público y el worker (service role) sabe qué mover. El movimiento en sí: tests/unit/photo-sync.test.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, anonClient, localSupabase, serviceClient, signIn, signInAdmin, sql } from "./local";

const TITLE = "Fotos privadas";
const PRIVATE = "listings-privadas";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const uuid = (s: string) => s.replace(/[^0-9a-f-]/g, "");

describe("fotos sin aprobar en un bucket privado (#69)", () => {
  const service = serviceClient();
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let adminAal1: SupabaseClient<Database>;
  let adminAal2: SupabaseClient<Database>;
  let ownerId: string;

  const listing = async (status: "active" | "draft" | "inactive") => {
    const row = {
      owner_id: ownerId,
      status,
      title: `${TITLE} ${status}`,
      description: "x",
      province: "Limón",
      whatsapp_phone: TEST_PHONES.owner,
      capacity: 2,
      bedrooms: 1,
      bathrooms: 1,
      accepts_nightly: true,
      nightly_price_crc: 30000,
    };
    const { data, error } = await service.from("listings").insert(row).select("id, public_id").single();
    if (error) throw error;
    return data!;
  };
  const cleanup = async () => {
    const { data } = await service.from("listings").select("id").like("title", `${TITLE}%`);
    for (const { id } of data ?? []) {
      for (const bucket of ["listings", PRIVATE]) {
        const folders = (await service.storage.from(bucket).list(id)).data ?? [];
        for (const f of folders) {
          const files = (await service.storage.from(bucket).list(`${id}/${f.name}`)).data ?? [];
          if (files.length) await service.storage.from(bucket).remove(files.map((x) => `${id}/${f.name}/${x.name}`));
        }
      }
    }
    await service.from("listings").delete().like("title", `${TITLE}%`);
  };
  const pending = async () => {
    const { data, error } = await service.rpc("photo_sync_pending");
    if (error) throw error;
    return data ?? [];
  };

  beforeAll(async () => {
    owner = await signIn("owner");
    ownerId = (await owner.auth.getUser()).data.user!.id;
    other = await signIn("other");
    adminAal1 = await signIn("admin");
    adminAal2 = await signInAdmin();
    await cleanup();
  });
  afterAll(cleanup);

  it("el dueño sube al bucket privado y ya no al público", async () => {
    const draft = await listing("draft");
    const folder = `${draft.id}/${crypto.randomUUID()}`;
    expect((await owner.storage.from("listings").upload(`${folder}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
    expect((await owner.storage.from(PRIVATE).upload(`${folder}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
    // Otro propietario no sube a una carpeta ajena.
    expect((await other.storage.from(PRIVATE).upload(`${draft.id}/${crypto.randomUUID()}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
    const photo = await owner.rpc("add_listing_photo", { p_listing: draft.id, p_path: folder }).single();
    expect(photo.error).toBeNull();
    expect(sql(`select bucket from public.listing_photos where path = '${folder}'`)).toBe("private");
  });

  it("una foto privada no la lee nadie más, ni con la ruta: solo el dueño y el admin con segundo factor", async () => {
    const draft = await listing("draft");
    const path = `${draft.id}/${crypto.randomUUID()}/800.jpg`;
    expect((await owner.storage.from(PRIVATE).upload(path, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
    const url = `${localSupabase().url}/storage/v1/object/public/${PRIVATE}/${path}`;
    expect((await fetch(url)).status).not.toBe(200);
    const who = { anon: anonClient(), otro: other, dueño: owner, "admin aal1": adminAal1, "admin aal2": adminAal2 } as const;
    const observed: Record<string, { carpeta: boolean; descarga: boolean; firmada: boolean }> = {};
    for (const [name, db] of Object.entries(who)) {
      const folder = await db.storage.from(PRIVATE).list(path.split("/").slice(0, 2).join("/"));
      const download = await db.storage.from(PRIVATE).download(path);
      const signed = await db.storage.from(PRIVATE).createSignedUrl(path, 60);
      observed[name] = { carpeta: (folder.data ?? []).some((e) => e.name === "800.jpg"), descarga: download.error === null, firmada: signed.error === null };
    }
    const yes = { carpeta: true, descarga: true, firmada: true };
    const no = { carpeta: false, descarga: false, firmada: false };
    expect(observed).toEqual({ anon: no, otro: no, dueño: yes, "admin aal1": no, "admin aal2": yes });
  });

  it("el bucket público tampoco se enumera (D4): la raíz no da los uuid de las casas a nadie más", async () => {
    const house = await listing("active");
    const path = `${house.id}/${crypto.randomUUID()}/800.jpg`;
    expect((await service.storage.from("listings").upload(path, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
    const sees = async (db: SupabaseClient<Database>) => ((await db.storage.from("listings").list("", { limit: 1000, search: house.id })).data ?? []).some((e) => e.name === house.id);
    expect([await sees(anonClient()), await sees(other), await sees(adminAal1)]).toEqual([false, false, false]);
    expect([await sees(owner), await sees(adminAal2)]).toEqual([true, true]);
    // Una foto aprobada sí se descarga por su URL pública: es la de la ficha.
    expect((await fetch(`${localSupabase().url}/storage/v1/object/public/listings/${path}`)).status).toBe(200);
  });

  it("la ficha pública solo enseña las fotos que ya están en el bucket público", async () => {
    const house = await listing("active");
    const [a, b] = [`${house.id}/${crypto.randomUUID()}`, `${house.id}/${crypto.randomUUID()}`];
    expect((await service.from("listing_photos").insert([{ listing_id: house.id, path: a, position: 0, bucket: "public" }, { listing_id: house.id, path: b, position: 1, bucket: "private" }])).error).toBeNull();
    const photos = async () => (await anonClient().from("listings_public").select("photos").eq("public_id", house.public_id).single()).data!.photos;
    expect(await photos()).toEqual([a]);
    const found = (await anonClient().rpc("search_listings", { p_limit: 200 })).data!.find((r) => r.public_id === house.public_id)!;
    expect(found.photos).toEqual([a]);
  });

  it("el worker sabe qué mover: lo aprobado de una casa visible al público; borradores, ediciones y casas paradas al privado", async () => {
    const active = await listing("active");
    const paused = await listing("inactive");
    const draft = await listing("draft");
    const p = (l: { id: string }) => `${l.id}/${crypto.randomUUID()}`;
    const rows = {
      toPublic: { listing_id: active.id, path: p(active), position: 0, bucket: "private" as const },
      stays: { listing_id: active.id, path: p(active), position: 1, bucket: "public" as const },
      pausedOut: { listing_id: paused.id, path: p(paused), position: 0, bucket: "public" as const },
      draftOut: { listing_id: draft.id, path: p(draft), position: 0, bucket: "public" as const },
    };
    expect((await service.from("listing_photos").insert(Object.values(rows))).error).toBeNull();
    const editPath = p(active);
    sql(`insert into public.listing_edits (listing_id) values ('${uuid(active.id)}') on conflict do nothing;
         insert into public.listing_edit_photos (listing_id, path, position, bucket) values ('${uuid(active.id)}', '${editPath}', 0, 'public');`);
    const mine = (await pending()).filter((r) => [active.id, paused.id, draft.id].includes(r.listing_id));
    const byPath = Object.fromEntries(mine.map((r) => [r.path, `${r.kind}:${r.from_bucket}→${r.to_bucket}`]));
    expect(byPath).toEqual({
      [rows.toPublic.path]: "listing:private→public",
      [rows.pausedOut.path]: "listing:public→private",
      [rows.draftOut.path]: "listing:public→private",
      [editPath]: "edit:public→private",
    });
    // Tras mover, el worker lo anota y deja de estar pendiente.
    for (const r of mine) expect((await service.rpc("set_photo_bucket", { p_kind: r.kind, p_id: r.id, p_bucket: r.to_bucket })).error).toBeNull();
    expect((await pending()).filter((r) => [active.id, paused.id, draft.id].includes(r.listing_id))).toEqual([]);
  });

  it("solo la service role pregunta qué mover o lo anota; nadie cambia el bucket de una foto por REST", async () => {
    for (const db of [anonClient(), owner, adminAal2]) {
      expect((await db.rpc("photo_sync_pending")).error).not.toBeNull();
      expect((await db.rpc("set_photo_bucket", { p_kind: "listing", p_id: crypto.randomUUID(), p_bucket: "public" })).error).not.toBeNull();
    }
    const house = await listing("draft");
    const path = `${house.id}/${crypto.randomUUID()}`;
    await service.from("listing_photos").insert({ listing_id: house.id, path, position: 0 });
    await owner.from("listing_photos").update({ bucket: "public" }).eq("path", path);
    expect(sql(`select bucket from public.listing_photos where path = '${path}'`)).toBe("private");
  });
});
