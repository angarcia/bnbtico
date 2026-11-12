// Contrato de la edición del admin (ronda de Ana del 2 nov, ticket 10, versión simple): Ana edita cualquier dato de
// cualquier casa salvo las eliminadas, al momento y sin revisión, con las reglas del anfitrión; fotos y calendario de una
// casa ajena; envía a revisión el borrador de otro; si edita un dato que el anfitrión tenía pendiente, manda lo suyo y ese
// pendiente se descarta. Una línea en admin_actions por guardado. Mismas reglas y mensajes en el fake y en la base
// (RPCs admin_update_listing, admin_submit_listing, admin_add/remove/reorder_listing_photo(s), admin_save_listing_days).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PhotoVariants } from "../../src/domain/api";
import { addDays, CALENDAR_MESSAGES } from "../../src/domain/calendar";
import { EDIT_MESSAGES } from "../../src/domain/edit";
import { DomainError } from "../../src/domain/errors";
import { costaRicaToday } from "../../src/domain/inquiry";
import { NIGHTLY_PRICE_ERROR, TITLE_EMPTY_ERROR, TITLE_LENGTH_ERROR } from "../../src/domain/listing-rules";
import { emptyDraft } from "../../src/domain/listing";
import { validateStep } from "../../src/domain/listing-rules";
import { PHOTO_REQUIRED_ERROR } from "../../src/domain/publish-rules";
import { REVIEW_MESSAGES as M } from "../../src/domain/review";
import type { SubscriptionHarness } from "./harness";

const jpeg = (n: number) => new Blob([new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9])], { type: "image/jpeg" });
const variants = (): PhotoVariants => ({ 480: jpeg(1), 800: jpeg(2), 1600: jpeg(3) });
const today = () => costaRicaToday(Date.now());

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

export function adminEditaContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`admin · editar casas · ${name}`, () => {
    let h: SubscriptionHarness;
    const ana = () => h.adminEdit("aal2");
    const edits = async (id: string) => (await h.adminActions(id)).filter((a) => a.action === "listing.edit" || a.action === "listing.submit").map((a) => a.action);

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);
    beforeEach(async () => {
      await h.reset();
    }, 60_000);

    describe("quién puede", () => {
      it("el anfitrión, otro usuario y el admin sin el segundo código no leen ni escriben nada", async () => {
        const s = await h.seed({ status: "active" });
        const draft = await h.seed({ status: "draft", as: "other" });
        for (const who of ["owner", "other"] as const) {
          const api = h.adminEdit(who);
          expect(await api.get(draft.id)).toBeNull();
          expect(await api.drafts()).toEqual([]);
          expect(await api.days(s.id)).toEqual([]);
          expect((await rejection(api.updateLive(s.id, { nightlyPriceCrc: 1000 }))).message).toBe(M.adminOnly);
          expect((await rejection(api.saveEdit(s.id, { title: "Casa del dueño" }))).message).toBe(M.adminOnly);
          expect((await rejection(api.saveStep(draft.id, 6, { title: "Casa ajena", description: "" }))).message).toBe(M.adminOnly);
          expect((await rejection(api.submit(draft.id))).message).toBe(M.adminOnly);
          expect((await rejection(api.saveDays(s.id, { days: [addDays(today(), 3)], available: false }))).message).toBe(M.adminOnly);
        }
        const aal1 = h.adminEdit("aal1");
        for (const attempt of [() => aal1.get(s.id), () => aal1.drafts(), () => aal1.updateLive(s.id, { nightlyPriceCrc: 1000 }), () => aal1.saveEdit(s.id, { title: "Casa del admin" })]) {
          const e = await rejection(attempt());
          expect(e.message).toBe(M.mfaRequired);
          expect(e.kind).toBe("forbidden");
        }
        expect((await h.anon.getPublic(s.publicId))?.nightlyPriceCrc).toBe(42000);
        expect(await edits(s.id)).toEqual([]);
      });

      it("una casa eliminada no se edita", async () => {
        const s = await h.seed({ status: "active" });
        await h.admin("aal2").deleteListing(s.id, "Casa duplicada.", s.publicId);
        expect(await ana().get(s.id)).toBeNull();
        expect((await rejection(ana().updateLive(s.id, { nightlyPriceCrc: 50000 }))).message).toBe(M.notFound);
        expect((await rejection(ana().saveEdit(s.id, { title: "Casa borrada" }))).message).toBe(M.notFound);
        expect((await rejection(ana().saveDays(s.id, { days: [addDays(today(), 3)], available: false }))).message).toBe(M.notFound);
      });
    });

    describe("asistir un borrador ajeno", () => {
      it("la lista de borradores trae los de todos, sin enviar, con su anfitrión; la casa se lee en cualquier estado", async () => {
        const mine = await h.seed({ status: "draft", draft: { title: "Borrador uno" } });
        const theirs = await h.seed({ status: "draft", as: "other", draft: { title: "Borrador dos" } });
        await h.seed({ status: "review", draft: { title: "En revisión" } });
        await h.seed({ status: "active", draft: { title: "Publicada" } });
        const drafts = await ana().drafts();
        expect(drafts.map((d) => d.listing.title).sort()).toEqual(["Borrador dos", "Borrador uno"]);
        expect(drafts.find((d) => d.listing.id === theirs.id)?.ownerName).toBe(h.ownerName("other"));
        expect((await ana().get(mine.id))?.title).toBe("Borrador uno");
      });

      it("guarda una pantalla con las reglas del asistente; el anfitrión lo ve y queda una línea en el registro", async () => {
        const s = await h.seed({ status: "draft", draft: { title: "", description: "" } });
        // Lo mismo que «Continuar» del anfitrión: el paso 1 exige el tipo; los demás avanzan siempre (planStep).
        expect((await rejection(ana().saveStep(s.id, 1, { kind: null }))).message).toBe(validateStep(1, { ...emptyDraft(), kind: null })!);
        const saved = await ana().saveStep(s.id, 6, { title: "Cabina asistida", description: "" });
        expect(saved.title).toBe("Cabina asistida");
        expect((await h.owner("owner").getOwn(s.id))?.title).toBe("Cabina asistida");
        expect(await edits(s.id)).toEqual(["listing.edit"]);
      });

      it("sube una foto a la carpeta de la casa y la registra; envía a revisión con las reglas de submit_listing", async () => {
        const s = await h.seed({ status: "draft", photos: 0 });
        expect((await rejection(ana().submit(s.id))).message).toBe(PHOTO_REQUIRED_ERROR);
        const folder = await h.adminPhotos().upload(s.id, variants());
        const photo = await ana().addPhoto(s.id, folder);
        expect(photo).toMatchObject({ path: folder, position: 0 });
        expect((await h.owner("owner").getOwn(s.id))?.photoCount).toBe(1);
        await ana().submit(s.id);
        expect((await h.owner("owner").getOwn(s.id))?.status).toBe("review");
        expect((await h.admin("aal2").queue()).review.map((i) => i.listing.id)).toContain(s.id);
        expect(await edits(s.id)).toEqual(["listing.edit", "listing.submit"]);
      });

      it("quita y ordena las fotos de un borrador ajeno", async () => {
        const s = await h.seed({ status: "draft", photos: 0 });
        const a = await ana().addPhoto(s.id, await h.adminPhotos().upload(s.id, variants()));
        const b = await ana().addPhoto(s.id, await h.adminPhotos().upload(s.id, variants()));
        await ana().reorderPhotos(s.id, [b.id, a.id]);
        expect((await ana().get(s.id))?.photos.map((p) => p.id)).toEqual([b.id, a.id]);
        await ana().removePhoto(b.id);
        expect((await ana().get(s.id))?.photos.map((p) => p.id)).toEqual([a.id]);
        expect((await h.objects(s.id)).every((o) => !o.name.startsWith(b.path))).toBe(true);
      });
    });

    describe("una casa publicada", () => {
      it("el nombre y el precio se publican al momento, sin revisión, con las reglas de crear", async () => {
        const s = await h.seed({ status: "active" });
        await ana().updateLive(s.id, { nightlyPriceCrc: 58000 });
        expect((await rejection(ana().updateLive(s.id, { nightlyPriceCrc: 0 }))).message).toBe(NIGHTLY_PRICE_ERROR);
        expect(await ana().saveEdit(s.id, { title: "  Casa renombrada " })).toBeNull();
        expect((await rejection(ana().saveEdit(s.id, { title: "" }))).message).toBe(TITLE_EMPTY_ERROR);
        expect((await rejection(ana().saveEdit(s.id, { title: "Abc" }))).message).toBe(TITLE_LENGTH_ERROR);
        expect((await rejection(ana().saveEdit(s.id, { lat: 9.7 }))).message).toBe(EDIT_MESSAGES.notHere);
        const pub = await h.anon.getPublic(s.publicId);
        expect(pub).toMatchObject({ title: "Casa renombrada", nightlyPriceCrc: 58000 });
        const own = await h.owner("owner").getOwn(s.id);
        expect(own).toMatchObject({ status: "active", edit: null });
        expect(await edits(s.id)).toEqual(["listing.edit", "listing.edit"]);
      });

      it("si el anfitrión tenía ese dato en revisión, manda lo del admin y ese pendiente se descarta; lo demás sigue", async () => {
        const s = await h.seed({ status: "active" });
        await h.owner("owner").saveEdit(s.id, { title: "Nombre del anfitrión" });
        await h.owner("owner").saveEdit(s.id, { description: "" });
        await ana().saveEdit(s.id, { title: "Nombre de Ana" });
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Nombre de Ana");
        const own = await h.owner("owner").getOwn(s.id);
        expect(own?.title).toBe("Nombre de Ana");
        expect(own?.edit?.title).toBeNull();
        expect(Object.keys(own?.edit?.fields ?? {})).toEqual(["descripcion"]);
        expect((await h.admin("aal2").editQueue()).map((i) => i.listing.id)).toEqual([s.id]);
      });

      it("también una casa bloqueada (cualquier estado salvo eliminada)", async () => {
        const s = await h.seed({ status: "active" });
        await h.admin("aal2").blockListing(s.id, "Fotos de otra casa.");
        await ana().updateLive(s.id, { capacity: 6 });
        expect((await ana().get(s.id))?.capacity).toBe(6);
      });

      it("las fotos van directo a la ficha; nunca se queda sin ninguna", async () => {
        const s = await h.seed({ status: "active", photos: 1 });
        const added = await ana().addPhoto(s.id, await h.adminPhotos().upload(s.id, variants()));
        expect((await h.anon.getPublic(s.publicId))?.photos).toHaveLength(2);
        const first = (await ana().get(s.id))!.photos[0]!;
        await ana().reorderPhotos(s.id, [added.id, first.id]);
        expect((await ana().get(s.id))?.photos[0]?.id).toBe(added.id);
        await ana().removePhoto(first.id);
        expect((await rejection(ana().removePhoto(added.id))).message).toBe(EDIT_MESSAGES.lastPhoto);
        expect((await h.anon.getPublic(s.publicId))?.photos).toHaveLength(1);
      });

      it("el calendario de una casa ajena se guarda con las reglas de save_listing_days y el cliente lo ve", async () => {
        const s = await h.seed({ status: "active" });
        const day = addDays(today(), 5);
        expect((await rejection(ana().saveDays(s.id, { days: [addDays(today(), -1)], available: false }))).message).toBe(CALENDAR_MESSAGES.range);
        await ana().saveDays(s.id, { days: [day], available: false });
        expect(await ana().days(s.id)).toEqual([{ day, available: false, specialPriceCrc: null }]);
        expect(await h.anon.getPublicDays(s.publicId)).toEqual([{ day, available: false, specialPriceCrc: null }]);
        expect(await h.calendar("owner").days(s.id)).toEqual([{ day, available: false, specialPriceCrc: null }]);
        expect(await edits(s.id)).toEqual(["listing.edit"]);
      });
    });
  });
}
