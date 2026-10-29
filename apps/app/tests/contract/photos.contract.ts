// Contrato de fotos (ticket 08): subida directa de tres variantes a Storage, registro con add_listing_photo (posición en
// la base, máximo 15), quitar (fila y después objetos), reordenar y portada. Mismas reglas en el fake y en la base.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PhotoVariants } from "../../src/domain/api";
import { DomainError } from "../../src/domain/errors";
import { variantUrl } from "../../src/domain/image";
import { moveTo } from "../../src/domain/photo-order";
import type { ListingsHarness } from "./harness";

const NOT_FOUND = "No encontramos ese anuncio.";
const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";
const UPLOAD_FAILED = "No pudimos subir esa foto. Intente de nuevo.";
const ONE_YEAR = /max-age=31536000/;

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

export function photosContract(name: string, makeHarness: () => Promise<ListingsHarness>) {
  describe(`contrato de fotos · ${name}`, () => {
    let h: ListingsHarness;
    beforeAll(async () => {
      h = await makeHarness();
    });
    beforeEach(() => h.reset());

    const photos = () => h.photos("owner");
    const own = async (id: string) => (await h.owner("owner").getOwn(id))!;
    const addOne = async (id: string) => photos().add(id, await photos().upload(id, variants()));

    it("sube las tres variantes a <casa>/<uuid>/ con caché de un año, avisando de cada una", async () => {
      const { id } = await h.seed({ status: "draft" });
      let uploaded = 0;
      const folder = await photos().upload(id, variants(), () => uploaded++);
      expect(folder).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}$`));
      expect(uploaded).toBe(3);
      const objects = await h.objects(id);
      expect(objects.map((o) => o.name)).toEqual([`${folder}/1600.jpg`, `${folder}/480.jpg`, `${folder}/800.jpg`]);
      for (const o of objects) expect(o.cacheControl).toMatch(ONE_YEAR);
    });

    it("add registra la carpeta como una foto al final; la URL es la de 800 y hay 480", async () => {
      const { id } = await h.seed({ status: "draft", photos: 2 });
      const folder = await photos().upload(id, variants());
      const photo = await photos().add(id, folder);
      expect(photo).toMatchObject({ path: folder, position: 2 });
      expect(photo.url).toMatch(new RegExp(`/storage/v1/object/public/listings/${folder}/800\\.jpg$`));
      expect(variantUrl(photo, 480)).toMatch(new RegExp(`${folder}/480\\.jpg$`));
      const l = await own(id);
      expect(l.photoCount).toBe(3);
      expect(l.photos[2]).toEqual(photo);
      expect(l.photos[0]!.url).toMatch(/\/foto-0\.jpg$/); // las anteriores siguen siendo un solo archivo
    });

    it("máximo 15 fotos, con el mensaje de la base; discard limpia lo subido", async () => {
      const { id } = await h.seed({ status: "draft", photos: 14 });
      await addOne(id);
      const folder = await photos().upload(id, variants());
      expect((await rejection(photos().add(id, folder))).message).toBe("Máximo 15 fotos.");
      await photos().discard(folder);
      expect((await h.objects(id)).filter((o) => o.name.startsWith(folder))).toEqual([]);
      expect((await own(id)).photoCount).toBe(15);
    });

    it("add solo acepta una carpeta de esa casa", async () => {
      const { id } = await h.seed({ status: "draft" });
      const other = await h.seed({ status: "draft", as: "other" });
      for (const path of [`${id}/foto.jpg`, `${other.id}/${crypto.randomUUID()}`, `${id}/${crypto.randomUUID()}/800.jpg`]) {
        expect((await rejection(photos().add(id, path))).message, path).toBe("Ruta de foto no válida.");
      }
    });

    it("quitar borra la fila, recompacta y después borra los tres objetos", async () => {
      const { id } = await h.seed({ status: "draft" });
      const a = await addOne(id);
      const b = await addOne(id);
      const c = await addOne(id);
      await photos().remove(b.id);
      const l = await own(id);
      expect(l.photos.map((p) => [p.id, p.position])).toEqual([
        [a.id, 0],
        [c.id, 1],
      ]);
      const names = (await h.objects(id)).map((o) => o.name);
      expect(names.some((n) => n.startsWith(`${b.path}/`))).toBe(false);
      expect(names.filter((n) => n.startsWith(`${a.path}/`))).toHaveLength(3);
    });

    it("quitar una foto anterior (un solo archivo) también funciona", async () => {
      const { id } = await h.seed({ status: "draft", photos: 2 });
      const [first] = (await own(id)).photos;
      await photos().remove(first!.id);
      expect((await own(id)).photos.map((p) => p.path)).toEqual([`${id}/foto-1.jpg`]);
    });

    it("reordenar y hacer portada: el orden completo de una vez", async () => {
      const { id } = await h.seed({ status: "draft" });
      const ids = [(await addOne(id)).id, (await addOne(id)).id, (await addOne(id)).id];
      await photos().reorder(id, [ids[2]!, ids[0]!, ids[1]!]);
      expect((await own(id)).photos.map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
      await photos().reorder(id, moveTo([ids[2]!, ids[0]!, ids[1]!], ids[1]!, 0));
      const l = await own(id);
      expect(l.photos[0]!.id).toBe(ids[1]);
      expect(l.photos.map((p) => p.position)).toEqual([0, 1, 2]);
      expect((await rejection(photos().reorder(id, ids.slice(1)))).message).toBe("La lista de fotos cambió. Vuelva a intentarlo.");
    });

    it("fuera de borrador o cambios pedidos no se toca nada", async () => {
      // En revisión. Una casa publicada ordena y quita fotos: sus casos van con la edición (edit.contract.ts).
      const { id } = await h.seed({ status: "review" });
      const l = await own(id);
      expect((await rejection(photos().upload(id, variants()))).message).toBe(UPLOAD_FAILED);
      expect((await rejection(photos().add(id, `${id}/${crypto.randomUUID()}`))).message).toBe(FROZEN);
      expect((await rejection(photos().remove(l.photos[0]!.id))).message).toBe(FROZEN);
      expect((await rejection(photos().reorder(id, [...l.photos].reverse().map((p) => p.id)))).message).toBe(FROZEN);
      expect((await own(id)).photos).toEqual(l.photos);
    });

    it("con cambios pedidos sí se editan las fotos", async () => {
      const { id } = await h.seed({ status: "changes" });
      await addOne(id);
      expect((await own(id)).photoCount).toBe(6);
    });

    it("un intruso no sube, registra, quita ni reordena fotos de una casa ajena", async () => {
      const { id } = await h.seed({ status: "draft" });
      const mine = await addOne(id);
      const intruder = h.photos("other");
      expect((await rejection(intruder.upload(id, variants()))).message).toBe(UPLOAD_FAILED);
      expect((await rejection(intruder.add(id, `${id}/${crypto.randomUUID()}`))).message).toBe(NOT_FOUND);
      expect((await rejection(intruder.remove(mine.id))).message).toBe("No encontramos esa foto.");
      expect((await rejection(intruder.reorder(id, [mine.id]))).message).toBe(NOT_FOUND);
      expect((await own(id)).photos).toEqual([mine]);
      expect(await h.objects(id)).toHaveLength(3);
    });
  });
}
