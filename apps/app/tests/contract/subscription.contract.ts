// Contrato de la suscripción (fase 5): plaza de la oferta al aprobar, fin de la oferta con y sin método, método de pago
// de la cuenta, parar y reactivar, visibilidad pública por estado, avisos en cola (outbox), reclamarlos y cerrarlos,
// eventos de pago, contexto de la pasarela y reloj de pruebas. Mismas reglas y mensajes en el fake (nextStatus,
// SUBSCRIPTION_MESSAGES) y en la base (fase5_suscripcion). Cada caso empieza con la base de casas vacía; el trabajo
// diario recorre toda la base, por eso se comprueban cuentas exactas solo después de reset().
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/calendar";
import { DomainError } from "../../src/domain/errors";
import { parseFilters } from "../../src/domain/filters";
import { costaRicaToday } from "../../src/domain/inquiry";
import { PROVINCES } from "../../src/domain/listing";
import { MONTHLY_FEE_CRC, SUBSCRIPTION_MESSAGES as M, promoEndsOn, type BillingHouse, type PaymentEvent } from "../../src/domain/subscription";
import type { Persona, SeedOwner, SeedSpec, SubscriptionHarness } from "./harness";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

const today = () => costaRicaToday(Date.now());
let eventSeq = 0;
const cardEvent = (ownerId: string, patch: Partial<PaymentEvent> = {}): PaymentEvent => ({
  provider: "fake",
  eventId: `evt_${Date.now()}_${++eventSeq}`,
  type: "setup_completed",
  ownerId,
  customerRef: "cus_prueba",
  methodRef: "pm_prueba",
  brand: "visa",
  last4: "4242",
  expMonth: 12,
  expYear: 2029,
  ...patch,
});

export function subscriptionContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`suscripción · ${name}`, () => {
    let h: SubscriptionHarness;
    const house = (spec: Partial<SeedSpec> = {}) => h.seed({ status: "active", ...spec });
    const mine = async (id: string, who: Persona = "owner"): Promise<BillingHouse | undefined> => (await h.billing(who).overview()).houses.find((x) => x.listingId === id);
    const addCard = (who: SeedOwner, patch: Partial<PaymentEvent> = {}) => h.service.applyPaymentEvent(cardEvent(h.ownerId(who), patch));
    const expire = async (id: string) => {
      await h.setDaysLeft(id, -1);
      return h.service.runDay(today());
    };

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
    }, 60_000);

    describe("plaza de la oferta al aprobar", () => {
      it("la primera aprobación toma la plaza siguiente: la 50 tiene 12 meses y la 51, 6", async () => {
        await h.takeSlots(49);
        const a = await house();
        const b = await house();
        expect(await mine(a.id)).toEqual({
          listingId: a.id,
          publicId: a.publicId,
          title: "Cabina Cahuita",
          status: "active",
          plan: "promo",
          promoSlot: 50,
          promoMonths: 12,
          promoEndsOn: promoEndsOn(today(), 12),
          paidSince: null,
          stoppedOn: null,
          monthlyPriceCrc: MONTHLY_FEE_CRC,
          hold: null,
          reminders: [],
        });
        expect(await mine(b.id)).toMatchObject({ promoSlot: 51, promoMonths: 6, promoEndsOn: promoEndsOn(today(), 6), status: "active" });
        expect(await h.anon.offerTaken()).toBe(51);
      });

      it("la 100 tiene 6 meses y la 101, 3", async () => {
        await h.takeSlots(99);
        const a = await house();
        const b = await house();
        expect(await mine(a.id)).toMatchObject({ promoSlot: 100, promoMonths: 6 });
        expect(await mine(b.id)).toMatchObject({ promoSlot: 101, promoMonths: 3, promoEndsOn: promoEndsOn(today(), 3) });
      });

      it("la 200 tiene 3 meses; la 201 no tiene oferta: plan de pago y, sin método, pendiente de pago y fuera del catálogo", async () => {
        await h.takeSlots(199);
        const a = await house();
        const b = await house();
        expect(await mine(a.id)).toMatchObject({ promoSlot: 200, promoMonths: 3, status: "active" });
        expect(await mine(b.id)).toMatchObject({ promoSlot: null, promoMonths: null, promoEndsOn: null, plan: "paid", paidSince: null, status: "payment_due" });
        expect(await h.anon.offerTaken()).toBe(200);
        expect(await h.anon.getPublic(b.publicId)).toBeNull();
        expect(await h.anon.blockedReason(b.publicId)).toBe("payment");
      });

      it("sin oferta y con método: activa en el plan de pago desde hoy", async () => {
        await h.takeSlots(200);
        expect(await addCard("owner")).toBe("applied");
        const a = await house();
        expect(await mine(a.id)).toMatchObject({ promoSlot: null, plan: "paid", paidSince: today(), status: "active" });
        expect(await h.anon.getPublic(a.publicId)).not.toBeNull();
      });

      it("aprobar un cambio de nombre conserva la plaza, el fin de la oferta y el estado", async () => {
        const a = await house();
        const before = await mine(a.id);
        await h.owner("owner").saveEdit(a.id, { title: "Casa renovada frente al mar" });
        await h.admin("aal2").reviewEditField(a.id, "nombre", "approve", "", (await h.admin("aal2").getEdit(a.id))?.listing.edit?.fields.nombre?.submittedAt ?? null);
        expect(await mine(a.id)).toEqual({ ...before, title: "Casa renovada frente al mar" });
        expect(await h.anon.offerTaken()).toBe(1);
      });

      it("volver a aprobar una casa reabierta (estado heredado) conserva la plaza y el fin de la oferta", async () => {
        // Desde editar-casa una casa publicada ya no vuelve a borrador; las que lo hicieron antes siguen pudiendo enviarse.
        const a = await house({ status: "reopened" });
        const before = await mine(a.id);
        expect(before).toMatchObject({ status: "draft", promoSlot: 1 });
        await h.owner("owner").submit(a.id);
        await h.admin("aal2").review(a.id, "approve", "");
        expect(await mine(a.id)).toEqual({ ...before, status: "active" });
        expect(await h.anon.offerTaken()).toBe(1);
      });

      it("pedir cambios o rechazar no toma plaza; una casa sin aprobar no sale en la facturación", async () => {
        const c = await h.seed({ status: "changes" });
        const r = await h.seed({ status: "rejected" });
        const d = await h.seed({ status: "review" });
        expect(await h.anon.offerTaken()).toBe(0);
        const ids = (await h.billing("owner").overview()).houses.map((x) => x.listingId);
        for (const l of [c, r, d]) expect(ids).not.toContain(l.id);
      });
    });

    describe("fin de la oferta", () => {
      it("sin método: pendiente de pago, fuera del catálogo y su enlace dice por qué", async () => {
        const a = await house();
        expect(await h.anon.countActive()).toBe(1);
        expect(await expire(a.id)).toEqual({ paid: 0, paymentDue: 1, queued: 0 });
        expect(await mine(a.id)).toMatchObject({ status: "payment_due", plan: "promo", paidSince: null });
        expect(await h.anon.getPublic(a.publicId)).toBeNull();
        expect(await h.anon.getManyPublic([a.publicId])).toEqual([]);
        expect((await h.anon.sitemap()).map((x) => x.publicId)).not.toContain(a.publicId);
        expect(await h.anon.countActive()).toBe(0);
        expect(await h.anon.linkState(a.publicId)).toBe("blocked");
        expect(await h.anon.blockedReason(a.publicId)).toBe("payment");
      });

      it("con método guardado antes: sigue activa con el plan de pago desde el día siguiente al último gratis", async () => {
        const a = await house();
        await addCard("owner");
        const ends = addDays(today(), -1);
        expect(await expire(a.id)).toEqual({ paid: 1, paymentDue: 0, queued: 0 });
        expect(await mine(a.id)).toMatchObject({ status: "active", plan: "paid", promoEndsOn: ends, paidSince: today() });
        expect(await h.anon.getPublic(a.publicId)).not.toBeNull();
        expect(await h.service.runDay(today())).toEqual({ paid: 0, paymentDue: 0, queued: 0 });
      });

      it("el último día gratis (0 días) todavía no termina", async () => {
        const a = await house();
        await h.setDaysLeft(a.id, 0);
        expect((await h.service.runDay(today())).paymentDue).toBe(0);
        expect(await mine(a.id)).toMatchObject({ status: "active", plan: "promo" });
      });

      it("una casa parada no cambia con los días aunque su oferta termine", async () => {
        const a = await house();
        await h.billing("owner").stop(a.id);
        expect(await expire(a.id)).toEqual({ paid: 0, paymentDue: 0, queued: 0 });
        expect(await mine(a.id)).toMatchObject({ status: "inactive", plan: "promo" });
      });
    });

    describe("método de pago", () => {
      it("activa todas las casas pendientes de pago de esa cuenta, y solo de esa; las que tienen oferta siguen igual", async () => {
        const a = await house();
        const b = await house();
        const c = await house();
        const d = await house({ as: "other" });
        await h.setDaysLeft(a.id, -1);
        await h.setDaysLeft(b.id, -3);
        await h.setDaysLeft(c.id, 40);
        await h.setDaysLeft(d.id, -1);
        expect(await h.service.runDay(today())).toEqual({ paid: 0, paymentDue: 3, queued: 1 });
        expect(await addCard("owner")).toBe("applied");
        for (const l of [a, b]) {
          expect(await mine(l.id)).toMatchObject({ status: "active", plan: "paid", paidSince: today() });
          expect(await h.anon.getPublic(l.publicId)).not.toBeNull();
        }
        expect(await mine(c.id)).toMatchObject({ status: "active", plan: "promo", paidSince: null });
        expect(await mine(d.id, "other")).toMatchObject({ status: "payment_due", plan: "promo" });
        expect(await h.anon.blockedReason(d.publicId)).toBe("payment");
      });

      it("el navegador ve marca, últimos 4 y vencimiento, nunca los ids de la pasarela", async () => {
        expect((await h.billing("owner").overview()).method).toBeNull();
        await addCard("owner", { customerRef: "cus_123", methodRef: "pm_456", brand: "mastercard", last4: "4444", expMonth: 3, expYear: 2031 });
        const { method } = await h.billing("owner").overview();
        expect(method).toEqual({ brand: "mastercard", last4: "4444", expMonth: 3, expYear: 2031, addedAt: expect.any(String) });
        expect(JSON.stringify(method)).not.toMatch(/cus_123|pm_456/);
        expect(await h.storedMethod("owner")).toEqual({ customerRef: "cus_123", methodRef: "pm_456" });
        expect((await h.billing("other").overview()).method).toBeNull();
      });

      it("cambiar de tarjeta reemplaza el método de la cuenta (uno por propietario)", async () => {
        await addCard("owner");
        await addCard("owner", { methodRef: "pm_nueva", last4: "1881" });
        expect((await h.billing("owner").overview()).method).toMatchObject({ last4: "1881" });
        expect(await h.storedMethod("owner")).toEqual({ customerRef: "cus_prueba", methodRef: "pm_nueva" });
      });

      it("cada evento se aplica una vez: repetido es «duplicate»; uno desconocido o incompleto se registra sin hacer nada", async () => {
        const a = await house();
        await expire(a.id);
        const event = cardEvent(h.ownerId("owner"));
        expect(await h.service.applyPaymentEvent(event)).toBe("applied");
        expect(await h.service.applyPaymentEvent(event)).toBe("duplicate");
        const unknown = cardEvent(h.ownerId("other"), { type: "customer.updated" });
        expect(await h.service.applyPaymentEvent(unknown)).toBe("ignored");
        expect(await h.service.applyPaymentEvent(unknown)).toBe("duplicate");
        expect(await h.service.applyPaymentEvent(cardEvent(h.ownerId("other"), { last4: null }))).toBe("ignored");
        expect(await h.service.applyPaymentEvent(cardEvent("00000000-0000-4000-8000-00000000dead"))).toBe("ignored");
        expect((await h.billing("other").overview()).method).toBeNull();
      });
    });

    describe("parar y reactivar", () => {
      it("activa con oferta → parada (fuera, «paró la suscripción») → reactivada activa, con el mismo enlace", async () => {
        const a = await house();
        const me = h.billing("owner");
        expect(await me.stop(a.id)).toBe("inactive");
        expect(await mine(a.id)).toMatchObject({ status: "inactive", stoppedOn: today(), promoSlot: 1 });
        expect(await h.anon.getPublic(a.publicId)).toBeNull();
        expect(await h.anon.blockedReason(a.publicId)).toBe("stopped");
        expect(await h.anon.offerTaken()).toBe(1);
        expect(await me.resume(a.id)).toBe("active");
        expect(await mine(a.id)).toMatchObject({ status: "active", stoppedOn: null, plan: "promo", promoSlot: 1 });
        expect(await h.anon.getPublic(a.publicId)).not.toBeNull();
        expect(await h.anon.blockedReason(a.publicId)).toBeNull();
      });

      it("pendiente de pago → parada → reactivada sin método vuelve a pendiente de pago", async () => {
        const a = await house();
        await expire(a.id);
        const me = h.billing("owner");
        expect(await me.stop(a.id)).toBe("inactive");
        expect(await h.anon.blockedReason(a.publicId)).toBe("stopped");
        expect(await me.resume(a.id)).toBe("payment_due");
        expect(await h.anon.blockedReason(a.publicId)).toBe("payment");
      });

      it("la oferta corre mientras está parada: reactivar con método después del fin la deja activa en el plan de pago desde hoy", async () => {
        const a = await house();
        const me = h.billing("owner");
        await me.stop(a.id);
        await h.setDaysLeft(a.id, -5);
        await addCard("owner");
        expect(await mine(a.id)).toMatchObject({ status: "inactive" });
        expect(await me.resume(a.id)).toBe("active");
        expect(await mine(a.id)).toMatchObject({ status: "active", plan: "paid", paidSince: today() });
      });

      it("parar una casa no toca las demás", async () => {
        const a = await house();
        const b = await house();
        await h.billing("owner").stop(a.id);
        expect(await mine(b.id)).toMatchObject({ status: "active", stoppedOn: null });
      });

      it("rechazos: ajena o inexistente, borrador, revisión, cambios, ya parada, reactivar una activa, sin sesión", async () => {
        const mineActive = await house();
        const theirs = await house({ as: "other" });
        const me = h.billing("owner");
        expect((await rejection(me.stop(theirs.id))).message).toBe(M.notFound);
        expect((await rejection(me.resume(theirs.id))).message).toBe(M.notFound);
        expect((await rejection(me.stop("00000000-0000-4000-8000-00000000dead"))).message).toBe(M.notFound);
        for (const status of ["draft", "review", "changes", "reopened"] as const) {
          const l = await h.seed({ status });
          expect((await rejection(me.stop(l.id))).message, status).toBe(M.stop);
          expect((await rejection(me.resume(l.id))).message, status).toBe(M.resume);
        }
        expect((await rejection(me.resume(mineActive.id))).message).toBe(M.resume);
        await me.stop(mineActive.id);
        expect((await rejection(me.stop(mineActive.id))).message).toBe(M.stop);
        expect((await rejection(h.billing("anon").stop(mineActive.id))).kind).toBe("session");
        expect((await rejection(h.billing("anon").overview())).kind).toBe("session");
        expect(await mine(theirs.id, "other")).toMatchObject({ status: "active" });
      });

      it("con la cuenta desactivada no se para ni se reactiva", async () => {
        const a = await house();
        await h.setAccountActive("owner", false);
        try {
          expect((await rejection(h.billing("owner").stop(a.id))).message).toBe(M.inactiveAccount);
        } finally {
          await h.setAccountActive("owner", true);
        }
        expect(await mine(a.id)).toMatchObject({ status: "active" });
      });
    });

    describe("visibilidad pública y motivo del enlace", () => {
      it("solo las activas son públicas; el motivo distingue parada, por pagar y lo demás", async () => {
        const active = await house();
        const due = await house();
        const stopped = await house();
        const reopened = await h.seed({ status: "reopened" });
        const draft = await h.seed({ status: "draft" });
        await expire(due.id);
        await h.billing("owner").stop(stopped.id);
        const listed = (await h.anon.searchPublic(parseFilters({ prov: "Todas" }, PROVINCES))).map((x) => x.publicId);
        expect(listed).toEqual([active.publicId]);
        expect((await h.anon.getManyPublic([active, due, stopped, reopened].map((x) => x.publicId))).map((x) => x.publicId)).toEqual([active.publicId]);
        expect(await h.anon.blockedReason(active.publicId)).toBeNull();
        expect(await h.anon.blockedReason(due.publicId)).toBe("payment");
        expect(await h.anon.blockedReason(stopped.publicId)).toBe("stopped");
        expect(await h.anon.blockedReason(reopened.publicId)).toBe("other");
        expect(await h.anon.blockedReason(draft.publicId)).toBeNull();
        expect(await h.anon.blockedReason("CT-999999")).toBeNull();
        for (const l of [due, stopped, reopened]) expect(await h.anon.linkState(l.publicId)).toBe("blocked");
      });
    });

    describe("avisos en cola", () => {
      it("91 → nada; 90, 30, 7 y 0 encolan su umbral una sola vez; −1 termina la oferta", async () => {
        const a = await house();
        const steps: [number, number[]][] = [
          [91, []],
          [90, [90]],
          [89, [90]],
          [31, [90]],
          [30, [90, 30]],
          [8, [90, 30]],
          [7, [90, 30, 7]],
          [1, [90, 30, 7]],
          [0, [90, 30, 7, 0]],
          [-1, [90, 30, 7, 0]],
        ];
        let before = 0;
        for (const [days, expected] of steps) {
          await h.setDaysLeft(a.id, days);
          const run = await h.service.runDay(today());
          expect(run.queued, `${days} días`).toBe(expected.length - before);
          expect((await h.reminders(a.id)).map((r) => r.daysBefore), `${days} días`).toEqual(expected);
          before = expected.length;
        }
        expect(await mine(a.id)).toMatchObject({ status: "payment_due" });
        expect((await mine(a.id))!.reminders).toEqual([90, 30, 7, 0].map((d) => ({ daysBefore: d, status: "queued", sentAt: null })));
      });

      it("si el trabajo no corrió, la casa recibe el umbral en el que está y no los anteriores", async () => {
        const a = await house();
        await h.setDaysLeft(a.id, 5);
        expect((await h.service.runDay(today())).queued).toBe(1);
        expect((await h.reminders(a.id)).map((r) => r.daysBefore)).toEqual([7]);
      });

      it("no se avisa a casas con método, paradas o sin oferta", async () => {
        const withCard = await house({ as: "other" });
        await addCard("other");
        const stopped = await house();
        await h.billing("owner").stop(stopped.id);
        for (const l of [withCard, stopped]) await h.setDaysLeft(l.id, 30);
        expect((await h.service.runDay(today())).queued).toBe(0);
      });
    });

    describe("reclamar y cerrar avisos", () => {
      const queue = async (n: number, as: SeedOwner = "owner") => {
        const houses = [];
        for (let k = 0; k < n; k++) houses.push(await house({ as }));
        for (const l of houses) await h.setDaysLeft(l.id, 60);
        await h.service.runDay(today());
        return houses;
      };

      it("reclamar devuelve lo que necesita el remitente y no vuelve a dar los que están enviándose", async () => {
        const [a] = await queue(1);
        const claimed = await h.service.claimReminders(10);
        expect(claimed).toEqual([
          { id: expect.any(String), listingId: a!.id, publicId: a!.publicId, title: "Cabina Cahuita", ownerName: h.ownerName("owner"), toPhone: h.phone("owner"), daysBefore: 90, promoEndsOn: addDays(today(), 60) },
        ]);
        expect(await h.service.claimReminders(10)).toEqual([]);
        expect(await h.reminders(a!.id)).toMatchObject([{ status: "sending", attempts: 1, toPhone: h.phone("owner") }]);
      });

      it("respeta el límite y el resto queda para la siguiente vez", async () => {
        await queue(3);
        expect(await h.service.claimReminders(2)).toHaveLength(2);
        expect(await h.service.claimReminders(2)).toHaveLength(1);
        expect(await h.service.claimReminders(2)).toEqual([]);
      });

      it("cerrar: sent guarda número, texto y referencia; retry vuelve a la cola hasta 5 intentos; unknown y skipped no vuelven", async () => {
        const houses = await queue(4);
        const claimed = await h.service.claimReminders(10);
        const byListing = (id: string) => claimed.find((c) => c.listingId === id)!.id;
        const [a, b, c, d] = houses.map((x) => byListing(x.id));
        expect(
          await h.service.finishReminders([
            { id: a!, outcome: "sent", providerRef: "SM123", toPhone: "+50687770001", body: "Hola, Yorleny." },
            { id: b!, outcome: "retry", error: "400 número no válido" },
            { id: c!, outcome: "unknown", error: "timeout" },
            { id: d!, outcome: "skipped", error: "fuera de la lista permitida" },
          ]),
        ).toBe(4);
        expect(await h.service.finishReminders([{ id: a!, outcome: "retry", error: "otra vez" }])).toBe(0);
        const [ra, rb, rc, rd] = await Promise.all(houses.map((x) => h.reminders(x.id)));
        expect(ra![0]).toMatchObject({ status: "sent", providerRef: "SM123", toPhone: "+50687770001", body: "Hola, Yorleny.", sentAt: expect.any(String) });
        expect(rb![0]).toMatchObject({ status: "queued", attempts: 1, sentAt: null });
        expect(rc![0]).toMatchObject({ status: "unknown", sentAt: null });
        expect(rd![0]).toMatchObject({ status: "skipped" });
        expect((await mine(houses[0]!.id))!.reminders).toEqual([{ daysBefore: 90, status: "sent", sentAt: expect.any(String) }]);

        for (let attempt = 2; attempt <= 5; attempt++) {
          const again = await h.service.claimReminders(10);
          expect(again.map((x) => x.id), `intento ${attempt}`).toEqual([b]);
          await h.service.finishReminders([{ id: b!, outcome: "retry", error: "400" }]);
        }
        expect((await h.reminders(houses[1]!.id))[0]).toMatchObject({ status: "failed", attempts: 5 });
        expect(await h.service.claimReminders(10)).toEqual([]);
      });

      it("un aviso de una casa que ya no lo necesita (parada o con método) se omite al reclamar", async () => {
        const [a] = await queue(1);
        const [b] = await queue(1, "other");
        await h.billing("owner").stop(a!.id);
        await addCard("other");
        expect(await h.service.claimReminders(10)).toEqual([]);
        expect((await h.reminders(a!.id))[0]).toMatchObject({ status: "skipped" });
        expect((await h.reminders(b!.id))[0]).toMatchObject({ status: "skipped" });
      });
    });

    describe("contexto de la pasarela", () => {
      it("con el JWT de la sesión: la cuenta y su cliente en esa pasarela", async () => {
        const jwt = await h.jwt("owner");
        expect(await h.service.setupContext(jwt, "stripe")).toEqual({ ownerId: h.ownerId("owner"), fullName: h.ownerName("owner"), phone: h.phone("owner"), customerRef: null });
        await h.service.savePaymentCustomer(h.ownerId("owner"), "stripe", "cus_1");
        await h.service.savePaymentCustomer(h.ownerId("owner"), "stripe", "cus_2");
        expect((await h.service.setupContext(jwt, "stripe")).customerRef).toBe("cus_2");
        expect((await h.service.setupContext(jwt, "fake")).customerRef).toBeNull();
      });

      it("un JWT que no vale es «session»; una cuenta desactivada, su mensaje", async () => {
        expect((await rejection(h.service.setupContext("no-es-un-jwt", "stripe"))).kind).toBe("session");
        await h.setAccountActive("owner", false);
        try {
          expect((await rejection(h.service.setupContext(await h.jwt("owner"), "stripe"))).message).toBe(M.inactiveAccount);
        } finally {
          await h.setAccountActive("owner", true);
        }
      });
    });

    describe("reloj de pruebas", () => {
      it("sin el secreto de Vault se rechaza; con él deja N días de oferta sin cambiar el estado", async () => {
        const a = await house();
        const was = await h.setTestClock(false);
        try {
          expect((await rejection(h.service.setOfferDaysLeft(a.publicId, 10))).message).toBe(M.testClockOff);
          await h.setTestClock(true);
          expect(await h.service.setOfferDaysLeft(a.publicId, 10)).toBe(addDays(today(), 10));
          expect(await h.service.setOfferDaysLeft(a.publicId, -2)).toBe(addDays(today(), -2));
          expect(await mine(a.id)).toMatchObject({ status: "active", promoEndsOn: addDays(today(), -2) });
          expect((await rejection(h.service.setOfferDaysLeft("CT-999999", 1))).message).toBe(M.notFound);
        } finally {
          await h.setTestClock(was);
        }
      });
    });

    describe("facturación del propietario", () => {
      it("cada propietario ve solo sus casas, la más reciente primero, y el «hoy» de Costa Rica", async () => {
        const a = await house();
        const b = await house();
        const c = await house({ as: "other" });
        const own = await h.billing("owner").overview();
        expect(own.houses.map((x) => x.listingId)).toEqual([b.id, a.id]);
        expect(own.today).toBe(today());
        expect((await h.billing("other").overview()).houses.map((x) => x.listingId)).toEqual([c.id]);
      });
    });
  });
}
