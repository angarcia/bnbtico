// Fake en memoria de la suscripción (fase 5): las RPCs de fase5_suscripcion con los mismos mensajes
// (SUBSCRIPTION_MESSAGES) y los estados de nextStatus del dominio. «Hoy» sale del reloj de la base (FakeDb.today()).
import { ADMIN_HOLD_MESSAGES } from "../../domain/admin-actions";
import type { BillingServiceApi, OwnerBillingApi } from "../../domain/api";
import { addDays } from "../../domain/calendar";
import { DomainError } from "../../domain/errors";
import type { ListingStatus } from "../../domain/listing";
import {
  MONTHLY_FEE_CRC,
  SUBSCRIPTION_MESSAGES as M,
  daysLeft,
  nextStatus,
  promoEndsOn,
  promoRunning,
  reminderThreshold,
  tierForSlot,
  type BillingHouse,
  type ReminderToSend,
  type StatusResult,
} from "../../domain/subscription";
import type { FakeDb, FakeListing, FakeSubscription } from "./db";

const hasMethod = (db: FakeDb, ownerId: string) => db.paymentMethods.has(ownerId);
const statusOf = (r: StatusResult): ListingStatus => {
  if (!r.ok) throw new DomainError(r.message, "validation");
  return r.status;
};

/** La parte de review_listing que toca la suscripción: la plaza la primera vez y el estado por la regla de aprobar. */
export function approveSubscription(db: FakeDb, l: FakeListing): ListingStatus {
  const today = db.today();
  let sub = db.subscriptions.get(l.id);
  if (!sub) {
    const slot = Math.max(0, ...[...db.subscriptions.values()].map((s) => s.promoSlot ?? 0)) + 1;
    const tier = tierForSlot(slot);
    sub = {
      listingId: l.id,
      plan: tier ? "promo" : "paid",
      promoSlot: tier ? slot : null,
      promoMonths: tier?.months ?? null,
      promoEndsOn: tier ? promoEndsOn(today, tier.months) : null,
      paidSince: null,
      stoppedOn: null,
      monthlyPriceCrc: MONTHLY_FEE_CRC,
    };
    db.subscriptions.set(l.id, sub);
  }
  const method = hasMethod(db, l.ownerId);
  const running = promoRunning(sub, today);
  const status = statusOf(nextStatus("review", "approve", { promoRunning: running, hasMethod: method }));
  if (!running && method && (sub.plan === "promo" || sub.paidSince === null)) Object.assign(sub, { plan: "paid", paidSince: today });
  return status;
}

export function createFakeOwnerBilling(db: FakeDb, opts: { userId: () => string | null }): OwnerBillingApi {
  function me(): string {
    const id = opts.userId();
    if (!id) throw new DomainError(M.session, "session");
    return id;
  }

  function transition(listingId: string, event: "stop" | "resume"): ListingStatus {
    const uid = me();
    const found = db.listings.get(listingId);
    const l = found && found.deletedAt === null ? found : undefined;
    if (l && l.ownerId === uid && l.adminHold?.kind === "blocked") throw new DomainError(ADMIN_HOLD_MESSAGES.ownerBlocked, "validation");
    const isOwner = l !== undefined && l.ownerId === uid;
    const accountActive = db.profiles.get(uid)?.isActive !== false;
    const sub = l ? db.subscriptions.get(l.id) : undefined;
    const today = db.today();
    const running = sub ? promoRunning(sub, today) : false;
    const method = hasMethod(db, uid);
    if (isOwner && accountActive && event === "resume" && l.status === "inactive" && !sub) throw new DomainError(M.resume, "validation");
    const status = statusOf(nextStatus(l?.status ?? "draft", event, { promoRunning: running, hasMethod: method, isOwner, accountActive }));
    if (event === "stop") {
      if (sub) sub.stoppedOn = today;
    } else if (sub) {
      const paid = !running && method;
      Object.assign(sub, {
        stoppedOn: null,
        plan: paid ? "paid" : sub.plan,
        paidSince: paid && (sub.plan === "promo" || sub.paidSince === null) ? today : sub.paidSince,
      } satisfies Partial<FakeSubscription>);
    }
    Object.assign(l!, { status, updatedAt: db.now() });
    return status;
  }

  return {
    async overview() {
      const uid = me();
      const houses: BillingHouse[] = [...db.listings.values()]
        .filter((l) => l.ownerId === uid && l.deletedAt === null && db.subscriptions.has(l.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => {
          const s = db.subscriptions.get(l.id)!;
          return {
            listingId: l.id,
            publicId: l.publicId,
            title: l.title,
            status: l.status,
            plan: s.plan,
            promoSlot: s.promoSlot,
            promoMonths: s.promoMonths,
            promoEndsOn: s.promoEndsOn,
            paidSince: s.paidSince,
            stoppedOn: s.stoppedOn,
            monthlyPriceCrc: s.monthlyPriceCrc,
            hold: l.adminHold?.kind ?? null,
            reminders: db.reminders
              .filter((r) => r.listingId === l.id)
              .sort((a, b) => b.daysBefore - a.daysBefore)
              .map((r) => ({ daysBefore: r.daysBefore, status: r.status, sentAt: r.sentAt })),
          };
        });
      const m = db.paymentMethods.get(uid);
      return {
        houses,
        method: m ? { brand: m.brand, last4: m.last4, expMonth: m.expMonth, expYear: m.expYear, addedAt: m.addedAt } : null,
        today: db.today(),
      };
    },
    stop: async (id) => transition(id, "stop"),
    resume: async (id) => transition(id, "resume"),
  };
}

/** Plazas asignadas (launch_offer_taken): la más alta, porque una plaza no se reutiliza. */
export const offerTaken = (db: FakeDb): number => Math.max(0, ...[...db.subscriptions.values()].map((s) => s.promoSlot ?? 0));

/** Bloqueada o eliminada: su suscripción está parada (ni fin de oferta, ni avisos, ni cobro). */
export const subscriptionFrozen = (l: Pick<FakeListing, "adminHold" | "deletedAt">) => l.adminHold?.kind === "blocked" || l.deletedAt !== null;

/** Activa con oferta y sin método: la única casa que recibe avisos. */
const awaitingMethod = (db: FakeDb, l: FakeListing, s: FakeSubscription | undefined) =>
  l.status === "active" && !subscriptionFrozen(l) && s?.plan === "promo" && !hasMethod(db, l.ownerId);

export function createFakeBillingService(db: FakeDb): BillingServiceApi {
  return {
    async runDay(today = db.today()) {
      let paid = 0;
      let paymentDue = 0;
      let queued = 0;
      for (const l of db.listings.values()) {
        const s = db.subscriptions.get(l.id);
        if (l.status !== "active" || subscriptionFrozen(l) || s?.plan !== "promo" || !s.promoEndsOn || s.promoEndsOn >= today) continue;
        if (hasMethod(db, l.ownerId)) {
          Object.assign(s, { plan: "paid", paidSince: addDays(s.promoEndsOn, 1) });
          paid += 1;
        } else {
          Object.assign(l, { status: statusOf(nextStatus("active", "dayPassed", { promoRunning: false, hasMethod: false })), updatedAt: db.now() });
          paymentDue += 1;
        }
      }
      for (const l of db.listings.values()) {
        const s = db.subscriptions.get(l.id);
        if (!awaitingMethod(db, l, s) || !s!.promoEndsOn) continue;
        const threshold = reminderThreshold(daysLeft(s!.promoEndsOn, today));
        if (threshold === null || db.reminders.some((r) => r.listingId === l.id && r.daysBefore === threshold)) continue;
        db.reminders.push({
          id: db.newId(),
          listingId: l.id,
          daysBefore: threshold,
          promoEndsOn: s!.promoEndsOn,
          queuedAt: db.now(),
          status: "queued",
          attempts: 0,
          claimedAt: null,
          toPhone: null,
          body: null,
          providerRef: null,
          lastError: null,
          sentAt: null,
        });
        queued += 1;
      }
      return { paid, paymentDue, queued };
    },

    async claimReminders(limit) {
      const picked = db.reminders
        .filter((r) => r.status === "queued")
        .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id))
        .slice(0, Math.max(0, limit));
      const claimed: ReminderToSend[] = [];
      for (const r of picked) {
        const l = db.listings.get(r.listingId)!;
        const owner = db.profiles.get(l.ownerId)!;
        if (!awaitingMethod(db, l, db.subscriptions.get(l.id)) || !owner.isActive) {
          Object.assign(r, { status: "skipped", lastError: "ya no corresponde" });
          continue;
        }
        Object.assign(r, { status: "sending", claimedAt: db.now(), attempts: r.attempts + 1, toPhone: owner.phone });
        claimed.push({ id: r.id, listingId: l.id, publicId: l.publicId, title: l.title, ownerName: owner.fullName, toPhone: owner.phone, daysBefore: r.daysBefore, promoEndsOn: r.promoEndsOn });
      }
      return claimed.sort((a, b) => a.id.localeCompare(b.id));
    },

    async finishReminders(results) {
      let n = 0;
      for (const x of results) {
        const r = db.reminders.find((y) => y.id === x.id && y.status === "sending");
        if (!r) continue;
        if (x.outcome === "sent") Object.assign(r, { status: "sent", sentAt: db.now(), providerRef: x.providerRef, toPhone: x.toPhone, body: x.body, lastError: null });
        else if (x.outcome === "skipped") Object.assign(r, { status: "skipped", lastError: x.error?.slice(0, 500) ?? null });
        else {
          const status = x.outcome === "unknown" ? "unknown" : r.attempts < 5 ? "queued" : "failed";
          Object.assign(r, { status, lastError: x.error.slice(0, 500), toPhone: x.toPhone ?? r.toPhone, body: x.body ?? r.body });
        }
        n += 1;
      }
      return n;
    },

    async setupContext(userJwt, provider) {
      const uid = db.authSessions.get(userJwt);
      const p = uid ? db.profiles.get(uid) : undefined;
      if (!p) throw new DomainError(M.session, "session");
      if (!p.isActive) throw new DomainError(M.inactiveAccount, "validation");
      return { ownerId: p.id, fullName: p.fullName, phone: p.phone, customerRef: db.paymentCustomers.get(`${p.id}|${provider}`) ?? null };
    },

    async savePaymentCustomer(ownerId, provider, customerRef) {
      db.paymentCustomers.set(`${ownerId}|${provider}`, customerRef);
    },

    async applyPaymentEvent(e) {
      const key = `${e.provider}|${e.eventId}`;
      if (db.paymentEvents.has(key)) return "duplicate";
      const owner = e.ownerId ? db.profiles.get(e.ownerId) : undefined;
      const complete =
        e.type === "setup_completed" &&
        owner !== undefined &&
        !!e.customerRef &&
        !!e.methodRef &&
        !!e.brand &&
        /^[0-9]{4}$/.test(e.last4 ?? "") &&
        e.expMonth !== null &&
        e.expMonth >= 1 &&
        e.expMonth <= 12 &&
        e.expYear !== null &&
        e.expYear >= 2000 &&
        e.expYear <= 2100;
      db.paymentEvents.set(key, complete ? "applied" : "ignored");
      if (!complete) return "ignored";
      const ownerId = owner.id;
      const before = db.paymentMethods.get(ownerId);
      db.paymentMethods.set(ownerId, {
        ownerId,
        provider: e.provider,
        customerRef: e.customerRef!,
        methodRef: e.methodRef!,
        brand: e.brand!,
        last4: e.last4!,
        expMonth: e.expMonth!,
        expYear: e.expYear!,
        addedAt: before?.addedAt ?? db.now(),
      });
      const today = db.today();
      for (const l of db.listings.values()) {
        if (l.ownerId !== ownerId || l.status !== "payment_due" || subscriptionFrozen(l)) continue;
        const s = db.subscriptions.get(l.id);
        if (s) Object.assign(s, { plan: "paid", paidSince: s.paidSince ?? today });
        Object.assign(l, { status: statusOf(nextStatus("payment_due", "methodAdded", { promoRunning: false, hasMethod: true })), updatedAt: db.now() });
      }
      return "applied";
    },

    async setOfferDaysLeft(publicId, days) {
      if (!db.testClock) throw new DomainError(M.testClockOff, "validation");
      const l = db.byPublicId(publicId);
      const s = l ? db.subscriptions.get(l.id) : undefined;
      if (!s || s.plan !== "promo") throw new DomainError(M.notFound, "validation");
      s.promoEndsOn = addDays(db.today(), days);
      return s.promoEndsOn;
    },
  };
}
