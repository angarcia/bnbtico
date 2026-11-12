// Migración cliente_directo, parte dos: fotos registradas con RPCs (posición en SQL, máximo 15, reordenar en una
// transacción), 45 objetos por carpeta de casa en Storage y cinco borradores abiertos por dueño. Cada tope se prueba
// también con un intruso (otro propietario).
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const folder = (listing: string) => `${listing}/${crypto.randomUUID()}`;

describe("migración cliente_directo · fotos y topes", () => {
  let h: ListingsHarness;
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    other = await signIn("other");
  });
  beforeEach(() => h.reset());

  const add = (db: SupabaseClient<Database>, listing: string, path = folder(listing)) => db.rpc("add_listing_photo", { p_listing: listing, p_path: path }).single();
  const positions = async (listing: string) =>
    (await serviceClient().from("listing_photos").select("id, path, position").eq("listing_id", listing).order("position")).data!;

  describe("add_listing_photo", () => {
    it("la base calcula la posición: al final, empezando en 0", async () => {
      const { id } = await h.seed({ status: "draft" });
      const paths = [folder(id), folder(id), folder(id)];
      for (const [i, path] of paths.entries()) {
        const { data, error } = await add(owner, id, path);
        expect(error).toBeNull();
        expect(data).toMatchObject({ path, position: i });
      }
      expect((await positions(id)).map((p) => p.path)).toEqual(paths);
    });

    it("máximo 15 fotos", async () => {
      const { id } = await h.seed({ status: "draft" });
      for (let i = 0; i < 15; i++) expect((await add(owner, id)).error).toBeNull();
      expect((await add(owner, id)).error?.message).toBe("Máximo 15 fotos.");
      expect(await positions(id)).toHaveLength(15);
    });

    // Corte de la fase R (decisión 2026-11-11, Vercel retirado): las filas solo cambian por las RPCs security definer.
    it("ni el dueño ni un anónimo escriben listing_photos directamente: insert, update y delete fallan por permisos", async () => {
      const { id } = await h.seed({ status: "draft" });
      expect((await add(owner, id)).error).toBeNull();
      const [photo] = await positions(id);
      const anon = anonClient();
      for (const db of [owner, anon]) {
        const insert = await db.from("listing_photos").insert({ listing_id: id, path: folder(id), position: 1 });
        expect(insert.error?.code).toBe("42501");
        const update = await db.from("listing_photos").update({ position: 5 }).eq("listing_id", id);
        expect(update.error?.code).toBe("42501");
        const remove = await db.from("listing_photos").delete().eq("listing_id", id);
        expect(remove.error?.code).toBe("42501");
      }
      expect(await positions(id)).toEqual([photo]);
    });

    it("solo carpetas de esa casa (<casa>/<uuid>)", async () => {
      const { id } = await h.seed({ status: "draft" });
      const elsewhere = await h.seed({ status: "draft", as: "other" });
      for (const path of [`${id}/foto.jpg`, `${elsewhere.id}/${crypto.randomUUID()}`, `${id}/${crypto.randomUUID()}/800.jpg`, "../x"]) {
        expect((await add(owner, id, path)).error?.message, path).toBe("Ruta de foto no válida.");
      }
    });

    it("una casa en revisión o activa no gana fotos", async () => {
      const review = await h.seed({ status: "review" });
      expect((await add(owner, review.id)).error?.message).toBe(FROZEN);
      // Una casa publicada añade fotos por la edición (migración editar_casa_publicada).
      const active = await h.seed({ status: "active" });
      expect((await add(owner, active.id)).error?.message).toBe("Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.");
    });

    it("un intruso no añade fotos a una casa ajena; sin sesión no se llama", async () => {
      const { id } = await h.seed({ status: "draft" });
      expect((await add(other, id)).error?.message).toBe("No encontramos ese anuncio.");
      expect((await add(anonClient(), id)).error).not.toBeNull();
      expect(await positions(id)).toHaveLength(0);
    });
  });

  describe("remove_listing_photo", () => {
    it("borra la fila, devuelve la ruta y recompacta las posiciones", async () => {
      const { id } = await h.seed({ status: "draft" });
      const paths = [folder(id), folder(id), folder(id)];
      for (const path of paths) await add(owner, id, path);
      const [, middle] = await positions(id);
      const { data, error } = await owner.rpc("remove_listing_photo", { p_photo: middle!.id });
      expect(error).toBeNull();
      expect(data).toBe(paths[1]);
      expect((await positions(id)).map((p) => [p.path, p.position])).toEqual([
        [paths[0], 0],
        [paths[2], 1],
      ]);
    });

    it("un intruso no quita fotos ajenas; en revisión tampoco el dueño", async () => {
      const { id } = await h.seed({ status: "draft" });
      await add(owner, id);
      const [photo] = await positions(id);
      expect((await other.rpc("remove_listing_photo", { p_photo: photo!.id })).error?.message).toBe("No encontramos esa foto.");
      // Una casa publicada sí quita fotos (editar_casa_publicada); una en revisión, no.
      const review = await h.seed({ status: "review" });
      const [first] = await positions(review.id);
      expect((await owner.rpc("remove_listing_photo", { p_photo: first!.id })).error?.message).toBe(FROZEN);
      expect(await positions(review.id)).toHaveLength(5);
    });
  });

  describe("reorder_listing_photos", () => {
    it("todo el orden de una vez; la primera es la portada", async () => {
      const { id } = await h.seed({ status: "draft" });
      for (let i = 0; i < 4; i++) await add(owner, id);
      const before = (await positions(id)).map((p) => p.id);
      const wanted = [before[2]!, before[0]!, before[3]!, before[1]!];
      expect((await owner.rpc("reorder_listing_photos", { p_listing: id, p_ids: wanted })).error).toBeNull();
      expect((await positions(id)).map((p) => p.id)).toEqual(wanted);
    });

    it("rechaza una lista que no es exactamente la de la casa", async () => {
      const { id } = await h.seed({ status: "draft" });
      for (let i = 0; i < 3; i++) await add(owner, id);
      const ids = (await positions(id)).map((p) => p.id);
      const stale = "La lista de fotos cambió. Vuelva a intentarlo.";
      for (const bad of [ids.slice(1), [...ids, ids[0]!], [ids[0]!, ids[1]!, crypto.randomUUID()], [ids[0]!, ids[0]!, ids[1]!]]) {
        expect((await owner.rpc("reorder_listing_photos", { p_listing: id, p_ids: bad })).error?.message).toBe(stale);
      }
      expect((await positions(id)).map((p) => p.id)).toEqual(ids);
    });

    it("un intruso no reordena una casa ajena", async () => {
      const { id } = await h.seed({ status: "draft" });
      for (let i = 0; i < 2; i++) await add(owner, id);
      const ids = (await positions(id)).map((p) => p.id);
      expect((await other.rpc("reorder_listing_photos", { p_listing: id, p_ids: [...ids].reverse() })).error?.message).toBe("No encontramos ese anuncio.");
      expect((await positions(id)).map((p) => p.id)).toEqual(ids);
    });
  });

  describe("Storage", () => {
    const upload = (db: SupabaseClient<Database>, name: string) => db.storage.from("listings").upload(name, JPEG, { contentType: "image/jpeg" });

    it("como mucho 45 objetos por carpeta de casa (15 fotos × 3 variantes)", async () => {
      const { id } = await h.seed({ status: "draft" });
      for (let i = 0; i < 15; i++) {
        const dir = folder(id);
        const results = await Promise.all([480, 800, 1600].map((size) => upload(owner, `${dir}/${size}.jpg`)));
        for (const r of results) expect(r.error).toBeNull();
      }
      expect((await upload(owner, `${folder(id)}/480.jpg`)).error).not.toBeNull();
    });

    it("solo las variantes 480/800/1600; la foto única de la app vieja ya no se sube", async () => {
      const { id } = await h.seed({ status: "draft" });
      expect((await upload(owner, `${folder(id)}/800.jpg`)).error).toBeNull();
      for (const name of [`${folder(id)}.jpg`, `${folder(id)}/900.jpg`, `${id}/foto.jpg`, `${folder(id)}/800.png`, `${folder(id)}/a/800.jpg`]) {
        expect((await upload(owner, name)).error, name).not.toBeNull();
      }
    });

    it("un intruso no sube a la carpeta de una casa ajena", async () => {
      const { id } = await h.seed({ status: "draft" });
      expect((await upload(other, `${folder(id)}/800.jpg`)).error).not.toBeNull();
    });
  });

  describe("borradores abiertos", () => {
    const create = (db: SupabaseClient<Database>, ownerId: string) =>
      db.from("listings").insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: "" }).select("id").single();

    it("como mucho cinco borradores sin enviar por dueño, con el mensaje en español", async () => {
      const ownerId = (await owner.auth.getUser()).data.user!.id;
      for (let i = 0; i < 5; i++) expect((await create(owner, ownerId)).error).toBeNull();
      expect((await create(owner, ownerId)).error?.message).toBe("Ya tiene 5 borradores sin enviar. Termine o descarte uno antes de empezar otro.");
      // Otro propietario no se ve afectado por los borradores ajenos.
      const otherId = (await other.auth.getUser()).data.user!.id;
      expect((await create(other, otherId)).error).toBeNull();
    });

    it("las casas enviadas y las reabiertas para editar no cuentan; la regla de alta segura sigue", async () => {
      const ownerId = (await owner.auth.getUser()).data.user!.id;
      for (let i = 0; i < 2; i++) await h.seed({ status: "review" });
      await h.seed({ status: "reopened" });
      for (let i = 0; i < 4; i++) expect((await create(owner, ownerId)).error).toBeNull();
      const { data, error } = await owner
        .from("listings")
        .insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: "+50600000000" })
        .select("whatsapp_phone, status")
        .single();
      expect(error).toBeNull();
      expect(data).toEqual({ whatsapp_phone: "+50687770001", status: "draft" });
      expect((await create(owner, ownerId)).error?.message).toMatch(/^Ya tiene 5 borradores/);
      expect((await owner.from("listings").insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: "", status: "active" })).error?.message).toBe(
        "Un anuncio nuevo empieza como borrador.",
      );
    });

    it("un intruso no crea borradores a nombre de otro", async () => {
      const ownerId = (await owner.auth.getUser()).data.user!.id;
      expect((await create(other, ownerId)).error).not.toBeNull();
    });
  });
});
