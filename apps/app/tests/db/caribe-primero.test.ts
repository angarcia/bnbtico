// Ronda de Ana del 2 nov, ticket 06 (rehecho el 2026-11-06): sin zona, Explorar enseña todo el país con el Caribe primero.
// search_listings ordena las casas de Limón primero y, dentro de cada grupo, las más nuevas, y ese orden decide también qué
// casas entran en el límite. El tipo «completo» incluye las filas viejas con `kind` = 'casa' o 'apartamento'.
import { beforeAll, describe, expect, it } from "vitest";
import { parseFilters } from "../../src/domain/filters";
import { PROVINCES } from "../../src/domain/listing";
import type { CalendarHarness } from "../contract/harness";
import { anonClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const filters = (params: Record<string, string> = {}) => parseFilters(params, PROVINCES);

describe("search_listings · el Caribe primero y tipo de alojamiento", () => {
  let h: CalendarHarness;
  const house = {} as Record<"limonVieja" | "puntarenas" | "limonNueva" | "guanacaste" | "casaVieja" | "habitacion", { id: string; publicId: string }>;
  const ids = async (params: Record<string, string> = {}) => (await h.anon.searchPublic(filters(params))).map((l) => l.publicId);
  const expected = () => [house.habitacion, house.casaVieja, house.limonNueva, house.limonVieja, house.guanacaste, house.puntarenas].map((x) => x.publicId);

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
    // Puntos sobre tierra en cada provincia (submit_listing rechaza los del mar).
    const elsewhere = (province: string, canton: string, lat: number, lng: number) => ({ province, canton, zone: canton, zoneSource: "other" as const, zoneId: null, lat, lng });
    // Orden de creación: de la más vieja a la más nueva.
    house.limonVieja = await h.seed({ status: "active", draft: { title: "Limón vieja" } });
    house.puntarenas = await h.seed({ status: "active", draft: { title: "Puntarenas", ...elsewhere("Puntarenas", "Esparza", 9.99, -84.66) } });
    house.limonNueva = await h.seed({ status: "active", draft: { title: "Limón nueva" } });
    house.guanacaste = await h.seed({ status: "active", draft: { title: "Guanacaste", ...elsewhere("Guanacaste", "Nicoya", 9.88, -85.53) } });
    house.casaVieja = await h.seed({ status: "active", draft: { title: "Casa vieja" } });
    house.habitacion = await h.seed({ status: "active", draft: { title: "Habitación", kind: "habitacion", bedrooms: 1, bathroomShared: false, bathrooms: 1 } });
    // Una fila anterior al diseño v1: kind = 'casa'.
    sql(`begin; set local app.allow_status = 'on'; update public.listings set kind = 'casa' where id = '${house.casaVieja.id}'; commit;`);
  }, 120_000);

  it("Limón primero y, dentro de cada grupo, las más nuevas primero (sort_rank)", async () => {
    const { data, error } = await anonClient().rpc("search_listings", {}).select("public_id, sort_rank").order("sort_rank");
    expect(error).toBeNull();
    expect(data!.map((r) => r.public_id)).toEqual(expected());
    expect(data!.map((r) => r.sort_rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("el adaptador conserva ese orden, también con otros filtros", async () => {
    expect(await ids()).toEqual(expected());
    expect(await ids({ ppl: "2" })).toEqual(expected());
  });

  it("el límite se aplica después de ordenar: con 4, las cuatro de Limón aunque Guanacaste sea más nueva", async () => {
    const { data, error } = await anonClient().rpc("search_listings", { p_limit: 4 }).select("public_id, sort_rank").order("sort_rank");
    expect(error).toBeNull();
    expect(data!.map((r) => r.public_id)).toEqual(expected().slice(0, 4));
  });

  it("tipo «completo» incluye los valores viejos (casa) y deja fuera las habitaciones", async () => {
    const completo = await ids({ tipo: "completo" });
    expect(completo).toContain(house.casaVieja.publicId);
    expect(completo).not.toContain(house.habitacion.publicId);
    expect(completo).toHaveLength(5);
    expect(await ids({ tipo: "habitacion" })).toEqual([house.habitacion.publicId]);
  });

  it("una provincia (enlace viejo con ?prov=) sigue filtrando", async () => {
    expect(await ids({ prov: "Guanacaste" })).toEqual([house.guanacaste.publicId]);
  });
});
