import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { serviceClient } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const COCLES = { lat: 9.6418, lng: -82.733 };
let h: Awaited<ReturnType<typeof postgrestHarness>>;
beforeAll(async () => {
  h = await postgrestHarness();
});
beforeEach(async () => {
  await h.reset();
});

async function submitWith(patch: Record<string, unknown>) {
  const { id } = await h.seed({ status: "draft", photos: 5 });
  await serviceClient().from("listings").update(patch as never).eq("id", id);
  let error: string | null = null;
  try {
    await h.owner("owner").submit(id);
  } catch (e) {
    error = (e as Error).message;
  }
  const row = (await serviceClient().from("listings").select("status, province, canton, district, zone, zone_id" as never).eq("id", id).single()).data!;
  return { error, row };
}

describe("submit_listing con la ubicación por punto", () => {
  it("sobrescribe un cantón equivocado que manda el cliente", async () => {
    const { error, row } = await submitWith({ ...lat(COCLES), province: "Limón", canton: "Limón", district: "", zone: "Cocles", zone_id: "704-cocles", zone_source: "list" });
    expect(error).toBeNull();
    expect(row).toMatchObject({ status: "review", province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cocles" });
  });
  it("rechaza una zona de la lista a más de 5 km", async () => {
    expect((await submitWith({ ...lat(COCLES), zone: "Cahuita", zone_id: "704-cahuita", zone_source: "list" })).error).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
  });
  it("rechaza 'district' con otro nombre", async () => {
    expect((await submitWith({ ...lat(COCLES), zone: "Bratsi", zone_id: null, zone_source: "district" })).error).toBe("La zona no coincide con el distrito del punto. Elija otra.");
  });
  it("acepta 'other' y rechaza más de 60 caracteres", async () => {
    expect((await submitWith({ ...lat(COCLES), zone: "Rancho Escondido", zone_id: null, zone_source: "other" })).row).toMatchObject({ status: "review", zone: "Rancho Escondido", zone_id: null });
    expect((await submitWith({ ...lat(COCLES), zone: "x".repeat(61), zone_id: null, zone_source: "other" })).error).toBe("La zona puede tener como mucho 60 caracteres.");
  });
  it("un punto en el mar no se envía", async () => {
    expect((await submitWith({ lat: 10.2, lng: -82.8, zone: "Cocles", zone_id: "704-cocles", zone_source: "list" })).error).toBe("Ponga el punto sobre tierra, dentro de Costa Rica.");
  });
  it("'other' con el punto al otro lado del río Estrella guarda el cantón nuevo", async () => {
    // 9.8, -82.93 cae en Valle La Estrella (cantón Limón), cerca del límite con Talamanca: place_at lo confirma.
    const { row } = await submitWith({ lat: 9.8, lng: -82.93, province: "Limón", canton: "Talamanca", zone: "Finca Los Almendros", zone_id: null, zone_source: "other" });
    expect(row).toMatchObject({ canton: "Limón", zone: "Finca Los Almendros" });
  });
  it("listings_public no expone zone_source", async () => {
    expect((await serviceClient().from("listings_public").select("zone_source" as never).limit(1)).error).not.toBeNull();
  });
});
const lat = (p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng });
