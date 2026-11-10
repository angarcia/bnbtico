import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SubscriptionHarness } from "../contract/harness";
import { anonClient, signIn, signInAdmin } from "./local";
import { icalExportHarness } from "./ical-export-harness";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

describe("Gestión Airbnb · permisos reales", () => {
  let h: SubscriptionHarness;
  beforeAll(async () => { h = await icalExportHarness(); }, 90_000);
  afterAll(async () => { if (h) await h.reset(); }, 60_000);
  it("las columnas privadas y funciones internas siguen cerradas; admin no gestiona conexiones ajenas", async () => {
    const l = await h.seed({ status: "active" });
    const anon = anonClient();
    const owner = await signIn("owner");
    const other = await signIn("other");
    const admin = await signInAdmin();
    for (const client of [anon, owner, other, admin]) {
      expect((await client.from("airbnb_import_attempts").select("candidate_url,operation")).error?.code).toBe("42501");
      expect((await client.from("airbnb_connections").select("last_error_at,private_url")).error?.code).toBe("42501");
      expect((await client.from("ical_exports").select("generation,token")).error?.code).toBe("42501");
      expect((await client.rpc("airbnb_check_owner", { p_listing: l.id })).error?.code).toBe("42501");
      expect((await client.rpc("airbnb_import_context", { p_listing: l.id, p_request: crypto.randomUUID() })).error?.code).toBe("42501");
    }
    for (const client of [other, admin]) {
      expect((await client.rpc("begin_airbnb_update", { p_listing: l.id, p_request: crypto.randomUUID() })).error?.code).toBe("P0001");
      expect((await client.rpc("disconnect_airbnb", { p_listing: l.id, p_request: crypto.randomUUID() })).error?.code).toBe("P0001");
      expect((await client.rpc("revoke_ical_export_generation", { p_listing: l.id, p_generation: 0 })).error?.code).toBe("P0001");
    }
    expect((await anon.rpc("begin_airbnb_update", { p_listing: l.id, p_request: crypto.randomUUID() })).error?.code).toBe("42501");
    expect((await anon.rpc("disconnect_airbnb", { p_listing: l.id, p_request: crypto.randomUUID() })).error?.code).toBe("42501");
    expect((await anon.rpc("revoke_ical_export_generation", { p_listing: l.id, p_generation: 0 })).error?.code).toBe("42501");
  });

  it("marcar reserva exige dueño activo y rechaza visitante, otro dueño y admin por RPC directa", async () => {
    const l = await h.seed({ status: "active" });
    const day = addDays(costaRicaToday(Date.now()), 10);
    const args = { p_listing: l.id, p_days: [day] };
    const owner = await signIn("owner");
    expect((await anonClient().rpc("mark_listing_reservation", args)).error?.code).toBe("42501");
    for (const client of [await signIn("other"), await signInAdmin()]) {
      expect((await client.rpc("mark_listing_reservation", args)).error?.code).toBe("P0001");
    }
    await h.setAccountActive("owner", false);
    try {
      expect((await owner.rpc("mark_listing_reservation", args)).error?.code).toBe("42501");
    } finally { await h.setAccountActive("owner", true); }
    expect(await h.calendar("owner").days(l.id)).toEqual([]);
    expect((await owner.rpc("mark_listing_reservation", args)).error).toBeNull();
    expect(await h.calendar("owner").days(l.id)).toEqual([{ day, available: false, specialPriceCrc: null }]);
  });
});
