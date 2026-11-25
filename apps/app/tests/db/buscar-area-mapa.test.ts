// Historia #96: search_listings filtra por el área visible del mapa con el punto público guardado (el que pinta el marcador),
// nunca con el real, y rechaza áreas mal formadas. El orden, el límite y los demás filtros los cubre la suite de contrato.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, anonClient, serviceClient, signIn } from "./local";

const TITLE = "Área del mapa";
const EXACT = { lat: 9.6512345, lng: -82.7543219 };

describe("búsqueda por área del mapa (#96)", () => {
  const service = serviceClient();
  let owner: SupabaseClient<Database>;
  let publicId: string;
  let pub: { lat: number; lng: number };

  const area = (west: number, south: number, east: number, north: number) =>
    anonClient().rpc("search_listings", { p_west: west, p_south: south, p_east: east, p_north: north, p_limit: 60 });

  beforeAll(async () => {
    owner = await signIn("owner");
    const ownerId = (await owner.auth.getUser()).data.user!.id;
    await service.from("listings").delete().like("title", `${TITLE}%`);
    const { data, error } = await service
      .from("listings")
      .insert({ owner_id: ownerId, status: "active", title: TITLE, description: "x", province: "Limón", whatsapp_phone: TEST_PHONES.owner, capacity: 2, bedrooms: 1, bathrooms: 1, accepts_nightly: true, nightly_price_crc: 30000, lat: EXACT.lat, lng: EXACT.lng })
      .select("public_id")
      .single();
    if (error) throw error;
    publicId = data.public_id;
    const point = await anonClient().from("listings_public").select("lat, lng").eq("public_id", publicId).single();
    if (point.error) throw point.error;
    pub = { lat: point.data.lat!, lng: point.data.lng! };
  });
  afterAll(async () => {
    await service.from("listings").delete().like("title", `${TITLE}%`);
  });

  it("un área alrededor del punto público la encuentra; una alrededor del real (a 150–499 m), no", async () => {
    // ±0,0005° ≈ 55 m: el punto público queda dentro y el real (al menos a 150 m) fuera, y al revés.
    const d = 0.0005;
    const aroundPublic = await area(pub.lng - d, pub.lat - d, pub.lng + d, pub.lat + d);
    expect(aroundPublic.error).toBeNull();
    expect(aroundPublic.data!.map((r) => r.public_id)).toContain(publicId);
    const row = aroundPublic.data!.find((r) => r.public_id === publicId)!;
    expect({ lat: row.lat, lng: row.lng }).toEqual(pub);
    const aroundExact = await area(EXACT.lng - d, EXACT.lat - d, EXACT.lng + d, EXACT.lat + d);
    expect(aroundExact.error).toBeNull();
    expect(aroundExact.data!.map((r) => r.public_id)).not.toContain(publicId);
  });

  it("un área incompleta, al revés, plana o fuera de rango se rechaza con «Revise el área del mapa.»", async () => {
    const half = await anonClient().rpc("search_listings", { p_west: -83, p_south: 9 });
    expect(half.error?.message).toBe("Revise el área del mapa.");
    for (const [w, s, e, n] of [
      [-82, 9, -83, 10],
      [-83, 10, -82, 9],
      [-83, 9, -83, 10],
      [-200, 9, -82, 10],
      [-83, -95, -82, 10],
    ] as const) {
      expect((await area(w, s, e, n)).error?.message).toBe("Revise el área del mapa.");
    }
  });
});
