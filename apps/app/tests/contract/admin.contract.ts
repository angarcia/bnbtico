// Contrato de la revisión del admin (ticket 09): la cola separada por estado y antigüedad, las decisiones y su validación,
// y quién no obtiene nada. Mismas reglas y mensajes en el fake y en la base (RLS con is_admin() en aal2, RPC review_listing).
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../../src/domain/errors";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import type { ListingsHarness } from "./harness";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

export function adminContract(name: string, makeHarness: () => Promise<ListingsHarness>) {
  describe(`revisión del admin · ${name}`, () => {
    let h: ListingsHarness;

    beforeEach(async () => {
      h ??= await makeHarness();
      await h.reset();
    });

    it("la cola separa por revisar (la que más espera primero), cambios pedidos, rechazadas y cuenta las activas", async () => {
      const first = await h.seed({ status: "review", draft: { title: "Primera" } });
      await h.seed({ status: "draft", draft: { title: "Borrador" } });
      const changes = await h.seed({ status: "changes", draft: { title: "Con cambios" } });
      const second = await h.seed({ status: "review", as: "other", draft: { title: "Segunda" }, photos: 7 });
      const rejected = await h.seed({ status: "rejected", draft: { title: "Rechazada" } });
      await h.seed({ status: "active", draft: { title: "Activa" } });
      await h.seed({ status: "reopened", draft: { title: "Reabierta" } });

      const q = await h.admin("aal2").queue();
      expect(q.review.map((i) => i.listing.id)).toEqual([first.id, second.id]);
      expect(q.changes.map((i) => i.listing.id)).toEqual([changes.id]);
      expect(q.rejected.map((i) => i.listing.id)).toEqual([rejected.id]);
      expect(q.active).toBe(1);

      const [a, b] = q.review;
      expect(a!.ownerName).toBe(h.ownerName("owner"));
      expect(b!.ownerName).toBe(h.ownerName("other"));
      expect(b!.listing.title).toBe("Segunda");
      expect(b!.listing.photos).toHaveLength(7);
      expect(b!.listing.photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(b!.listing.reviewedAt).toBeNull();
      expect(q.changes[0]!.listing.reviewNote).toBe("Faltan fotos del baño.");
    });

    it("una casa corregida tras cambios pedidos vuelve a la cola con su fecha de revisión anterior", async () => {
      const s = await h.seed({ status: "changes" });
      await h.owner("owner").submit(s.id);
      const q = await h.admin("aal2").queue();
      expect(q.review.map((i) => i.listing.id)).toEqual([s.id]);
      expect(q.review[0]!.listing.reviewedAt).not.toBeNull();
      expect(q.changes).toEqual([]);
    });

    it("get devuelve una casa en cualquier estado con su propietario; null si no existe", async () => {
      const s = await h.seed({ status: "active", as: "other" });
      const item = await h.admin("aal2").get(s.id);
      expect(item?.listing.publicId).toBe(s.publicId);
      expect(item?.listing.status).toBe("active");
      expect(item?.ownerName).toBe(h.ownerName("other"));
      expect(await h.admin("aal2").get("00000000-0000-4000-8000-999999999999")).toBeNull();
      expect(await h.admin("aal2").get("no-es-un-id")).toBeNull();
    });

    it("aprobar publica la casa: sale de la cola, la ve el público y cuenta como activa", async () => {
      const s = await h.seed({ status: "review" });
      await h.admin("aal2").review(s.id, "approve", "");
      const q = await h.admin("aal2").queue();
      expect(q.review).toEqual([]);
      expect(q.active).toBe(1);
      expect((await h.anon.getPublic(s.publicId))?.id).toBe(s.id);
      expect(await h.anon.linkState(s.publicId)).toBe("active");
      const own = await h.owner("owner").getOwn(s.id);
      expect(own?.status).toBe("active");
      expect(own?.reviewNote).toBeNull();
      expect(own?.reviewedAt).not.toBeNull();
    });

    it("pedir cambios y rechazar guardan el motivo, que el propietario ve", async () => {
      const a = await h.seed({ status: "review" });
      const b = await h.seed({ status: "review" });
      await h.admin("aal2").review(a.id, "changes", "  Falta una foto de la cocina.  ");
      await h.admin("aal2").review(b.id, "reject", "No es un alojamiento.");
      const q = await h.admin("aal2").queue();
      expect(q.review).toEqual([]);
      expect(q.changes.map((i) => [i.listing.id, i.listing.reviewNote])).toEqual([[a.id, "Falta una foto de la cocina."]]);
      expect(q.rejected.map((i) => [i.listing.id, i.listing.reviewNote])).toEqual([[b.id, "No es un alojamiento."]]);
      expect((await h.owner("owner").getOwn(a.id))?.reviewNote).toBe("Falta una foto de la cocina.");
      expect(await h.anon.getPublic(a.publicId)).toBeNull();
    });

    it("validación: motivo obligatorio, como mucho 2000 caracteres, ya decidida, menos de 5 fotos, inexistente", async () => {
      const s = await h.seed({ status: "review" });
      const admin = h.admin("aal2");
      expect((await rejection(admin.review(s.id, "changes", "   "))).message).toBe(REVIEW_MESSAGES.noteRequired);
      expect((await rejection(admin.review(s.id, "reject", ""))).message).toBe(REVIEW_MESSAGES.noteRequired);
      expect((await rejection(admin.review(s.id, "reject", "x".repeat(2001)))).message).toBe(REVIEW_MESSAGES.noteTooLong);
      await admin.review(s.id, "changes", "x".repeat(2000));
      expect((await admin.get(s.id))?.listing.reviewNote).toHaveLength(2000);
      expect((await rejection(admin.review(s.id, "approve", ""))).message).toBe(REVIEW_MESSAGES.decided);

      const few = await h.seed({ status: "review" });
      for (let i = 0; i < 5; i++) await h.dropPhoto(few.id);
      expect((await rejection(admin.review(few.id, "approve", ""))).message).toBe(REVIEW_MESSAGES.fewPhotos);
      expect((await admin.get(few.id))?.listing.status).toBe("review");
      await admin.review(few.id, "changes", "Suba al menos una foto.");

      expect((await rejection(admin.review("00000000-0000-4000-8000-999999999999", "approve", ""))).message).toBe(REVIEW_MESSAGES.notFound);
    });

    it("quien no es admin no obtiene nada, ni siquiera sus propias casas en revisión", async () => {
      const mine = await h.seed({ status: "review" });
      const user = h.admin("owner");
      expect(await user.queue()).toEqual({ review: [], changes: [], rejected: [], active: 0 });
      expect(await user.get(mine.id)).toBeNull();
      expect((await rejection(user.review(mine.id, "approve", ""))).message).toBe(REVIEW_MESSAGES.adminOnly);
      expect((await h.owner("owner").getOwn(mine.id))?.status).toBe("review");
    });

    it("un admin sin el segundo código (aal1) es rechazado en la cola, el detalle y la decisión", async () => {
      const s = await h.seed({ status: "review" });
      const admin = h.admin("aal1");
      expect((await rejection(admin.queue())).message).toBe(REVIEW_MESSAGES.mfaRequired);
      expect((await rejection(admin.get(s.id))).message).toBe(REVIEW_MESSAGES.mfaRequired);
      const refused = await rejection(admin.review(s.id, "approve", ""));
      expect(refused.message).toBe(REVIEW_MESSAGES.mfaRequired);
      expect(refused.kind).toBe("forbidden");
      expect((await h.admin("aal2").get(s.id))?.listing.status).toBe("review");
    });
  });
}
