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

describe("ediciones del propietario", () => {
  let h: ListingsHarness;
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  const inReview = "Ya hay una edición en revisión. Espere la respuesta o descártela.";

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    other = await signIn("other");
  });
  beforeEach(() => h.reset());

  const save = (id: string, p: object, db = owner) => db.rpc("save_edit", { p_listing: id, p_patch: p as never });
  // PostgREST da un null compuesto como un objeto con todo null: la edición borrada se reconoce por listing_id.
  const gone = (data: { listing_id: string | null } | null) => (data?.listing_id ?? null) === null;

  it("save_edit + add_edit_photo + submit_edit dejan listings y listings_public igual", async () => {
    const { id, publicId } = await h.seed({ status: "active" });
    const before = await h.anon.getPublic(publicId);
    expect((await save(id, { title: "Casa Coco frente al mar" })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error).toBeNull();
    expect((await owner.rpc("submit_edit", { p_listing: id })).data).toBe("review");
    expect(await h.anon.getPublic(publicId)).toEqual(before);
    expect((await serviceClient().from("listings").select("title, status").eq("id", id).single()).data).toEqual({ title: "Cabina Cahuita", status: "active" });
    expect((await owner.from("listing_edits").select("status, title").eq("listing_id", id).single()).data).toEqual({ status: "review", title: "Casa Coco frente al mar" });
  });

  it("una segunda edición en revisión no se abre ni se cambia", async () => {
    const { id } = await h.seed({ status: "active" });
    await save(id, { title: "Casa Coco frente al mar" });
    const photo = (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    await owner.rpc("submit_edit", { p_listing: id });
    expect((await owner.rpc("start_edit", { p_listing: id })).error?.message).toBe(inReview);
    expect((await save(id, { title: "Casa Coco del Caribe" })).error?.message).toBe(inReview);
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error?.message).toBe(inReview);
    expect((await owner.rpc("remove_edit_photo", { p_photo: photo.id })).error?.message).toBe(inReview);
    expect((await owner.rpc("reorder_edit_photos", { p_listing: id, p_ids: [photo.id] })).error?.message).toBe(inReview);
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe(inReview);
    expect((await owner.from("listing_edits").select("title").eq("listing_id", id).single()).data?.title).toBe("Casa Coco frente al mar");
  });

  it("start_edit devuelve la edición abierta o crea una vacía", async () => {
    const { id } = await h.seed({ status: "active" });
    const first = await owner.rpc("start_edit", { p_listing: id });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ listing_id: id, status: "open", title: null });
    await save(id, { title: "Casa Coco frente al mar" });
    expect((await owner.rpc("start_edit", { p_listing: id })).data).toMatchObject({ status: "open", title: "Casa Coco frente al mar" });
  });

  it("guardar el valor aprobado no cuenta como cambio y una edición vacía se borra", async () => {
    const { id } = await h.seed({ status: "active", draft: { title: "Cabina Cahuita" } });
    await save(id, { title: "Casa Coco frente al mar" });
    const { data, error } = await save(id, { title: "Cabina Cahuita" });
    expect(error).toBeNull();
    expect(gone(data)).toBe(true);
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
  });

  it("la ubicación igual a la aprobada no cuenta; el tipo y el baño se comparan cada uno", async () => {
    const { id } = await h.seed({ status: "active" });
    const same = { lat: 9.7366, lng: -82.8431, zone: "Cahuita", zone_id: "704-cahuita", zone_source: "list" };
    expect(gone((await save(id, same)).data)).toBe(true);
    expect(gone((await save(id, { kind: "completo" })).data)).toBe(true);
    const room = await save(id, { kind: "habitacion", bathroom_shared: true });
    expect(room.data).toMatchObject({ kind: "habitacion", bathroom_shared: true, lat: null });
    const moved = await save(id, { ...same, lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_id: "704-puerto-viejo" });
    expect(moved.data).toMatchObject({ kind: "habitacion", lat: 9.6553, zone: "Puerto Viejo", zone_source: "list" });
    expect((await save(id, same)).data).toMatchObject({ kind: "habitacion", lat: null, lng: null, zone: null, zone_id: null, zone_source: null });
  });

  it("save_edit rechaza claves fuera de las nueve, una ubicación a medias y textos largos", async () => {
    const { id } = await h.seed({ status: "active" });
    const notHere = "Ese dato no se puede cambiar aquí.";
    expect((await save(id, { nightly_price_crc: 50000 })).error?.message).toBe(notHere);
    expect((await save(id, { status: "review" })).error?.message).toBe(notHere);
    expect((await save(id, { lat: 9.6553, lng: -82.7536 })).error?.message).toBe(notHere);
    expect((await save(id, { kind: "castillo" })).error?.message).toBe(notHere);
    expect((await save(id, { lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_source: "mapa" })).error?.message).toBe(notHere);
    expect((await save(id, { description: "x".repeat(2001) })).error?.message).toBe("La descripción debe tener entre 80 y 2000 caracteres.");
    expect((await save(id, { lat: 9.6553, lng: -82.7536, zone: "z".repeat(61), zone_source: "other" })).error?.message).toBe("La zona puede tener como mucho 60 caracteres.");
    expect((await save(id, { title: "C".repeat(61) })).error?.message).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
  });

  it("submit_edit rechaza una zona a 10 km, un nombre de 4 letras y una edición vacía", async () => {
    const { id } = await h.seed({ status: "active" });
    // Zona Cahuita con el pin en Puerto Viejo, a más de 10 km.
    await save(id, { lat: 9.6553, lng: -82.7536, zone: "Cahuita", zone_id: "704-cahuita", zone_source: "list" });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
    await owner.rpc("discard_edit", { p_listing: id });
    expect((await save(id, { title: "Casa" })).error?.message).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("No encontramos esa edición.");
    await owner.rpc("start_edit", { p_listing: id });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("No hay cambios que enviar.");
  });

  it("submit_edit valida la casa resultante: baño de la habitación, descripción y habitaciones", async () => {
    const { id } = await h.seed({ status: "active", draft: { bedrooms: 0 } });
    await save(id, { kind: "habitacion" });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.");
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { bedrooms: 1 } })).error).toBeNull();
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("Indique si el baño es privado o compartido.");
    await save(id, { bathroom_shared: false, description: "Muy corta." });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("La descripción debe tener entre 80 y 2000 caracteres.");
    await save(id, { description: "" });
    expect((await owner.rpc("submit_edit", { p_listing: id })).data).toBe("review");
  });

  it("fotos nuevas: aprobadas + nuevas ≤ 15; discard devuelve sus rutas y borra la edición", async () => {
    const { id } = await h.seed({ status: "active", photos: 13 });
    const p = () => `${id}/${crypto.randomUUID()}`;
    const [a, b] = [p(), p()];
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: a })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: b })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: p() })).error?.message).toBe("Máximo 15 fotos.");
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: "otra/ruta" })).error?.message).toBe("Ruta de foto no válida.");
    expect((await owner.rpc("discard_edit", { p_listing: id })).data).toEqual([a, b]);
    expect((await serviceClient().from("listing_edit_photos").select("id").eq("listing_id", id)).data).toEqual([]);
    expect((await serviceClient().from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    expect((await owner.rpc("discard_edit", { p_listing: id })).data).toEqual([]);
  });

  it("fotos nuevas: posiciones seguidas, ordenar con el conjunto exacto, quitar recompacta y la última vacía la edición", async () => {
    const { id } = await h.seed({ status: "active" });
    const add = async () => (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    const [a, b, c] = [await add(), await add(), await add()];
    expect([a.position, b.position, c.position]).toEqual([0, 1, 2]);
    expect((await owner.rpc("reorder_edit_photos", { p_listing: id, p_ids: [c.id, a.id] })).error?.message).toBe("La lista de fotos cambió. Vuelva a intentarlo.");
    expect((await owner.rpc("reorder_edit_photos", { p_listing: id, p_ids: [c.id, a.id, b.id] })).error).toBeNull();
    expect((await owner.rpc("remove_edit_photo", { p_photo: a.id })).data).toBe(a.path);
    const rows = (await owner.from("listing_edit_photos").select("id, position").eq("listing_id", id).order("position")).data;
    expect(rows).toEqual([{ id: c.id, position: 0 }, { id: b.id, position: 1 }]);
    expect((await other.rpc("remove_edit_photo", { p_photo: b.id })).error?.message).toBe("No encontramos esa foto.");
    await owner.rpc("remove_edit_photo", { p_photo: b.id });
    await owner.rpc("remove_edit_photo", { p_photo: c.id });
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
  });

  it("otro propietario no edita mi casa; un borrador no tiene ediciones", async () => {
    const { id } = await h.seed({ status: "active" });
    const draft = await h.seed({ status: "draft" });
    const notFound = "No encontramos ese anuncio.";
    expect((await save(id, { title: "Casa Coco frente al mar" }, other)).error?.message).toBe(notFound);
    expect((await other.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error?.message).toBe(notFound);
    expect((await other.rpc("submit_edit", { p_listing: id })).error?.message).toBe(notFound);
    expect((await other.rpc("discard_edit", { p_listing: id })).error?.message).toBe(notFound);
    expect((await other.rpc("start_edit", { p_listing: id })).error?.message).toBe(notFound);
    expect((await save(draft.id, { title: "Casa Coco frente al mar" })).error?.message).toBe("Solo puede cambiar así una casa publicada.");
    expect((await anonClient().rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco" } })).error).not.toBeNull();
    expect((await anonClient().rpc("listing_edit_check" as never, {} as never)).error).not.toBeNull();
  });

  it("Storage: con la edición en revisión no se sube; descartada, se vuelve a poder", async () => {
    const { id } = await h.seed({ status: "active" });
    const up = () => owner.storage.from("listings").upload(`${id}/${crypto.randomUUID()}/800.jpg`, JPEG, { contentType: "image/jpeg" });
    await save(id, { title: "Casa Coco frente al mar" });
    expect((await up()).error).toBeNull();
    await owner.rpc("submit_edit", { p_listing: id });
    expect((await up()).error).not.toBeNull();
    await owner.rpc("discard_edit", { p_listing: id });
    expect((await up()).error).toBeNull();
  });
});
