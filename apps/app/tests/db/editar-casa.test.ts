// Migraciones editar_casa_* y revision_por_dato (spec .scratch/editar-casa; revisión UX 2026-10-29, A5): una casa
// publicada cambia al momento sus datos sin revisión (update_listing_live), no vuelve nunca a borrador, ordena y quita
// fotos pero no las añade directamente (pasan por la edición). Cada dato con revisión y cada foto nueva va a revisión al
// guardarse, con su estado; el admin decide dato a dato. Storage deja subir a su carpeta y borrar solo objetos que ya no
// enlaza ninguna foto. Las tablas de la edición solo se leen (dueño y admin); se escriben por RPC.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn, signInAdmin, sql } from "./local";
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
    // Con el tipo de parqueo ya dicho, no se puede vaciar (sin parqueo antes, añadirlo sin decirlo se guarda: ver abajo).
    const parked = await h.seed({ status: "active", draft: { features: ["wifi", "parking"], parkingPaid: true } });
    expect((await live(parked.id, { parking_paid: null })).error?.message).toBe("Indique si el parqueo es gratuito o de pago.");
    expect((await live(active.id, { parking_paid: true })).error?.message).toBe("El tipo de parqueo solo aplica si el anuncio tiene parqueo.");
    const monthly = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: 650000 } });
    expect((await live(monthly.id, { monthly_price_crc: 0 })).error?.message).toBe("Indique el precio al mes en colones o déjelo vacío.");
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

  // ---- Editar sigue las reglas de crear (ronda de Ana del 2026-11-02, ticket 12): cada dato valida solo ese dato ----
  it("update_listing_live: una casa publicada sin baños cambia el precio", async () => {
    const nobath = await h.seed({ status: "active", draft: { bathrooms: null } });
    expect((await live(nobath.id, { nightly_price_crc: 55000 })).error).toBeNull();
    expect(await h.owner("owner").getOwn(nobath.id)).toMatchObject({ nightlyPriceCrc: 55000, bathrooms: null, status: "active" });
  });

  it("update_listing_live: borrar la capacidad de una casa que la tenía falla; un dato que estaba vacío puede seguir vacío", async () => {
    const full = await h.seed({ status: "active" });
    for (const [patch, message] of [
      [{ capacity: null }, "Indique cuántas personas pueden alojarse (mínimo 1)."],
      [{ capacity: 0 }, "Indique cuántas personas pueden alojarse (mínimo 1)."],
      [{ bathrooms: null }, "Indique el número de baños (mínimo 1)."],
      [{ bedrooms: null }, "Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0."],
      [{ nightly_price_crc: null }, "Indique el precio por noche en colones."],
    ] as const) expect((await live(full.id, patch)).error?.message, JSON.stringify(patch)).toBe(message);
    expect(await h.owner("owner").getOwn(full.id)).toMatchObject({ capacity: 2, bedrooms: 1, bathrooms: 1, nightlyPriceCrc: 42000 });
    // Sin baños antes: se cambian las personas dejando los baños vacíos, y un 0 se guarda vacío (como «Continuar» al crear).
    const nobath = await h.seed({ status: "active", draft: { bathrooms: null } });
    expect((await live(nobath.id, { capacity: 4, bathrooms: null })).error).toBeNull();
    expect((await live(nobath.id, { bathrooms: 0 })).error).toBeNull();
    expect(await h.owner("owner").getOwn(nobath.id)).toMatchObject({ capacity: 4, bathrooms: null });
    // Sin parqueo antes: añadirlo sin decir si se paga se guarda.
    expect((await live(full.id, { features: ["wifi", "parking"] })).error).toBeNull();
    expect(await h.owner("owner").getOwn(full.id)).toMatchObject({ features: ["wifi", "parking"], parkingPaid: null });
  });

  it("update_listing_live: el precio al mes a 0 falla si tenía valor; sin valor antes, queda vacío", async () => {
    const priced = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: 650000 } });
    expect((await live(priced.id, { monthly_price_crc: 0 })).error?.message).toBe("Indique el precio al mes en colones o déjelo vacío.");
    expect((await live(priced.id, { monthly_price_crc: null })).error).toBeNull();
    const negotiable = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: null } });
    expect((await live(negotiable.id, { monthly_price_crc: 0 })).error).toBeNull();
    expect((await h.owner("owner").getOwn(negotiable.id))?.monthlyPriceCrc).toBeNull();
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
    expect((await owner.from("listings").update({ status: "draft" }).eq("id", id)).error?.message).toBe("Solo 3bstays puede cambiar el estado de un anuncio.");
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
    expect((await other.from("listing_edits").select("listing_id, title").eq("listing_id", id)).data).toEqual([]);
    expect((await other.from("listing_edit_photos").select("*").eq("listing_id", id)).data).toEqual([]);
    expect((await owner.from("listing_edits").select("title").eq("listing_id", id)).data).toEqual([{ title: "Casa Coco frente al mar" }]);
    // Quién revisó y cuándo no es del propietario: ni esas columnas ni «*».
    for (const columns of ["reviewed_by", "reviewed_at", "*"]) {
      expect((await owner.from("listing_edits").select(columns).eq("listing_id", id)).error?.message).toMatch(/permission denied/);
    }
    expect((await owner.from("listing_edit_photos").select("id").eq("listing_id", id)).data).toHaveLength(1);
    expect((await owner.from("listing_edits").update({ title: "Casa Coco" }).eq("listing_id", id)).error).not.toBeNull();
    expect((await owner.from("listing_edits").delete().eq("listing_id", id)).error).not.toBeNull();
    expect((await owner.from("listing_edit_photos").insert({ listing_id: id, path: `${id}/${crypto.randomUUID()}` })).error).not.toBeNull();
    expect((await owner.from("listing_edits").insert({ listing_id: (await h.seed({ status: "active" })).id })).error).not.toBeNull();
  });

  it("Storage: subir a una casa activa sí, también con cambios en revisión (revisión por dato); a una ajena o en revisión, no", async () => {
    const { id } = await h.seed({ status: "active" });
    const up = () => owner.storage.from("listings").upload(`${id}/${crypto.randomUUID()}/800.jpg`, JPEG, { contentType: "image/jpeg" });
    expect((await up()).error).toBeNull();
    sql(`insert into public.listing_edits (listing_id, status, title) values ('${id}', 'review', 'Casa Coco frente al mar')`);
    expect((await up()).error).toBeNull();
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

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    other = await signIn("other");
  });
  beforeEach(() => h.reset());

  const save = (id: string, p: object, db = owner) => db.rpc("save_edit", { p_listing: id, p_patch: p as never });
  // PostgREST da un null compuesto como un objeto con todo null: la edición borrada se reconoce por listing_id.
  const gone = (data: { listing_id: string | null } | null) => (data?.listing_id ?? null) === null;

  /** Estado de cada dato pendiente: [campo, estado]. */
  const fields = async (id: string) =>
    ((await owner.from("listing_edit_fields").select("field, status").eq("listing_id", id).order("field")).data ?? []).map((f) => [f.field, f.status]);

  it("save_edit envía el dato a revisión al momento; add_edit_photo, la foto; listings y listings_public no cambian", async () => {
    const { id, publicId } = await h.seed({ status: "active" });
    const before = await h.anon.getPublic(publicId);
    const saved = await save(id, { title: "Casa Coco frente al mar" });
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({ status: "review", title: "Casa Coco frente al mar" });
    expect(await fields(id)).toEqual([["title", "review"]]);
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error).toBeNull();
    expect((await owner.from("listing_edit_photos").select("status").eq("listing_id", id)).data).toEqual([{ status: "review" }]);
    expect(await h.anon.getPublic(publicId)).toEqual(before);
    expect((await serviceClient().from("listings").select("title, status").eq("id", id).single()).data).toEqual({ title: "Cabina Cahuita", status: "active" });
  });

  it("con cambios en revisión se puede cambiar otro dato o el mismo otra vez: cuenta el último valor, con su nueva fecha", async () => {
    const { id } = await h.seed({ status: "active" });
    await save(id, { title: "Casa Coco frente al mar" });
    const first = (await owner.from("listing_edit_fields").select("submitted_at").eq("listing_id", id).single()).data!.submitted_at;
    const photo = (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    expect((await save(id, { title: "Casa Coco del Caribe" })).data).toMatchObject({ title: "Casa Coco del Caribe" });
    expect((await save(id, { kind: "completo" })).error).toBeNull();
    expect((await save(id, { kind: "habitacion", bathroom_shared: true })).error).toBeNull();
    expect(await fields(id)).toEqual([["kind", "review"], ["title", "review"]]);
    const again = (await owner.from("listing_edit_fields").select("submitted_at").eq("listing_id", id).eq("field", "title").single()).data!.submitted_at;
    expect(again > first).toBe(true);
    expect((await owner.rpc("start_edit", { p_listing: id })).error).toBeNull();
    expect((await owner.rpc("reorder_edit_photos", { p_listing: id, p_ids: [photo.id] })).error).toBeNull();
    expect((await owner.rpc("remove_edit_photo", { p_photo: photo.id })).data).toBe(photo.path);
  });

  it("start_edit devuelve la edición que haya o crea una vacía", async () => {
    const { id } = await h.seed({ status: "active" });
    const first = await owner.rpc("start_edit", { p_listing: id });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ listing_id: id, title: null });
    await save(id, { title: "Casa Coco frente al mar" });
    expect((await owner.rpc("start_edit", { p_listing: id })).data).toMatchObject({ status: "review", title: "Casa Coco frente al mar" });
  });

  it("guardar el valor aprobado saca el dato de la revisión y una edición vacía se borra", async () => {
    const { id } = await h.seed({ status: "active", draft: { title: "Cabina Cahuita" } });
    await save(id, { title: "Casa Coco frente al mar" });
    const { data, error } = await save(id, { title: "Cabina Cahuita" });
    expect(error).toBeNull();
    expect(gone(data)).toBe(true);
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    expect(await fields(id)).toEqual([]);
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
    expect(await fields(id)).toEqual([["kind", "review"], ["location", "review"]]);
    expect((await save(id, same)).data).toMatchObject({ kind: "habitacion", lat: null, lng: null, zone: null, zone_id: null, zone_source: null });
    expect(await fields(id)).toEqual([["kind", "review"]]);
  });

  it("save_edit rechaza claves fuera de las nueve, una ubicación a medias y textos largos", async () => {
    const { id } = await h.seed({ status: "active" });
    const notHere = "Ese dato no se puede cambiar aquí.";
    expect((await save(id, { nightly_price_crc: 50000 })).error?.message).toBe(notHere);
    expect((await save(id, { status: "review" })).error?.message).toBe(notHere);
    expect((await save(id, { lat: 9.6553, lng: -82.7536 })).error?.message).toBe(notHere);
    expect((await save(id, { kind: "castillo" })).error?.message).toBe(notHere);
    expect((await save(id, { lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_source: "mapa" })).error?.message).toBe(notHere);
    expect((await save(id, { description: "x".repeat(2001) })).error?.message).toBe("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
    expect((await save(id, { lat: 9.6553, lng: -82.7536, zone: "z".repeat(61), zone_source: "other" })).error?.message).toBe("La zona puede tener como mucho 60 caracteres.");
    expect((await save(id, { title: "C".repeat(33) })).error?.message).toBe("El nombre de la casa debe tener entre 5 y 32 caracteres.");
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
  });

  it("una ubicación sin zone_id no hereda la zona de la lista de un guardado anterior", async () => {
    const { id } = await h.seed({ status: "active" });
    await save(id, { lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_id: "704-puerto-viejo", zone_source: "list" });
    const other_ = await save(id, { lat: 9.6553, lng: -82.7536, zone: "Mi finca", zone_source: "other" });
    expect(other_.data).toMatchObject({ zone: "Mi finca", zone_id: null, zone_source: "other" });
    // Volver a la ubicación aprobada (zona propia, sin zone_id) tras una de la lista no cuenta como cambio.
    const own = await h.seed({ status: "active", draft: { zone: "Mi finca", zoneId: null, zoneSource: "other" } });
    await save(own.id, { lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_id: "704-puerto-viejo", zone_source: "list" });
    expect(gone((await save(own.id, { lat: 9.7366, lng: -82.8431, zone: "Mi finca", zone_source: "other" })).data)).toBe(true);
  });

  it("el baño de un tipo que no es habitación no cuenta como cambio", async () => {
    const { id } = await h.seed({ status: "active" });
    expect(gone((await save(id, { kind: "completo", bathroom_shared: true })).data)).toBe(true);
    expect(gone((await save(id, { bathroom_shared: false })).data)).toBe(true);
  });

  it("al guardar se valida el dato con las reglas de submit_listing: zona a 10 km, nombre de 4 letras", async () => {
    const { id } = await h.seed({ status: "active" });
    // Zona Cahuita con el pin en Puerto Viejo, a más de 10 km.
    expect((await save(id, { lat: 9.6553, lng: -82.7536, zone: "Cahuita", zone_id: "704-cahuita", zone_source: "list" })).error?.message).toBe(
      "La zona elegida queda a más de 5 km del punto. Elija otra.",
    );
    expect((await save(id, { title: "Casa" })).error?.message).toBe("El nombre de la casa debe tener entre 5 y 32 caracteres.");
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
  });

  it("un nombre aprobado de 40 caracteres no bloquea otro cambio; un nombre nuevo de 33 sí se rechaza", async () => {
    const { id } = await h.seed({ status: "active" });
    sql(`begin; select set_config('app.allow_status','on',true); update public.listings set title = '${"N".repeat(40)}' where id = '${id}'; commit;`);
    expect((await save(id, { description: "D".repeat(100) })).error).toBeNull();
    expect(await fields(id)).toEqual([["description", "review"]]);
    expect((await save(id, { title: "T".repeat(33) })).error?.message).toBe("El nombre de la casa debe tener entre 5 y 32 caracteres.");
  });

  it("al guardar se valida solo ese dato: el tipo sin baño y la descripción corta se guardan; el tope y el nombre vacío no", async () => {
    // Un estudio (0 habitaciones) pasa a Habitación sin elegir el baño: como al crear, solo avisa la app (ticket 12).
    const { id } = await h.seed({ status: "active", draft: { bedrooms: 0 } });
    expect((await save(id, { kind: "habitacion" })).error).toBeNull();
    expect((await save(id, { kind: "habitacion", bathroom_shared: false })).error).toBeNull();
    expect((await save(id, { description: "Muy corta." })).error).toBeNull();
    expect((await save(id, { description: "a".repeat(2001) })).error?.message).toBe("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
    expect((await save(id, { title: "   " })).error?.message).toBe("Póngale un nombre a la casa.");
    expect((await save(id, { title: "" })).error?.message).toBe("Póngale un nombre a la casa.");
    expect((await save(id, { description: "" })).error).toBeNull();
    expect(await fields(id)).toEqual([["description", "review"], ["kind", "review"]]);
  });

  it("renombrar con una descripción de 50 caracteres funciona; una descripción de 50 se guarda; la ubicación no pide habitaciones", async () => {
    const { id } = await h.seed({ status: "active", draft: { description: "D".repeat(50), bedrooms: null } });
    expect((await save(id, { title: "Casa Coco frente al mar" })).error).toBeNull();
    expect((await save(id, { description: "E".repeat(50) })).error).toBeNull();
    expect((await save(id, { lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_id: "704-puerto-viejo", zone_source: "list" })).error).toBeNull();
    expect(await fields(id)).toEqual([["description", "review"], ["location", "review"], ["title", "review"]]);
    expect((await owner.from("listing_edits").select("title, description").eq("listing_id", id).single()).data).toEqual({ title: "Casa Coco frente al mar", description: "E".repeat(50) });
  });

  it("discard_edit_field descarta un dato y deja los demás; el último vacía la edición", async () => {
    const { id } = await h.seed({ status: "active" });
    await save(id, { title: "Casa Coco frente al mar", description: "D".repeat(100) });
    expect((await owner.rpc("discard_edit_field", { p_listing: id, p_field: "title" })).error).toBeNull();
    expect(await fields(id)).toEqual([["description", "review"]]);
    expect((await owner.from("listing_edits").select("title, description").eq("listing_id", id).single()).data).toEqual({ title: null, description: "D".repeat(100) });
    expect((await owner.rpc("discard_edit_field", { p_listing: id, p_field: "precio" })).error?.message).toBe("Ese dato no se puede cambiar aquí.");
    expect((await other.rpc("discard_edit_field", { p_listing: id, p_field: "description" })).error?.message).toBe("No encontramos ese anuncio.");
    await owner.rpc("discard_edit_field", { p_listing: id, p_field: "description" });
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    // Sin edición no falla.
    expect((await owner.rpc("discard_edit_field", { p_listing: id, p_field: "title" })).error).toBeNull();
  });

  it("fotos nuevas: aprobadas + nuevas ≤ 15; discard devuelve sus rutas y borra la edición", async () => {
    const { id } = await h.seed({ status: "active", photos: 13 });
    const p = () => `${id}/${crypto.randomUUID()}`;
    const [a, b] = [p(), p()];
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: a })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: b })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: p() })).error?.message).toBe("Máximo 15 fotos.");
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: "otra/ruta" })).error?.message).toBe("Ruta de foto no válida.");
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: a })).error?.message).toBe("Ruta de foto no válida.");
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
    expect((await other.rpc("discard_edit", { p_listing: id })).error?.message).toBe(notFound);
    expect((await other.rpc("start_edit", { p_listing: id })).error?.message).toBe(notFound);
    expect((await save(draft.id, { title: "Casa Coco frente al mar" })).error?.message).toBe("Solo puede cambiar así una casa publicada.");
    expect((await anonClient().rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco" } })).error).not.toBeNull();
    expect((await anonClient().rpc("listing_edit_check" as never, {} as never)).error).not.toBeNull();
    // Los ayudantes no se llaman ni con sesión.
    expect((await owner.rpc("edit_place", { p_lat: 9.6553, p_lng: -82.7536, p_zone: "Puerto Viejo", p_zone_id: "704-puerto-viejo", p_zone_source: "list" })).error?.code).toBe("42501");
    expect((await owner.rpc("listing_status_published", { p_status: "active", p_first: new Date().toISOString() })).error?.code).toBe("42501");
    expect((await owner.rpc("listing_edit_sync", { p_listing: id })).error?.code).toBe("42501");
  });

  it("RLS: listing_edit_fields solo la leen el dueño y el admin, y nadie la escribe", async () => {
    const { id } = await h.seed({ status: "active" });
    await save(id, { title: "Casa Coco frente al mar" });
    expect((await anonClient().from("listing_edit_fields").select("*")).data ?? []).toEqual([]);
    expect((await other.from("listing_edit_fields").select("*").eq("listing_id", id)).data).toEqual([]);
    expect((await owner.from("listing_edit_fields").update({ status: "changes" }).eq("listing_id", id)).error).not.toBeNull();
    expect((await owner.from("listing_edit_fields").delete().eq("listing_id", id)).error).not.toBeNull();
    expect(await fields(id)).toEqual([["title", "review"]]);
  });
});

describe("revisión dato a dato", () => {
  let h: ListingsHarness;
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let admin: SupabaseClient<Database>;
  let adminAal1: SupabaseClient<Database>;

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    other = await signIn("other");
    admin = await signInAdmin();
    adminAal1 = await signIn("admin");
  });
  beforeEach(() => h.reset());

  /** submitted_at del dato tal como lo vio el admin al abrirlo (null si no está pendiente). */
  const seenAt = async (id: string, field: string) =>
    (await serviceClient().from("listing_edit_fields").select("submitted_at").eq("listing_id", id).eq("field", field).maybeSingle()).data?.submitted_at ?? null;
  const review = async (id: string, field: string, decision: string, note = "", db = admin, seen?: string | null) =>
    db.rpc("review_edit_field", { p_listing: id, p_field: field, p_decision: decision, p_note: note, p_submitted_at: (seen === undefined ? await seenAt(id, field) : seen)! });
  const photoSeen = async (photo: string) => (await serviceClient().from("listing_edit_photos").select("submitted_at").eq("id", photo).maybeSingle()).data?.submitted_at ?? null;
  const reviewPhoto = async (photo: string, decision: string, note = "", db = admin, seen?: string | null) =>
    db.rpc("review_edit_photo", { p_photo: photo, p_decision: decision, p_note: note, p_submitted_at: (seen === undefined ? await photoSeen(photo) : seen)! });
  /** Un nombre nuevo enviado a revisión. */
  async function sent() {
    const seeded = await h.seed({ status: "active" });
    expect((await owner.rpc("save_edit", { p_listing: seeded.id, p_patch: { title: "Casa Coco frente al mar" } })).error).toBeNull();
    return seeded;
  }

  // Zona: Puerto Viejo (704-puerto-viejo, a 132 m del pin 9.6553, -82.7536 según zones_near de 20261028070328_zonas.sql).
  it("aprobar cada dato lo publica al momento y deja los demás pendientes; con todo aprobado la edición desaparece", async () => {
    const { id, publicId } = await h.seed({ status: "active", photos: 5 });
    const before = (await serviceClient().from("listings").select("status, first_published_at").eq("id", id).single()).data!;
    const desc = "Casa de madera frente a Playa Cocles, con terraza y hamacas, a cinco minutos a pie del pueblo y del arrecife.";
    await owner.rpc("save_edit", {
      p_listing: id,
      p_patch: { title: "Casa Coco frente al mar", description: desc, kind: "habitacion", bathroom_shared: true, lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_id: "704-puerto-viejo", zone_source: "list" },
    });
    const paths = [`${id}/${crypto.randomUUID()}`, `${id}/${crypto.randomUUID()}`];
    const photos = [];
    for (const path of paths) photos.push((await owner.rpc("add_edit_photo", { p_listing: id, p_path: path })).data![0]!);

    expect((await review(id, "title", "approve")).data).toBe("approved");
    expect((await h.anon.getPublic(publicId))?.title).toBe("Casa Coco frente al mar");
    expect((await serviceClient().from("listing_edits").select("title, description").eq("listing_id", id).single()).data).toEqual({ title: null, description: desc });
    for (const f of ["description", "kind", "location"]) expect((await review(id, f, "approve")).data).toBe("approved");
    for (const ph of photos) expect((await reviewPhoto(ph.id, "approve")).data).toBe("approved");

    const after = (await serviceClient().from("listings").select("*").eq("id", id).single()).data!;
    expect(after).toMatchObject({
      title: "Casa Coco frente al mar", description: desc, kind: "habitacion", bathroom_shared: true, lat: 9.6553, lng: -82.7536,
      zone: "Puerto Viejo", zone_id: "704-puerto-viejo", zone_source: "list", canton: "Talamanca", province: "Limón", district: "Cahuita",
      status: before.status, first_published_at: before.first_published_at,
    });
    const approved = (await serviceClient().from("listing_photos").select("path, position").eq("listing_id", id).order("position")).data!;
    expect(approved.slice(5)).toEqual([{ path: paths[0], position: 5 }, { path: paths[1], position: 6 }]);
    expect((await serviceClient().from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    expect((await serviceClient().from("admin_actions").select("reason").eq("target_listing_id", id).eq("action", "edit.approve").order("created_at")).data!.map((a) => a.reason)).toEqual([
      "title", "description", "kind", "location", "foto", "foto",
    ]);
  });

  it("aprobar el nombre y pedir cambios en una foto: el nombre se publica y la foto queda con su nota", async () => {
    const { id, publicId } = await sent();
    const photo = (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    expect((await review(id, "title", "approve")).data).toBe("approved");
    expect((await reviewPhoto(photo.id, "changes", " Se ve un teléfono. ")).data).toBe("changes");
    expect((await h.anon.getPublic(publicId))?.title).toBe("Casa Coco frente al mar");
    expect((await owner.from("listing_edit_photos").select("status, review_note").eq("id", photo.id).single()).data).toEqual({ status: "changes", review_note: "Se ve un teléfono." });
    // Nada espera al admin: la edición queda con cambios pedidos.
    expect((await owner.from("listing_edits").select("status, submitted_at").eq("listing_id", id).single()).data).toEqual({ status: "changes", submitted_at: null });
  });

  it("aprobar un cambio a alojamiento completo borra el baño y deja lo que no cambia", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    await owner.rpc("save_edit", { p_listing: id, p_patch: { kind: "completo" } });
    expect((await review(id, "kind", "approve")).data).toBe("approved");
    const after = (await serviceClient().from("listings").select("kind, bathroom_shared, title, zone, lat").eq("id", id).single()).data;
    expect(after).toEqual({ kind: "completo", bathroom_shared: null, title: "Cabina Cahuita", zone: "Cahuita", lat: 9.7366 });
  });

  it("approve vuelve a validar el baño; las habitaciones ya no estorban: un cambio a Habitación con 0 se aprueba y deja 1", async () => {
    // Carrera: se envía con 1 habitación; mientras espera, el anfitrión baja a 0 al momento (lo permite el tipo aprobado, completo).
    const { id } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 1 } });
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { kind: "habitacion", bathroom_shared: false } })).error).toBeNull();
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { bedrooms: 0 } })).error).toBeNull();
    expect((await review(id, "kind", "approve")).data).toBe("approved");
    expect((await serviceClient().from("listings").select("kind, bedrooms").eq("id", id).single()).data).toEqual({ kind: "habitacion", bedrooms: 1 });
  });

  it("aprobar una foto con 15 aprobadas se rechaza", async () => {
    const { id } = await h.seed({ status: "active", photos: 14 });
    const photo = (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    await serviceClient().from("listing_photos").insert({ listing_id: id, path: `${id}/${crypto.randomUUID()}`, position: 14 });
    expect((await reviewPhoto(photo.id, "approve")).error?.message).toBe("Máximo 15 fotos.");
  });

  it("pedir cambios exige nota; el propietario la ve y, al guardar otra vez, vuelve a revisión sin nota", async () => {
    const { id } = await sent();
    expect((await review(id, "title", "changes", "  ")).error?.message).toBe("Escriba una nota para pedir cambios.");
    expect((await review(id, "title", "reject", "No.")).error?.message).toBe("Decisión no válida.");
    expect((await review(id, "title", "changes", " Sin mayúsculas, por favor. ")).data).toBe("changes");
    expect((await owner.from("listing_edit_fields").select("status, review_note").eq("listing_id", id).single()).data).toEqual({
      status: "changes", review_note: "Sin mayúsculas, por favor.",
    });
    const action = (await serviceClient().from("admin_actions").select("reason").eq("target_listing_id", id).eq("action", "edit.changes")).data;
    expect(action).toEqual([{ reason: "title: Sin mayúsculas, por favor." }]);
    expect((await serviceClient().from("listings").select("title, status").eq("id", id).single()).data).toEqual({ title: "Cabina Cahuita", status: "active" });
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco del Caribe" } })).error).toBeNull();
    expect((await owner.from("listing_edit_fields").select("status, review_note").eq("listing_id", id).single()).data).toEqual({ status: "review", review_note: null });
  });

  it("un dato reenviado o descartado tras abrirlo no se decide: ni se aprueba ni se piden cambios sobre lo que el admin no vio", async () => {
    const { id } = await sent();
    const seen = await seenAt(id, "title");
    expect(seen).not.toBeNull();
    await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa B que el admin no vio" } });
    expect(await seenAt(id, "title")).not.toBe(seen);
    expect((await review(id, "title", "approve", "", admin, seen)).error?.message).toBe("La edición cambió. Vuelva a abrirla.");
    expect((await review(id, "title", "changes", "Cambie el nombre.", admin, seen)).error?.message).toBe("La edición cambió. Vuelva a abrirla.");
    expect((await serviceClient().from("listings").select("title").eq("id", id).single()).data?.title).toBe("Cabina Cahuita");
    expect((await serviceClient().from("admin_actions").select("action").eq("target_listing_id", id).like("action", "edit.%")).data).toEqual([]);
    await owner.rpc("discard_edit_field", { p_listing: id, p_field: "title" });
    expect((await review(id, "title", "approve", "", admin, seen)).error?.message).toBe("La edición cambió. Vuelva a abrirla.");
    const photo = (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    const shown = await photoSeen(photo.id);
    await owner.rpc("remove_edit_photo", { p_photo: photo.id });
    expect((await reviewPhoto(photo.id, "approve", "", admin, shown)).error?.message).toBe("La edición cambió. Vuelva a abrirla.");
  });

  it("quien no es admin y el admin sin segundo código no deciden; lo ya decidido no se decide otra vez", async () => {
    const { id } = await sent();
    expect((await review(id, "title", "approve", "", other)).error?.message).toBe("Solo 3bstays puede revisar anuncios.");
    expect((await review(id, "title", "approve", "", owner)).error?.message).toBe("Solo 3bstays puede revisar anuncios.");
    expect((await review(id, "title", "approve", "", adminAal1)).error?.message).toBe("Confirme el segundo código para revisar anuncios.");
    expect((await review(id, "title", "approve", "", anonClient())).error).not.toBeNull();
    expect((await review(crypto.randomUUID(), "title", "approve")).error?.message).toBe("No encontramos esa edición.");
    expect((await review(id, "title", "changes", "Cambie el nombre.")).error).toBeNull();
    expect((await review(id, "title", "approve")).error?.message).toBe("Esta edición ya tiene una decisión.");
    const photo = (await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).data![0]!;
    expect((await reviewPhoto(photo.id, "approve", "", adminAal1)).error?.message).toBe("Confirme el segundo código para revisar anuncios.");
  });

  it("el admin lee ediciones, sus datos pendientes y sus fotos; con aal1 no", async () => {
    const { id } = await sent();
    await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` });
    expect((await admin.from("listing_edits").select("status, title").eq("listing_id", id)).data).toEqual([{ status: "review", title: "Casa Coco frente al mar" }]);
    expect((await admin.from("listing_edit_fields").select("field, status").eq("listing_id", id)).data).toEqual([{ field: "title", status: "review" }]);
    expect((await admin.from("listing_edit_photos").select("id").eq("listing_id", id)).data).toHaveLength(1);
    expect((await adminAal1.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    expect((await adminAal1.from("listing_edit_fields").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    expect((await adminAal1.from("listing_edit_photos").select("id").eq("listing_id", id)).data).toEqual([]);
  });
});
