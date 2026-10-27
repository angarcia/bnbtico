// Pasarela falsa para local, CI y Playwright (solo ENVIRONMENT=local): su «página de pago» es /_pago-falso/:sesion, del
// propio worker, sin script ni estilo en línea, con «Guardar tarjeta de prueba». La sesión es un token firmado con
// FAKE_PAYMENTS_SECRET (no hay estado en el worker); el evento que manda al webhook falso va firmado igual que los de
// Stripe, así que el camino del webhook se prueba entero.
import type { PaymentProvider } from "../domain/payments";
import type { PaymentEvent } from "../domain/subscription";
import { escapeHtml } from "./render";
import { constantTimeEqual, hmacSha256Hex, signPayload, verifySignature } from "./stripe";

export const FAKE_SIGNATURE_HEADER = "fake-signature";
/** Una sesión falsa vale una hora, como mucho (las de Stripe, 24 h; aquí basta para una prueba). */
const SESSION_TTL_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FakeSession {
  ownerId: string;
  customerRef: string;
  successUrl: string;
  cancelUrl: string;
  issuedAt: number;
}

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function encodeSession(secret: string, s: FakeSession): Promise<string> {
  const payload = b64url(JSON.stringify(s));
  return `${payload}.${await hmacSha256Hex(secret, `session.${payload}`)}`;
}

/** La sesión del token, o null si la firma no vale, venció o los datos no tienen forma. */
export async function decodeSession(secret: string, token: string, nowMs: number): Promise<FakeSession | null> {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  if (!constantTimeEqual(mac, await hmacSha256Hex(secret, `session.${payload}`))) return null;
  try {
    const s = JSON.parse(unb64url(payload)) as Partial<FakeSession>;
    if (typeof s.ownerId !== "string" || !UUID.test(s.ownerId) || typeof s.customerRef !== "string" || typeof s.successUrl !== "string" || typeof s.cancelUrl !== "string" || typeof s.issuedAt !== "number") return null;
    if (nowMs - s.issuedAt > SESSION_TTL_MS || s.issuedAt - nowMs > 60_000) return null;
    return s as FakeSession;
  } catch {
    return null;
  }
}

export interface FakeProviderConfig {
  secret: string;
  now(): number;
}

export function createFakeProvider(cfg: FakeProviderConfig): PaymentProvider {
  return {
    name: "fake",

    async createSetupSession(req) {
      const customerRef = req.customerRef ?? `fake_cus_${randomId()}`;
      const token = await encodeSession(cfg.secret, { ownerId: req.owner.id, customerRef, successUrl: req.successUrl, cancelUrl: req.cancelUrl, issuedAt: cfg.now() });
      return { url: `${new URL(req.successUrl).origin}/_pago-falso/${token}`, customerRef };
    },

    async verifyWebhook(request) {
      const body = await request.text();
      if (!(await verifySignature(cfg.secret, body, request.headers.get(FAKE_SIGNATURE_HEADER), cfg.now()))) return null;
      try {
        const e = JSON.parse(body) as PaymentEvent;
        return typeof e.eventId === "string" && typeof e.type === "string" ? { ...e, provider: "fake" } : null;
      } catch {
        return null;
      }
    },
  };
}

/** El evento que «manda la pasarela» al guardar la tarjeta de prueba (Visa ···· 4242), con su firma. */
export async function fakeSetupEvent(secret: string, s: FakeSession, nowMs: number): Promise<{ body: string; signature: string }> {
  const event: PaymentEvent = {
    provider: "fake",
    eventId: `fake_evt_${randomId()}`,
    type: "setup_completed",
    ownerId: s.ownerId,
    customerRef: s.customerRef,
    methodRef: `fake_pm_${randomId()}`,
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: new Date(nowMs).getUTCFullYear() + 3,
  };
  const body = JSON.stringify(event);
  return { body, signature: await signPayload(secret, body, Math.floor(nowMs / 1000)) };
}

/** Página de la pasarela falsa: un formulario que vuelve al worker (form-action 'self'); nada en línea. */
export function fakeCheckoutPage(token: string, cancelUrl: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Pasarela de prueba · bnbtico</title>
</head>
<body>
<main>
<h1>Pasarela de prueba</h1>
<p>Esta página reemplaza a la de Stripe en local. No pide ni guarda ninguna tarjeta: guarda una de prueba (Visa ···· 4242) y no cobra nada.</p>
<form method="post" action="/_pago-falso/${escapeHtml(token)}">
<button type="submit">Guardar tarjeta de prueba</button>
</form>
<p><a href="${escapeHtml(cancelUrl)}">Volver sin guardar</a></p>
</main>
</body>
</html>
`;
}
