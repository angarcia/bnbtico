// Migración mensual_como_caracteristica (2026-10-27): toda casa se alquila por noches (accepts_nightly siempre true) y
// «Alquiler mensual» es una característica más: accepts_monthly no nulo, por defecto false, con precio al mes opcional.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { TEST_PHONES, signIn, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

describe("migración mensual_como_caracteristica", () => {
  let h: ListingsHarness;
  let owner: SupabaseClient<Database>;
  let ownerId: string;
  // Un solo borrador para los casos que solo tocan la tabla: cada dueño tiene como mucho cinco sin enviar.
  let draft: string;
  const base = () => ({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: TEST_PHONES.owner });

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
    owner = await signIn("owner");
    ownerId = (await owner.auth.getUser()).data.user!.id;
    draft = (await h.seed({ status: "draft" })).id;
  }, 60_000);

  it("un borrador nuevo nace por noches y sin mensual", async () => {
    const { data, error } = await owner.from("listings").insert(base()).select("accepts_nightly, accepts_monthly").single();
    expect(error).toBeNull();
    expect(data).toEqual({ accepts_nightly: true, accepts_monthly: false });
  });

  it("accepts_nightly = false lo rechaza la tabla", async () => {
    const { error } = await owner.from("listings").insert({ ...base(), accepts_nightly: false });
    expect(error?.message).toContain("listings_accepts_nightly");
    expect(() => sql(`update listings set accepts_nightly = false where id = '${draft}';`)).toThrow(/listings_accepts_nightly/);
  });

  it("accepts_monthly no admite null", async () => {
    const { error } = await owner.from("listings").update({ accepts_monthly: null as unknown as boolean }).eq("id", draft);
    expect(error?.code).toBe("23502");
  });

  it("submit_listing exige el precio por noche", async () => {
    const { id } = await h.seed({ status: "draft", photos: 5, draft: { nightlyPriceCrc: null } });
    await expect(h.owner("owner").submit(id)).rejects.toThrow("Indique el precio por noche en colones.");
  });

  it("submit_listing acepta mensual sin precio", async () => {
    const { id } = await h.seed({ status: "draft", photos: 5, draft: { acceptsMonthly: true, monthlyPriceCrc: null } });
    await expect(h.owner("owner").submit(id)).resolves.toBeUndefined();
    expect(await h.owner("owner").getOwn(id)).toMatchObject({ status: "review", acceptsMonthly: true, monthlyPriceCrc: null });
  });

  it("precio al mes 0 no llega a la tabla", async () => {
    expect(() => sql(`update listings set monthly_price_crc = 0 where id = '${draft}';`)).toThrow(/monthly_price_crc/);
  });
});
