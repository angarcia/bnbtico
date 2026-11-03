// Contrato de pausar, bloquear y eliminar una casa desde el admin (spec .scratch/admin-casas-acciones): lo que ve el público,
// lo que ve y puede hacer el propietario, la suscripción de una casa bloqueada y el borrado lógico. Mismas reglas y mensajes
// en el fake y en la base (RPCs admin_pause/resume/block/unblock/delete_listing, vista listings_public, RLS y guardas).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_HOLD_MESSAGES as H } from "../../src/domain/admin-actions";
import { addDays } from "../../src/domain/calendar";
import { DomainError } from "../../src/domain/errors";
import { parseFilters } from "../../src/domain/filters";
import { INQUIRY_MESSAGES, costaRicaToday } from "../../src/domain/inquiry";
import { PROVINCES } from "../../src/domain/listing";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import type { PaymentEvent } from "../../src/domain/subscription";
import type { SeedOwner, Seeded, SubscriptionHarness } from "./harness";

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
const REASON = "Las fotos no son de la casa.";
const ALL = parseFilters({ prov: "Todas" }, PROVINCES);
let eventSeq = 0;

export function adminAccionesContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`admin · pausar, bloquear y eliminar · ${name}`, () => {
    let h: SubscriptionHarness;
    const admin = () => h.admin("aal2");
    const publicIds = async () => (await h.anon.searchPublic(ALL)).map((l) => l.publicId);
    const ownerHouse = async (id: string, who: SeedOwner = "owner") => (await h.owner(who).listOwn()).find((l) => l.id === id);
    const adminHouse = async (id: string) => (await admin().houses()).houses.find((x) => x.listingId === id);
    const addCard = (who: SeedOwner) =>
      h.service.applyPaymentEvent({
        provider: "fake",
        eventId: `evt_hold_${Date.now()}_${++eventSeq}`,
        type: "setup_completed",
        ownerId: h.ownerId(who),
        customerRef: "cus_prueba",
        methodRef: "pm_prueba",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2029,
      } satisfies PaymentEvent);
    /** Una casa activa que el cliente ya guardó en favoritos y consultó. */
    async function liked(title: string): Promise<Seeded> {
      const s = await h.seed({ status: "active", draft: { title } });
      await h.favorites("other").add(s.publicId);
      return s;
    }

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
    }, 60_000);

    describe("quién puede", () => {
      it("quien no es admin y el admin sin el segundo código son rechazados, con cualquiera de las cinco acciones", async () => {
        const s = await h.seed({ status: "active" });
        for (const who of ["owner", "other"] as const) {
          const api = h.admin(who);
          expect((await rejection(api.pauseListing(s.id, REASON))).message).toBe(REVIEW_MESSAGES.adminOnly);
          expect((await rejection(api.blockListing(s.id, REASON))).message).toBe(REVIEW_MESSAGES.adminOnly);
          expect((await rejection(api.resumeListing(s.id))).message).toBe(REVIEW_MESSAGES.adminOnly);
          expect((await rejection(api.unblockListing(s.id))).message).toBe(REVIEW_MESSAGES.adminOnly);
          expect((await rejection(api.deleteListing(s.id, REASON, s.publicId))).message).toBe(REVIEW_MESSAGES.adminOnly);
        }
        const aal1 = h.admin("aal1");
        const attempts = [
          () => aal1.pauseListing(s.id, REASON),
          () => aal1.blockListing(s.id, REASON),
          () => aal1.resumeListing(s.id),
          () => aal1.unblockListing(s.id),
          () => aal1.deleteListing(s.id, REASON, s.publicId),
        ];
        for (const act of attempts) {
          const e = await rejection(act());
          expect(e.message).toBe(REVIEW_MESSAGES.mfaRequired);
          expect(e.kind).toBe("forbidden");
        }
        expect(await h.anon.getPublic(s.publicId)).not.toBeNull();
        expect((await h.adminActions(s.id)).length).toBe(0);
      });

      it("el motivo es obligatorio en pausar, bloquear y eliminar", async () => {
        const s = await h.seed({ status: "active" });
        for (const reason of ["", "   "]) {
          expect((await rejection(admin().pauseListing(s.id, reason))).message).toBe(H.reasonRequired);
          expect((await rejection(admin().blockListing(s.id, reason))).message).toBe(H.reasonRequired);
          expect((await rejection(admin().deleteListing(s.id, reason, s.publicId))).message).toBe(H.reasonRequired);
        }
        expect((await rejection(admin().pauseListing(s.id, "x".repeat(2001)))).message).toBe(H.reasonTooLong);
        expect((await ownerHouse(s.id))?.adminHold).toBeNull();
      });

      it("pausar y bloquear solo valen para casas publicadas; una que no existe no se encuentra", async () => {
        for (const status of ["draft", "review", "changes", "rejected", "reopened"] as const) {
          const s = await h.seed({ status });
          expect((await rejection(admin().pauseListing(s.id, REASON))).message).toBe(H.notPublished);
          expect((await rejection(admin().blockListing(s.id, REASON))).message).toBe(H.notPublished);
        }
        const none = "00000000-0000-4000-8000-00000000ffff";
        expect((await rejection(admin().pauseListing(none, REASON))).message).toBe(REVIEW_MESSAGES.notFound);
        expect((await rejection(admin().deleteListing(none, REASON, "CT-1"))).message).toBe(REVIEW_MESSAGES.notFound);
      });
    });

    describe("pausar", () => {
      it("la casa sale del público y su enlace deja de funcionar; la suscripción no cambia", async () => {
        const s = await liked("Casa Pausable");
        const other = await h.seed({ status: "active", as: "other", draft: { title: "Otra casa" } });
        const before = (await h.billing("owner").overview()).houses[0]!;
        await admin().pauseListing(s.id, `  ${REASON}  `);

        expect(await h.anon.getPublic(s.publicId)).toBeNull();
        expect(await h.anon.getManyPublic([s.publicId, other.publicId])).toHaveLength(1);
        expect(await publicIds()).toEqual([other.publicId]);
        expect((await h.anon.sitemap()).map((e) => e.publicId)).toEqual([other.publicId]);
        expect(await h.anon.countActive()).toBe(1);
        expect(await h.anon.linkState(s.publicId)).toBe("blocked");
        expect(await h.anon.blockedReason(s.publicId)).toBe("other");
        expect(await h.anon.getPublicDays(s.publicId)).toEqual([]);
        expect(await h.favorites("other").list()).toEqual([]);
        expect((await rejection(h.inquiries("other").create(s.publicId, { arrival: null, departure: null, people: null, message: "Hola" }))).message).toBe(INQUIRY_MESSAGES.notPublished);

        const mine = await ownerHouse(s.id);
        expect(mine).toMatchObject({ status: "active", adminHold: { kind: "paused", reason: REASON } });
        const after = (await h.billing("owner").overview()).houses[0]!;
        expect(after).toMatchObject({ status: "active", plan: before.plan, promoEndsOn: before.promoEndsOn, hold: "paused" });
        expect(await adminHouse(s.id)).toMatchObject({ status: "active", hold: { kind: "paused", reason: REASON }, subscription: { hold: "paused" } });
        expect((await h.adminActions(s.id)).map((a) => [a.action, a.reason])).toEqual([["listing.pause", REASON]]);
      });

      it("el propietario sigue viendo y editando la casa pausada", async () => {
        const s = await h.seed({ status: "active" });
        await admin().pauseListing(s.id, REASON);
        await h.owner("owner").updateLive(s.id, { capacity: 6 });
        expect((await ownerHouse(s.id))?.capacity).toBe(6);
        await h.calendar("owner").save(s.id, { days: [addDays(today(), 3)], available: false });
        expect((await h.calendar("owner").days(s.id)).map((d) => d.day)).toEqual([addDays(today(), 3)]);
        const edit = await h.owner("owner").saveEdit(s.id, { title: "Cabina pausada" });
        expect(edit).not.toBeNull();
        expect((await ownerHouse(s.id))?.adminHold?.kind).toBe("paused");
      });

      it("se reanuda: vuelve a verse y a encontrarse; sin pausa no hay nada que reanudar", async () => {
        const s = await h.seed({ status: "active" });
        expect((await rejection(admin().resumeListing(s.id))).message).toBe(H.notPaused);
        await admin().pauseListing(s.id, REASON);
        expect((await rejection(admin().pauseListing(s.id, "Otra vez"))).message).toBe(H.alreadyPaused);
        await admin().resumeListing(s.id);
        expect(await publicIds()).toEqual([s.publicId]);
        expect(await h.anon.linkState(s.publicId)).toBe("active");
        expect((await ownerHouse(s.id))?.adminHold).toBeNull();
        expect((await h.adminActions(s.id)).map((a) => a.action)).toEqual(["listing.pause", "listing.resume"]);
      });

      it("también se pausa una casa pendiente de pago o inactiva", async () => {
        const due = await h.seed({ status: "active" });
        const stopped = await h.seed({ status: "active", as: "other" });
        await h.setDaysLeft(due.id, -1);
        await h.service.runDay(today());
        await h.billing("other").stop(stopped.id);
        await admin().pauseListing(due.id, REASON);
        await admin().pauseListing(stopped.id, REASON);
        expect(await adminHouse(due.id)).toMatchObject({ status: "payment_due", hold: { kind: "paused" } });
        expect(await adminHouse(stopped.id)).toMatchObject({ status: "inactive", hold: { kind: "paused" } });
        expect(await h.anon.linkState(stopped.publicId)).toBe("blocked");
      });
    });

    describe("bloquear", () => {
      it("para el público es como pausar; el propietario la ve con el motivo y no puede tocarla", async () => {
        const s = await liked("Casa Bloqueable");
        await admin().blockListing(s.id, REASON);
        expect(await h.anon.getPublic(s.publicId)).toBeNull();
        expect(await publicIds()).toEqual([]);
        expect(await h.anon.linkState(s.publicId)).toBe("blocked");
        expect(await h.anon.blockedReason(s.publicId)).toBe("other");
        expect(await h.favorites("other").list()).toEqual([]);

        expect(await ownerHouse(s.id)).toMatchObject({ status: "active", adminHold: { kind: "blocked", reason: REASON } });
        const me = h.owner("owner");
        const photos = (await ownerHouse(s.id))!.photos;
        const attempts = [
          () => me.updateLive(s.id, { capacity: 6 }),
          () => me.saveEdit(s.id, { title: "Cabina bloqueada" }),
          () => h.calendar("owner").save(s.id, { days: [addDays(today(), 3)], available: false }),
          () => h.photos("owner").reorder(s.id, photos.map((p) => p.id).reverse()),
          () => h.photos("owner").remove(photos[0]!.id),
          () => h.billing("owner").stop(s.id),
        ];
        for (const act of attempts) expect((await rejection(act())).message).toBe(H.ownerBlocked);
        expect((await ownerHouse(s.id))?.capacity).toBe(2);
        expect(await adminHouse(s.id)).toMatchObject({ hold: { kind: "blocked", reason: REASON }, subscription: { hold: "blocked" } });
      });

      it("desde una pausada pasa a bloqueada; una bloqueada no se pausa ni se bloquea otra vez", async () => {
        const s = await h.seed({ status: "active" });
        await admin().pauseListing(s.id, REASON);
        await admin().blockListing(s.id, "Datos falsos");
        expect(await ownerHouse(s.id)).toMatchObject({ adminHold: { kind: "blocked", reason: "Datos falsos" } });
        expect((await rejection(admin().pauseListing(s.id, REASON))).message).toBe(H.blockedFirst);
        expect((await rejection(admin().blockListing(s.id, REASON))).message).toBe(H.alreadyBlocked);
        expect((await rejection(admin().resumeListing(s.id))).message).toBe(H.notPaused);
        await admin().unblockListing(s.id);
        expect((await rejection(admin().unblockListing(s.id))).message).toBe(H.notBlocked);
        expect((await ownerHouse(s.id))?.adminHold).toBeNull();
        expect((await h.adminActions(s.id)).map((a) => a.action)).toEqual(["listing.pause", "listing.block", "listing.unblock"]);
      });

      it("la suscripción se para: sin fin de oferta, sin avisos ni los que estaban en cola", async () => {
        const blocked = await h.seed({ status: "active" });
        const free = await h.seed({ status: "active", as: "other" });
        await h.setDaysLeft(blocked.id, 20);
        await h.setDaysLeft(free.id, 20);
        await h.service.runDay(today());
        expect((await h.reminders(blocked.id)).map((r) => r.status)).toEqual(["queued"]);
        await admin().blockListing(blocked.id, REASON);
        expect(await h.reminders(blocked.id)).toEqual([]);

        // La oferta vence con la casa bloqueada: sigue activa, sin pasar a pendiente de pago ni encolar nada.
        await h.setDaysLeft(blocked.id, -2);
        await h.setDaysLeft(free.id, -2);
        const day = await h.service.runDay(today());
        expect(day).toMatchObject({ paymentDue: 1 });
        expect(await adminHouse(blocked.id)).toMatchObject({ status: "active" });
        expect(await adminHouse(free.id)).toMatchObject({ status: "payment_due" });
        expect(await h.reminders(blocked.id)).toEqual([]);
        // Con el método de pago no se pasa al plan de pago.
        await addCard("owner");
        await h.service.runDay(today());
        expect((await h.billing("owner").overview()).houses[0]).toMatchObject({ plan: "promo", paidSince: null });
        expect((await h.service.claimReminders(20)).map((r) => r.listingId)).not.toContain(blocked.id);
      });

      it("un aviso en cola de una casa que se bloquea después no se reclama", async () => {
        const s = await h.seed({ status: "active" });
        await h.setDaysLeft(s.id, 20);
        await h.service.runDay(today());
        await admin().blockListing(s.id, REASON);
        await h.service.runDay(today());
        expect(await h.service.claimReminders(20)).toEqual([]);
      });

      it("la casa bloqueada no muestra «Añadir método de pago»: su línea dice que la suscripción está parada", async () => {
        const s = await h.seed({ status: "active" });
        await h.setDaysLeft(s.id, 5);
        await admin().blockListing(s.id, REASON);
        const overview = await h.billing("owner").overview();
        expect(overview.houses[0]).toMatchObject({ listingId: s.id, hold: "blocked", status: "active" });
      });

      it("al desbloquear, la oferta gratuita se corre los días que estuvo bloqueada y la casa vuelve a su estado", async () => {
        const s = await h.seed({ status: "active" });
        await h.setDaysLeft(s.id, 10);
        await admin().blockListing(s.id, REASON);
        await h.backdateHold(s.id, 7);
        await admin().unblockListing(s.id);
        const [house] = (await h.billing("owner").overview()).houses;
        expect(house).toMatchObject({ status: "active", hold: null, promoEndsOn: addDays(today(), 17) });
        expect(await publicIds()).toEqual([s.publicId]);
      });

      it("un método de pago añadido mientras está bloqueada no la activa hasta desbloquearla", async () => {
        const s = await h.seed({ status: "active" });
        await h.setDaysLeft(s.id, -1);
        await h.service.runDay(today());
        expect(await adminHouse(s.id)).toMatchObject({ status: "payment_due" });
        await admin().blockListing(s.id, REASON);
        await addCard("owner");
        expect(await adminHouse(s.id)).toMatchObject({ status: "payment_due", subscription: { plan: "promo", paidSince: null } });
        await admin().unblockListing(s.id);
        expect(await adminHouse(s.id)).toMatchObject({ status: "active", hold: null, subscription: { plan: "paid", paidSince: today() } });
      });
    });

    describe("eliminar", () => {
      it("pide el código CT-#### de la casa; sin él no se borra", async () => {
        const s = await h.seed({ status: "active" });
        for (const typed of ["", "CT-9999", s.publicId.slice(3)]) {
          expect((await rejection(admin().deleteListing(s.id, REASON, typed))).message).toBe(H.confirmCode);
        }
        expect(await ownerHouse(s.id)).toBeDefined();
        await admin().deleteListing(s.id, REASON, `  ${s.publicId.toLowerCase()} `);
        expect(await ownerHouse(s.id)).toBeUndefined();
      });

      it("desaparece para todos: propietario, contadores, calendario, consultas, favoritos, Explorar y sitemap", async () => {
        const s = await liked("Casa Eliminable");
        const keep = await h.seed({ status: "active", draft: { title: "Se queda" } });
        await h.inquiries("other").create(s.publicId, { arrival: null, departure: null, people: null, message: "Hola, ¿está libre?" });
        await h.favorites("other").add(keep.publicId);
        expect(await h.inquiries("owner").listForOwner()).toHaveLength(1);

        await admin().deleteListing(s.id, REASON, s.publicId);

        // Propietario
        expect((await h.owner("owner").listOwn()).map((l) => l.id)).toEqual([keep.id]);
        expect(await h.owner("owner").getOwn(s.id)).toBeNull();
        expect((await h.owner("owner").ownerActivity()).map((a) => a.listingId)).toEqual([keep.id]);
        expect((await h.billing("owner").overview()).houses.map((x) => x.listingId)).toEqual([keep.id]);
        expect(await h.inquiries("owner").listForOwner()).toEqual([]);
        expect(await h.calendar("owner").days(s.id)).toEqual([]);
        expect((await rejection(h.calendar("owner").save(s.id, { days: [addDays(today(), 3)], available: false }))).message).toBeTruthy();
        expect((await rejection(h.owner("owner").updateLive(s.id, { capacity: 4 }))).message).toBe("No encontramos ese anuncio.");
        expect((await rejection(h.billing("owner").stop(s.id))).message).toBeTruthy();
        // Admin
        expect((await admin().houses()).houses.map((x) => x.listingId)).toEqual([keep.id]);
        expect(await admin().get(s.id)).toBeNull();
        // Público
        expect(await h.anon.getPublic(s.publicId)).toBeNull();
        expect(await h.anon.linkState(s.publicId)).toBeNull();
        expect(await h.anon.blockedReason(s.publicId)).toBeNull();
        expect(await publicIds()).toEqual([keep.publicId]);
        expect((await h.anon.sitemap()).map((e) => e.publicId)).toEqual([keep.publicId]);
        expect((await h.favorites("other").list()).map((f) => f.publicId)).toEqual([keep.publicId]);
        expect((await h.adminActions(s.id)).map((a) => [a.action, a.reason])).toEqual([["listing.delete", REASON]]);
      });

      it("vale en cualquier estado (borrador, en revisión, pendiente de pago, inactiva) y no se repite", async () => {
        const draft = await h.seed({ status: "draft" });
        const review = await h.seed({ status: "review" });
        const due = await h.seed({ status: "active" });
        const stopped = await h.seed({ status: "active", as: "other" });
        await h.setDaysLeft(due.id, -1);
        await h.service.runDay(today());
        await h.billing("other").stop(stopped.id);
        for (const s of [draft, review, due, stopped]) {
          await admin().deleteListing(s.id, REASON, s.publicId);
          expect((await rejection(admin().deleteListing(s.id, REASON, s.publicId))).message).toBe(REVIEW_MESSAGES.notFound);
        }
        expect(await h.owner("owner").listOwn()).toEqual([]);
        expect(await h.owner("other").listOwn()).toEqual([]);
        expect((await admin().queue()).review).toEqual([]);
      });

      it("una casa eliminada no cuenta entre los borradores abiertos del propietario", async () => {
        for (let i = 0; i < 5; i++) await h.owner("owner").createDraft();
        const [first] = await h.owner("owner").listOwn();
        expect((await rejection(h.owner("owner").createDraft())).message).toMatch(/Ya tiene 5 borradores/);
        await admin().deleteListing(first!.id, REASON, first!.publicId);
        await h.owner("owner").createDraft();
        expect(await h.owner("owner").listOwn()).toHaveLength(5);
      });

      it("elimina también una pausada o bloqueada, y quita los avisos pendientes", async () => {
        const s = await h.seed({ status: "active" });
        await h.setDaysLeft(s.id, 20);
        await h.service.runDay(today());
        expect(await h.reminders(s.id)).toHaveLength(1);
        await admin().pauseListing(s.id, REASON);
        await admin().deleteListing(s.id, "Duplicada", s.publicId);
        expect(await h.service.claimReminders(20)).toEqual([]);
        expect(await h.owner("owner").listOwn()).toEqual([]);
      });
    });
  });
}
