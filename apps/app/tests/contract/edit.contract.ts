// Contrato de la edición de una casa publicada (spec .scratch/editar-casa), parte del propietario: datos al momento
// (update_listing_live) y edición revisada (save_edit, submit_edit, discard_edit). Mismas reglas y mensajes en el fake y
// en la base; mientras la edición no se apruebe, la ficha pública sigue con la versión aprobada.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OwnerListingsApi, PhotoVariants } from "../../src/domain/api";
import { EDIT_MESSAGES, editSummary } from "../../src/domain/edit";
import { DomainError } from "../../src/domain/errors";
import { TITLE_LENGTH_ERROR } from "../../src/domain/listing";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import type { ListingsHarness } from "./harness";
import { PUERTO_VIEJO } from "./points";

const jpeg = (n: number) => new Blob([new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9])], { type: "image/jpeg" });
const variants = (): PhotoVariants => ({ 480: jpeg(1), 800: jpeg(2), 1600: jpeg(3) });
const UPLOAD_FAILED = "No pudimos subir esa foto. Intente de nuevo.";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

export function editContract(name: string, makeHarness: () => Promise<ListingsHarness>) {
  describe(`edición de una casa publicada · ${name}`, () => {
    let h: ListingsHarness;
    let me: OwnerListingsApi;
    let other: OwnerListingsApi;

    beforeAll(async () => {
      h = await makeHarness();
      me = h.owner("owner");
      other = h.owner("other");
    }, 90_000);
    beforeEach(() => h.reset());

    it("updateLive cambia el precio al momento: la ficha pública lo muestra y la casa sigue activa", async () => {
      const s = await h.seed({ status: "active" });
      await me.updateLive(s.id, { nightlyPriceCrc: 55000 });
      expect((await h.anon.getPublic(s.publicId))?.nightlyPriceCrc).toBe(55000);
      expect(await me.getOwn(s.id)).toMatchObject({ status: "active", nightlyPriceCrc: 55000, edit: null });
    });

    it("updateLive cambia capacidad y características con el tipo de parqueo, y el mensual", async () => {
      const s = await h.seed({ status: "active" });
      await me.updateLive(s.id, { capacity: 6, bedrooms: 3, bathrooms: 2, features: ["wifi", "parking"], parkingPaid: false });
      await me.updateLive(s.id, { acceptsMonthly: true, monthlyPriceCrc: null });
      expect(await me.getOwn(s.id)).toMatchObject({ capacity: 6, bedrooms: 3, bathrooms: 2, features: ["wifi", "parking"], parkingPaid: false, acceptsMonthly: true, monthlyPriceCrc: null, status: "active" });
    });

    it("updateLive rechaza un borrador y parqueo sin tipo, con los mensajes de la base", async () => {
      expect((await rejection(me.updateLive((await h.seed({ status: "draft" })).id, { capacity: 3 }))).message).toBe("Solo puede cambiar así una casa publicada.");
      expect((await rejection(me.updateLive((await h.seed({ status: "active" })).id, { features: ["parking"], parkingPaid: null }))).message).toBe("Indique si el parqueo es gratuito o de pago.");
    });

    it("saveEdit crea la edición; getOwn y listOwn la traen; la ficha pública no cambia", async () => {
      const s = await h.seed({ status: "active" });
      const e = await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
      expect(e).toMatchObject({ status: "open", title: "Casa Coco frente al mar", description: null, location: null, photos: [] });
      expect((await me.getOwn(s.id))?.edit?.title).toBe("Casa Coco frente al mar");
      expect((await me.listOwn()).find((l) => l.id === s.id)?.edit?.status).toBe("open");
      expect((await h.anon.getPublic(s.publicId))?.title).toBe("Cabina Cahuita");
    });

    it("saveEdit guarda la ubicación entera y el tipo con su baño", async () => {
      const s = await h.seed({ status: "active" });
      await me.saveEdit(s.id, { lat: PUERTO_VIEJO.lat, lng: PUERTO_VIEJO.lng, zone: "Puerto Viejo", zoneId: "704-puerto-viejo", zoneSource: "list" });
      const e = await me.saveEdit(s.id, { kind: "habitacion", bathroomShared: true });
      expect(e).toMatchObject({
        title: null,
        kind: "habitacion",
        bathroomShared: true,
        location: { lat: PUERTO_VIEJO.lat, lng: PUERTO_VIEJO.lng, zone: "Puerto Viejo", zoneId: "704-puerto-viejo", zoneSource: "list" },
      });
      expect((await me.getOwn(s.id))?.edit).toMatchObject({ kind: "habitacion", location: { zone: "Puerto Viejo" } });
      expect((await me.getOwn(s.id))?.zone).toBe("Cahuita");
    });

    it("saveEdit con el valor aprobado devuelve null y no deja edición", async () => {
      const s = await h.seed({ status: "active" });
      expect(await me.saveEdit(s.id, { title: "Cabina Cahuita" })).toBeNull();
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
      expect(await me.saveEdit(s.id, { title: "Cabina Cahuita" })).toBeNull();
      expect((await me.getOwn(s.id))?.edit).toBeNull();
    });

    it("submitEdit: vacía no; en revisión ya no se guarda; descartar la quita en cualquier estado", async () => {
      const s = await h.seed({ status: "active" });
      await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
      await me.submitEdit(s.id);
      expect((await me.getOwn(s.id))?.edit).toMatchObject({ status: "review" });
      expect((await me.getOwn(s.id))?.edit?.submittedAt).not.toBeNull();
      expect((await rejection(me.saveEdit(s.id, { title: "Otra Casa Coco" }))).message).toBe("Ya hay una edición en revisión. Espere la respuesta o descártela.");
      expect((await rejection(me.submitEdit(s.id))).message).toBe("Ya hay una edición en revisión. Espere la respuesta o descártela.");
      await me.discardEdit(s.id);
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      expect((await rejection(me.submitEdit(s.id))).message).toBe("No encontramos esa edición.");
      expect((await h.anon.getPublic(s.publicId))?.title).toBe("Cabina Cahuita");
    });

    it("submitEdit rechaza un nombre corto y una zona lejana", async () => {
      const s = await h.seed({ status: "active" });
      expect((await rejection(me.saveEdit(s.id, { title: "Casa" }))).message).toBe(TITLE_LENGTH_ERROR);
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      // Zona Cahuita con el pin en Puerto Viejo, a más de 5 km: se guarda, pero no se envía.
      await me.saveEdit(s.id, { lat: PUERTO_VIEJO.lat, lng: PUERTO_VIEJO.lng, zone: "Cahuita", zoneId: "704-cahuita", zoneSource: "list" });
      expect((await rejection(me.submitEdit(s.id))).message).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
      expect((await me.getOwn(s.id))?.edit?.status).toBe("open");
    });

    it("un nombre aprobado de más de 32 caracteres no impide enviar otro cambio; un nombre nuevo de 33 sí se rechaza", async () => {
      const s = await h.seed({ status: "active" });
      await h.setLegacyTitle(s.id, "Casa grande con vista al mar en Cahuita!");
      await me.saveEdit(s.id, { description: "Casa amplia ".repeat(9).trim() + " junto al mar." });
      await me.submitEdit(s.id);
      expect((await me.getOwn(s.id))?.edit?.status).toBe("review");
      await me.discardEdit(s.id);
      expect((await rejection(me.saveEdit(s.id, { title: "x".repeat(33) }))).message).toBe(TITLE_LENGTH_ERROR);
    });

    it("descartar sin edición no falla; en un borrador, sí", async () => {
      const s = await h.seed({ status: "active" });
      await me.discardEdit(s.id);
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      expect((await rejection(me.discardEdit((await h.seed({ status: "draft" })).id))).message).toBe("Solo puede cambiar así una casa publicada.");
    });

    it("una casa ajena no se edita", async () => {
      const mine = await h.seed({ status: "active" });
      expect((await rejection(other.saveEdit(mine.id, { title: "Casa Coco frente al mar" }))).message).toBe("No encontramos ese anuncio.");
      expect((await rejection(other.updateLive(mine.id, { capacity: 9 }))).message).toBe("No encontramos ese anuncio.");
      expect((await rejection(other.submitEdit(mine.id))).message).toBe("No encontramos ese anuncio.");
      expect((await rejection(other.discardEdit(mine.id))).message).toBe("No encontramos ese anuncio.");
      expect(await me.getOwn(mine.id)).toMatchObject({ capacity: 2, edit: null });
    });

    // ---------- Fotos nuevas de la edición ----------
    describe("fotos", () => {
      const ph = () => h.photos("owner");
      const names = async (id: string) => (await h.objects(id)).map((o) => o.name);

      it("una foto nueva se sube y registra en la edición; la ficha pública no la ve", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const folder = await ph().upload(s.id, variants());
        const p = await ph().addEditPhoto(s.id, folder);
        expect(p).toMatchObject({ path: folder, position: 0 });
        expect((await me.getOwn(s.id))?.edit?.photos.map((x) => x.path)).toEqual([folder]);
        expect((await h.anon.getPublic(s.publicId))?.photos).toHaveLength(5);
      });

      it("quitar la única foto nueva borra la edición y los tres objetos", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const folder = await ph().upload(s.id, variants());
        const p = await ph().addEditPhoto(s.id, folder);
        await ph().removeEditPhoto(p.id);
        expect((await me.getOwn(s.id))?.edit).toBeNull();
        expect((await names(s.id)).filter((n) => n.startsWith(folder))).toEqual([]);
      });

      it("quitar una de dos fotos nuevas recompacta y deja la edición", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const a = await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        const b = await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        await ph().removeEditPhoto(a.id);
        expect((await me.getOwn(s.id))?.edit?.photos.map((x) => [x.id, x.position])).toEqual([[b.id, 0]]);
      });

      it("reordenar las fotos nuevas es al momento y exige el conjunto completo", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const a = await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        const b = await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        await ph().reorderEditPhotos(s.id, [b.id, a.id]);
        expect((await me.getOwn(s.id))?.edit?.photos.map((x) => x.id)).toEqual([b.id, a.id]);
        expect((await rejection(ph().reorderEditPhotos(s.id, [a.id]))).message).toBe("La lista de fotos cambió. Vuelva a intentarlo.");
      });

      it("descartar con dos fotos nuevas borra sus objetos y deja los de las aprobadas", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const before = await names(s.id);
        const f1 = await ph().upload(s.id, variants());
        const f2 = await ph().upload(s.id, variants());
        await ph().addEditPhoto(s.id, f1);
        await ph().addEditPhoto(s.id, f2);
        expect((await names(s.id)).filter((n) => n.startsWith(f1) || n.startsWith(f2))).toHaveLength(6);
        await me.discardEdit(s.id);
        const after = await names(s.id);
        expect(after.filter((n) => n.startsWith(f1) || n.startsWith(f2))).toEqual([]);
        expect(after).toEqual(before);
        expect((await me.getOwn(s.id))?.edit).toBeNull();
      });

      it("en una casa publicada se ordena y se quita al momento, pero no la última foto ni con add", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const all = (await me.getOwn(s.id))!.photos.map((p) => p.id);
        for (const id of all.slice(2)) await ph().remove(id); // publicada: quitar hasta que quede una foto es válido
        const ids = all.slice(0, 2);
        const kept = (await me.getOwn(s.id))!.photos.map((p) => p.path);
        await ph().reorder(s.id, [...ids].reverse());
        expect((await h.anon.getPublic(s.publicId))?.photos.map((p) => p.path)).toEqual([...kept].reverse());
        await ph().remove(ids[0]!);
        expect((await rejection(ph().remove(ids[1]!))).message).toBe("Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.");
        expect((await rejection(ph().add(s.id, await ph().upload(s.id, variants())))).message).toBe("Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.");
      });

      it("con la edición en revisión no se suben ni registran fotos nuevas", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const folder = await ph().upload(s.id, variants());
        await ph().addEditPhoto(s.id, folder);
        await me.submitEdit(s.id);
        expect((await rejection(ph().upload(s.id, variants()))).message).toBe(UPLOAD_FAILED);
        expect((await rejection(ph().addEditPhoto(s.id, `${s.id}/${crypto.randomUUID()}`))).message).toBe("Ya hay una edición en revisión. Espere la respuesta o descártela.");
      });

      it("aprobadas + nuevas no pasan de 15", async () => {
        const s = await h.seed({ status: "active", photos: 14 });
        await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        expect((await rejection(ph().addEditPhoto(s.id, await ph().upload(s.id, variants())))).message).toBe("Máximo 15 fotos.");
      });

      it("una carpeta ya usada o ajena no se registra", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const folder = await ph().upload(s.id, variants());
        await ph().addEditPhoto(s.id, folder);
        expect((await rejection(ph().addEditPhoto(s.id, folder))).message).toBe("Ruta de foto no válida.");
        expect((await rejection(ph().addEditPhoto(s.id, s.photoPaths[0]!))).message).toBe("Ruta de foto no válida.");
      });

      it("un intruso no registra, quita ni ordena fotos nuevas de una casa ajena", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const p = await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        const intruder = h.photos("other");
        expect((await rejection(intruder.addEditPhoto(s.id, `${s.id}/${crypto.randomUUID()}`))).message).toBe("No encontramos ese anuncio.");
        expect((await rejection(intruder.removeEditPhoto(p.id))).message).toBe("No encontramos esa foto.");
        expect((await rejection(intruder.reorderEditPhotos(s.id, [p.id]))).message).toBe("No encontramos ese anuncio.");
      });

      it("addEditPhoto en un borrador falla", async () => {
        const s = await h.seed({ status: "draft" });
        expect((await rejection(ph().addEditPhoto(s.id, `${s.id}/${crypto.randomUUID()}`))).message).toBe("Solo puede cambiar así una casa publicada.");
      });
    });

    describe("revisión del admin", () => {
      const admin = () => h.admin("aal2");
      /** El envío que el admin ve al abrir la edición (submittedAt). */
      const seen = async (id: string) => (await admin().getEdit(id))?.listing.edit?.submittedAt ?? null;
      const submitted = async (title: string, edit: string) => {
        const s = await h.seed({ status: "active", photos: 5, draft: { title } });
        await me.saveEdit(s.id, { title: edit });
        await me.submitEdit(s.id);
        return s;
      };

      it("la cola de ediciones trae las enviadas, la que más espera primero, con su resumen", async () => {
        const a = await h.seed({ status: "active", draft: { title: "Casa A" } });
        const b = await h.seed({ status: "active", draft: { title: "Casa B" } });
        for (const s of [b, a]) {
          await me.saveEdit(s.id, { title: `${s === a ? "Casa A" : "Casa B"} renovada` });
          await me.submitEdit(s.id);
        }
        await me.saveEdit((await h.seed({ status: "active" })).id, { title: "Sin enviar todavía" });
        const q = await admin().editQueue();
        expect(q.map((i) => i.listing.title)).toEqual(["Casa B", "Casa A"]);
        expect(editSummary(q[0]!.listing.edit!)).toBe("nombre");
        expect(q[0]!.ownerName).toBe(h.ownerName("owner"));
      });

      it("getEdit trae la casa con su edición y las fotos nuevas; null si no hay edición", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        expect(await admin().getEdit(s.id)).toBeNull();
        await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
        await h.photos("owner").addEditPhoto(s.id, await h.photos("owner").upload(s.id, variants()));
        await me.submitEdit(s.id);
        const item = await admin().getEdit(s.id);
        expect(item?.listing).toMatchObject({ title: "Cabina Cahuita", photoCount: 5, edit: { status: "review", title: "Casa Coco frente al mar" } });
        expect(item?.listing.edit?.photos).toHaveLength(1);
      });

      it("aprobar aplica la edición: la ficha pública cambia y la edición desaparece", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
        await h.photos("owner").addEditPhoto(s.id, await h.photos("owner").upload(s.id, variants()));
        await me.submitEdit(s.id);
        await admin().reviewEdit(s.id, "approve", "", await seen(s.id));
        const pub = await h.anon.getPublic(s.publicId);
        expect(pub?.title).toBe("Casa Coco frente al mar");
        expect(pub?.photos).toHaveLength(6);
        expect(await me.getOwn(s.id)).toMatchObject({ status: "active", title: "Casa Coco frente al mar", edit: null });
        expect(await admin().editQueue()).toEqual([]);
        expect(await admin().getEdit(s.id)).toBeNull();
      });

      it("pedir cambios guarda la nota; el propietario la ve y reenvía", async () => {
        const s = await submitted("Casa A", "Casa A renovada");
        await admin().reviewEdit(s.id, "changes", "  La foto 2 tiene un teléfono.  ", await seen(s.id));
        expect((await me.getOwn(s.id))?.edit).toMatchObject({ status: "changes", reviewNote: "La foto 2 tiene un teléfono." });
        expect(await admin().editQueue()).toEqual([]);
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa A");
        await me.saveEdit(s.id, { title: "Casa A renovada del todo" });
        await me.submitEdit(s.id);
        expect((await me.getOwn(s.id))?.edit).toMatchObject({ status: "review", reviewNote: null });
        expect((await admin().editQueue()).map((i) => i.listing.id)).toEqual([s.id]);
      });

      it("una edición descartada o reenviada después de abrirla no se decide", async () => {
        const s = await submitted("Casa A", "Casa A renovada");
        const at = await seen(s.id);
        await me.discardEdit(s.id);
        expect((await rejection(admin().reviewEdit(s.id, "approve", "", at))).message).toBe(EDIT_MESSAGES.changed);
        await new Promise((r) => setTimeout(r, 5)); // otro envío, otro instante (el reloj del fake va en milisegundos)
        await me.saveEdit(s.id, { title: "Casa B sin ver" });
        await me.submitEdit(s.id);
        expect((await rejection(admin().reviewEdit(s.id, "approve", "", at))).message).toBe(EDIT_MESSAGES.changed);
        expect((await rejection(admin().reviewEdit(s.id, "changes", "No.", at))).message).toBe(EDIT_MESSAGES.changed);
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa A");
        expect((await me.getOwn(s.id))?.edit).toMatchObject({ status: "review", title: "Casa B sin ver", reviewNote: null });
        await admin().reviewEdit(s.id, "approve", "", await seen(s.id));
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa B sin ver");
      });

      it("validación y acceso: nota obligatoria, ya decidida, no admin y aal1", async () => {
        const s = await submitted("Casa A", "Casa A renovada");
        const at = await seen(s.id);
        expect((await rejection(admin().reviewEdit(s.id, "changes", "", at))).message).toBe(EDIT_MESSAGES.noteRequired);
        await admin().reviewEdit(s.id, "changes", "Falta algo.", at);
        expect((await rejection(admin().reviewEdit(s.id, "approve", "", at))).message).toBe(EDIT_MESSAGES.decided);
        expect((await rejection(admin().reviewEdit("00000000-0000-4000-8000-999999999999", "approve", "", null))).message).toBe(EDIT_MESSAGES.notFound);
        await me.submitEdit(s.id);
        const owner = h.admin("owner");
        expect(await owner.editQueue()).toEqual([]);
        expect(await owner.getEdit(s.id)).toBeNull();
        expect((await rejection(owner.reviewEdit(s.id, "approve", "", at))).message).toBe(REVIEW_MESSAGES.adminOnly);
        const aal1 = h.admin("aal1");
        for (const call of [() => aal1.editQueue(), () => aal1.getEdit(s.id), () => aal1.reviewEdit(s.id, "approve", "", at)]) {
          expect((await rejection(call())).message).toBe(REVIEW_MESSAGES.mfaRequired);
        }
        expect((await me.getOwn(s.id))?.edit?.status).toBe("review");
      });
    });
  });
}
