// Rutas del método de pago (fase 5, ticket 04): sesión de la pasarela para guardar la tarjeta (sin cobro), webhooks
// firmados y, solo en local, la pasarela falsa. Seguridad del dinero: aquí solo se ven ids de la pasarela, marca, últimos
// 4 y vencimiento; los logs llevan solo el id del evento, su tipo y el resultado; la página de pago es una navegación de
// primer nivel, así que la CSP del shell no cambia.
import type { Context, Hono } from "hono";
import type { BillingServiceApi } from "../domain/api";
import { DomainError } from "../domain/errors";
import { PAYMENT_MESSAGES as P, setupReturnUrls, type PaymentProvider } from "../domain/payments";
import { parsePublicId } from "../domain/share";
import { SUBSCRIPTION_MESSAGES as M, type PaymentProviderName } from "../domain/subscription";
import { securityHeaders } from "../shared/security";
import type { Env } from "./app";
import { createFakeProvider, decodeSession, FAKE_SIGNATURE_HEADER, fakeCheckoutPage, fakeSetupEvent } from "./fake-payments";
import { createStripeProvider } from "./stripe";

export type PaymentsEnv = {
  /** "stripe" | "fake" (solo ENVIRONMENT=local); sin valor, los pagos están apagados. */
  PAYMENTS?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Firma de las sesiones y eventos de la pasarela falsa (pnpm dev:vars). */
  FAKE_PAYMENTS_SECRET?: string;
};

export interface BillingDeps {
  /** Datos de la suscripción con la service role; null sin clave de servicio. */
  service(env: Env): BillingServiceApi | null;
  /** fetch hacia la pasarela (Stripe). */
  fetch: typeof fetch;
  now(): number;
  log(line: string): void;
}

const WEBHOOK_MAX_BYTES = 256 * 1024;
const NO_STORE = { "cache-control": "no-store" };

/**
 * La pasarela de este entorno, o por qué está apagada. Producción: apagada entera en esta fase (no hay cobros reales).
 * Stripe solo con claves de prueba; una `sk_live_` fuera de producción se rechaza. La falsa solo en local.
 */
export function paymentProvider(env: Env, deps: Pick<BillingDeps, "fetch" | "now">): { provider: PaymentProvider } | { provider: null; reason: string } {
  if (env.ENVIRONMENT === "production") return { provider: null, reason: "producción: sin pagos en esta fase" };
  if (env.PAYMENTS === "stripe") {
    const key = env.STRIPE_SECRET_KEY ?? "";
    if (/^(sk|rk)_live_/.test(key)) return { provider: null, reason: "clave live de Stripe fuera de producción" };
    if (!/^(sk|rk)_test_/.test(key)) return { provider: null, reason: "sin STRIPE_SECRET_KEY de prueba" };
    if (!env.STRIPE_WEBHOOK_SECRET) return { provider: null, reason: "sin STRIPE_WEBHOOK_SECRET" };
    return { provider: createStripeProvider({ secretKey: key, webhookSecret: env.STRIPE_WEBHOOK_SECRET, fetch: deps.fetch, now: deps.now }) };
  }
  if (env.PAYMENTS === "fake") {
    if (env.ENVIRONMENT !== "local") return { provider: null, reason: "la pasarela falsa solo vale en local" };
    if (!env.FAKE_PAYMENTS_SECRET) return { provider: null, reason: "sin FAKE_PAYMENTS_SECRET" };
    return { provider: createFakeProvider({ secret: env.FAKE_PAYMENTS_SECRET, now: deps.now }) };
  }
  return { provider: null, reason: "PAYMENTS sin valor" };
}

export function registerBilling(app: Hono<{ Bindings: Env }>, deps: BillingDeps, withSecurityHeaders: boolean) {
  const active = (env: Env) => paymentProvider(env, deps);
  const log = (fields: Record<string, unknown>) => deps.log(JSON.stringify(fields));

  app.post("/api/pago/sesion", async (c) => {
    const origin = c.req.header("origin");
    const base = new URL(c.req.url).origin;
    if (origin && origin !== base) return c.json({ error: "No autorizado." }, 403, NO_STORE);
    const jwt = /^Bearer (\S+)$/.exec(c.req.header("authorization") ?? "")?.[1];
    if (!jwt) return c.json({ error: P.noSession }, 401, NO_STORE);

    const chosen = active(c.env);
    const service = deps.service(c.env);
    if (!chosen.provider || !service) {
      log({ event: "payment_session", result: "off", reason: chosen.provider ? "sin clave de servicio" : chosen.reason });
      return c.json({ error: P.off }, 503, NO_STORE);
    }
    const provider = chosen.provider;

    let raw: unknown = {};
    const text = await c.req.text();
    if (text) {
      try {
        raw = JSON.parse(text);
      } catch {
        return c.json({ error: P.badHouse }, 400, NO_STORE);
      }
    }
    const given = (raw as { publicId?: unknown } | null)?.publicId;
    const publicId = given === undefined || given === null ? null : typeof given === "string" ? parsePublicId(given) : null;
    if (given !== undefined && given !== null && !publicId) return c.json({ error: P.badHouse }, 400, NO_STORE);

    let ctx;
    try {
      ctx = await service.setupContext(jwt, provider.name);
    } catch (e) {
      if (e instanceof DomainError && (e.kind === "session" || e.message === M.session)) return c.json({ error: M.session }, 401, NO_STORE);
      if (e instanceof DomainError && e.message === M.inactiveAccount) return c.json({ error: M.inactiveAccount }, 403, NO_STORE);
      log({ event: "payment_session", provider: provider.name, result: "error", stage: "context", kind: e instanceof DomainError ? e.kind : "unknown" });
      return c.json({ error: P.gateway }, 502, NO_STORE);
    }

    try {
      const { successUrl, cancelUrl } = setupReturnUrls(base, publicId);
      const session = await provider.createSetupSession({ owner: { id: ctx.ownerId, fullName: ctx.fullName }, customerRef: ctx.customerRef, successUrl, cancelUrl });
      if (session.customerRef !== ctx.customerRef) await service.savePaymentCustomer(ctx.ownerId, provider.name, session.customerRef);
      log({ event: "payment_session", provider: provider.name, result: "created", newCustomer: session.customerRef !== ctx.customerRef });
      return c.json({ url: session.url }, 200, NO_STORE);
    } catch (e) {
      log({ event: "payment_session", provider: provider.name, result: "error", stage: "gateway", status: (e as { status?: unknown }).status ?? null });
      return c.json({ error: P.gateway }, 502, NO_STORE);
    }
  });

  /** Webhook ya con la pasarela elegida: 400 sin firma válida (no escribe nada), 200 aplicado/duplicado/ignorado, 500 si
   *  la pasarela o la base fallan (la pasarela reintenta). */
  async function webhook(provider: PaymentProvider, request: Request, service: BillingServiceApi | null): Promise<Response> {
    if (Number(request.headers.get("content-length") ?? 0) > WEBHOOK_MAX_BYTES) return Response.json({ error: "Demasiado grande." }, { status: 413 });
    if (!service) {
      log({ event: "payment_webhook", provider: provider.name, result: "off", reason: "sin clave de servicio" });
      return Response.json({ error: P.off }, { status: 503 });
    }
    let event;
    try {
      event = await provider.verifyWebhook(request);
    } catch (e) {
      log({ event: "payment_webhook", provider: provider.name, result: "error", stage: "gateway", status: (e as { status?: unknown }).status ?? null });
      return Response.json({ error: "No pudimos completar el evento." }, { status: 500 });
    }
    if (!event) {
      log({ event: "payment_webhook", provider: provider.name, result: "invalid_signature" });
      return Response.json({ error: "Firma no válida." }, { status: 400 });
    }
    try {
      const result = await service.applyPaymentEvent(event);
      log({ event: "payment_webhook", provider: provider.name, id: event.eventId, type: event.type, result });
      return Response.json({ result });
    } catch (e) {
      log({ event: "payment_webhook", provider: provider.name, id: event.eventId, type: event.type, result: "error", stage: "database", kind: e instanceof DomainError ? e.kind : "unknown" });
      return Response.json({ error: "No pudimos guardar el evento." }, { status: 500 });
    }
  }

  const providerFor = (c: Context<{ Bindings: Env }>, name: PaymentProviderName) => {
    const chosen = active(c.env);
    return chosen.provider?.name === name ? chosen.provider : null;
  };

  app.post("/webhooks/stripe", async (c) => {
    const provider = providerFor(c, "stripe");
    // 503 (y no 404): si falta configurar Stripe en el entorno, Stripe reintenta y el evento no se pierde.
    if (!provider) return c.json({ error: P.off }, 503);
    return webhook(provider, c.req.raw, deps.service(c.env));
  });

  // La pasarela falsa solo existe donde está activa (ENVIRONMENT=local y PAYMENTS=fake): en otro sitio, 404.
  app.post("/webhooks/fake", async (c) => {
    const provider = providerFor(c, "fake");
    if (!provider) return c.notFound();
    return webhook(provider, c.req.raw, deps.service(c.env));
  });

  const html = (c: Context<{ Bindings: Env }>, body: string, status: 200 | 404 | 502) =>
    c.html(body, status, { ...NO_STORE, ...(withSecurityHeaders ? securityHeaders({ turnstile: false }) : {}) });

  async function fakeSession(c: Context<{ Bindings: Env }>) {
    const provider = providerFor(c, "fake");
    if (!provider) return null;
    const session = await decodeSession(c.env.FAKE_PAYMENTS_SECRET!, c.req.param("session") ?? "", deps.now());
    return session && new URL(session.successUrl).origin === new URL(c.req.url).origin ? { provider, session } : null;
  }

  app.get("/_pago-falso/:session", async (c) => {
    const found = await fakeSession(c);
    if (!found) return c.notFound();
    return html(c, fakeCheckoutPage(c.req.param("session"), found.session.cancelUrl), 200);
  });

  // «Guardar tarjeta de prueba»: el evento firmado pasa por el mismo webhook que en Stripe y se vuelve a la app.
  app.post("/_pago-falso/:session", async (c) => {
    const found = await fakeSession(c);
    if (!found) return c.notFound();
    const { body, signature } = await fakeSetupEvent(c.env.FAKE_PAYMENTS_SECRET!, found.session, deps.now());
    const request = new Request(new URL("/webhooks/fake", c.req.url), { method: "POST", headers: { "content-type": "application/json", [FAKE_SIGNATURE_HEADER]: signature }, body });
    const res = await webhook(found.provider, request, deps.service(c.env));
    if (!res.ok) return html(c, "<!doctype html><html lang=\"es\"><title>Pasarela de prueba</title><p>No pudimos guardar la tarjeta de prueba. Vuelva atrás e intente de nuevo.</p></html>", 502);
    return c.redirect(found.session.successUrl, 303);
  });
}
