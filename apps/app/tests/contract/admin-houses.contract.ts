// Contrato de las casas del admin (fase 5, ticket 07): las aprobadas alguna vez, en cualquier estado, con propietario,
// zona, portada y suscripción; nada para quien no es admin y el segundo código para el admin en aal1. Mismas reglas en el
// fake y en la base (RLS de listings, subscriptions, payment_methods y profiles con is_admin() en aal2).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/calendar";
import { DomainError } from "../../src/domain/errors";
import { costaRicaToday } from "../../src/domain/inquiry";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import { MONTHLY_FEE_CRC, promoEndsOn, type PaymentEvent } from "../../src/domain/subscription";
import type { SeedOwner, SubscriptionHarness } from "./harness";

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

export function adminHousesContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`casas del admin · ${name}`, () => {
    let h: SubscriptionHarness;
    const addCard = (who: SeedOwner) =>
      h.service.applyPaymentEvent({
        provider: "fake",
        eventId: `evt_casas_${Date.now()}_${++eventSeq}`,
        type: "setup_completed",
        ownerId: h.ownerId(who),
        customerRef: "cus_prueba",
        methodRef: "pm_prueba",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2029,
      } satisfies PaymentEvent);
    const houses = async () => (await h.admin("aal2").houses()).houses;

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
    }, 60_000);

    it("lista las aprobadas alguna vez, en cualquier estado, con propietario, zona, portada y suscripción", async () => {
      const active = await h.seed({ status: "active", draft: { title: "Activa", zone: "Cocles", zoneSource: "other", zoneId: null } });
      const other = await h.seed({ status: "active", as: "other", draft: { title: "De otra", zone: "Punta Uva", zoneSource: "other", zoneId: null } });
      const due = await h.seed({ status: "active", draft: { title: "Por pagar" } });
      const stopped = await h.seed({ status: "active", as: "other", draft: { title: "Parada" } });
      const editing = await h.seed({ status: "reopened", draft: { title: "En edición" } });
      await h.seed({ status: "draft", draft: { title: "Borrador" } });
      await h.seed({ status: "review", draft: { title: "En revisión sin publicar" } });
      await h.seed({ status: "changes" });
      await h.seed({ status: "rejected" });
      await h.setDaysLeft(due.id, -1);
      await h.service.runDay(today());
      await h.billing("other").stop(stopped.id);

      const result = await h.admin("aal2").houses();
      expect(result.today).toBe(today());
      const byId = new Map(result.houses.map((x) => [x.listingId, x]));
      expect([...byId.keys()].sort()).toEqual([active.id, other.id, due.id, stopped.id, editing.id].sort());

      expect(byId.get(active.id)).toMatchObject({
        publicId: active.publicId,
        title: "Activa",
        status: "active",
        ownerName: h.ownerName("owner"),
        zone: "Cocles",
        subscription: {
          status: "active",
          plan: "promo",
          promoEndsOn: promoEndsOn(today(), 12),
          paidSince: null,
          stoppedOn: null,
          monthlyPriceCrc: MONTHLY_FEE_CRC,
          hasMethod: false,
        },
      });
      expect(byId.get(active.id)!.cover?.position).toBe(0);
      expect(byId.get(active.id)!.cover?.url).toMatch(/^https?:\/\//);
      expect(byId.get(other.id)).toMatchObject({ ownerName: h.ownerName("other"), zone: "Punta Uva", status: "active" });
      expect(byId.get(due.id)).toMatchObject({ status: "payment_due", subscription: { status: "payment_due", promoEndsOn: addDays(today(), -1), hasMethod: false } });
      expect(byId.get(stopped.id)).toMatchObject({ status: "inactive", subscription: { status: "inactive", stoppedOn: today() } });
      expect(byId.get(editing.id)).toMatchObject({ status: "draft", title: "En edición", subscription: { plan: "promo", stoppedOn: null } });
    });

    it("la aprobada más recientemente sale primero", async () => {
      const first = await h.seed({ status: "active" });
      const second = await h.seed({ status: "active" });
      expect((await houses()).map((x) => x.listingId)).toEqual([second.id, first.id]);
    });

    it("dice si el propietario tiene método de pago y el plan de pago tras la oferta", async () => {
      const paid = await h.seed({ status: "active" });
      const free = await h.seed({ status: "active", as: "other" });
      await addCard("owner");
      await h.setDaysLeft(paid.id, -1);
      await h.service.runDay(today());
      const list = await houses();
      expect(list.find((x) => x.listingId === paid.id)).toMatchObject({ status: "active", subscription: { plan: "paid", paidSince: today(), hasMethod: true } });
      expect(list.find((x) => x.listingId === free.id)?.subscription.hasMethod).toBe(false);
    });

    it("una casa sin fotos no tiene portada", async () => {
      const s = await h.seed({ status: "reopened" });
      for (let i = 0; i < 5; i++) await h.dropPhoto(s.id);
      expect((await houses()).find((x) => x.listingId === s.id)?.cover).toBeNull();
    });

    it("quien no es admin no obtiene nada, ni siquiera sus propias casas", async () => {
      await h.seed({ status: "active" });
      await h.seed({ status: "active", as: "other" });
      expect((await h.admin("owner").houses()).houses).toEqual([]);
      expect((await h.admin("other").houses()).houses).toEqual([]);
    });

    it("un admin sin el segundo código (aal1) es rechazado", async () => {
      await h.seed({ status: "active" });
      const refused = await rejection(h.admin("aal1").houses());
      expect(refused.message).toBe(REVIEW_MESSAGES.mfaRequired);
      expect(refused.kind).toBe("forbidden");
    });
  });
}
