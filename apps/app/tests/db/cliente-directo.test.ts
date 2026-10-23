// Migración cliente_directo, parte uno: el catálogo es una sola consulta (fotos en la vista) y las provincias con casas
// salen de una vista, no de un distinct en el navegador.
import { beforeAll, describe, expect, it } from "vitest";
import type { ListingsHarness, Seeded } from "../contract/harness";
import { anonClient } from "./local";
import { postgrestHarness } from "./postgrest-harness";

describe("migración cliente_directo · vistas públicas", () => {
  let h: ListingsHarness;
  let active: Seeded;

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
    active = await h.seed({ status: "active", photos: 7 });
    await h.seed({ status: "active", draft: { zone: "Puerto Viejo" } });
    await h.seed({ status: "review", draft: { province: "Puntarenas", canton: "Osa", zone: "Uvita", lat: 9.15, lng: -83.75 } });
  });

  it("listings_public.photos es la lista de rutas ordenada por posición", async () => {
    const { data, error } = await anonClient().from("listings_public").select("photos").eq("public_id", active.publicId).single();
    expect(error).toBeNull();
    expect(data!.photos).toEqual(active.photoPaths);
  });

  it("una casa sin fotos trae una lista vacía, no null", async () => {
    const { data } = await anonClient().from("listings_public").select("public_id, photos");
    for (const row of data!) expect(Array.isArray(row.photos)).toBe(true);
  });

  it("provinces_with_listings cuenta solo casas activas y la lee cualquiera", async () => {
    const { data, error } = await anonClient().from("provinces_with_listings").select("province, listings");
    expect(error).toBeNull();
    expect(data).toEqual([{ province: "Limón", listings: 2 }]);
  });
});
