// Avisos de fin de oferta por WhatsApp (fase 5, ticket 03): el worker vacía la cola (outbox) que llena
// run_subscription_day. Una pasada = 1 claim_reminders + ≤ 20 envíos + 1 finish_reminders (≤ 22 subpeticiones; el plan
// gratuito de Workers permite 50). El texto lo compone el dominio (reminderWhatsApp) y finish_reminders guarda el número
// y el texto enviados. Un aviso nunca sale dos veces: lo reclamado queda en «sending» y no se vuelve a reclamar; solo un
// rechazo seguro de la pasarela lo devuelve a la cola; lo dudoso queda «unknown» para una alerta.
import type { BillingServiceApi } from "../domain/api";
import { shareBase } from "../domain/seo";
import { payLink, reminderWhatsApp, type ReminderDays, type ReminderOutcome } from "../domain/subscription";
import { parseAllowlist, type WhatsAppSendResult, type WhatsAppSender } from "../domain/whatsapp-sender";
import type { Env } from "./app";

export const REMINDER_BATCH = 20;
/** Sin respuesta de Twilio en este tiempo, el envío es dudoso (`unknown`). */
export const TWILIO_TIMEOUT_MS = 10_000;

/** Variables del entorno para los avisos (wrangler.jsonc y secretos de Cloudflare; en local, .dev.vars). */
export type ReminderEnv = {
  /** `twilio` | `fake`; sin valor, apagado (los avisos se quedan en cola). En producción, apagado en esta fase. */
  WHATSAPP_SENDER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  /** Número del remitente (el del sandbox en pruebas), E.164, sin el prefijo `whatsapp:`. */
  TWILIO_WHATSAPP_FROM?: string;
  /** Pruebas: solo estos números E.164 reciben avisos; los demás se omiten. Con Twilio en pruebas es obligatoria. */
  WHATSAPP_ALLOWLIST?: string;
  /** Origen público del entorno para el enlace del aviso (el cron no tiene petición): https://pruebas.3bstays.com. */
  PUBLIC_ORIGIN?: string;
  /** Ruta del reloj de pruebas /_pruebas/oferta/CT-####; sin él (y siempre en producción), 404. */
  TEST_CLOCK_SECRET?: string;
};

export interface ReminderRuntime {
  service: BillingServiceApi;
  /** null: envío apagado (no se reclama nada). */
  sender: WhatsAppSender | null;
  allowlist: ReadonlySet<string> | null;
  /** Por qué está apagado (va al log). */
  off?: string;
}

export interface BatchOutcome {
  publicId: string;
  daysBefore: ReminderDays;
  outcome: ReminderOutcome["outcome"];
  providerRef?: string;
  body?: string;
  error?: string;
}

export interface BatchResult {
  claimed: number;
  sent: number;
  retry: number;
  unknown: number;
  skipped: number;
  outcomes: BatchOutcome[];
  error?: string;
}

/** Base pública del enlace del aviso: 3bstays.com en producción; en pruebas, PUBLIC_ORIGIN o el origen de la petición. */
export function reminderBase(env: Pick<Env, "ENVIRONMENT"> & ReminderEnv, origin: string | null): string {
  return shareBase(env.ENVIRONMENT, env.PUBLIC_ORIGIN ?? origin);
}

const e164 = (phone: string) => (phone.startsWith("+") ? phone : `+${phone}`);

/** Un lote de envío. Nunca lanza: los errores van a la línea de log (JSON) y al resultado. */
export async function sendReminders(rt: ReminderRuntime, opts: { base: string; log(line: string): void; limit?: number }): Promise<BatchResult> {
  const result: BatchResult = { claimed: 0, sent: 0, retry: 0, unknown: 0, skipped: 0, outcomes: [] };
  if (!rt.sender) {
    opts.log(JSON.stringify({ event: "reminders", ...counts(result), off: rt.off ?? "sin remitente" }));
    return result;
  }
  let claimed;
  try {
    claimed = await rt.service.claimReminders(Math.min(opts.limit ?? REMINDER_BATCH, REMINDER_BATCH));
  } catch (e) {
    result.error = `claim: ${String(e)}`;
    opts.log(JSON.stringify({ event: "reminders", ok: false, ...counts(result), error: result.error }));
    return result;
  }
  result.claimed = claimed.length;
  if (claimed.length === 0) {
    opts.log(JSON.stringify({ event: "reminders", ok: true, ...counts(result) }));
    return result;
  }

  const finished: ReminderOutcome[] = [];
  for (const r of claimed) {
    const to = e164(r.toPhone);
    const base = { publicId: r.publicId, daysBefore: r.daysBefore };
    if (rt.allowlist && !rt.allowlist.has(to)) {
      const error = "fuera de WHATSAPP_ALLOWLIST";
      finished.push({ id: r.id, outcome: "skipped", error });
      result.outcomes.push({ ...base, outcome: "skipped", error });
      continue;
    }
    const body = reminderWhatsApp({ name: r.ownerName, title: r.title, endsOn: r.promoEndsOn, link: payLink(opts.base, r.publicId), daysBefore: r.daysBefore });
    let sent: WhatsAppSendResult;
    try {
      sent = await rt.sender.send(to, body);
    } catch (e) {
      sent = { ok: false, definite: false, error: String(e) };
    }
    if (sent.ok) {
      finished.push({ id: r.id, outcome: "sent", providerRef: sent.ref, toPhone: to, body });
      result.outcomes.push({ ...base, outcome: "sent", providerRef: sent.ref, body });
    } else {
      const outcome = sent.definite ? "retry" : "unknown";
      finished.push({ id: r.id, outcome, error: sent.error, toPhone: to, body });
      result.outcomes.push({ ...base, outcome, error: sent.error, body });
    }
  }
  for (const o of result.outcomes) result[o.outcome] += 1;

  try {
    await rt.service.finishReminders(finished);
  } catch (e) {
    // Las filas se quedan en «sending»: nunca se vuelven a reclamar, así que no hay doble envío (queda para una alerta).
    result.error = `finish: ${String(e)}`;
  }
  opts.log(JSON.stringify({ event: "reminders", ok: !result.error, ...counts(result), ...(result.error ? { error: result.error } : {}) }));
  return result;
}

const counts = (r: BatchResult) => ({ claimed: r.claimed, sent: r.sent, retry: r.retry, unknown: r.unknown, skipped: r.skipped });

/**
 * Twilio (WhatsApp) solo con fetch: POST /2010-04-01/Accounts/:sid/Messages.json con Basic auth. Una respuesta 4xx/5xx
 * es un rechazo seguro (el mensaje no se aceptó); un error de red o la falta de respuesta a tiempo, dudoso.
 */
export function createTwilioSender(cfg: { accountSid: string; authToken: string; from: string; fetch: typeof fetch; timeoutMs?: number }): WhatsAppSender {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`;
  const auth = `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`;
  return {
    async send(to, body) {
      let res: Response;
      try {
        res = await cfg.fetch(url, {
          method: "POST",
          headers: { authorization: auth, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ From: `whatsapp:${e164(cfg.from)}`, To: `whatsapp:${e164(to)}`, Body: body }).toString(),
          signal: AbortSignal.timeout(cfg.timeoutMs ?? TWILIO_TIMEOUT_MS),
        });
      } catch (e) {
        const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        return { ok: false, definite: false, error: timeout ? `Twilio sin respuesta en ${cfg.timeoutMs ?? TWILIO_TIMEOUT_MS} ms` : `Twilio: ${String(e)}` };
      }
      let json: { sid?: unknown; code?: unknown } = {};
      try {
        json = (await res.json()) as typeof json;
      } catch {
        // Sin cuerpo JSON: basta con el estado.
      }
      if (!res.ok) return { ok: false, definite: true, error: `Twilio ${res.status}${typeof json.code === "number" ? ` ${json.code}` : ""}` };
      return { ok: true, ref: typeof json.sid === "string" ? json.sid : `twilio-${res.status}` };
    },
  };
}

/** Remitente falso (local y pruebas automáticas): no sale nada; guarda lo «enviado» y responde `fake-…`. */
export class FakeSender implements WhatsAppSender {
  readonly sent: { to: string; body: string; ref: string }[] = [];
  constructor(private readonly log?: (line: string) => void) {}
  async send(to: string, body: string): Promise<WhatsAppSendResult> {
    const ref = `fake-${crypto.randomUUID()}`;
    this.sent.push({ to, body, ref });
    this.log?.(JSON.stringify({ event: "whatsapp_fake", to: `···${to.slice(-4)}`, ref }));
    return { ok: true, ref };
  }
}

/**
 * Remitente según el entorno; null (apagado) si falta algo. Producción: apagado en esta fase (plantillas de Meta y regla
 * de las 24 horas pendientes). Twilio en pruebas exige WHATSAPP_ALLOWLIST: el proyecto de pruebas nunca escribe a una
 * persona real por error.
 */
export function senderFromEnv(env: Pick<Env, "ENVIRONMENT"> & ReminderEnv, fetchFn: typeof fetch, log: (line: string) => void): { sender: WhatsAppSender | null; off?: string } {
  if (env.ENVIRONMENT === "production") return { sender: null, off: "producción" };
  if (env.WHATSAPP_SENDER === "fake") return { sender: new FakeSender(log) };
  if (env.WHATSAPP_SENDER !== "twilio") return { sender: null, off: "WHATSAPP_SENDER sin valor" };
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) return { sender: null, off: "faltan los secretos de Twilio" };
  if (env.ENVIRONMENT === "pruebas" && !parseAllowlist(env.WHATSAPP_ALLOWLIST)?.size) return { sender: null, off: "falta WHATSAPP_ALLOWLIST" };
  return { sender: createTwilioSender({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_WHATSAPP_FROM, fetch: fetchFn }) };
}
