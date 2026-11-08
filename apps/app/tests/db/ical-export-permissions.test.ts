import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIcalExportService } from "../../src/data/postgrest/ical-export";
import type { SubscriptionHarness } from "../contract/harness";
import { anonClient, localSupabase, signIn, signInAdmin } from "./local";
import { icalExportHarness } from "./ical-export-harness";

describe("Exportación iCal · permisos reales", () => {
  let h: SubscriptionHarness;
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(localSupabase().url).hostname)) throw new Error("Esta suite requiere Supabase local.");
    h = await icalExportHarness(); await h.reset();
  }, 90_000);
  afterAll(async () => { if (h) await h.reset(); }, 60_000);
  it("anon, propietario y admin aal2 no leen tokens de tabla ni ejecutan la lectura de servicio", async () => {
    const l = await h.seed({ status: "active" });
    const local = localSupabase();
    const service = createIcalExportService({ supabaseUrl: local.url, ...local, fetch: (input, init) => fetch(input, init) });
    const generated = await service.owner(await h.jwt("owner"), l.id, true);
    if (!generated.token) throw new Error("No se generó el enlace de prueba.");
    const owner = await signIn("owner");
    const other = await signIn("other");
    const admin = await signInAdmin();
    const anon = anonClient();
    for (const client of [anon, owner, other, admin]) {
      expect((await client.from("ical_exports").select("token")).error?.code).toBe("42501");
      expect((await client.rpc("read_ical_export", { p_token: generated.token })).error?.code).toBe("42501");
    }
    for (const client of [other, admin]) {
      expect((await client.rpc("owner_ical_export", { p_listing: l.id, p_generate: true })).error?.code).toBe("P0001");
      expect((await client.rpc("revoke_ical_export", { p_listing: l.id })).error?.code).toBe("P0001");
    }
    expect((await anon.rpc("owner_ical_export", { p_listing: l.id, p_generate: true })).error?.code).toBe("42501");
    expect((await anon.rpc("revoke_ical_export", { p_listing: l.id })).error?.code).toBe("42501");
    expect(await service.read(generated.token)).toEqual({ id: expect.any(String), nights: [] });
  });
});
