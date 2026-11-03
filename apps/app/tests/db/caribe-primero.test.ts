// Migración caribe_primero (ronda de Ana del 2 nov, ticket 06): search_listings ordena las casas de Limón primero y, dentro de
// cada grupo, las más nuevas primero; el adaptador PostgREST ya no pide su propio orden. También: baños y tipo con una fila
// de un valor viejo de `kind` (`casa`).
import { beforeAll, describe, expect, it } from "vitest";
import { parseFilters } from "../../src/domain/filters";
import { PROVINCES } from "../../src/domain/listing";
import type { CalendarHarness } from "../contract/harness";
import { anonClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const filters = (params: Record<string, string> = {}) => parseFilters(params, PROVINCES);

describe("migración caribe_primero", () => {
  let h: CalendarHarness;
  const house = {} as Record<"limonVieja" | "puntarenas" | "limonNueva" | "guanacaste" | "casaVieja" | "habitacion", { id: string; publicId: string }>;
  const ids = async (params: Record<string, string> = {}) => (await h.anon.searchPublic(filters(params))).map((l) => l.publicId);

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
    const elsewhere = (province: string, canton: string, lat: number, lng: number) => ({ province, canton, zone: canton, zoneSource: "other" as const, zoneId: null, lat, lng });
    // Orden de creación: de la más vieja a la más nueva.
    house.limonVieja = await h.seed({ status: "active", draft: { title: "Limón vieja" } });
    house.puntarenas = await h.seed({ status: "active", draft: { title: "Puntarenas", ...elsewhere("Puntarenas", "Garabito", 9.615, -84.629) } });
    house.limonNueva = await h.seed({ status: "active", draft: { title: "Limón nueva" } });
    house.guanacaste = await h.seed({ status: "active", draft: { title: "Guanacaste", ...elsewhere("Guanacaste", "Nicoya", 9.88, -85.53) } });
    house.casaVieja = await h.seed({ status: "active", draft: { title: "Casa vieja", bathrooms: 2 } });
    house.habitacion = await h.seed({ status: "active", draft: { title: "Habitación", kind: "habitacion", bathroomShared: false, bathrooms: 1 } });
    // Una fila anterior al diseño v1: kind = 'casa'.
    sql(`begin; set local app.allow_status = 'on'; update public.listings set kind = 'casa' where id = '${house.casaVieja.id}'; commit;`);
  }, 120_000);

  it("search_listings: Limón primero y, dentro de cada grupo, las más nuevas primero", async () => {
    const { data, error } = await anonClient().rpc("search_listings", {}).select("public_id");
    expect(error).toBeNull();
    expect(data!.map((r) => r.public_id)).toEqual([house.habitacion, house.casaVieja, house.limonNueva, house.limonVieja, house.guanacaste, house.puntarenas].map((x) => x.publicId));
  });

  it("search_listings numera el orden en sort_rank (1, 2, 3…) y el adaptador lo pide explícito", async () => {
    const { data, error } = await anonClient().rpc("search_listings", {}).select("public_id, sort_rank, stay_total_crc");
    expect(error).toBeNull();
    expect(data!.map((r) => r.sort_rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(data!.map((r) => r.stay_total_crc)).toEqual([null, null, null, null, null, null]); // sin fechas, sin total
    // Pedido al revés, PostgREST devuelve el orden contrario: el adaptador depende de `.order("sort_rank")`, no de la suerte.
    const back = await anonClient().rpc("search_listings", {}).select("public_id, sort_rank").order("sort_rank", { ascending: false });
    expect(back.error).toBeNull();
    expect(back.data!.map((r) => r.public_id)).toEqual([...data!].reverse().map((r) => r.public_id));
  });

  it("el adaptador conserva ese orden (con su `.order(\"sort_rank\")`) también con otros filtros", async () => {
    expect(await ids()).toEqual([house.habitacion, house.casaVieja, house.limonNueva, house.limonVieja, house.guanacaste, house.puntarenas].map((x) => x.publicId));
    expect(await ids({ ppl: "2" })).toEqual(await ids());
  });

  it("tipo «completo» incluye los valores viejos (casa); baños como mínimo", async () => {
    const completo = await ids({ tipo: "completo" });
    expect(completo).toContain(house.casaVieja.publicId);
    expect(completo).not.toContain(house.habitacion.publicId);
    expect(await ids({ tipo: "habitacion" })).toEqual([house.habitacion.publicId]);
    expect(await ids({ banos: "2" })).toEqual([house.casaVieja.publicId]);
  });

  it("el total orientativo solo se calcula para las casas que se devuelven (después de filtros y límite)", () => {
    const from = sql("select (public.costa_rica_today() + 10)::text");
    const to = sql("select (public.costa_rica_today() + 14)::text");
    // search_stay_total es plpgsql (no se expande en línea): sus llamadas se cuentan con las estadísticas de funciones de la transacción.
    const calls = (args: string) =>
      Number(
        sql(`begin; set local track_functions = 'all';
          select count(*) from public.search_listings(${args}) \\gset
          select coalesce(pg_stat_get_xact_function_calls('public.search_stay_total(uuid,integer,boolean,integer,date,date)'::regprocedure::oid), 0);
          rollback;`).split("\n").pop(),
      );
    const dates = `p_from => '${from}', p_to => '${to}'`;
    expect(calls(dates)).toBe(6); // seis casas, sin límite
    expect(calls(`${dates}, p_limit => 2`)).toBe(2); // límite: solo las dos que salen
    expect(calls(`${dates}, p_province => 'Puntarenas'`)).toBe(1); // filtro: solo la de Puntarenas
    expect(calls(`p_limit => 2`)).toBe(2); // sin fechas también solo por las devueltas (la llamada sale null)
  });
});
