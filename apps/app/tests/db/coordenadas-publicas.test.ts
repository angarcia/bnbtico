// Historia #68 (segv1-coordenadas), contrato aprobado el 2026-11-20 (.scratch/seguridad-2026-11-17/01-contrato-privacidad.md):
// el punto público es un dato guardado (public_lat, public_lng) con un desplazamiento aleatorio de 150–499 m, no un cálculo
// a partir del CT. Antes, approx_point sacaba el desplazamiento de md5(public_id) y se invertía hasta el punto exacto.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, anonClient, serviceClient, signIn, signInAdmin, sql } from "./local";

const TITLE = "Coordenadas públicas";
const uuid = (s: string) => s.replace(/[^0-9a-f-]/g, "");

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos((b.lat * Math.PI) / 180));

/** El cálculo antiguo de approx_point, al revés: lo que haría quien solo tiene el punto público y el CT. */
function oldInverse(lat: number, lng: number, publicId: string) {
  const md5 = createHash("md5").update(publicId).digest("hex");
  const int32 = (hex: string) => Math.abs(parseInt(hex, 16) | 0);
  const dist = 150 + (int32(md5.slice(0, 8)) % 350);
  const ang = ((int32(md5.slice(8, 16)) % 360) * Math.PI) / 180;
  const exactLat = lat - (dist * Math.cos(ang)) / 111320;
  return { lat: exactLat, lng: lng - (dist * Math.sin(ang)) / (111320 * Math.cos((exactLat * Math.PI) / 180)) };
}

describe("punto público guardado y aleatorio (#68)", () => {
  const service = serviceClient();
  let owner: SupabaseClient<Database>;
  let ownerId: string;
  const EXACT = { lat: 9.6512345, lng: -82.7543219 };

  const insert = async (status: "active" | "draft", where = EXACT) => {
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
      lat: where.lat,
      lng: where.lng,
    };
    const { data, error } = await service.from("listings").insert(row).select("id, public_id").single();
    if (error) throw error;
    return data!;
  };
  const publicPoint = async (publicId: string) => {
    const { data, error } = await anonClient().from("listings_public").select("lat, lng").eq("public_id", publicId).single();
    if (error) throw error;
    return { lat: data!.lat!, lng: data!.lng! };
  };
  /** Cambia una casa publicada como lo harían las RPCs (que abren app.allow_status). */
  const updatePublished = (id: string, set: string) => sql(`begin; set local app.allow_status = 'on'; update public.listings set ${set} where id = '${uuid(id)}'; commit;`);

  beforeAll(async () => {
    owner = await signIn("owner");
    ownerId = (await owner.auth.getUser()).data.user!.id;
    await service.from("listings").delete().like("title", `${TITLE}%`);
  });
  afterAll(async () => {
    await service.from("listings").delete().like("title", `${TITLE}%`);
  });

  it("el punto público queda a 150–499 m y el cálculo antiguo con el CT ya no da el exacto", async () => {
    const house = await insert("active");
    const pub = await publicPoint(house.public_id);
    expect(metres(pub, EXACT)).toBeGreaterThanOrEqual(149);
    expect(metres(pub, EXACT)).toBeLessThan(500);
    expect(metres(oldInverse(pub.lat, pub.lng, house.public_id), EXACT)).toBeGreaterThan(1);
    // Ninguna salida pública trae el exacto ni con qué invertirlo: approx_point ya no existe y la búsqueda da lo mismo.
    expect((await anonClient().rpc("approx_point" as never, { p_lat: 1, p_lng: 1, p_seed: "x" } as never)).error).not.toBeNull();
    const found = (await anonClient().rpc("search_listings", { p_limit: 200 })).data ?? [];
    const row = found.find((r) => r.public_id === house.public_id)!;
    expect({ lat: row.lat, lng: row.lng }).toEqual(pub);
    expect(Object.keys(row)).not.toContain("public_lat");
  });

  it("es estable: no cambia al releer ni con otros cambios de la casa", async () => {
    const house = await insert("active");
    const first = await publicPoint(house.public_id);
    expect(await publicPoint(house.public_id)).toEqual(first);
    updatePublished(house.id, "title = title || ' bis', capacity = 3");
    expect(await publicPoint(house.public_id)).toEqual(first);
  });

  it("una ubicación nueva da un punto público nuevo alrededor de ella", async () => {
    const house = await insert("active");
    const before = await publicPoint(house.public_id);
    const moved = { lat: 9.7012345, lng: -82.8043219 };
    updatePublished(house.id, `lat = ${moved.lat}, lng = ${moved.lng}`);
    const after = await publicPoint(house.public_id);
    expect(after).not.toEqual(before);
    expect(metres(after, moved)).toBeGreaterThanOrEqual(149);
    expect(metres(after, moved)).toBeLessThan(500);
  });

  it("nadie lo escribe a mano: el dueño de un borrador no puede fijar su punto público", async () => {
    const draft = await insert("draft");
    const stored = sql(`select public_lat || ',' || public_lng from public.listings where id = '${uuid(draft.id)}'`);
    expect(stored).toMatch(/^-?\d/);
    const { error } = await owner.from("listings").update({ public_lat: EXACT.lat, public_lng: EXACT.lng, title: `${TITLE} draft editado` }).eq("id", draft.id);
    expect(error).toBeNull();
    expect(sql(`select public_lat || ',' || public_lng || '|' || title from public.listings where id = '${uuid(draft.id)}'`)).toBe(`${stored}|${TITLE} draft editado`);
  });

  it("el punto exacto solo lo leen el dueño y el admin con segundo factor", async () => {
    const house = await insert("active");
    const exactOf = async (db: SupabaseClient<Database>) => (await db.from("listings").select("lat, lng").eq("id", house.id)).data ?? [];
    expect(await exactOf(anonClient())).toEqual([]);
    expect(await exactOf(await signIn("other"))).toEqual([]);
    expect(await exactOf(await signIn("admin"))).toEqual([]);
    expect(await exactOf(owner)).toEqual([EXACT]);
    expect(await exactOf(await signInAdmin())).toEqual([EXACT]);
  });
});
