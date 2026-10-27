// Contrato de las consultas por WhatsApp: crear (con todas sus reglas), Mis consultas y marcar como abierta.
// Mismas reglas y mensajes en el fake y en la base (RPCs create_inquiry, owner_inquiries, mark_inquiry_opened).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../../src/domain/errors";
import { INQUIRY_MESSAGES as M, costaRicaToday, type InquiryDraft } from "../../src/domain/inquiry";
import type { InquiriesHarness, Seeded } from "./harness";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

const day = (offset: number) => costaRicaToday(Date.now() + offset * 86_400_000);
const draft = (patch: Partial<InquiryDraft> = {}): InquiryDraft => ({ arrival: null, departure: null, people: null, message: "Hola, ¿está disponible?", ...patch });

export function inquiriesContract(name: string, makeHarness: () => Promise<InquiriesHarness>) {
  describe(`consultas · ${name}`, () => {
    let h: InquiriesHarness;
    let house: Seeded;

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
      house = await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
    }, 60_000);

    it("sin sesión no se crea ni se lista nada", async () => {
      expect((await rejection(h.inquiries("anon").create(house.publicId, draft()))).kind).toBe("session");
      expect((await rejection(h.inquiries("anon").listForOwner())).kind).toBe("session");
      expect(await h.inquiries("owner").listForOwner()).toEqual([]);
    });

    it("crea la consulta y devuelve el WhatsApp de la casa; el propietario la ve con nombre y WhatsApp del cliente", async () => {
      const r = await h.inquiries("other").create(house.publicId, draft({ arrival: day(10), departure: day(13), people: 4, message: "  Hola, somos cuatro.  " }));
      expect(r.whatsappPhone).toBe(h.phone("owner"));
      expect(r.inquiryId).toMatch(/^[0-9a-f-]{36}$/);
      const list = await h.inquiries("owner").listForOwner();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: r.inquiryId,
        listingId: house.id,
        publicId: house.publicId,
        listingTitle: "Casa Cahuita",
        clientName: h.ownerName("other"),
        clientPhone: h.phone("other"),
        arrival: day(10),
        departure: day(13),
        people: 4,
        message: "Hola, somos cuatro.",
        openedAt: null,
        source: "listing",
      });
      expect(Date.parse(list[0]!.createdAt)).not.toBeNaN();
      expect(list[0]!.updatedAt >= list[0]!.createdAt).toBe(true);
    });

    it("otro propietario no ve las consultas ajenas, ni el cliente las ve como propietario", async () => {
      await h.inquiries("other").create(house.publicId, draft());
      const hers = await h.seed({ status: "active", as: "other", draft: { title: "Casa de Ana" } });
      await h.inquiries("owner").create(hers.publicId, draft());
      expect((await h.inquiries("owner").listForOwner()).map((i) => i.publicId)).toEqual([house.publicId]);
      expect((await h.inquiries("other").listForOwner()).map((i) => i.publicId)).toEqual([hers.publicId]);
      expect((await h.inquiries("other").listForOwner())[0]).toMatchObject({ clientName: h.ownerName("owner"), clientPhone: h.phone("owner") });
    });

    it("la propia casa no se contacta", async () => {
      expect((await rejection(h.inquiries("owner").create(house.publicId, draft()))).message).toBe(M.ownHouse);
    });

    it("casas no publicadas, inexistentes o no disponibles se rechazan con el mensaje de la base", async () => {
      for (const status of ["draft", "review", "changes", "rejected", "reopened"] as const) {
        const l = await h.seed({ status, draft: { title: `Casa ${status}` } });
        expect((await rejection(h.inquiries("other").create(l.publicId, draft()))).message, status).toBe(M.notPublished);
      }
      expect((await rejection(h.inquiries("other").create("CT-999999", draft()))).message).toBe(M.notPublished);
      await h.owner("owner").setAvailable(house.id, false);
      expect((await rejection(h.inquiries("other").create(house.publicId, draft()))).message).toBe(M.unavailable);
      expect(await h.inquiries("owner").listForOwner()).toEqual([]);
    });

    it("valida fechas, personas y mensaje con los mensajes de validateInquiryDraft", async () => {
      const cases: [Partial<InquiryDraft>, string][] = [
        [{ arrival: day(3) }, M.bothDates],
        [{ departure: day(3) }, M.bothDates],
        [{ arrival: day(3), departure: day(3) }, M.departureAfter],
        [{ arrival: day(-1), departure: day(2) }, M.arrivalPast],
        [{ people: 0 }, M.people],
        [{ people: 51 }, M.people],
        [{ message: "   " }, M.messageEmpty],
        [{ message: "a".repeat(1001) }, M.messageLong],
      ];
      for (const [patch, message] of cases) {
        expect((await rejection(h.inquiries("other").create(house.publicId, draft(patch)))).message, JSON.stringify(patch).slice(0, 60)).toBe(message);
      }
      await h.inquiries("other").create(house.publicId, draft({ arrival: day(0), departure: day(1), people: 50, message: "a".repeat(1000) }));
      expect(await h.inquiries("owner").listForOwner()).toHaveLength(1);
    });

    it("la misma casa en 7 días renueva la consulta (datos nuevos, vuelve a ser Nueva) en vez de crear otra", async () => {
      const first = await h.inquiries("other").create(house.publicId, draft({ message: "Primero" }));
      await h.inquiries("owner").markOpened(first.inquiryId);
      expect((await h.inquiries("owner").listForOwner())[0]!.openedAt).not.toBeNull();
      const before = (await h.inquiries("owner").listForOwner())[0]!;
      const again = await h.inquiries("other").create(house.publicId, draft({ message: "Segundo", people: 2 }));
      expect(again.inquiryId).toBe(first.inquiryId);
      const list = await h.inquiries("owner").listForOwner();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: first.inquiryId, message: "Segundo", people: 2, openedAt: null, createdAt: before.createdAt });
      expect(list[0]!.updatedAt >= before.updatedAt).toBe(true);
    });

    it("pasados 7 días, una consulta nueva", async () => {
      const first = await h.inquiries("other").create(house.publicId, draft({ message: "Hace tiempo" }));
      await h.backdateInquiry(first.inquiryId, 8);
      const again = await h.inquiries("other").create(house.publicId, draft({ message: "Otra vez" }));
      expect(again.inquiryId).not.toBe(first.inquiryId);
      expect((await h.inquiries("owner").listForOwner()).map((i) => i.message)).toEqual(["Otra vez", "Hace tiempo"]);
    });

    it("como mucho 20 casas distintas en 24 h; las ya contactadas se pueden renovar", async () => {
      await h.inquiries("other").create(house.publicId, draft());
      await h.seedContacts("other", 19);
      await h.inquiries("other").create(house.publicId, draft({ message: "Renuevo" }));
      const fresh = await h.seed({ status: "active", draft: { title: "Casa nueva" } });
      expect((await rejection(h.inquiries("other").create(fresh.publicId, draft()))).message).toBe(M.rateLimit);
    }, 60_000);

    it("marcar como abierta: solo el dueño de la consulta; la primera vez cuenta", async () => {
      const r = await h.inquiries("other").create(house.publicId, draft());
      expect((await rejection(h.inquiries("other").markOpened(r.inquiryId))).message).toBe(M.notFound);
      expect((await rejection(h.inquiries("owner").markOpened("00000000-0000-4000-8000-999999999999"))).message).toBe(M.notFound);
      expect((await rejection(h.inquiries("anon").markOpened(r.inquiryId))).kind).toBe("session");
      await h.inquiries("owner").markOpened(r.inquiryId);
      const opened = (await h.inquiries("owner").listForOwner())[0]!.openedAt;
      expect(opened).not.toBeNull();
      await h.inquiries("owner").markOpened(r.inquiryId);
      expect((await h.inquiries("owner").listForOwner())[0]!.openedAt).toBe(opened);
    });

    it("Mis consultas: la renovada más recientemente primero", async () => {
      const second = await h.seed({ status: "active", draft: { title: "Casa dos" } });
      await h.inquiries("other").create(house.publicId, draft({ message: "A" }));
      await h.inquiries("other").create(second.publicId, draft({ message: "B" }));
      expect((await h.inquiries("owner").listForOwner()).map((i) => i.message)).toEqual(["B", "A"]);
      await h.inquiries("other").create(house.publicId, draft({ message: "A2" }));
      expect((await h.inquiries("owner").listForOwner()).map((i) => i.message)).toEqual(["A2", "B"]);
    });

    // Revisión UX A2: el propietario ve si su ficha funciona (visitas y consultas de 30 días), y nadie más.
    it("estadísticas de 30 días de una casa: visitas y consultas, solo para su dueño", async () => {
      expect(await h.owner("owner").stats(house.id)).toEqual({ views: 0, inquiries: 0 });
      await h.recordViews(house.publicId, 3);
      await h.recordViews(house.publicId, 2, 40); // hace 40 días: fuera
      const recent = await h.inquiries("other").create(house.publicId, draft());
      expect(await h.owner("owner").stats(house.id)).toEqual({ views: 3, inquiries: 1 });
      await h.backdateInquiry(recent.inquiryId, 31);
      expect(await h.owner("owner").stats(house.id)).toEqual({ views: 3, inquiries: 0 });
      expect((await rejection(h.owner("other").stats(house.id))).message).toBe("No encontramos ese anuncio.");
    });
  });
}
