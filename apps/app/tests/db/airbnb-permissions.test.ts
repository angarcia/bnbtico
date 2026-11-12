import { beforeAll, describe, expect, it } from "vitest";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import type { SubscriptionHarness } from "../contract/harness";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import { anonClient, localSupabase, signIn, signInAdmin } from "./local";
import { postgrestHarness } from "./postgrest-harness";

describe("Airbnb · grants y permisos reales", () => {
  let h: SubscriptionHarness;
  beforeAll(async () => { h = await postgrestHarness(); await h.reset(); }, 90_000);
  it("anon, dueño y admin aal2 no leen tablas privadas ni ejecutan finalización de servicio", async () => {
    const l = await h.seed({ status: "active" });
    const request = crypto.randomUUID();
    const cfg = localSupabase();
    const service = createAirbnbService({ supabaseUrl: cfg.url, anonKey: cfg.anonKey, serviceKey: cfg.serviceKey, fetch: (i, init) => fetch(i, init) });
    await service.begin(await h.jwt("owner"), l.id, TEST_AIRBNB_URL, request);
    const owner = await signIn("owner");
    const admin = await signInAdmin();
    const anon = anonClient();
    for (const client of [anon, owner, admin]) {
      for (const table of ["airbnb_connections", "airbnb_import_attempts", "airbnb_blocks"] as const) {
        expect((await client.from(table).select("*")).error?.code, table).toBe("42501");
      }
      expect((await client.rpc("airbnb_import_context", { p_listing: l.id, p_request: request })).error?.code).toBe("42501");
      expect((await client.rpc("finish_airbnb_import", { p_listing: l.id, p_request: request, p_blocks: [] })).error?.code).toBe("42501");
      expect((await client.rpc("claim_airbnb_import", { p_listing: l.id, p_request: crypto.randomUUID() })).error?.code).toBe("42501");
    }
    expect((await admin.rpc("begin_airbnb_import", { p_listing: l.id, p_url: TEST_AIRBNB_URL, p_request: crypto.randomUUID() })).error?.code).toBe("P0001");
    const info = await service.overview(await h.jwt("owner"), l.id);
    expect(JSON.stringify(info)).not.toContain("?t=");
    await service.context(l.id, request);
    await service.finish(l.id, request, [], null);
  });
});
