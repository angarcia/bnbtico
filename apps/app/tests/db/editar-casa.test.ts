// Migración editar_casa_publicada (spec .scratch/editar-casa): una casa publicada cambia al momento sus datos sin
// revisión (update_listing_live), no vuelve nunca a borrador, ordena y quita fotos pero no las añade directamente
// (pasan por la edición), y Storage deja subir a su carpeta mientras no haya una edición en revisión y borrar solo
// objetos que ya no enlaza ninguna foto. Las tablas de la edición solo se leen (dueño y admin); se escriben por RPC.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("editar una casa publicada · al momento y guardas", () => {
  let h: ListingsHarness;
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    other = await signIn("other");
  });
  beforeEach(() => h.reset());

  const live = (id: string, p: object, db = owner) => db.rpc("update_listing_live", { p_listing: id, p_patch: p as never });

  it("update_listing_live cambia el precio y la casa sigue activa y pública", async () => {
    const { id, publicId } = await h.seed({ status: "active" });
    expect((await live(id, { nightly_price_crc: 55000 })).error).toBeNull();
    expect((await h.anon.getPublic(publicId))?.nightlyPriceCrc).toBe(55000);
    expect((await h.owner("owner").getOwn(id))?.status).toBe("active");
  });

  it("cambia capacidad y características juntas, con el tipo de parqueo", async () => {
    const { id } = await h.seed({ status: "active" });
    expect((await live(id, { capacity: 6, bedrooms: 3, bathrooms: 2, features: ["wifi", "parking"], parking_paid: false })).error).toBeNull();
    const l = await h.owner("owner").getOwn(id);
    expect(l).toMatchObject({ capacity: 6, bedrooms: 3, bathrooms: 2, features: ["wifi", "parking"], parkingPaid: false, status: "active" });
  });

  it("rechaza el nombre, un borrador, parqueo sin tipo, un mes a 0, una característica desconocida y una casa ajena", async () => {
    const active = await h.seed({ status: "active" });
    const draft = await h.seed({ status: "draft" });
    expect((await live(active.id, { title: "Casa nueva" })).error?.message).toBe("Ese dato no se puede cambiar aquí.");
    expect((await live(active.id, { status: "draft" })).error?.message).toBe("Ese dato no se puede cambiar aquí.");
    expect((await live(draft.id, { capacity: 3 })).error?.message).toBe("Solo puede cambiar así una casa publicada.");
    expect((await live(active.id, { features: ["wifi", "parking"] })).error?.message).toBe("Indique si el parqueo es gratuito o de pago.");
    expect((await live(active.id, { parking_paid: true })).error?.message).toBe("El tipo de parqueo solo aplica si el anuncio tiene parqueo.");
    expect((await live(active.id, { accepts_monthly: true, monthly_price_crc: 0 })).error?.message).toBe("Indique el precio al mes en colones o déjelo vacío.");
    expect((await live(active.id, { nightly_price_crc: 0 })).error?.message).toBe("Indique el precio por noche en colones.");
    expect((await live(active.id, { capacity: 0 })).error?.message).toBe("Indique cuántas personas pueden alojarse (mínimo 1).");
    expect((await live(active.id, { features: ["jacuzzi"] })).error?.message).toBe("Ese dato no se puede cambiar aquí.");
    expect((await live(active.id, { capacity: 9 }, other)).error?.message).toBe("No encontramos ese anuncio.");
    expect((await live(active.id, { capacity: 9 }, anonClient())).error).not.toBeNull();
    expect((await h.owner("owner").getOwn(active.id))?.capacity).toBe(2);
  });

  it("las habitaciones se validan con el tipo aprobado: un completo puede tener 0, una habitación no", async () => {
    const completo = await h.seed({ status: "active" });
    expect((await live(completo.id, { bedrooms: 0 })).error).toBeNull();
    const room = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    expect((await live(room.id, { bedrooms: 0 })).error?.message).toBe("Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.");
  });

  it("accepts_monthly false borra el precio al mes", async () => {
    const { id } = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: 650000 } });
    expect((await live(id, { accepts_monthly: false })).error).toBeNull();
    const l = await h.owner("owner").getOwn(id);
    expect(l?.acceptsMonthly).toBe(false);
    expect(l?.monthlyPriceCrc).toBeNull();
  });

  it("listings_protect: un update directo del título o a borrador de una casa activa se rechaza", async () => {
    const { id } = await h.seed({ status: "active" });
    expect((await owner.from("listings").update({ title: "Otro nombre" }).eq("id", id)).error?.message).toBe("Esta casa está publicada: cambie sus datos desde Mis casas.");
    expect((await owner.from("listings").update({ status: "draft" }).eq("id", id)).error?.message).toBe("Solo bnbtico puede cambiar el estado de un anuncio.");
    const review = await h.seed({ status: "review" });
    expect((await owner.from("listings").update({ title: "Otro nombre" }).eq("id", review.id)).error?.message).toBe(
      "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.",
    );
    const changes = await h.seed({ status: "changes" });
    expect((await owner.from("listings").update({ status: "draft" }).eq("id", changes.id)).error).toBeNull();
  });

  it("fotos de una casa publicada: ordenar y quitar sí, añadir no, la última no", async () => {
    const { id } = await h.seed({ status: "active" });
    const ids = (await serviceClient().from("listing_photos").select("id").eq("listing_id", id).order("position")).data!.map((r) => r.id);
    expect((await owner.rpc("reorder_listing_photos", { p_listing: id, p_ids: [...ids].reverse() })).error).toBeNull();
    expect((await owner.rpc("add_listing_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error?.message).toBe(
      "Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.",
    );
    for (const photo of ids.slice(0, 4)) expect((await owner.rpc("remove_listing_photo", { p_photo: photo })).error).toBeNull();
    expect((await owner.rpc("remove_listing_photo", { p_photo: ids[4]! })).error?.message).toBe(
      "Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.",
    );
    expect((await other.rpc("reorder_listing_photos", { p_listing: id, p_ids: [ids[4]!] })).error?.message).toBe("No encontramos ese anuncio.");
    expect((await serviceClient().from("listing_photos").select("id").eq("listing_id", id)).data).toEqual([{ id: ids[4] }]);
  });

  it("RLS: anon y otro propietario no leen ni escriben listing_edits", async () => {
    const { id } = await h.seed({ status: "active" });
    sql(`insert into public.listing_edits (listing_id, title) values ('${id}', 'Casa Coco frente al mar')`);
    sql(`insert into public.listing_edit_photos (listing_id, path) values ('${id}', '${id}/${crypto.randomUUID()}')`);
    expect((await anonClient().from("listing_edits").select("*")).data ?? []).toEqual([]);
    expect((await anonClient().from("listing_edit_photos").select("*")).data ?? []).toEqual([]);
    expect((await other.from("listing_edits").select("*").eq("listing_id", id)).data).toEqual([]);
    expect((await other.from("listing_edit_photos").select("*").eq("listing_id", id)).data).toEqual([]);
    expect((await owner.from("listing_edits").select("title").eq("listing_id", id)).data).toEqual([{ title: "Casa Coco frente al mar" }]);
    expect((await owner.from("listing_edit_photos").select("id").eq("listing_id", id)).data).toHaveLength(1);
    expect((await owner.from("listing_edits").update({ title: "Casa Coco" }).eq("listing_id", id)).error).not.toBeNull();
    expect((await owner.from("listing_edits").delete().eq("listing_id", id)).error).not.toBeNull();
    expect((await owner.from("listing_edit_photos").insert({ listing_id: id, path: `${id}/${crypto.randomUUID()}` })).error).not.toBeNull();
    expect((await owner.from("listing_edits").insert({ listing_id: (await h.seed({ status: "active" })).id })).error).not.toBeNull();
  });

  it("Storage: subir a una casa activa sí sin edición en revisión; no con la edición en revisión", async () => {
    const { id } = await h.seed({ status: "active" });
    const up = () => owner.storage.from("listings").upload(`${id}/${crypto.randomUUID()}/800.jpg`, JPEG, { contentType: "image/jpeg" });
    expect((await up()).error).toBeNull();
    sql(`insert into public.listing_edits (listing_id, status, title) values ('${id}', 'review', 'Casa Coco frente al mar')`);
    expect((await up()).error).not.toBeNull();
    expect((await other.storage.from("listings").upload(`${id}/${crypto.randomUUID()}/800.jpg`, JPEG)).error).not.toBeNull();
    const review = await h.seed({ status: "review" });
    expect((await owner.storage.from("listings").upload(`${review.id}/${crypto.randomUUID()}/800.jpg`, JPEG)).error).not.toBeNull();
  });

  it("Storage: borrar un objeto referenciado se rechaza; uno sin referencia se borra", async () => {
    const { id } = await h.seed({ status: "active" });
    const used = `${id}/${crypto.randomUUID()}`;
    const pending = `${id}/${crypto.randomUUID()}`;
    const loose = `${id}/${crypto.randomUUID()}`;
    for (const f of [used, pending, loose]) expect((await owner.storage.from("listings").upload(`${f}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
    await serviceClient().from("listing_photos").insert({ listing_id: id, path: used, position: 9 });
    sql(`insert into public.listing_edits (listing_id, title) values ('${id}', 'Casa Coco frente al mar')`);
    sql(`insert into public.listing_edit_photos (listing_id, path) values ('${id}', '${pending}')`);
    await other.storage.from("listings").remove([`${loose}/800.jpg`]);
    expect((await h.objects(id)).map((o) => o.name)).toHaveLength(3);
    await owner.storage.from("listings").remove([`${used}/800.jpg`, `${pending}/800.jpg`, `${loose}/800.jpg`]);
    expect((await h.objects(id)).map((o) => o.name)).toEqual([`${used}/800.jpg`, `${pending}/800.jpg`].sort());
  });
});
