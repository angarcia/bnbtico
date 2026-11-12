// Contrato de los favoritos de la cuenta: aislados por usuario, solo casas publicadas, quitar idempotente.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../../src/domain/errors";
import { INQUIRY_MESSAGES } from "../../src/domain/inquiry";
import type { Seeded, SubscriptionHarness } from "./harness";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

export function favoritesContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`favoritos · ${name}`, () => {
    let h: SubscriptionHarness;
    let a: Seeded;
    let b: Seeded;

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
      a = await h.seed({ status: "active", draft: { title: "Casa A" } });
      b = await h.seed({ status: "active", as: "other", draft: { title: "Casa B" } });
    }, 60_000);

    const ids = async (who: "owner" | "other") => (await h.favorites(who).list()).map((f) => f.publicId);

    it("sin sesión falla antes de la red", async () => {
      expect((await rejection(h.favorites("anon").list())).kind).toBe("session");
      expect((await rejection(h.favorites("anon").add(a.publicId))).kind).toBe("session");
    });

    it("añadir, listar (el más reciente primero, con fecha) y quitar; idempotentes", async () => {
      await h.favorites("other").add(a.publicId);
      await h.favorites("other").add(b.publicId);
      await h.favorites("other").add(a.publicId);
      const list = await h.favorites("other").list();
      expect(list.map((f) => f.publicId)).toEqual([b.publicId, a.publicId]);
      expect(Date.parse(list[0]!.savedAt)).not.toBeNaN();
      await h.favorites("other").remove(b.publicId);
      await h.favorites("other").remove(b.publicId);
      await h.favorites("other").remove("CT-999999");
      expect(await ids("other")).toEqual([a.publicId]);
    });

    it("cada usuario ve solo los suyos", async () => {
      await h.favorites("other").add(a.publicId);
      await h.favorites("owner").add(b.publicId);
      expect(await ids("other")).toEqual([a.publicId]);
      expect(await ids("owner")).toEqual([b.publicId]);
      await h.favorites("owner").remove(a.publicId);
      expect(await ids("other")).toEqual([a.publicId]);
    });

    it("no se guarda una casa que no está publicada (ni la propia en borrador)", async () => {
      const draft = await h.seed({ status: "draft", draft: { title: "Borrador" } });
      expect((await rejection(h.favorites("owner").add(draft.publicId))).message).toBe(INQUIRY_MESSAGES.notPublished);
      expect((await rejection(h.favorites("other").add("CT-999999"))).message).toBe(INQUIRY_MESSAGES.notPublished);
      expect(await ids("owner")).toEqual([]);
    });

    it("una casa que deja de estar publicada no vuelve en la lista", async () => {
      await h.favorites("other").add(a.publicId);
      await h.favorites("other").add(b.publicId);
      // Una casa publicada ya no vuelve a borrador: deja de estarlo al parar su suscripción.
      await h.billing("owner").stop(a.id);
      expect(await ids("other")).toEqual([b.publicId]);
    });

    it("addMany añade las publicadas, ignora el resto y no duplica", async () => {
      const draft = await h.seed({ status: "draft", draft: { title: "Borrador" } });
      await h.favorites("other").add(a.publicId);
      await h.favorites("other").addMany([a.publicId, b.publicId, draft.publicId, "CT-999999"]);
      expect((await ids("other")).sort()).toEqual([a.publicId, b.publicId].sort());
      await h.favorites("other").addMany([]);
    });
  });
}
