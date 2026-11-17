// Contrato de «Eliminar casa» del anfitrión (historia 28): borrado lógico de una casa propia, autorizado en la base (RPC
// delete_own_listing). Lo que ve el propio anfitrión, el público y el admin, en qué estados vale, quién no puede y qué pasa
// al repetirlo. Mismas reglas y mensajes en el fake y en la base.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OWNER_DELETE_MESSAGES as M } from "../../src/domain/owner-delete";
import { costaRicaToday } from "../../src/domain/inquiry";
import { DomainError } from "../../src/domain/errors";
import { parseFilters } from "../../src/domain/filters";
import { PROVINCES } from "../../src/domain/listing";
import type { SubscriptionHarness } from "./harness";

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
const ALL = parseFilters({ prov: "Todas" }, PROVINCES);

export function ownerDeleteContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`anfitrión · eliminar casa · ${name}`, () => {
    let h: SubscriptionHarness;
    const me = () => h.owner("owner");
    const publicIds = async () => (await h.anon.searchPublic(ALL)).map((l) => l.publicId);

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
    });

    it("desaparece de Mis casas, Explorar, favoritos y su enlace; no admite consultas; las demás casas siguen", async () => {
      const s = await h.seed({ status: "active", draft: { title: "Casa a eliminar" } });
      const keep = await h.seed({ status: "active", draft: { title: "Se queda" } });
      await h.favorites("other").add(s.publicId);
      await h.inquiries("other").create(s.publicId, { arrival: null, departure: null, people: null });

      await me().deleteOwn(s.id);

      expect((await me().listOwn()).map((l) => l.id)).toEqual([keep.id]);
      expect(await me().getOwn(s.id)).toBeNull();
      expect((await h.billing("owner").overview()).houses.map((x) => x.listingId)).toEqual([keep.id]);
      expect(await h.inquiries("owner").listForOwner()).toEqual([]);
      expect(await h.anon.getPublic(s.publicId)).toBeNull();
      expect(await h.anon.linkState(s.publicId)).toBeNull();
      expect(await publicIds()).toEqual([keep.publicId]);
      expect(await h.favorites("other").list()).toEqual([]);
      expect((await rejection(h.inquiries("other").create(s.publicId, { arrival: null, departure: null, people: null }))).message).toBeTruthy();
      expect(await h.admin("aal2").get(s.id)).toBeNull();
      // No es una acción del admin: el registro de la casa queda en la propia fila (deleted_by), no en admin_actions.
      expect(await h.adminActions(s.id)).toEqual([]);
    });

    it("vale con cambios pedidos, pendiente de pago, inactiva, pausada por 3bstays y un borrador ya revisado", async () => {
      const changes = await h.seed({ status: "changes" });
      const reopened = await h.seed({ status: "reopened" });
      const due = await h.seed({ status: "active" });
      const stopped = await h.seed({ status: "active" });
      const paused = await h.seed({ status: "active" });
      await h.setDaysLeft(due.id, -1);
      await h.service.runDay(today());
      await h.billing("owner").stop(stopped.id);
      await h.admin("aal2").pauseListing(paused.id, "Confirme las fotos.");
      const statuses = new Map((await me().listOwn()).map((l) => [l.id, l.status]));
      expect([changes, reopened, due, stopped].map((s) => statuses.get(s.id))).toEqual(["changes", "draft", "payment_due", "inactive"]);

      for (const s of [changes, reopened, due, stopped, paused]) await me().deleteOwn(s.id);
      expect(await me().listOwn()).toEqual([]);
    });

    it("no vale en revisión, bloqueada ni en un borrador sin revisar (se descarta); la casa no cambia", async () => {
      const review = await h.seed({ status: "review" });
      const draft = await h.seed({ status: "draft" });
      const blocked = await h.seed({ status: "active" });
      await h.admin("aal2").blockListing(blocked.id, "Fotos de otra casa.");

      expect((await rejection(me().deleteOwn(review.id))).message).toBe(M.inReview);
      expect((await rejection(me().deleteOwn(draft.id))).message).toBe(M.draft);
      expect((await rejection(me().deleteOwn(blocked.id))).message).toBe(M.blocked);
      const left = new Map((await me().listOwn()).map((l) => [l.id, l.status]));
      expect([review, draft, blocked].map((s) => left.get(s.id))).toEqual(["review", "draft", "active"]);
      expect((await h.admin("aal2").queue()).review.map((i) => i.listing.id)).toEqual([review.id]);
    });

    it("otro anfitrión o un id que no existe no eliminan nada (sin sesión: prueba de base)", async () => {
      const s = await h.seed({ status: "active" });
      const other = await rejection(h.owner("other").deleteOwn(s.id));
      expect(other.message).toBe(M.notFound);
      expect(other.kind).toBe("not_found");
      expect((await rejection(me().deleteOwn("00000000-0000-4000-8000-00000000ffff"))).kind).toBe("not_found");
      expect((await rejection(me().deleteOwn("no-es-un-id"))).kind).toBe("not_found");
      expect(await me().getOwn(s.id)).not.toBeNull();
      expect(await h.anon.getPublic(s.publicId)).not.toBeNull();
    });

    it("repetirla da «No encontramos ese anuncio.» sin efectos nuevos, y quita los avisos pendientes de la suscripción", async () => {
      const s = await h.seed({ status: "active" });
      await h.setDaysLeft(s.id, 20);
      await h.service.runDay(today());
      expect(await h.reminders(s.id)).toHaveLength(1);

      await me().deleteOwn(s.id);
      const again = await rejection(me().deleteOwn(s.id));
      expect(again.message).toBe(M.notFound);
      expect(again.kind).toBe("not_found");
      expect(await h.service.claimReminders(20)).toEqual([]);
      await h.service.runDay(today());
      expect(await h.service.claimReminders(20)).toEqual([]);
    });
  });
}
