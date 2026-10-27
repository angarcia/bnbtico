// Contrato de la zona del propietario: leer las casas propias, disponibilidad, reabrir para editar y descartar.
// Mismas reglas y mensajes en el fake y en la base (RLS, trigger listings_protect, política listings_owner_delete,
// RPC set_listing_available).
import { beforeAll, describe, expect, it } from "vitest";
import type { OwnerListingsApi } from "../../src/domain/api";
import { DomainError } from "../../src/domain/errors";
import type { ListingsHarness, SeedStatus, Seeded } from "./harness";

const NOT_FOUND = "No encontramos ese anuncio.";
const ONLY_ACTIVE = "Solo puede cambiar la disponibilidad de una casa activa.";
const ONLY_BNBTICO = "Solo bnbtico puede cambiar el estado de un anuncio.";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

export function ownerListingsContract(name: string, makeHarness: () => Promise<ListingsHarness>) {
  describe(`zona del propietario · ${name}`, () => {
    let h: ListingsHarness;
    let me: OwnerListingsApi;
    let other: OwnerListingsApi;

    describe("lectura", () => {
      const mine = {} as Record<SeedStatus, Seeded>;
      let theirs: Seeded;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        other = h.owner("other");
        await h.reset();
        for (const status of ["draft", "review", "changes", "rejected", "active", "reopened"] as const) {
          mine[status] = await h.seed({ status, photos: status === "draft" ? 0 : 6, draft: { title: `Casa ${status}` } });
        }
        theirs = await h.seed({ status: "active", as: "other", draft: { title: "Casa de Ana" } });
      }, 90_000);

      it("listOwn trae mis casas en cualquier estado, la más reciente primero, y ninguna ajena", async () => {
        const list = await me.listOwn();
        expect(list.map((l) => l.title)).toEqual(["Casa reopened", "Casa active", "Casa rejected", "Casa changes", "Casa review", "Casa draft"]);
        expect(list.map((l) => l.status)).toEqual(["draft", "active", "rejected", "changes", "review", "draft"]);
        expect((await other.listOwn()).map((l) => l.publicId)).toEqual([theirs.publicId]);
      });

      it("cada casa trae estado, nota del admin, fecha de revisión, WhatsApp y fotos en orden", async () => {
        const list = await me.listOwn();
        const by = (title: string) => list.find((l) => l.title === title)!;
        expect(by("Casa changes")).toMatchObject({ status: "changes", reviewNote: "Faltan fotos del baño.", available: true, whatsappPhone: "+50687770001" });
        expect(by("Casa changes").reviewedAt).not.toBeNull();
        expect(by("Casa rejected").reviewNote).toBe("Faltan fotos del baño.");
        expect(by("Casa active")).toMatchObject({ reviewNote: null, publicId: mine.active.publicId, photoCount: 6 });
        expect(by("Casa active").photos.map((p) => p.path)).toEqual(mine.active.photoPaths);
        expect(by("Casa draft")).toMatchObject({ reviewedAt: null, photoCount: 0, photos: [] });
        expect(by("Casa reopened").reviewedAt).not.toBeNull();
        // Revisión UX A5: «estuvo publicada alguna vez» = primera aprobación; pedir cambios o rechazar no cuenta.
        expect(by("Casa active").firstPublishedAt).not.toBeNull();
        expect(by("Casa reopened").firstPublishedAt).not.toBeNull();
        for (const t of ["Casa changes", "Casa rejected", "Casa review", "Casa draft"]) expect(by(t).firstPublishedAt, t).toBeNull();
      });

      it("getOwn devuelve mi casa con todo y null para una ajena, inexistente o con id raro", async () => {
        const l = await me.getOwn(mine.active.id);
        expect(l).toMatchObject({ id: mine.active.id, publicId: mine.active.publicId, status: "active", title: "Casa active", province: "Limón", zone: "Cahuita", nightlyPriceCrc: 42000 });
        expect(l!.photos.map((p) => p.path)).toEqual(mine.active.photoPaths);
        expect(await me.getOwn(theirs.id)).toBeNull();
        expect(await me.getOwn("00000000-0000-4000-8000-999999999999")).toBeNull();
        expect(await me.getOwn("no-es-un-id")).toBeNull();
      });
    });

    describe("disponible para consultas", () => {
      let active: Seeded;
      let theirs: Seeded;
      const others = {} as Record<"draft" | "review" | "changes", Seeded>;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
        active = await h.seed({ status: "active" });
        for (const status of ["draft", "review", "changes"] as const) others[status] = await h.seed({ status });
        theirs = await h.seed({ status: "active", as: "other" });
      }, 90_000);

      it("apagar y encender en una casa activa: lo ven el dueño y el público", async () => {
        await me.setAvailable(active.id, false);
        expect((await me.getOwn(active.id))?.available).toBe(false);
        expect((await h.anon.getPublic(active.publicId))?.available).toBe(false);
        await me.setAvailable(active.id, true);
        expect((await me.getOwn(active.id))?.available).toBe(true);
        expect((await h.anon.getPublic(active.publicId))?.available).toBe(true);
      });

      it("fuera de activa o en una casa ajena, la base lo rechaza con su mensaje", async () => {
        for (const s of Object.values(others)) expect((await rejection(me.setAvailable(s.id, false))).message).toBe(ONLY_ACTIVE);
        expect((await rejection(me.setAvailable(theirs.id, false))).message).toBe(ONLY_ACTIVE);
        expect((await h.anon.getPublic(theirs.publicId))?.available).toBe(true);
      });
    });

    describe("reabrir para editar", () => {
      const s = {} as Record<"active" | "changes" | "rejected" | "review" | "draft", Seeded>;
      let theirs: Seeded;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
        for (const status of ["active", "changes", "rejected", "review", "draft"] as const) s[status] = await h.seed({ status });
        theirs = await h.seed({ status: "active", as: "other" });
      }, 90_000);

      it("una casa activa vuelve a borrador, conserva su revisión y su enlace queda bloqueado", async () => {
        await me.reopenForEdit(s.active.id);
        const l = await me.getOwn(s.active.id);
        expect(l).toMatchObject({ status: "draft", publicId: s.active.publicId });
        expect(l!.reviewedAt).not.toBeNull();
        expect(await h.anon.getPublic(s.active.publicId)).toBeNull();
        expect(await h.anon.linkState(s.active.publicId)).toBe("blocked");
      });

      it("con cambios pedidos o rechazada también vuelve a borrador, con la nota del admin", async () => {
        for (const x of [s.changes, s.rejected]) {
          await me.reopenForEdit(x.id);
          expect(await me.getOwn(x.id)).toMatchObject({ status: "draft", reviewNote: "Faltan fotos del baño." });
        }
      });

      it("en revisión no se puede: solo bnbtico cambia ese estado", async () => {
        expect((await rejection(me.reopenForEdit(s.review.id))).message).toBe(ONLY_BNBTICO);
        expect((await me.getOwn(s.review.id))?.status).toBe("review");
      });

      it("un borrador ya está abierto: no cambia nada", async () => {
        await me.reopenForEdit(s.draft.id);
        expect((await me.getOwn(s.draft.id))?.status).toBe("draft");
      });

      it("una casa ajena no existe para mí y sigue publicada", async () => {
        expect((await rejection(me.reopenForEdit(theirs.id))).message).toBe(NOT_FOUND);
        expect(await h.anon.linkState(theirs.publicId)).toBe("active");
      });
    });

    describe("descartar un borrador", () => {
      const s = {} as Record<"draft" | "reopened" | "review" | "active", Seeded>;
      let theirs: Seeded;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
        s.draft = await h.seed({ status: "draft", photos: 2 });
        for (const status of ["reopened", "review", "active"] as const) s[status] = await h.seed({ status });
        theirs = await h.seed({ status: "draft", as: "other" });
      }, 90_000);

      it("un borrador que nunca se revisó desaparece, con su CT-####", async () => {
        await me.deleteDraft(s.draft.id);
        expect(await me.getOwn(s.draft.id)).toBeNull();
        expect((await me.listOwn()).map((l) => l.id)).not.toContain(s.draft.id);
        expect(await h.anon.linkState(s.draft.publicId)).toBeNull();
      });

      it("una casa que ya estuvo publicada no se descarta, y el mensaje dice por qué", async () => {
        expect((await rejection(me.deleteDraft(s.reopened.id))).message).toMatch(/ya estuvo publicada/);
        expect((await me.getOwn(s.reopened.id))?.status).toBe("draft");
      });

      it("fuera de borrador tampoco", async () => {
        for (const x of [s.review, s.active]) {
          expect((await rejection(me.deleteDraft(x.id))).message).toBe("Solo se pueden descartar borradores sin enviar.");
          expect(await me.getOwn(x.id)).not.toBeNull();
        }
      });

      it("el borrador de otro propietario no existe para mí y sigue ahí", async () => {
        expect((await rejection(me.deleteDraft(theirs.id))).message).toBe(NOT_FOUND);
        expect((await h.owner("other").getOwn(theirs.id))?.status).toBe("draft");
      });
    });
  });
}
