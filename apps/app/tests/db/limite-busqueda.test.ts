// Migración limite_busqueda (issue #10, épica DBA #9): search_listings limita siempre dentro de SQL. Omitido o NULL → 60;
// más de 60 → 60; cero o negativo → error de validación. El límite va antes de calcular los totales orientativos: se
// comprueba contando las llamadas a search_stay_total en la misma transacción, no por la longitud del JSON.
import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { Seeded } from "../contract/harness";
import { anonClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const HELPER = "public.search_stay_total(uuid,integer,boolean,integer,date,date)";
const CLONES = 205;

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

describe("migración limite_busqueda", () => {
  const T = costaRicaToday(Date.now());
  const from = addDays(T, 10);
  const to = addDays(T, 14);
  const dates = `p_from => '${from}', p_to => '${to}'`;
  let guanacaste: Seeded;

  beforeAll(async () => {
    const h = await postgrestHarness();
    await h.reset();
    const template = await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: 40000 } });
    guanacaste = await h.seed({
      status: "active",
      photos: 1,
      draft: { province: "Guanacaste", canton: "Nicoya", zone: "Sámara", zoneSource: "other", zoneId: null, lat: 9.88, lng: -85.53, nightlyPriceCrc: 60000 },
    });
    // Más de 200 casas elegibles en Limón: copias de la plantilla (activas, sin fotos), como el servicio.
    sql(`begin; select set_config('app.allow_status', 'on', true);
      do $$ declare cols text; begin
        select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
          from information_schema.columns
          where table_schema = 'public' and table_name = 'listings' and is_generated = 'NEVER' and is_identity = 'NO'
            and column_name not in ('id', 'public_id', 'created_at', 'updated_at');
        execute format('insert into public.listings (%s) select %s from public.listings, generate_series(1, ${CLONES}) where id = %L',
          cols, cols, '${template.id}');
      end $$;
      commit;`);
  }, 180_000);

  it("hay más de 200 casas elegibles", () => {
    expect(Number(sql("select count(*) from public.listings_public where available"))).toBeGreaterThan(200);
  });

  it("omitido, NULL o 100 000: como máximo 60 casas, y el total solo se calcula para esas 60", () => {
    expect(rowsAndCalls("")).toEqual({ rows: 60, calls: 0 });
    expect(rowsAndCalls(dates)).toEqual({ rows: 60, calls: 60 });
    expect(rowsAndCalls(`${dates}, p_limit => null`)).toEqual({ rows: 60, calls: 60 });
    expect(rowsAndCalls(`${dates}, p_limit => 100000`)).toEqual({ rows: 60, calls: 60 });
    expect(rowsAndCalls(`${dates}, p_limit => 60`)).toEqual({ rows: 60, calls: 60 });
  });

  it("por PostgREST (anon) tampoco se salta el límite", async () => {
    for (const args of [{}, { p_limit: 100000 }, { p_from: from, p_to: to }]) {
      const { data, error } = await anonClient().rpc("search_listings", args).select("public_id");
      expect(error).toBeNull();
      expect(data).toHaveLength(60);
    }
  });

  it("un límite de 10 devuelve 10 y calcula 10 totales", () => {
    expect(rowsAndCalls(`${dates}, p_limit => 10`)).toEqual({ rows: 10, calls: 10 });
  });

  it("cero y negativos se rechazan de forma controlada, sin calcular nada", async () => {
    for (const p_limit of [0, -1]) {
      const { data, error } = await anonClient().rpc("search_listings", { p_from: from, p_to: to, p_limit });
      expect(data).toBeNull();
      expect(error?.code).toBe("22023");
      expect(error?.message).toBe("Revise el límite.");
    }
  });

  it("conserva el orden vigente: las 60 primeras de la lista completa (el Caribe primero, luego las más nuevas)", async () => {
    const expected = sql(`select string_agg(public_id, ',' order by (province = 'Limón') desc, created_at desc, id desc)
      from (select public_id, province, created_at, id from public.listings_public where available
            order by (province = 'Limón') desc, created_at desc, id desc limit 60) x`).split(",");
    const { data, error } = await anonClient().rpc("search_listings", { p_limit: 100000 }).select("public_id, sort_rank").order("sort_rank");
    expect(error).toBeNull();
    expect(data!.map((r) => r.public_id)).toEqual(expected);
    expect(data!.map((r) => r.sort_rank)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });

  it("el límite va después de los filtros: con provincia sale la casa que no cabría entre las 60 primeras", async () => {
    const { data, error } = await anonClient()
      .rpc("search_listings", { p_province: "Guanacaste", p_from: from, p_to: to })
      .select("public_id, stay_total_crc");
    expect(error).toBeNull();
    expect(data).toEqual([{ public_id: guanacaste.publicId, stay_total_crc: 4 * 60000 }]);
  });

  it("la autorización no cambia: anon y authenticated ejecutan search_listings; search_stay_total sigue cerrada", () => {
    const fn = "public.search_listings(text,date,date,text,integer,integer,public.feature[],integer,integer,integer,public.listing_kind[])";
    expect(sql(`select has_function_privilege('anon', '${fn}', 'execute') and has_function_privilege('authenticated', '${fn}', 'execute')`)).toBe("t");
    expect(sql(`select has_function_privilege('public', '${HELPER}', 'execute') or has_function_privilege('anon', '${HELPER}', 'execute')`)).toBe("f");
    expect(sql("select prosecdef from pg_proc where oid = 'public.search_listings'::regproc")).toBe("t");
  });
});
