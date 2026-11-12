// Datos de la suscripción para el worker (fase 5): RPCs de fase5_suscripcion por PostgREST con fetch a secas, como fx.ts
// y telemetry.ts (sin supabase-js en el worker). Todo con la service role salvo payment_setup_context, que va con el JWT
// del usuario y la anon key: PostgREST valida la sesión (401 si no vale) y la RPC la cuenta.
import type { BillingServiceApi } from "../../domain/api";
import { toDomainError } from "../../domain/errors";
import { fromSetupContextJson } from "../../domain/rows";
import type { DayRunResult, ReminderDays, ReminderToSend } from "../../domain/subscription";

export interface BillingServiceConfig {
  supabaseUrl: string;
  serviceKey: string;
  anonKey: string;
  fetch: typeof fetch;
}

type ClaimRow = { id: string; listing_id: string; public_id: string; title: string; owner_name: string; to_phone: string; days_before: number; promo_ends_on: string };

export function createBillingService(cfg: BillingServiceConfig): BillingServiceApi {
  async function rpc<T>(fn: string, args: Record<string, unknown>, auth: { apikey: string; bearer: string } = { apikey: cfg.serviceKey, bearer: cfg.serviceKey }): Promise<T> {
    const res = await cfg.fetch(`${cfg.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: auth.apikey, authorization: `Bearer ${auth.bearer}`, "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const e = (body ?? {}) as { code?: unknown; message?: unknown };
      // Un JWT que PostgREST no acepta llega como 401 (PGRST301/PGRST303 o sin código).
      throw toDomainError({ code: typeof e.code === "string" ? e.code : res.status === 401 ? "PGRST301" : "", message: e.message });
    }
    return body as T;
  }

  return {
    async runDay(today) {
      const r = await rpc<{ paid: number; payment_due: number; queued: number }>("run_subscription_day", today ? { p_today: today } : {});
      return { paid: r.paid, paymentDue: r.payment_due, queued: r.queued } satisfies DayRunResult;
    },

    async claimReminders(limit) {
      const rows = await rpc<ClaimRow[]>("claim_reminders", { p_limit: limit });
      return rows.map(
        (r): ReminderToSend => ({
          id: r.id,
          listingId: r.listing_id,
          publicId: r.public_id,
          title: r.title,
          ownerName: r.owner_name,
          toPhone: r.to_phone,
          daysBefore: r.days_before as ReminderDays,
          promoEndsOn: r.promo_ends_on,
        }),
      );
    },

    async finishReminders(results) {
      const p_results = results.map((r) =>
        r.outcome === "sent"
          ? { id: r.id, outcome: r.outcome, provider_ref: r.providerRef, to_phone: r.toPhone, body: r.body }
          : r.outcome === "skipped"
            ? { id: r.id, outcome: r.outcome, error: r.error ?? null }
            : { id: r.id, outcome: r.outcome, error: r.error, to_phone: r.toPhone ?? null, body: r.body ?? null },
      );
      return rpc<number>("finish_reminders", { p_results });
    },

    async setupContext(userJwt, provider) {
      return fromSetupContextJson(await rpc("payment_setup_context", { p_provider: provider }, { apikey: cfg.anonKey, bearer: userJwt }));
    },

    async savePaymentCustomer(ownerId, provider, customerRef) {
      await rpc("save_payment_customer", { p_owner: ownerId, p_provider: provider, p_ref: customerRef });
    },

    async applyPaymentEvent(e) {
      return rpc("apply_payment_event", {
        p_provider: e.provider,
        p_event_id: e.eventId,
        p_type: e.type,
        p_owner: e.ownerId,
        p_customer_ref: e.customerRef,
        p_method_ref: e.methodRef,
        p_brand: e.brand,
        p_last4: e.last4,
        p_exp_month: e.expMonth,
        p_exp_year: e.expYear,
      });
    },

    async setOfferDaysLeft(publicId, days) {
      return rpc<string>("test_set_offer_days_left", { p_public_id: publicId, p_days_left: days });
    },
  };
}
