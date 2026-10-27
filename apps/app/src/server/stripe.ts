// Stripe en modo de prueba, sin SDK (corre en Cloudflare Workers): REST con fetch y firma de webhooks con Web Crypto.
// Solo pasan por aquí ids opacos de Stripe, la marca, los últimos 4 y el vencimiento; nunca el número de la tarjeta, que
// el propietario escribe en la página de Stripe. Nada de lo que responde Stripe se registra en los logs.
import type { PaymentProvider, SetupSessionRequest } from "../domain/payments";
import type { PaymentEvent } from "../domain/subscription";

const API = "https://api.stripe.com/v1";
/** Tolerancia de la marca de tiempo de la firma (la de las librerías de Stripe). */
export const SIGNATURE_TOLERANCE_S = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante (para cadenas de la misma longitud; si no, false sin mirar el contenido). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cabecera `t=…,v1=…` como la de Stripe (la usan las pruebas y el webhook falso). */
export async function signPayload(secret: string, body: string, timestampS: number): Promise<string> {
  return `t=${timestampS},v1=${await hmacSha256Hex(secret, `${timestampS}.${body}`)}`;
}

/**
 * Verificación manual de `Stripe-Signature`: HMAC-SHA256 de `${t}.${cuerpo}` con el secreto del endpoint, solo el esquema
 * v1 (se ignora v0 y cualquier otro), cualquiera de las firmas v1 vale (secreto rotado), marca de tiempo a ±5 minutos.
 */
export async function verifySignature(secret: string, body: string, header: string | null, nowMs: number): Promise<boolean> {
  if (!header) return false;
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    else if (k === "v1") v1.push(v);
  }
  if (t === null || v1.length === 0) return false;
  if (Math.abs(nowMs / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${body}`);
  let ok = false;
  for (const sig of v1) ok = constantTimeEqual(sig, expected) || ok;
  return ok;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  fetch: typeof fetch;
  now(): number;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);
/** Un campo expandible de Stripe llega como id o como objeto con `id`. */
const ref = (v: unknown): string | null => str(v) ?? str(obj(v).id);

/** Error de Stripe sin su cuerpo: solo el código HTTP (los cuerpos no se registran). */
export class StripeError extends Error {
  constructor(readonly status: number) {
    super(`Stripe respondió ${status}`);
    this.name = "StripeError";
  }
}

export function createStripeProvider(cfg: StripeConfig): PaymentProvider {
  async function call(method: "GET" | "POST", path: string, form?: Record<string, string>, idempotencyKey?: string): Promise<Obj> {
    const headers: Record<string, string> = { authorization: `Bearer ${cfg.secretKey}` };
    if (form) headers["content-type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const res = await cfg.fetch(`${API}${path}`, { method, headers, body: form ? new URLSearchParams(form).toString() : undefined });
    if (!res.ok) throw new StripeError(res.status);
    return obj(await res.json());
  }

  return {
    name: "stripe",

    async createSetupSession(req: SetupSessionRequest) {
      let customerRef = req.customerRef;
      if (!customerRef) {
        // La clave de idempotencia evita dos clientes si el propietario toca dos veces (Stripe la recuerda 24 h).
        const customer = await call("POST", "/customers", { name: req.owner.fullName, "metadata[owner_id]": req.owner.id }, `bnbtico-customer-${req.owner.id}`);
        customerRef = str(customer.id);
        if (!customerRef) throw new StripeError(502);
      }
      const session = await call("POST", "/checkout/sessions", {
        mode: "setup",
        // En modo setup Stripe pide la moneda (no se cobra nada); solo tarjetas: es lo único que sabemos mostrar.
        currency: "usd",
        "payment_method_types[0]": "card",
        customer: customerRef,
        client_reference_id: req.owner.id,
        "metadata[owner_id]": req.owner.id,
        "setup_intent_data[metadata][owner_id]": req.owner.id,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        locale: "es-419",
      });
      const url = str(session.url);
      if (!url) throw new StripeError(502);
      return { url, customerRef };
    },

    async verifyWebhook(request: Request) {
      const body = await request.text();
      if (!(await verifySignature(cfg.webhookSecret, body, request.headers.get("stripe-signature"), cfg.now()))) return null;
      let event: Obj;
      try {
        event = obj(JSON.parse(body));
      } catch {
        return null;
      }
      const eventId = str(event.id);
      const type = str(event.type);
      if (!eventId || !type) return null;
      const ignored: PaymentEvent = { provider: "stripe", eventId, type, ownerId: null, customerRef: null, methodRef: null, brand: null, last4: null, expMonth: null, expYear: null };
      const session = obj(obj(event.data).object);
      // Solo modo de prueba en esta fase: un evento real (livemode) se registra y no hace nada.
      if (type !== "checkout.session.completed" || session.mode !== "setup" || event.livemode === true) return ignored;
      const setupIntentId = ref(session.setup_intent);
      if (!setupIntentId) return ignored;
      const si = await call("GET", `/setup_intents/${encodeURIComponent(setupIntentId)}?expand[]=payment_method`);
      if (si.status !== "succeeded") return { ...ignored, type: "checkout.session.completed:not_succeeded" };
      const pm = obj(si.payment_method);
      const card = obj(pm.card);
      const owner = str(session.client_reference_id) ?? str(obj(session.metadata).owner_id) ?? str(obj(si.metadata).owner_id);
      return {
        provider: "stripe",
        eventId,
        type: "setup_completed",
        ownerId: owner && UUID.test(owner) ? owner : null,
        customerRef: ref(session.customer) ?? ref(si.customer),
        methodRef: str(pm.id),
        brand: str(card.brand),
        last4: str(card.last4),
        expMonth: int(card.exp_month),
        expYear: int(card.exp_year),
      };
    },
  };
}
