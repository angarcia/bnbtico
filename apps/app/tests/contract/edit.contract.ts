// Contrato de la edición de una casa publicada (spec .scratch/editar-casa; revisión por dato, revisión UX 2026-10-29, A5):
// datos al momento (update_listing_live) y datos con revisión, que van a revisión al guardarse (save_edit) y se descartan
// uno a uno (discard_edit_field); el admin decide cada dato y cada foto (review_edit_field, review_edit_photo). Mismas
// reglas y mensajes en el fake y en la base; mientras no se apruebe un dato, la ficha pública sigue con lo aprobado.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OwnerListingsApi, PhotoVariants } from "../../src/domain/api";
import { EDIT_MESSAGES, editSummary } from "../../src/domain/edit";
import { DomainError } from "../../src/domain/errors";
import { BATHROOMS_ERROR, BEDROOMS_ERROR, CAPACITY_ERROR, DESCRIPTION_LENGTH_ERROR, MONTHLY_PRICE_ERROR, NIGHTLY_PRICE_ERROR, PARKING_ERROR, TITLE_EMPTY_ERROR, TITLE_LENGTH_ERROR } from "../../src/domain/listing-rules";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import type { ListingsHarness } from "./harness";
import { PUERTO_VIEJO } from "./points";

const jpeg = (n: number) => new Blob([new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9])], { type: "image/jpeg" });
const variants = (): PhotoVariants => ({ 480: jpeg(1), 800: jpeg(2), 1600: jpeg(3) });

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

    it("updateLive en una Habitación: las habitaciones son siempre 1 (aunque se mande otro número)", async () => {
      const s = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true, bedrooms: null } });
      expect((await me.getOwn(s.id))?.bedrooms).toBe(1);
      await me.updateLive(s.id, { capacity: 3, bedrooms: 4 });
      expect(await me.getOwn(s.id)).toMatchObject({ capacity: 3, bedrooms: 1, status: "active" });
      expect((await h.anon.getPublic(s.publicId))?.bedrooms).toBe(1);
    });

    it("updateLive en una Habitación: el baño es siempre 1 (sin mandarlo, con null o con otra cifra)", async () => {
      const s = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: false, bathrooms: 2 } });
      expect((await me.getOwn(s.id))?.bathrooms).toBe(1);
      await me.updateLive(s.id, { capacity: 3 });
      await me.updateLive(s.id, { bathrooms: null });
      await me.updateLive(s.id, { bathrooms: 4 });
      expect(await me.getOwn(s.id)).toMatchObject({ capacity: 3, bedrooms: 1, bathrooms: 1, status: "active" });
      expect((await h.anon.getPublic(s.publicId))?.bathrooms).toBe(1);
    });

    it("updateLive rechaza un borrador y vaciar el tipo de parqueo de una casa que lo tenía, con los mensajes de la base", async () => {
      expect((await rejection(me.updateLive((await h.seed({ status: "draft" })).id, { capacity: 3 }))).message).toBe("Solo puede cambiar así una casa publicada.");
      const parked = await h.seed({ status: "active", draft: { features: ["wifi", "parking"], parkingPaid: true } });
      expect((await rejection(me.updateLive(parked.id, { parkingPaid: null }))).message).toBe(PARKING_ERROR);
      expect(await me.getOwn(parked.id)).toMatchObject({ features: ["wifi", "parking"], parkingPaid: true });
    });

    // ---- Editar sigue las reglas de crear (ronda de Ana del 2026-11-02, ticket 12): cada dato valida solo ese dato ----
    it("updateLive: una casa publicada sin baños (ni personas) cambia el precio", async () => {
      const s = await h.seed({ status: "active", draft: { bathrooms: null, capacity: null } });
      await me.updateLive(s.id, { nightlyPriceCrc: 55000 });
      expect(await me.getOwn(s.id)).toMatchObject({ nightlyPriceCrc: 55000, bathrooms: null, capacity: null, status: "active" });
    });

    it("updateLive: vaciar un dato que tenía valor falla; uno que estaba vacío se puede dejar vacío", async () => {
      const s = await h.seed({ status: "active", draft: { bathrooms: null } });
      expect((await rejection(me.updateLive(s.id, { capacity: null }))).message).toBe(CAPACITY_ERROR);
      expect((await rejection(me.updateLive(s.id, { capacity: 0 }))).message).toBe(CAPACITY_ERROR);
      expect((await rejection(me.updateLive(s.id, { bedrooms: null }))).message).toBe(BEDROOMS_ERROR);
      expect(await me.getOwn(s.id)).toMatchObject({ capacity: 2, bedrooms: 1, bathrooms: null });
      await me.updateLive(s.id, { capacity: 4, bathrooms: null });
      expect(await me.getOwn(s.id)).toMatchObject({ capacity: 4, bathrooms: null });
      expect((await rejection(me.updateLive((await h.seed({ status: "active" })).id, { bathrooms: null }))).message).toBe(BATHROOMS_ERROR);
    });

    it("updateLive: el parqueo sin decir si se paga se guarda si antes no había parqueo; el precio por noche bloquea siempre", async () => {
      const s = await h.seed({ status: "active" });
      await me.updateLive(s.id, { features: ["wifi", "parking"], parkingPaid: null });
      expect(await me.getOwn(s.id)).toMatchObject({ features: ["wifi", "parking"], parkingPaid: null });
      expect((await rejection(me.updateLive(s.id, { nightlyPriceCrc: null }))).message).toBe(NIGHTLY_PRICE_ERROR);
      expect((await rejection(me.updateLive(s.id, { nightlyPriceCrc: 0 }))).message).toBe(NIGHTLY_PRICE_ERROR);
    });

    it("updateLive: el precio al mes inválido falla si tenía valor; vacío vale siempre", async () => {
      const s = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: 600000 } });
      expect((await rejection(me.updateLive(s.id, { monthlyPriceCrc: 0 }))).message).toBe(MONTHLY_PRICE_ERROR);
      await me.updateLive(s.id, { monthlyPriceCrc: null });
      expect(await me.getOwn(s.id)).toMatchObject({ acceptsMonthly: true, monthlyPriceCrc: null });
      // Ya sin valor: uno inválido se guarda vacío (como «Continuar» al crear).
      await me.updateLive(s.id, { monthlyPriceCrc: 0 });
      expect(await me.getOwn(s.id)).toMatchObject({ acceptsMonthly: true, monthlyPriceCrc: null });
    });

    it("saveEdit: renombrar con una descripción de 50 caracteres (sin tocarla) se guarda", async () => {
      const s = await h.seed({ status: "active", draft: { description: "D".repeat(50) } });
      expect(await me.saveEdit(s.id, { title: "Casa Coco frente al mar" })).toMatchObject({ title: "Casa Coco frente al mar", description: null });
    });

    it("saveEdit: una descripción de 50 caracteres se guarda; de 2001, no; vacía la borra", async () => {
      const s = await h.seed({ status: "active" });
      expect((await me.saveEdit(s.id, { description: "D".repeat(50) }))?.description).toBe("D".repeat(50));
      expect((await rejection(me.saveEdit(s.id, { description: "D".repeat(2001) }))).message).toBe(DESCRIPTION_LENGTH_ERROR);
      expect((await me.saveEdit(s.id, { description: "" }))?.description).toBe("");
    });

    it("saveEdit: un nombre vacío tiene su mensaje; Habitación sin baño elegido se guarda", async () => {
      const s = await h.seed({ status: "active" });
      expect((await rejection(me.saveEdit(s.id, { title: "  " }))).message).toBe(TITLE_EMPTY_ERROR);
      expect(await me.saveEdit(s.id, { kind: "habitacion", bathroomShared: null })).toMatchObject({ kind: "habitacion", bathroomShared: null });
    });

    it("saveEdit: la ubicación y el tipo no piden habitaciones aunque la casa no las tenga", async () => {
      const s = await h.seed({ status: "active", draft: { bedrooms: null } });
      const e = await me.saveEdit(s.id, { lat: PUERTO_VIEJO.lat, lng: PUERTO_VIEJO.lng, zone: "Puerto Viejo", zoneId: "704-puerto-viejo", zoneSource: "list" });
      expect(e?.location?.zone).toBe("Puerto Viejo");
      expect((await me.saveEdit(s.id, { kind: "habitacion", bathroomShared: true }))?.kind).toBe("habitacion");
    });

    it("saveEdit envía el dato a revisión; getOwn y listOwn lo traen con su estado; la ficha pública no cambia", async () => {
      const s = await h.seed({ status: "active" });
      const e = await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
      expect(e).toMatchObject({ status: "review", title: "Casa Coco frente al mar", description: null, location: null, photos: [] });
      expect(e?.fields).toEqual({ nombre: { status: "review", reviewNote: null, submittedAt: e?.submittedAt } });
      expect((await me.getOwn(s.id))?.edit?.fields.nombre?.status).toBe("review");
      // Lo que devuelve saveEdit es la edición entera, igual que la que se lee después (la pantalla no la vuelve a pedir).
      expect((await me.getOwn(s.id))?.edit).toEqual(e);
      expect((await me.listOwn()).find((l) => l.id === s.id)?.edit?.status).toBe("review");
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

    it("con un dato en revisión se guarda otro o el mismo otra vez; discardEditField quita uno y deja los demás", async () => {
      const s = await h.seed({ status: "active" });
      const first = await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
      const again = await me.saveEdit(s.id, { title: "Casa Coco del Caribe" });
      expect(again?.title).toBe("Casa Coco del Caribe");
      expect(again!.fields.nombre!.submittedAt > first!.fields.nombre!.submittedAt).toBe(true);
      const both = await me.saveEdit(s.id, { description: "Casa amplia ".repeat(9).trim() + " junto al mar." });
      expect(Object.keys(both!.fields).sort()).toEqual(["descripcion", "nombre"]);
      await me.discardEditField(s.id, "nombre");
      expect((await me.getOwn(s.id))?.edit).toMatchObject({ title: null, fields: { descripcion: { status: "review" } } });
      expect((await me.getOwn(s.id))?.edit?.fields.nombre).toBeUndefined();
      await me.discardEditField(s.id, "descripcion");
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      expect((await h.anon.getPublic(s.publicId))?.title).toBe("Cabina Cahuita");
    });

    it("saveEdit valida el dato al guardar: un nombre corto y una zona lejana no se guardan", async () => {
      const s = await h.seed({ status: "active" });
      expect((await rejection(me.saveEdit(s.id, { title: "Casa" }))).message).toBe(TITLE_LENGTH_ERROR);
      // Zona Cahuita con el pin en Puerto Viejo, a más de 5 km.
      expect((await rejection(me.saveEdit(s.id, { lat: PUERTO_VIEJO.lat, lng: PUERTO_VIEJO.lng, zone: "Cahuita", zoneId: "704-cahuita", zoneSource: "list" }))).message).toBe(
        "La zona elegida queda a más de 5 km del punto. Elija otra.",
      );
      expect((await me.getOwn(s.id))?.edit).toBeNull();
    });

    it("un nombre aprobado de más de 32 caracteres no impide enviar otro cambio; un nombre nuevo de 33 sí se rechaza", async () => {
      const s = await h.seed({ status: "active" });
      await h.setLegacyTitle(s.id, "Casa grande con vista al mar en Cahuita!");
      await me.saveEdit(s.id, { description: "Casa amplia ".repeat(9).trim() + " junto al mar." });
      expect((await me.getOwn(s.id))?.edit?.status).toBe("review");
      expect((await rejection(me.saveEdit(s.id, { title: "x".repeat(33) }))).message).toBe(TITLE_LENGTH_ERROR);
    });

    it("descartar un dato sin edición no falla; en un borrador, sí", async () => {
      const s = await h.seed({ status: "active" });
      await me.discardEditField(s.id, "nombre");
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      expect((await rejection(me.discardEditField((await h.seed({ status: "draft" })).id, "nombre"))).message).toBe("Solo puede cambiar así una casa publicada.");
    });

    it("una casa ajena no se edita", async () => {
      const mine = await h.seed({ status: "active" });
      expect((await rejection(other.saveEdit(mine.id, { title: "Casa Coco frente al mar" }))).message).toBe("No encontramos ese anuncio.");
      expect((await rejection(other.updateLive(mine.id, { capacity: 9 }))).message).toBe("No encontramos ese anuncio.");
      expect((await rejection(other.discardEditField(mine.id, "nombre"))).message).toBe("No encontramos ese anuncio.");
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
        expect((await me.getOwn(s.id))?.edit?.photos.map((x) => [x.path, x.status, x.reviewNote])).toEqual([[folder, "review", null]]);
        expect((await me.getOwn(s.id))?.edit?.status).toBe("review");
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
        // Guardar otro dato devuelve la edición entera, con las fotos nuevas en su orden y su estado.
        const e = await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
        expect(e?.photos.map((x) => x.id)).toEqual([b.id, a.id]);
        expect((await me.getOwn(s.id))?.edit).toEqual(e);
        expect((await rejection(ph().reorderEditPhotos(s.id, [a.id]))).message).toBe("La lista de fotos cambió. Vuelva a intentarlo.");
      });

      it("descartar las dos fotos nuevas borra sus objetos y deja los de las aprobadas", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        const before = await names(s.id);
        const f1 = await ph().upload(s.id, variants());
        const f2 = await ph().upload(s.id, variants());
        const a = await ph().addEditPhoto(s.id, f1);
        const b = await ph().addEditPhoto(s.id, f2);
        expect((await names(s.id)).filter((n) => n.startsWith(f1) || n.startsWith(f2))).toHaveLength(6);
        await ph().removeEditPhoto(a.id);
        await ph().removeEditPhoto(b.id);
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

      it("con cambios en revisión se siguen subiendo y registrando fotos nuevas", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
        await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        await ph().addEditPhoto(s.id, await ph().upload(s.id, variants()));
        expect((await me.getOwn(s.id))?.edit?.photos).toHaveLength(2);
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

    describe("revisión del admin, dato a dato", () => {
      const admin = () => h.admin("aal2");
      /** El envío de un dato (o de una foto) que el admin ve al abrir la casa. */
      const seen = async (id: string, field: "nombre" | "descripcion" = "nombre") => (await admin().getEdit(id))?.listing.edit?.fields[field]?.submittedAt ?? null;
      const photoSeen = async (id: string, photo: string) => (await admin().getEdit(id))?.listing.edit?.photos.find((p) => p.id === photo)?.submittedAt ?? null;
      const sent = async (title: string, edit: string) => {
        const s = await h.seed({ status: "active", photos: 5, draft: { title } });
        await me.saveEdit(s.id, { title: edit });
        return s;
      };

      it("la cola trae las casas con algo en revisión, la que más espera primero, con su resumen; lo que solo tiene cambios pedidos, no", async () => {
        const a = await h.seed({ status: "active", draft: { title: "Casa A" } });
        const b = await h.seed({ status: "active", draft: { title: "Casa B" } });
        for (const s of [b, a]) await me.saveEdit(s.id, { title: `${s === a ? "Casa A" : "Casa B"} renovada` });
        const c = await sent("Casa C", "Casa C renovada");
        await admin().reviewEditField(c.id, "nombre", "changes", "Otro nombre.", await seen(c.id));
        const q = await admin().editQueue();
        expect(q.map((i) => i.listing.title)).toEqual(["Casa B", "Casa A"]);
        expect(editSummary(q[0]!.listing.edit!)).toBe("nombre");
        expect(q[0]!.ownerName).toBe(h.ownerName("owner"));
      });

      it("getEdit trae la casa con cada dato y foto pendiente; null si no hay nada", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        expect(await admin().getEdit(s.id)).toBeNull();
        await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
        await h.photos("owner").addEditPhoto(s.id, await h.photos("owner").upload(s.id, variants()));
        const item = await admin().getEdit(s.id);
        expect(item?.listing).toMatchObject({ title: "Cabina Cahuita", photoCount: 5, edit: { status: "review", title: "Casa Coco frente al mar", fields: { nombre: { status: "review" } } } });
        expect(item?.listing.edit?.photos.map((p) => p.status)).toEqual(["review"]);
      });

      it("aprobar el nombre lo publica al momento y deja la foto pendiente; aprobar la foto la añade y la edición desaparece", async () => {
        const s = await h.seed({ status: "active", photos: 5 });
        await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
        const photo = await h.photos("owner").addEditPhoto(s.id, await h.photos("owner").upload(s.id, variants()));
        await admin().reviewEditField(s.id, "nombre", "approve", "", await seen(s.id));
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa Coco frente al mar");
        expect((await me.getOwn(s.id))?.edit).toMatchObject({ title: null, fields: {}, status: "review" });
        await admin().reviewEditPhoto(photo.id, "approve", "", await photoSeen(s.id, photo.id));
        const pub = await h.anon.getPublic(s.publicId);
        expect(pub?.photos).toHaveLength(6);
        expect(await me.getOwn(s.id)).toMatchObject({ status: "active", title: "Casa Coco frente al mar", edit: null });
        expect(await admin().editQueue()).toEqual([]);
        expect(await admin().getEdit(s.id)).toBeNull();
      });

      it("un completo (de 3 o un estudio de 0) que pasa a Habitación: se envía sin pedir habitaciones y al aprobarlo queda en 1 (y 1 baño)", async () => {
        for (const bedrooms of [3, 0]) {
          const s = await h.seed({ status: "active", draft: { kind: "completo", bedrooms, bathrooms: 2 } });
          await me.saveEdit(s.id, { kind: "habitacion", bathroomShared: false });
          expect((await me.getOwn(s.id))?.bedrooms, `${bedrooms} hab.`).toBe(bedrooms); // pendiente: aún no cambia
          const at = (await admin().getEdit(s.id))?.listing.edit?.fields.tipo?.submittedAt ?? null;
          await admin().reviewEditField(s.id, "tipo", "approve", "", at);
          expect(await me.getOwn(s.id)).toMatchObject({ kind: "habitacion", bathroomShared: false, bedrooms: 1, bathrooms: 1, status: "active", edit: null });
          expect(await h.anon.getPublic(s.publicId)).toMatchObject({ bedrooms: 1, bathrooms: 1 });
        }
      });

      it("pedir cambios en un dato guarda su nota; el propietario la ve y, al guardar otra vez, vuelve a revisión", async () => {
        const s = await sent("Casa A", "Casa A renovada");
        await admin().reviewEditField(s.id, "nombre", "changes", "  Sin mayúsculas, por favor.  ", await seen(s.id));
        expect((await me.getOwn(s.id))?.edit).toMatchObject({ status: "changes", fields: { nombre: { status: "changes", reviewNote: "Sin mayúsculas, por favor." } } });
        expect(await admin().editQueue()).toEqual([]);
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa A");
        await me.saveEdit(s.id, { title: "Casa A renovada del todo" });
        expect((await me.getOwn(s.id))?.edit?.fields.nombre).toMatchObject({ status: "review", reviewNote: null });
        expect((await admin().editQueue()).map((i) => i.listing.id)).toEqual([s.id]);
      });

      it("una foto con cambios pedidos lleva su nota; el nombre de la misma casa se aprueba aparte", async () => {
        const s = await sent("Casa A", "Casa A renovada");
        const photo = await h.photos("owner").addEditPhoto(s.id, await h.photos("owner").upload(s.id, variants()));
        await admin().reviewEditPhoto(photo.id, "changes", "Se ve un teléfono.", await photoSeen(s.id, photo.id));
        await admin().reviewEditField(s.id, "nombre", "approve", "", await seen(s.id));
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa A renovada");
        expect((await me.getOwn(s.id))?.edit?.photos.map((p) => [p.status, p.reviewNote])).toEqual([["changes", "Se ve un teléfono."]]);
      });

      it("un dato descartado o reenviado después de abrirlo no se decide", async () => {
        const s = await sent("Casa A", "Casa A renovada");
        const at = await seen(s.id);
        await me.discardEditField(s.id, "nombre");
        expect((await rejection(admin().reviewEditField(s.id, "nombre", "approve", "", at))).message).toBe(EDIT_MESSAGES.changed);
        await new Promise((r) => setTimeout(r, 5)); // otro envío, otro instante
        await me.saveEdit(s.id, { title: "Casa B sin ver" });
        expect((await rejection(admin().reviewEditField(s.id, "nombre", "approve", "", at))).message).toBe(EDIT_MESSAGES.changed);
        expect((await rejection(admin().reviewEditField(s.id, "nombre", "changes", "No.", at))).message).toBe(EDIT_MESSAGES.changed);
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa A");
        await admin().reviewEditField(s.id, "nombre", "approve", "", await seen(s.id));
        expect((await h.anon.getPublic(s.publicId))?.title).toBe("Casa B sin ver");
      });

      it("validación y acceso: nota obligatoria, ya decidido, no admin y aal1", async () => {
        const s = await sent("Casa A", "Casa A renovada");
        const at = await seen(s.id);
        expect((await rejection(admin().reviewEditField(s.id, "nombre", "changes", "", at))).message).toBe(EDIT_MESSAGES.noteRequired);
        await admin().reviewEditField(s.id, "nombre", "changes", "Falta algo.", at);
        expect((await rejection(admin().reviewEditField(s.id, "nombre", "approve", "", at))).message).toBe(EDIT_MESSAGES.decided);
        expect((await rejection(admin().reviewEditField("00000000-0000-4000-8000-999999999999", "nombre", "approve", "", null))).message).toBe(EDIT_MESSAGES.notFound);
        await me.saveEdit(s.id, { title: "Casa A renovada otra vez" });
        const now = await seen(s.id);
        const owner = h.admin("owner");
        expect(await owner.editQueue()).toEqual([]);
        expect(await owner.getEdit(s.id)).toBeNull();
        expect((await rejection(owner.reviewEditField(s.id, "nombre", "approve", "", now))).message).toBe(REVIEW_MESSAGES.adminOnly);
        const aal1 = h.admin("aal1");
        for (const call of [() => aal1.editQueue(), () => aal1.getEdit(s.id), () => aal1.reviewEditField(s.id, "nombre", "approve", "", now)]) {
          expect((await rejection(call())).message).toBe(REVIEW_MESSAGES.mfaRequired);
        }
        expect((await me.getOwn(s.id))?.edit?.status).toBe("review");
      });
    });
  });
}
