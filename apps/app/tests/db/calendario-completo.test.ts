// Migración calendario_completo (issue #13, épica DBA #9): las tres lecturas del calendario devuelven un solo jsonb con
// todos los días, así que max_rows (200) no las corta. Los casos de 0, 200, 201 y 366 días por anfitrión, admin y ficha
// están en la suite de contrato (calendar.contract.ts, fake y PostgREST); aquí, la forma de las funciones, que la
// ventana no crece y que los permisos no cambian.
import { beforeAll, describe, expect, it } from "vitest";
import type { Seeded } from "../contract/harness";
import { anonClient, signIn, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const FNS = ["public.owner_calendar_days(uuid)", "public.admin_calendar_days(uuid)", "public.public_listing_days(text)"];

describe("lecturas del calendario completas", () => {
  let casa: Seeded;

  beforeAll(async () => {
    const h = await postgrestHarness();
    await h.reset();
    casa = await h.seed({ status: "active" });
    // 366 días dentro de la ventana y uno a cada lado, que no deben salir.
    sql(`insert into public.listing_days (listing_id, day, available, special_price_crc)
      select '${casa.id}', public.costa_rica_today() + i, i <> 300, 70000 from generate_series(-1, 366) i`);
  }, 60_000);

  it("devuelven un jsonb, no filas: PostgREST no las corta en max_rows", () => {
    for (const fn of FNS) expect(sql(`select format_type(prorettype, null) || ',' || proretset from pg_proc where oid = '${fn}'::regprocedure`)).toBe("jsonb,false");
  });

  it("la ficha recibe los 366 días de la ventana en orden, con la noche 300 ocupada, y nada fuera de ella", async () => {
    const { data, error } = await anonClient().rpc("public_listing_days", { p_public_id: casa.publicId });
    expect(error).toBeNull();
    const days = data as { day: string; available: boolean; special_price_crc: number }[];
    const today = sql("select public.costa_rica_today()");
    expect(days).toHaveLength(366);
    expect(days[0]!.day).toBe(today);
    expect(days[300]).toEqual({ day: sql("select (public.costa_rica_today() + 300)::text"), available: false, special_price_crc: 70000 });
    expect(days.map((d) => d.day)).toEqual([...days.map((d) => d.day)].sort());
  });

  it("los permisos no cambian: anon solo lee la ficha; el anfitrión y el admin, con sesión; otro usuario recibe []", async () => {
    expect(sql(`select has_function_privilege('anon', '${FNS[2]}', 'execute') and has_function_privilege('authenticated', '${FNS[2]}', 'execute')`)).toBe("t");
    for (const fn of FNS.slice(0, 2)) {
      expect(sql(`select has_function_privilege('anon', '${fn}', 'execute') or has_function_privilege('public', '${fn}', 'execute')`)).toBe("f");
      expect(sql(`select has_function_privilege('authenticated', '${fn}', 'execute')`)).toBe("t");
      expect(sql(`select prosecdef from pg_proc where oid = '${fn}'::regprocedure`)).toBe("t");
    }
    const other = await signIn("other");
    expect((await other.rpc("owner_calendar_days", { p_listing: casa.id })).data).toEqual([]);
    expect((await other.rpc("admin_calendar_days", { p_listing: casa.id })).data).toEqual([]);
  });
});
