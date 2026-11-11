// Reloj de pruebas de punta a punta contra Supabase local: la ruta del worker llama a test_set_offer_days_left,
// run_subscription_day y al envío con el remitente falso. El secreto de Vault 3bstays_test_clock no existe en local: se
// crea para el caso y se borra siempre (como en admin-aal2-purga.test.ts).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBillingService } from "../../src/data/postgrest/billing-service";
import { SUBSCRIPTION_MESSAGES } from "../../src/domain/subscription";
import { createApp, type Env } from "../../src/server/app";
import { FakeSender } from "../../src/server/reminders";
import type { SubscriptionHarness } from "../contract/harness";
import { localSupabase, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const ORIGIN = "http://localhost:4273";
const clockSecretCount = () => sql("select count(*) from vault.secrets where name = '3bstays_test_clock'");

describe("reloj de pruebas · /_pruebas/oferta/CT-#### contra Supabase local", () => {
  let h: SubscriptionHarness;
  let sender: FakeSender;
  let hadSecret = false;

  beforeAll(async () => {
    h = await postgrestHarness();
    hadSecret = await h.setTestClock(false);
  }, 90_000);

  afterAll(async () => {
    await h.setTestClock(hadSecret);
    if (!hadSecret) expect(clockSecretCount()).toBe("0");
  });

  beforeEach(async () => {
    sender = new FakeSender();
    await h.reset();
  }, 60_000);

  function post(publicId: string, diasRestantes: number) {
    const { url, serviceKey, anonKey } = localSupabase();
    const app = createApp({
      listings: () => h.anon,
      cache: () => null,
      purgeFetch: fetch,
      reminders: () => ({ service: createBillingService({ supabaseUrl: url, serviceKey, anonKey, fetch }), sender, allowlist: null }),
    });
    const env = { ENVIRONMENT: "local", SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, TEST_CLOCK_SECRET: "reloj-local", ASSETS: { fetch: async () => new Response("") } } as Env;
    return app.request(`${ORIGIN}/_pruebas/oferta/${publicId}`, { method: "POST", headers: { authorization: "Bearer reloj-local", "content-type": "application/json" }, body: JSON.stringify({ diasRestantes }) }, env);
  }

  it("sin el secreto de Vault la base se niega: 409 con su mensaje y nada cambia", async () => {
    const l = await h.seed({ status: "active" });
    const res = await post(l.publicId, 7);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: SUBSCRIPTION_MESSAGES.testClockOff });
    expect(await h.reminders(l.id)).toEqual([]);
    expect(sender.sent).toEqual([]);
  });

  it("con el secreto: 30 días → aviso enviado y guardado; −1 → pendiente de pago y enlace bloqueado", async () => {
    const l = await h.seed({ status: "active" });
    await h.setTestClock(true);
    try {
      const res = await post(l.publicId, 30);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ publicId: l.publicId, diasRestantes: 30, day: { queued: 1 }, reminders: { claimed: 1, sent: 1 } });
      expect(sender.sent).toHaveLength(1);
      expect(sender.sent[0]!.body).toContain(`${ORIGIN}/propietario/suscripcion#pago=${l.publicId}`);
      expect((await h.reminders(l.id))[0]).toMatchObject({ daysBefore: 30, status: "sent", providerRef: sender.sent[0]!.ref, body: sender.sent[0]!.body, toPhone: h.phone("owner") });

      // Mismo umbral otra vez: no se vuelve a encolar ni a mandar.
      expect(await (await post(l.publicId, 30)).json()).toMatchObject({ day: { queued: 0 }, reminders: { claimed: 0 } });
      expect(sender.sent).toHaveLength(1);

      expect(await (await post(l.publicId, -1)).json()).toMatchObject({ day: { paymentDue: 1 } });
      expect(await h.anon.blockedReason(l.publicId)).toBe("payment");
    } finally {
      await h.setTestClock(false);
    }
    expect(clockSecretCount()).toBe("0");
  });
});
