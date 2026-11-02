// Migración explorar_fechas_y_zona (spec .scratch/explorar-airbnb/spec.md, «Data · SQL»): search_listings da las casas
// públicas abiertas, libres todas las noches de [llegada, salida) y a 5 km o menos del punto de la zona (o con esa zona),
// medido con el punto real dentro de la base; zones_with_listings da las zonas con alguna de esas casas.
import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { CalendarHarness } from "../contract/harness";
import { anonClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

type Args = { p_zone?: string; p_from?: string; p_to?: string };
// Puntos hacia el sur del punto de la zona Cocles (9.643783, -82.730561): a 4 km, 4,8 km y 6 km.
const KM4 = { lat: 9.607608, lng: -82.730561 };
const KM48 = { lat: 9.600374, lng: -82.730561 };
const KM6 = { lat: 9.589521, lng: -82.730561 };
const LIMON_CENTRO = { lat: 9.993161, lng: -83.029761 };

const ids = async (args: Args) => {
  const { data, error } = await anonClient().rpc("search_listings", args).select("public_id");
  if (error) throw new Error(error.message);
  return data!.map((r) => r.public_id).sort();
};
const rpcError = async (args: Args) => (await anonClient().rpc("search_listings", args)).error?.message;

describe("migración explorar_fechas_y_zona", () => {
  let h: CalendarHarness;
  const T = costaRicaToday(Date.now());
  const A = addDays(T, 20);
  const S = addDays(T, 24);
  const house = {} as Record<"km4" | "km48" | "km6" | "km6z" | "draft" | "closed", { id: string; publicId: string }>;

  const place = (id: string, p: { lat: number; lng: number }, zoneId: string | null = null) =>
    sql(`begin; set local app.allow_status = 'on'; update public.listings set lat = ${p.lat}, lng = ${p.lng}, zone_id = ${zoneId ? `'${zoneId}'` : "null"} where id = '${id}'; commit;`);

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
    const other = { zone: "Cocles", zoneSource: "other" as const, zoneId: null };
    for (const k of ["km4", "km48", "km6", "km6z", "closed"] as const) {
      house[k] = await h.seed({ status: "active", draft: { ...other, title: `Casa ${k}` } });
    }
    house.draft = await h.seed({ status: "draft", draft: { ...other, title: "Casa borrador" } });
    place(house.km4.id, KM4);
    place(house.km48.id, KM48);
    place(house.km6.id, KM6);
    place(house.km6z.id, KM6, "704-cocles");
    place(house.draft.id, LIMON_CENTRO);
    await h.setClosed(house.closed.id, true, addDays(T, 5));
    // Un día ocupado por casa: dentro del rango, la última noche, el día de salida y la víspera de la llegada.
    const busy = async (id: string, day: string) => h.putDay(id, { day, available: false, specialPriceCrc: null });
    await busy(house.km4.id, addDays(A, 2));
    await busy(house.km48.id, addDays(S, -1));
    await busy(house.km6.id, S);
    await busy(house.km6z.id, addDays(A, -1));
  }, 120_000);

  it("sin argumentos da las casas activas y abiertas: ni el borrador ni la cerrada", async () => {
    expect(await ids({})).toEqual([house.km4, house.km48, house.km6, house.km6z].map((x) => x.publicId).sort());
  });

  it("con fechas, solo las libres todas las noches de [llegada, salida)", async () => {
    const got = await ids({ p_from: A, p_to: S });
    expect(got).not.toContain(house.km4.publicId); // ocupada en A + 2
    expect(got).not.toContain(house.km48.publicId); // ocupada la última noche (S − 1)
    expect(got).toContain(house.km6.publicId); // ocupada el día de salida
    expect(got).toContain(house.km6z.publicId); // ocupada la víspera
  });

  it("con zona, las de esa zona y las que quedan a 5 km o menos de su punto", async () => {
    const got = await ids({ p_zone: "704-cocles" });
    expect(got).toContain(house.km4.publicId);
    expect(got).toContain(house.km48.publicId);
    expect(got).not.toContain(house.km6.publicId);
    expect(got).toContain(house.km6z.publicId);
  });

  it("una zona que no existe o inactiva no da casas", async () => {
    expect(await ids({ p_zone: "704-no-existe" })).toEqual([]);
    const inactive = sql("select id from zones where not active limit 1");
    expect(inactive).toBeTruthy();
    expect(await ids({ p_zone: inactive })).toEqual([]);
  });

  it("rechaza un rango inválido con «Revise las fechas.»", async () => {
    expect(await rpcError({ p_from: A })).toBe("Revise las fechas.");
    expect(await rpcError({ p_from: S, p_to: A })).toBe("Revise las fechas.");
    expect(await rpcError({ p_from: addDays(T, -1), p_to: A })).toBe("Revise las fechas.");
    expect(await rpcError({ p_from: A, p_to: addDays(T, 367) })).toBe("Revise las fechas.");
    expect(await rpcError({ p_from: addDays(T, 365), p_to: addDays(T, 366) })).toBeUndefined();
  });

  it("anon llama a la RPC sin poder leer listings", async () => {
    expect((await anonClient().rpc("search_listings", {})).error).toBeNull();
    const direct = await anonClient().from("listings").select("id");
    expect(direct.error !== null || direct.data!.length === 0).toBe(true);
  });

  it("zones_with_listings: zonas con alguna casa activa y abierta cerca, con cantón y provincia", async () => {
    const { data, error } = await anonClient().from("zones_with_listings").select("id, name, canton_code, canton, province, lat, lng, listings");
    expect(error).toBeNull();
    const cocles = data!.find((z) => z.id === "704-cocles");
    expect(cocles).toMatchObject({ name: "Cocles", canton_code: "704", canton: "Talamanca", province: "Limón" });
    expect(cocles!.listings).toBeGreaterThanOrEqual(1);
    // El borrador está en el punto de Limón centro: no cuenta.
    expect(data!.map((z) => z.id)).not.toContain("701-limon-centro");
  });
});
