// Migración precios_fecha_flag (historia #61, decisiones del 2026-11-17): con la flag `date_prices` apagada, los precios
// especiales del calendario se conservan en la base, pero ninguna lectura los devuelve (ficha, anfitrión, admin), el total
// de la búsqueda usa solo el precio por noche y no se puede guardar uno nuevo, tampoco llamando directamente a la API.
// Bloquear y desbloquear noches no cambia. Encendida, todo vuelve tal cual (lo cubre el resto de las pruebas del calendario,
// con el harness en `date_prices` encendida).
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Seeded } from "../contract/harness";
import type { Database } from "../../src/domain/database.types";
import { anonClient, serviceClient, signIn, sql } from "./local";
import { HARNESS_FLAGS, postgrestHarness } from "./postgrest-harness";

const PRICES_OFF = { ...HARNESS_FLAGS, p_date_prices: false };
const MESSAGE = "Los precios por fecha no están disponibles por ahora.";
const prices = async (on: boolean) => expect((await serviceClient().rpc("set_feature_flags", on ? HARNESS_FLAGS : PRICES_OFF)).error).toBeNull();
type Day = { day: string; available: boolean; special_price_crc: number | null };

describe("precios por fecha con la flag apagada", () => {
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  let owner: SupabaseClient<Database>;
  let casa: Seeded;
  const day = (n: number) => sql(`select (public.costa_rica_today() + ${n})::text`);

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
  }, 90_000);
  beforeEach(async () => {
    await h.reset();
    // ₡50 000 la noche; la noche 11 con precio especial de ₡80 000 y la 15 ocupada.
    casa = await h.seed({ status: "active", draft: { nightlyPriceCrc: 50_000 } });
    sql(`insert into public.listing_days (listing_id, day, available, special_price_crc) values
      ('${casa.id}', public.costa_rica_today() + 11, true, 80000), ('${casa.id}', public.costa_rica_today() + 15, false, null)`);
    await prices(false);
  });
  afterAll(() => prices(true));

  it("la ficha no ve el precio especial pero sí la noche ocupada; el precio sigue guardado", async () => {
    const { data } = await anonClient().rpc("public_listing_days", { p_public_id: casa.publicId });
    const days = data as Day[];
    expect(days.find((d) => d.day === day(11))?.special_price_crc ?? null).toBeNull();
    expect(days.find((d) => d.day === day(15))).toEqual({ day: day(15), available: false, special_price_crc: null });
    expect(sql(`select special_price_crc from public.listing_days where listing_id = '${casa.id}' and day = public.costa_rica_today() + 11`)).toBe("80000");
  });

  it("el anfitrión tampoco lo ve en su calendario", async () => {
    const { data } = await owner.rpc("owner_calendar_days", { p_listing: casa.id });
    expect((data as Day[]).every((d) => d.special_price_crc === null)).toBe(true);
  });

  it("3 noches con una de precio especial: el total de la búsqueda es 3 × ₡50 000", () => {
    expect(sql(`select public.search_stay_total('${casa.id}', 50000, false, null, public.costa_rica_today() + 10, public.costa_rica_today() + 13)`)).toBe("150000");
  });

  it("no se guarda un precio por fecha, ni llamando a la API; bloquear y desbloquear sí, y conservan el precio guardado", async () => {
    const price = await owner.rpc("save_listing_days", { p_listing: casa.id, p_days: [day(20)], p_price_crc: 60_000 });
    expect(price.error?.message).toBe(MESSAGE);
    expect(sql(`select count(*) from public.listing_days where listing_id = '${casa.id}' and day = public.costa_rica_today() + 20`)).toBe("0");

    expect((await owner.rpc("save_listing_days", { p_listing: casa.id, p_days: [day(11)], p_available: false })).error).toBeNull();
    expect((await owner.rpc("save_listing_days", { p_listing: casa.id, p_days: [day(11)], p_available: true })).error).toBeNull();
    expect(sql(`select available || '/' || special_price_crc from public.listing_days where listing_id = '${casa.id}' and day = public.costa_rica_today() + 11`)).toBe("true/80000");
  });

  it("al encenderla, el precio guardado vuelve a la ficha y al total", async () => {
    await prices(true);
    const { data } = await anonClient().rpc("public_listing_days", { p_public_id: casa.publicId });
    expect((data as Day[]).find((d) => d.day === day(11))?.special_price_crc).toBe(80_000);
    expect(sql(`select public.search_stay_total('${casa.id}', 50000, false, null, public.costa_rica_today() + 10, public.costa_rica_today() + 13)`)).toBe("180000");
  });
});
