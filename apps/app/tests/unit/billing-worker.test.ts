// Costura HTTP del método de pago (fase 5, ticket 04): rutas del worker en proceso, con el fake de la base y un fetch
// falso de Stripe. Cada caso de la lista de aceptación, más un evento con la forma real de Stripe firmado con un secreto
// de prueba.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type Env } from "../../src/server/app";
import { contentSecurityPolicy } from "../../src/shared/security";
import { signPayload, verifySignature } from "../../src/server/stripe";
import { decodeSession, encodeSession, FAKE_SIGNATURE_HEADER } from "../../src/server/fake-payments";
import { SUBSCRIPTION_MESSAGES as M } from "../../src/domain/subscription";
import { fakeHarness } from "./fake-harness";

const ORIGIN = "https://nueva.bnbtico.com";
const NOW = Date.parse("2026-10-27T18:00:00Z");
const T = Math.floor(NOW / 1000);
const WHSEC = "whsec_prueba_0123456789abcdef";
const SK = "sk_test_prueba123";
const FAKE_SECRET = "secreto-falso-local";

type StripeCall = { method: string; url: string; headers: Record<string, string>; form: URLSearchParams };

/** Stripe falso: responde clientes, sesiones de Checkout y SetupIntents, y apunta cada llamada. */
function stripeFetch(over: { fail?: RegExp; setupIntentStatus?: string } = {}) {
  const calls: StripeCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    calls.push({ method: init?.method ?? "GET", url, headers, form: new URLSearchParams(typeof init?.body === "string" ? init.body : "") });
    if (over.fail?.test(url)) return Response.json({ error: { message: "card_declined 4242 secreto" } }, { status: 402 });
    if (url.endsWith("/v1/customers")) return Response.json({ id: "cus_Prueba123", object: "customer" });
    if (url.endsWith("/v1/checkout/sessions")) return Response.json({ id: "cs_test_abc", object: "checkout.session", mode: "setup", url: "https://checkout.stripe.com/c/pay/cs_test_abc#fid" });
    if (url.includes("/v1/setup_intents/seti_1Prueba")) return Response.json(setupIntent(over.setupIntentStatus ?? "succeeded"));
    return Response.json({ error: { message: "no existe" } }, { status: 404 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

function setupIntent(status: string) {
  return {
    id: "seti_1Prueba",
    object: "setup_intent",
    customer: "cus_Prueba123",
    status,
    usage: "off_session",
    livemode: false,
    metadata: {},
    payment_method: {
      id: "pm_1Prueba",
      object: "payment_method",
      type: "card",
      customer: "cus_Prueba123",
      card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2029, funding: "credit", country: "US" },
      billing_details: { name: "Yorleny Prueba", email: "yorleny@example.com" },
    },
  };
}

/** Evento `checkout.session.completed` de una sesión en modo setup, con la forma que manda Stripe. */
function checkoutCompleted(ownerId: string, over: { id?: string; mode?: string; livemode?: boolean } = {}) {
  return JSON.stringify(
    {
      id: over.id ?? "evt_1PruebaSetup",
      object: "event",
      api_version: "2025-09-30.clover",
      created: T - 5,
      livemode: over.livemode ?? false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_abc",
          object: "checkout.session",
          cancel_url: `${ORIGIN}/propietario/suscripcion#pago=CT-1001`,
          client_reference_id: ownerId,
          created: T - 120,
          currency: "usd",
          customer: "cus_Prueba123",
          customer_details: { email: "yorleny@example.com", name: "Yorleny Prueba" },
          livemode: over.livemode ?? false,
          metadata: { owner_id: ownerId },
          mode: over.mode ?? "setup",
          payment_intent: null,
          payment_method_types: ["card"],
          payment_status: "no_payment_required",
          setup_intent: "seti_1Prueba",
          status: "complete",
          success_url: `${ORIGIN}/propietario/suscripcion?pago=ok#pago=CT-1001`,
          ui_mode: "hosted_page",
          url: null,
        },
      },
    },
    null,
    2,
  );
}

function setup(over: Partial<Env> = {}, stripe = stripeFetch()) {
  const h = fakeHarness();
  const logs: string[] = [];
  let service: ReturnType<typeof fakeHarness>["service"] | null = h.service;
  const app = createApp({
    listings: () => h.anon,
    cache: () => null,
    purgeFetch: (() => Promise.resolve(new Response())) as unknown as typeof fetch,
    billing: { service: () => service, fetch: stripe.fn, now: () => NOW, log: (l) => logs.push(l) },
  });
  const env: Env = {
    ENVIRONMENT: "pruebas",
    SUPABASE_URL: "http://supabase.test",
    SUPABASE_ANON_KEY: "anon",
    PAYMENTS: "stripe",
    STRIPE_SECRET_KEY: SK,
    STRIPE_WEBHOOK_SECRET: WHSEC,
    ASSETS: { fetch: async () => new Response("<!doctype html><title>shell</title>", { headers: { "content-type": "text/html" } }) },
    ...over,
  };
  const request = (path: string, init?: RequestInit) => app.request(`${ORIGIN}${path}`, init, env);
  const session = (body: unknown, jwt: string | null = "jwt-owner", headers: Record<string, string> = {}) =>
    request("/api/pago/sesion", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers }, body: JSON.stringify(body) });
  const stripeWebhook = async (body: string, signature?: string) =>
    request("/webhooks/stripe", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature ?? (await signPayload(WHSEC, body, T)) }, body });
  return { h, app, env, logs, stripe, request, session, stripeWebhook, dropService: () => (service = null), setService: (s: typeof service) => (service = s) };
}

/** Casa del propietario con la oferta vencida y sin método: pendiente de pago. */
async function unpaidHouse(h: ReturnType<typeof fakeHarness>) {
  const casa = await h.seed({ status: "active" });
  await h.setDaysLeft(casa.id, -1);
  await h.service.runDay();
  expect(h.db.listings.get(casa.id)!.status).toBe("payment_due");
  return casa;
}

describe("firma de los webhooks (Stripe-Signature)", () => {
  const body = '{"id":"evt_1","type":"x"}';

  it("vale la firma v1 de `${t}.${cuerpo}` dentro de los 5 minutos, en los dos sentidos", async () => {
    const sig = await signPayload(WHSEC, body, T);
    expect(await verifySignature(WHSEC, body, sig, NOW)).toBe(true);
    expect(await verifySignature(WHSEC, body, sig, NOW + 300_000)).toBe(true);
    expect(await verifySignature(WHSEC, body, sig, NOW + 301_000)).toBe(false);
    expect(await verifySignature(WHSEC, body, sig, NOW - 301_000)).toBe(false);
  });

  it("no vale con otro secreto, otro cuerpo, sin cabecera, sin t o solo con v0", async () => {
    const sig = await signPayload(WHSEC, body, T);
    expect(await verifySignature("whsec_otro", body, sig, NOW)).toBe(false);
    expect(await verifySignature(WHSEC, `${body} `, sig, NOW)).toBe(false);
    expect(await verifySignature(WHSEC, body, null, NOW)).toBe(false);
    expect(await verifySignature(WHSEC, body, sig.replace(/^t=\d+,/, ""), NOW)).toBe(false);
    expect(await verifySignature(WHSEC, body, sig.replace("v1=", "v0="), NOW)).toBe(false);
  });

  it("con el secreto rotado llegan dos v1: basta con que una coincida", async () => {
    const good = (await signPayload(WHSEC, body, T)).split("v1=")[1]!;
    const header = `t=${T},v1=${"0".repeat(64)},v1=${good},v0=${"f".repeat(64)}`;
    expect(await verifySignature(WHSEC, body, header, NOW)).toBe(true);
  });
});

describe("POST /api/pago/sesion", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("con Stripe: crea el cliente la primera vez, lo guarda y abre Checkout en modo setup con las URLs de vuelta", async () => {
    const casa = await unpaidHouse(t.h);
    const res = await t.session({ publicId: casa.publicId });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_abc#fid" });

    const [customer, checkout] = t.stripe.calls;
    expect(customer!.url).toBe("https://api.stripe.com/v1/customers");
    expect(customer!.headers.authorization).toBe(`Bearer ${SK}`);
    expect(customer!.headers["idempotency-key"]).toBe(`bnbtico-customer-${t.h.ownerId("owner")}`);
    expect(customer!.form.get("metadata[owner_id]")).toBe(t.h.ownerId("owner"));
    expect(customer!.form.has("phone")).toBe(false);

    expect(checkout!.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const f = checkout!.form;
    expect(f.get("mode")).toBe("setup");
    expect(f.get("customer")).toBe("cus_Prueba123");
    expect(f.get("client_reference_id")).toBe(t.h.ownerId("owner"));
    expect(f.get("setup_intent_data[metadata][owner_id]")).toBe(t.h.ownerId("owner"));
    expect(f.get("success_url")).toBe(`${ORIGIN}/propietario/suscripcion?pago=ok#pago=${casa.publicId}`);
    expect(f.get("cancel_url")).toBe(`${ORIGIN}/propietario/suscripcion#pago=${casa.publicId}`);
    expect(f.has("line_items[0][price]")).toBe(false);
    expect(t.h.db.paymentCustomers.get(`${t.h.ownerId("owner")}|stripe`)).toBe("cus_Prueba123");
  });

  it("reutiliza el cliente que la cuenta ya tiene en Stripe; sin publicId, las URLs van sin #pago", async () => {
    await t.h.service.savePaymentCustomer(t.h.ownerId("owner"), "stripe", "cus_Existente");
    const res = await t.session({});
    expect(res.status).toBe(200);
    expect(t.stripe.calls.map((c) => c.url)).toEqual(["https://api.stripe.com/v1/checkout/sessions"]);
    const f = t.stripe.calls[0]!.form;
    expect(f.get("customer")).toBe("cus_Existente");
    expect(f.get("success_url")).toBe(`${ORIGIN}/propietario/suscripcion?pago=ok`);
    expect(f.get("cancel_url")).toBe(`${ORIGIN}/propietario/suscripcion`);
  });

  it("401 sin Authorization o con un JWT que la base no acepta; nada en Stripe", async () => {
    const none = await t.session({}, null);
    expect(none.status).toBe(401);
    const bad = await t.session({}, "jwt-falso");
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: M.session });
    expect(t.stripe.calls).toEqual([]);
  });

  it("403 con la cuenta desactivada; nada en Stripe", async () => {
    await t.h.setAccountActive("owner", false);
    const res = await t.session({});
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: M.inactiveAccount });
    expect(t.stripe.calls).toEqual([]);
  });

  it("403 desde otro origen (como las balizas)", async () => {
    const res = await t.session({}, "jwt-owner", { origin: "https://malo.example" });
    expect(res.status).toBe(403);
    expect(t.stripe.calls).toEqual([]);
  });

  it("400 con un publicId que no es CT-####", async () => {
    for (const publicId of ["casa-1", 42]) expect((await t.session({ publicId })).status).toBe(400);
  });

  it("503 sin pagos configurados: PAYMENTS vacío, sin clave, sin secreto del webhook o sin service role", async () => {
    for (const over of [{ PAYMENTS: undefined }, { STRIPE_SECRET_KEY: undefined }, { STRIPE_WEBHOOK_SECRET: undefined }, { PAYMENTS: "otro" }] as Partial<Env>[]) {
      const res = await setup(over).session({});
      expect(res.status, JSON.stringify(over)).toBe(503);
    }
    t.dropService();
    expect((await t.session({})).status).toBe(503);
  });

  it("rechaza una sk_live_ (o rk_live_) fuera de producción", async () => {
    for (const key of ["sk_live_abc", "rk_live_abc"]) {
      const s = setup({ STRIPE_SECRET_KEY: key });
      expect((await s.session({})).status).toBe(503);
      expect(s.stripe.calls).toEqual([]);
      expect(s.logs.join("\n")).toContain("clave live de Stripe fuera de producción");
      expect(s.logs.join("\n")).not.toContain(key);
    }
  });

  it("producción: ningún pago en esta fase, ni lanzada ni con claves de prueba", async () => {
    const launched = setup({ ENVIRONMENT: "production", LAUNCHED: "true" });
    expect((await launched.session({})).status).toBe(503);
    expect((await launched.stripeWebhook(checkoutCompleted(launched.h.ownerId("owner")))).status).toBe(503);
    expect(launched.stripe.calls).toEqual([]);
    // Antes del lanzamiento, ni existen: la portada con 404.
    expect((await setup({ ENVIRONMENT: "production" }).session({})).status).toBe(404);
  });

  it("502 si Stripe no abre la sesión, sin su respuesta en el log", async () => {
    const s = setup({}, stripeFetch({ fail: /checkout\/sessions/ }));
    const res = await s.session({});
    expect(res.status).toBe(502);
    expect(s.logs.join("\n")).not.toMatch(/card_declined|4242|secreto/);
  });
});

describe("POST /webhooks/stripe", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("checkout.session.completed (setup) con la forma real: recupera el SetupIntent con su método y activa la casa", async () => {
    const casa = await unpaidHouse(t.h);
    const res = await t.stripeWebhook(checkoutCompleted(t.h.ownerId("owner")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "applied" });
    expect(t.stripe.calls.map((c) => `${c.method} ${c.url}`)).toEqual(["GET https://api.stripe.com/v1/setup_intents/seti_1Prueba?expand[]=payment_method"]);
    const overview = await t.h.billing("owner").overview();
    expect(overview.method).toMatchObject({ brand: "visa", last4: "4242", expMonth: 12, expYear: 2029 });
    expect(overview.houses.find((x) => x.listingId === casa.id)!.status).toBe("active");
    expect(await t.h.storedMethod("owner")).toEqual({ customerRef: "cus_Prueba123", methodRef: "pm_1Prueba" });
  });

  it("los logs llevan solo id, tipo y resultado: ni el cuerpo ni lo que responde Stripe", async () => {
    await t.stripeWebhook(checkoutCompleted(t.h.ownerId("owner")));
    expect(t.logs.map((l) => JSON.parse(l))).toEqual([{ event: "payment_webhook", provider: "stripe", id: "evt_1PruebaSetup", type: "setup_completed", result: "applied" }]);
    expect(t.logs.join("\n")).not.toMatch(/4242|pm_|cus_|seti_|yorleny|visa/i);
  });

  it("firma inválida, vencida o ausente → 400 sin escribir nada ni llamar a Stripe", async () => {
    const body = checkoutCompleted(t.h.ownerId("owner"));
    const cases = [await signPayload("whsec_otro", body, T), await signPayload(WHSEC, body, T - 301), await signPayload(WHSEC, `${body}\n`, T), ""];
    for (const sig of cases) {
      const res = await t.request("/webhooks/stripe", { method: "POST", headers: { "stripe-signature": sig }, body });
      expect(res.status).toBe(400);
    }
    expect(t.h.db.paymentEvents.size).toBe(0);
    expect(t.stripe.calls).toEqual([]);
    expect(await t.h.storedMethod("owner")).toBeNull();
  });

  it("el mismo evento dos veces → 200 duplicate la segunda (Stripe reintenta)", async () => {
    const body = checkoutCompleted(t.h.ownerId("owner"));
    expect(await (await t.stripeWebhook(body)).json()).toEqual({ result: "applied" });
    const again = await t.stripeWebhook(body);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ result: "duplicate" });
  });

  it("tipo desconocido → 200 ignored, registrado y sin llamar a Stripe", async () => {
    const body = JSON.stringify({ id: "evt_otro", object: "event", type: "customer.created", livemode: false, data: { object: { id: "cus_1" } } });
    const res = await t.stripeWebhook(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "ignored" });
    expect(t.h.db.paymentEvents.has("stripe|evt_otro")).toBe(true);
    expect(t.stripe.calls).toEqual([]);
  });

  it("una sesión que no es de setup, un evento livemode o un SetupIntent sin terminar → ignored sin método", async () => {
    const owner = t.h.ownerId("owner");
    expect(await (await t.stripeWebhook(checkoutCompleted(owner, { id: "evt_pago", mode: "payment" }))).json()).toEqual({ result: "ignored" });
    expect(await (await t.stripeWebhook(checkoutCompleted(owner, { id: "evt_live", livemode: true }))).json()).toEqual({ result: "ignored" });
    const pending = setup({}, stripeFetch({ setupIntentStatus: "requires_action" }));
    expect(await (await pending.stripeWebhook(checkoutCompleted(pending.h.ownerId("owner")))).json()).toEqual({ result: "ignored" });
    expect(await t.h.storedMethod("owner")).toBeNull();
    expect(await pending.h.storedMethod("owner")).toBeNull();
  });

  it("un client_reference_id que no es un uuid no llega a la base como propietario (ignored, no 500)", async () => {
    const res = await t.stripeWebhook(checkoutCompleted("no-es-uuid"));
    expect(await res.json()).toEqual({ result: "ignored" });
  });

  it("si la base falla → 500 (Stripe reintenta); si Stripe no da el SetupIntent → 500 sin escribir nada", async () => {
    t.setService({ ...t.h.service, applyPaymentEvent: () => Promise.reject(new Error("conexión perdida")) });
    expect((await t.stripeWebhook(checkoutCompleted(t.h.ownerId("owner")))).status).toBe(500);
    expect(t.logs.at(-1)).not.toContain("conexión perdida");

    const down = setup({}, stripeFetch({ fail: /setup_intents/ }));
    expect((await down.stripeWebhook(checkoutCompleted(down.h.ownerId("owner")))).status).toBe(500);
    expect(down.h.db.paymentEvents.size).toBe(0);
  });

  it("503 si Stripe no está configurado en el entorno (el evento no se pierde: Stripe reintenta)", async () => {
    const off = setup({ PAYMENTS: undefined });
    expect((await off.stripeWebhook(checkoutCompleted(off.h.ownerId("owner")))).status).toBe(503);
  });
});

describe("pasarela falsa (solo ENVIRONMENT=local)", () => {
  const local: Partial<Env> = { ENVIRONMENT: "local", PAYMENTS: "fake", FAKE_PAYMENTS_SECRET: FAKE_SECRET, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined };

  it("sesión → /_pago-falso/:sesion sin nada en línea → «Guardar tarjeta de prueba» guarda el método y vuelve con ?pago=ok", async () => {
    const t = setup(local);
    const casa = await unpaidHouse(t.h);
    const res = await t.session({ publicId: casa.publicId });
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(new RegExp(`^${ORIGIN}/_pago-falso/[\\w-]+\\.[0-9a-f]{64}$`));
    expect(t.h.db.paymentCustomers.get(`${t.h.ownerId("owner")}|fake`)).toMatch(/^fake_cus_/);

    const path = new URL(url).pathname;
    const page = await t.request(path);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(page.headers.get("cache-control")).toBe("no-store");
    const html = await page.text();
    expect(html).toContain("Guardar tarjeta de prueba");
    expect(html).toContain(`<form method="post" action="${path}">`);
    expect(html).toContain(`href="${ORIGIN}/propietario/suscripcion#pago=${casa.publicId}"`);
    expect(html).not.toMatch(/<script|<style|\sstyle=|\son\w+=|<input/i);

    const saved = await t.request(path, { method: "POST" });
    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe(`${ORIGIN}/propietario/suscripcion?pago=ok#pago=${casa.publicId}`);
    const overview = await t.h.billing("owner").overview();
    expect(overview.method).toMatchObject({ brand: "visa", last4: "4242", expMonth: 12, expYear: 2029 });
    expect(overview.houses.find((x) => x.listingId === casa.id)!.status).toBe("active");
    expect(t.logs.at(-1)).toMatch(/"provider":"fake".*"type":"setup_completed","result":"applied"/);
  });

  it("una sesión manipulada, vencida o de otro origen → 404", async () => {
    const t = setup(local);
    const owner = t.h.ownerId("owner");
    const good = await encodeSession(FAKE_SECRET, { ownerId: owner, customerRef: "fake_cus_1", successUrl: `${ORIGIN}/propietario/suscripcion?pago=ok`, cancelUrl: `${ORIGIN}/propietario/suscripcion`, issuedAt: NOW });
    expect((await t.request(`/_pago-falso/${good}`)).status).toBe(200);
    const forged = await encodeSession("otro-secreto", { ownerId: owner, customerRef: "fake_cus_1", successUrl: `${ORIGIN}/x`, cancelUrl: `${ORIGIN}/x`, issuedAt: NOW });
    const old = await encodeSession(FAKE_SECRET, { ownerId: owner, customerRef: "fake_cus_1", successUrl: `${ORIGIN}/x`, cancelUrl: `${ORIGIN}/x`, issuedAt: NOW - 2 * 3600_000 });
    const elsewhere = await encodeSession(FAKE_SECRET, { ownerId: owner, customerRef: "fake_cus_1", successUrl: "https://malo.example/x", cancelUrl: "https://malo.example/x", issuedAt: NOW });
    for (const token of [forged, old, elsewhere, `${good}x`, "basura"]) {
      expect((await t.request(`/_pago-falso/${token}`)).status, token).toBe(404);
      expect((await t.request(`/_pago-falso/${token}`, { method: "POST" })).status, token).toBe(404);
    }
    expect(t.h.db.paymentEvents.size).toBe(0);
    expect(await decodeSession(FAKE_SECRET, good, NOW)).toMatchObject({ ownerId: owner });
  });

  it("/webhooks/fake: firma inválida → 400 sin escribir; evento firmado → applied", async () => {
    const t = setup(local);
    const body = JSON.stringify({ provider: "fake", eventId: "fake_evt_1", type: "setup_completed", ownerId: t.h.ownerId("owner"), customerRef: "fake_cus_1", methodRef: "fake_pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2029 });
    const bad = await t.request("/webhooks/fake", { method: "POST", headers: { [FAKE_SIGNATURE_HEADER]: await signPayload("otro", body, T) }, body });
    expect(bad.status).toBe(400);
    expect(t.h.db.paymentEvents.size).toBe(0);
    const ok = await t.request("/webhooks/fake", { method: "POST", headers: { [FAKE_SIGNATURE_HEADER]: await signPayload(FAKE_SECRET, body, T) }, body });
    expect(await ok.json()).toEqual({ result: "applied" });
  });

  it("fuera de local no existe: PAYMENTS=fake en pruebas → 503 en la sesión y 404 en sus rutas; con Stripe, /webhooks/fake es 404", async () => {
    const pruebas = setup({ ...local, ENVIRONMENT: "pruebas" });
    expect((await pruebas.session({})).status).toBe(503);
    expect((await pruebas.request("/webhooks/fake", { method: "POST", body: "{}" })).status).toBe(404);
    expect((await pruebas.request("/_pago-falso/abc.def")).status).toBe(404);
    expect((await setup().request("/webhooks/fake", { method: "POST", body: "{}" })).status).toBe(404);
    // Sin FAKE_PAYMENTS_SECRET en local, también apagada.
    expect((await setup({ ...local, FAKE_PAYMENTS_SECRET: undefined }).session({})).status).toBe(503);
  });
});

describe("la CSP del shell no cambia con los pagos", () => {
  it("ningún origen de Stripe en ninguna directiva (la página de pago es una navegación de primer nivel)", () => {
    for (const turnstile of [true, false]) expect(contentSecurityPolicy({ supabaseUrl: "https://x.supabase.co", turnstile, photon: true })).not.toMatch(/stripe/i);
  });
});
