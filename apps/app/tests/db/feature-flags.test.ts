// Migración feature_flags (historia #58, 2026-11-17): una fila con las cinco flags que escribe el despliegue con
// set_feature_flags. Solo el servicio la escribe; nadie la lee por REST ni puede cambiarla enviando su propio valor;
// public.feature_flags() (la que usan las RPCs por dentro) no se puede llamar desde fuera.
import { afterEach, describe, expect, it } from "vitest";
import { anonClient, serviceClient, signIn, sql } from "./local";

const INITIAL = { p_explore_dates: false, p_explore_nights: true, p_date_prices: false, p_external_calendars: true, p_rooms: false };
const row = () => sql("select explore_dates || '/' || explore_nights || '/' || date_prices || '/' || external_calendars || '/' || rooms from public.feature_flags();");

describe("feature flags en la base", () => {
  afterEach(async () => {
    await serviceClient().rpc("set_feature_flags", INITIAL);
  });

  it("sin cambios, los cinco valores iniciales", () => {
    expect(row()).toBe("false/true/false/true/false");
  });

  it("el servicio las cambia y las RPCs leen el valor nuevo", async () => {
    const { error } = await serviceClient().rpc("set_feature_flags", { ...INITIAL, p_explore_dates: true, p_rooms: true });
    expect(error).toBeNull();
    expect(row()).toBe("true/true/false/true/true");
  });

  it("sin fila, la lectura devuelve los valores iniciales", () => {
    expect(sql("begin; delete from public.feature_flags; select explore_nights || '/' || rooms from public.feature_flags(); rollback;")).toContain("true/false");
  });

  it("ni anónimo ni usuario las leen, las cambian o llaman a la lectura interna", async () => {
    const owner = await signIn("owner");
    for (const client of [anonClient(), owner]) {
      expect((await client.rpc("set_feature_flags", { ...INITIAL, p_rooms: true })).error).not.toBeNull();
      expect((await client.from("feature_flags").select("*")).data ?? []).toEqual([]);
      expect((await client.rpc("feature_flags")).error).not.toBeNull();
    }
    expect(row()).toBe("false/true/false/true/false");
  });
});
