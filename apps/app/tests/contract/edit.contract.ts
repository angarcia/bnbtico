// Contrato de la edición de una casa publicada (spec .scratch/editar-casa), parte del propietario: datos al momento
// (update_listing_live) y edición revisada (save_edit, submit_edit, discard_edit). Mismas reglas y mensajes en el fake y
// en la base; mientras la edición no se apruebe, la ficha pública sigue con la versión aprobada.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OwnerListingsApi } from "../../src/domain/api";
import { DomainError } from "../../src/domain/errors";
import type { ListingsHarness } from "./harness";
import { PUERTO_VIEJO } from "./points";

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
      expect((await rejection(me.saveEdit(s.id, { title: "Casa" }))).message).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
      expect((await me.getOwn(s.id))?.edit).toBeNull();
      // Zona Cahuita con el pin en Puerto Viejo, a más de 5 km: se guarda, pero no se envía.
      await me.saveEdit(s.id, { lat: PUERTO_VIEJO.lat, lng: PUERTO_VIEJO.lng, zone: "Cahuita", zoneId: "704-cahuita", zoneSource: "list" });
      expect((await rejection(me.submitEdit(s.id))).message).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
      expect((await me.getOwn(s.id))?.edit?.status).toBe("open");
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
  });
}
