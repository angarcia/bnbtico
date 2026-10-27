// Casas del admin (fase 5, ticket 07) sin migración nueva: la lista se arma con lecturas que ya permiten las políticas
// de admin (listings, subscriptions, payment_methods, profiles con is_admin() en aal2). Aquí se comprueba en la base,
// sin pasar por el adaptador, que un admin en aal1 y un propietario no leen las suscripciones ni los métodos ajenos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { SubscriptionHarness } from "../contract/harness";
import { TEST_PHONES, serviceClient, signIn, signInAdmin } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: SubscriptionHarness;
let aal1: SupabaseClient<Database>;
let aal2: SupabaseClient<Database>;
let owner: SupabaseClient<Database>;

const HOUSES = "id, subscriptions!inner(plan)";

beforeAll(async () => {
  h = await postgrestHarness();
  aal2 = await signInAdmin();
  aal1 = await signIn("admin");
  owner = await signIn("owner");
  await serviceClient().rpc("seed_admin", { p_phone: TEST_PHONES.admin });
}, 60_000);

describe("casas del admin en la base", () => {
  it("el admin en aal2 lee las casas con suscripción y los métodos de pago de todos", async () => {
    await h.reset();
    const mine = await h.seed({ status: "active" });
    const theirs = await h.seed({ status: "active", as: "other" });
    await h.service.applyPaymentEvent({
      provider: "fake",
      eventId: `evt_admin_casas_${Date.now()}`,
      type: "setup_completed",
      ownerId: h.ownerId("other"),
      customerRef: "cus_prueba",
      methodRef: "pm_prueba",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2029,
    });
    const houses = await aal2.from("listings").select(HOUSES);
    expect(houses.error).toBeNull();
    expect((houses.data ?? []).map((r) => r.id).sort()).toEqual([mine.id, theirs.id].sort());
    const methods = await aal2.from("payment_methods").select("owner_id");
    expect(methods.data?.map((m) => m.owner_id)).toEqual([h.ownerId("other")]);
  });

  it("un admin en aal1 no lee casas, suscripciones ni métodos de pago", async () => {
    await h.reset();
    await h.seed({ status: "active", as: "other" });
    await h.seed({ status: "review", as: "other" });
    expect((await aal1.from("listings").select(HOUSES)).data).toEqual([]);
    expect((await aal1.from("subscriptions").select("listing_id")).data).toEqual([]);
    expect((await aal1.from("payment_methods").select("owner_id")).data).toEqual([]);
  });

  it("un propietario solo lee sus propias suscripciones, nunca las ajenas ni sus métodos", async () => {
    await h.reset();
    const mine = await h.seed({ status: "active" });
    await h.seed({ status: "active", as: "other" });
    await h.service.applyPaymentEvent({
      provider: "fake",
      eventId: `evt_admin_casas_otro_${Date.now()}`,
      type: "setup_completed",
      ownerId: h.ownerId("other"),
      customerRef: "cus_prueba",
      methodRef: "pm_prueba",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2029,
    });
    expect(((await owner.from("listings").select(HOUSES)).data ?? []).map((r) => r.id)).toEqual([mine.id]);
    expect(((await owner.from("subscriptions").select("listing_id")).data ?? []).map((r) => r.listing_id)).toEqual([mine.id]);
    expect((await owner.from("payment_methods").select("owner_id")).data).toEqual([]);
  });
});
