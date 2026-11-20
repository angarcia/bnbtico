// Historia #67 (segv1-contrato): reproducción de los dos hallazgos de privacidad del 2026-11-17 con datos desechables.
// Estas pruebas afirman la EXPOSICIÓN que queda a propósito: cuando #68 y #69 la cierren, fallarán y se reescribirán como
// regresiones del contrato aprobado (.scratch/seguridad-2026-11-17/01-contrato-privacidad.md). No usan la service role
// para leer: solo para sembrar.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { storagePhotoUrl } from "../../src/domain/rows";
import { TEST_PHONES, anonClient, localSupabase, serviceClient, signIn, signInAdmin } from "./local";

const TITLE = "Privacidad exposición";

/** El inverso de approx_point (migración 20261019203305_fase2_permisos.sql): el desplazamiento sale solo del CT público. */
function invert(lat: number, lng: number, publicId: string) {
  const md5 = createHash("md5").update(publicId).digest("hex");
  // `('x' || hex)::bit(32)::int` en Postgres: entero de 32 bits con signo, luego abs.
  const int32 = (hex: string) => Math.abs(parseInt(hex, 16) | 0);
  const dist = 150 + (int32(md5.slice(0, 8)) % 350);
  const ang = ((int32(md5.slice(8, 16)) % 360) * Math.PI) / 180;
  const exactLat = lat - (dist * Math.cos(ang)) / 111320;
  return { lat: exactLat, lng: lng - (dist * Math.sin(ang)) / (111320 * Math.cos((exactLat * Math.PI) / 180)) };
}

describe("exposición actual de coordenadas y fotos (#67)", () => {
  const service = serviceClient();
  let ownerId: string;
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let adminAal1: SupabaseClient<Database>;
  let adminAal2: SupabaseClient<Database>;

  const listing = (status: "active" | "draft", lat: number, lng: number) => ({
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
    lat,
    lng,
  });
  const cleanup = async () => {
    const { data } = await service.from("listings").select("id").like("title", `${TITLE}%`);
    for (const { id } of data ?? []) {
      const files = (await service.storage.from("listings").list(`${id}/foto`)).data ?? [];
      if (files.length) await service.storage.from("listings").remove(files.map((f) => `${id}/foto/${f.name}`));
    }
    await service.from("listings").delete().like("title", `${TITLE}%`);
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

  it("coordenadas: con solo listings_public y el CT, cualquiera recupera el punto exacto guardado", async () => {
    const exact = { lat: 9.6512345, lng: -82.7543219 };
    const { data: house } = await service.from("listings").insert(listing("active", exact.lat, exact.lng)).select("public_id").single();
    const pub = await anonClient().from("listings_public").select("public_id, lat, lng").eq("public_id", house!.public_id).single();
    expect(pub.error).toBeNull();
    // El punto público se aleja entre 150 y 499 m…
    const metres = Math.hypot((pub.data!.lat! - exact.lat) * 111320, (pub.data!.lng! - exact.lng) * 111320 * Math.cos((exact.lat * Math.PI) / 180));
    expect(metres).toBeGreaterThanOrEqual(149);
    expect(metres).toBeLessThan(500);
    // …pero el desplazamiento se deshace: a menos de un metro del original (en la práctica, el mismo punto).
    const back = invert(pub.data!.lat!, pub.data!.lng!, pub.data!.public_id!);
    const error = Math.hypot((back.lat - exact.lat) * 111320, (back.lng - exact.lng) * 111320 * Math.cos((exact.lat * Math.PI) / 180));
    expect(error).toBeLessThan(1);
    // search_listings devuelve el mismo punto reversible.
    const found = await anonClient().rpc("search_listings", { p_limit: 200 });
    const row = (found.data ?? []).find((r) => r.public_id === house!.public_id);
    expect([row?.lat, row?.lng]).toEqual([pub.data!.lat, pub.data!.lng]);
  });

  it("fotos: tras D4 solo dueño y admin aal2 enumeran; la descarga del borrador (URL pública o API) sigue abierta a todos (#69)", async () => {
    const { data: draft } = await service.from("listings").insert(listing("draft", 9.65, -82.75)).select("id").single();
    const path = `${draft!.id}/foto/800.jpg`;
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    expect((await service.storage.from("listings").upload(path, jpeg, { contentType: "image/jpeg" })).error).toBeNull();

    // La fila del borrador sí está protegida: anon no la ve.
    expect((await anonClient().from("listing_photos").select("id").eq("listing_id", draft!.id)).data).toEqual([]);

    // El objeto no del todo: en un bucket público su URL responde a cualquiera, sin sesión. Lo cierra #69 (bucket privado).
    const res = await fetch(storagePhotoUrl(localSupabase().url)(path));
    expect(res.status).toBe(200);

    // La enumeración (raíz: uuid de todas las casas; carpeta: sus fotos) pasa por las políticas de storage.objects: desde D4
    // (migración fotos_sin_enumerar, 2026-11-20) solo el dueño y el admin con segundo factor. La descarga por la API, no:
    // en un bucket público Storage la sirve igual que la URL pública.
    const who = { anon: anonClient(), otro: other, dueño: owner, "admin aal1": adminAal1, "admin aal2": adminAal2 } as const;
    const observed: Record<string, { raíz: boolean; carpeta: boolean; descarga: boolean }> = {};
    for (const [name, db] of Object.entries(who)) {
      const root = await db.storage.from("listings").list("", { limit: 1000, search: draft!.id });
      const folder = await db.storage.from("listings").list(`${draft!.id}/foto`);
      const download = await db.storage.from("listings").download(path);
      observed[name] = {
        raíz: (root.data ?? []).some((e) => e.name === draft!.id),
        carpeta: (folder.data ?? []).some((e) => e.name === "800.jpg"),
        descarga: download.error === null,
      };
    }
    const yes = { raíz: true, carpeta: true, descarga: true };
    const no = { raíz: false, carpeta: false, descarga: true };
    expect(observed).toEqual({ anon: no, otro: no, dueño: yes, "admin aal1": no, "admin aal2": yes });
  });
});
