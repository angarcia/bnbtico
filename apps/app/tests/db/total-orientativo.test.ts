// Migración total_orientativo_en_busqueda (ronda de Ana 2 nov, ticket 07): search_listings filtra, ordena (sort_rank) y
// limita dentro, y calcula stay_total_crc con search_stay_total SOLO para las filas que devuelve. Las cifras (fake y
// PostgREST iguales, con precios especiales y 30 noches o más) las prueba la suite de contrato (public-reads.contract.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { Seeded } from "../contract/harness";
import { anonClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const HELPER = "public.search_stay_total(uuid,integer,boolean,integer,date,date)";

/** Filas que devuelve search_listings(args) y llamadas a search_stay_total en esa misma transacción. */
function rowsAndCalls(args: string): { rows: number; calls: number } {
  const out = sql(`begin;
    set local track_functions = 'all';
    create temp table r on commit drop as select * from public.search_listings(${args});
    select (select count(*) from r) || ',' || coalesce(pg_stat_get_xact_function_calls('${HELPER}'::regprocedure), 0);
    rollback;`);
  const [rows, calls] = out.split("\n").pop()!.split(",").map(Number);
  return { rows: rows!, calls: calls! };
}

describe("migración total_orientativo_en_busqueda", () => {
  const T = costaRicaToday(Date.now());
  const dates = `p_from => '${addDays(T, 10)}', p_to => '${addDays(T, 14)}'`;
  const house = {} as Record<"limon1" | "limon2" | "limon3" | "guanacaste" | "busy", Seeded>;

  beforeAll(async () => {
    const h = await postgrestHarness();
    await h.reset();
    house.limon1 = await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: 40000 } });
    house.limon2 = await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: 50000, capacity: 6 } });
    house.guanacaste = await h.seed({
      status: "active",
      photos: 1,
      draft: { province: "Guanacaste", canton: "Nicoya", zone: "Sámara", zoneSource: "other", zoneId: null, lat: 9.88, lng: -85.53, nightlyPriceCrc: 60000 },
    });
    house.limon3 = await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: 70000 } });
    house.busy = await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: 80000 } });
    await h.putDay(house.busy.id, { day: addDays(T, 11), available: false, specialPriceCrc: null });
  }, 120_000);

  it("devuelve las columnas de listings_public, en su orden y con sus tipos, más stay_total_crc y sort_rank", () => {
    const view = sql(`select string_agg(column_name || ' ' || format_type(atttypid, atttypmod), ', ' order by ordinal_position)
      from information_schema.columns c join pg_attribute a on a.attrelid = 'public.listings_public'::regclass and a.attname = c.column_name
      where c.table_schema = 'public' and c.table_name = 'listings_public'`);
    const fn = sql(`select string_agg(n || ' ' || format_type(t, null), ', ' order by o)
      from pg_proc p, unnest(p.proargnames, p.proallargtypes::oid[], p.proargmodes::text[]) with ordinality as x(n, t, m, o)
      where p.oid = 'public.search_listings'::regproc and x.m = 't'`);
    expect(fn).toBe(`${view}, stay_total_crc bigint, sort_rank integer`);
  });

  it("solo hay una search_listings (la vieja de 3 argumentos se borró) y anon puede llamarla; search_stay_total, no", async () => {
    expect(sql("select count(*) from pg_proc where proname = 'search_listings' and pronamespace = 'public'::regnamespace")).toBe("1");
    expect(sql(`select has_function_privilege('anon', '${HELPER}', 'execute') or has_function_privilege('authenticated', '${HELPER}', 'execute')`)).toBe("f");
    const helper = await anonClient().rpc("search_stay_total", { p_listing: house.limon1.id, p_nightly: 1, p_accepts_monthly: false, p_monthly: 0, p_from: addDays(T, 1), p_to: addDays(T, 2) });
    expect(helper.error).not.toBeNull();
    const { data, error } = await anonClient().rpc("search_listings", { p_from: addDays(T, 10), p_to: addDays(T, 14) }).select("public_id, stay_total_crc");
    expect(error).toBeNull();
    expect(data!.find((r) => r.public_id === house.limon1.publicId)?.stay_total_crc).toBe(4 * 40000);
  });

  it("sort_rank numera el orden (más nuevas primero) y PostgREST ordena por él cuando se le pide", async () => {
    const newestFirst = [house.busy, house.limon3, house.guanacaste, house.limon2, house.limon1].map((x) => x.publicId);
    const { data, error } = await anonClient().rpc("search_listings", {}).select("public_id, sort_rank").order("sort_rank");
    expect(error).toBeNull();
    expect(data!.map((r) => r.public_id)).toEqual(newestFirst);
    expect(data!.map((r) => r.sort_rank)).toEqual([1, 2, 3, 4, 5]);
    // Con `returns table`, PostgREST solo ordena por una columna que también se pide (sin ella: «column record.sort_rank does not exist»).
    const back = await anonClient().rpc("search_listings", {}).select("public_id, sort_rank").order("sort_rank", { ascending: false });
    expect(back.data!.map((r) => r.public_id)).toEqual([...newestFirst].reverse());
  });

  it("los filtros y el límite van dentro: el límite deja las más nuevas que cumplen los filtros", async () => {
    const ids = async (args: Record<string, unknown>) => {
      const { data, error } = await anonClient().rpc("search_listings", args).select("public_id, sort_rank").order("sort_rank");
      expect(error).toBeNull();
      return data!.map((r) => r.public_id);
    };
    expect(await ids({ p_province: "Limón", p_limit: 2 })).toEqual([house.busy.publicId, house.limon3.publicId]);
    expect(await ids({ p_people: 6 })).toEqual([house.limon2.publicId]);
    expect(await ids({ p_min: 50000, p_max: 70000 })).toEqual([house.limon3.publicId, house.guanacaste.publicId, house.limon2.publicId]);
    expect(await ids({ p_province: "Limón", p_from: addDays(T, 10), p_to: addDays(T, 14), p_limit: 2 })).toEqual([house.limon3.publicId, house.limon2.publicId]);
  });

  it("el total solo se calcula para las filas que se devuelven (tras filtros, noches libres y límite); sin fechas, nunca", () => {
    expect(rowsAndCalls(dates)).toEqual({ rows: 4, calls: 4 }); // la ocupada no sale y no se calcula
    expect(rowsAndCalls(`${dates}, p_limit => 2`)).toEqual({ rows: 2, calls: 2 });
    expect(rowsAndCalls(`${dates}, p_province => 'Guanacaste'`)).toEqual({ rows: 1, calls: 1 });
    expect(rowsAndCalls(`${dates}, p_people => 50`)).toEqual({ rows: 0, calls: 0 });
    expect(rowsAndCalls("p_limit => 3")).toEqual({ rows: 3, calls: 0 });
    expect(rowsAndCalls("")).toEqual({ rows: 5, calls: 0 });
  });
});
