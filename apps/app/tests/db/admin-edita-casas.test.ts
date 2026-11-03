// Migración admin_edita_casas (ronda de Ana del 2 nov, ticket 10): lo que el adaptador y la suite de contrato no ven. Las
// RPCs admin_* solo las llama un admin con el segundo factor (aal2): ni el anfitrión (tampoco sobre su propia casa), ni otro
// usuario, ni el admin en aal1, ni sin sesión; una casa eliminada no se edita; los núcleos que comparten con las RPCs del
// anfitrión no se llaman desde fuera; Storage deja subir y borrar al admin en la carpeta de cualquier casa (no eliminada)
// y el anfitrión sigue sin poder subir a una ajena.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import { REVIEW_MESSAGES as M } from "../../src/domain/review";
import type { SubscriptionHarness } from "../contract/harness";
import { anonClient, signIn, signInAdmin } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const folderOf = (listingId: string) => `${listingId}/${crypto.randomUUID()}`;

describe("admin · editar casas · en la base", () => {
  let h: SubscriptionHarness;
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let admin: SupabaseClient<Database>;
  let aal1: SupabaseClient<Database>;

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    other = await signIn("other");
    admin = await signInAdmin();
    aal1 = await signIn("admin");
  }, 60_000);
  beforeEach(() => h.reset(), 60_000);

  /** Las seis RPCs del admin sobre una casa (y una de sus fotos). */
  const calls = (db: SupabaseClient<Database>, listingId: string, photoId: string) => [
    db.rpc("admin_update_listing", { p_listing: listingId, p_patch: { nightly_price_crc: 1000 } }),
    db.rpc("admin_submit_listing", { p_listing: listingId }),
    db.rpc("admin_add_listing_photo", { p_listing: listingId, p_path: folderOf(listingId) }),
    db.rpc("admin_remove_listing_photo", { p_photo: photoId }),
    db.rpc("admin_reorder_listing_photos", { p_listing: listingId, p_ids: [photoId] }),
    db.rpc("admin_save_listing_days", { p_listing: listingId, p_days: [addDays(costaRicaToday(Date.now()), 3)], p_available: false }),
  ];
  const firstPhoto = async (listingId: string) => (await h.adminEdit("aal2").get(listingId))!.photos[0]!.id;

  it("solo el admin en aal2: el anfitrión (también con su propia casa), otro usuario, el admin en aal1 y sin sesión, no", async () => {
    const s = await h.seed({ status: "active", photos: 2 });
    const photo = await firstPhoto(s.id);
    for (const db of [owner, other]) for (const r of await Promise.all(calls(db, s.id, photo))) expect(r.error?.message).toBe(M.adminOnly);
    for (const r of await Promise.all(calls(aal1, s.id, photo))) expect(r.error?.message).toBe(M.mfaRequired);
    for (const r of await Promise.all(calls(anonClient(), s.id, photo))) expect(r.error).not.toBeNull();
    const after = await h.owner("owner").getOwn(s.id);
    expect(after).toMatchObject({ nightlyPriceCrc: 42000, photoCount: 2 });
    expect(await h.calendar("owner").days(s.id)).toEqual([]);
    expect(await h.adminActions(s.id)).toEqual([]);
  });

  it("una casa eliminada no se edita (ni sus fotos ni su calendario)", async () => {
    const s = await h.seed({ status: "active", photos: 2 });
    const photo = await firstPhoto(s.id);
    await h.admin("aal2").deleteListing(s.id, "Duplicada.", s.publicId);
    const results = await Promise.all(calls(admin, s.id, photo));
    for (const r of results) expect(r.error?.message).toBe(M.notFound);
  });

  it("los núcleos compartidos con el anfitrión no se llaman desde fuera", async () => {
    const s = await h.seed({ status: "active" });
    const internal = [
      admin.rpc("listing_photo_insert" as never, { p_listing: s.id, p_path: folderOf(s.id) } as never),
      admin.rpc("listing_photos_order" as never, { p_listing: s.id, p_ids: [] } as never),
      admin.rpc("admin_log_edit" as never, { p_listing: s.id } as never),
      owner.rpc("listing_photo_insert" as never, { p_listing: s.id, p_path: folderOf(s.id) } as never),
    ];
    for (const r of await Promise.all(internal)) expect(r.error).not.toBeNull();
    expect(await h.adminActions(s.id)).toEqual([]);
  });

  it("el admin no cambia el estado ni el dueño con admin_update_listing", async () => {
    const s = await h.seed({ status: "draft" });
    for (const patch of [{ status: "active" }, { owner_id: (await other.auth.getUser()).data.user!.id }, { first_published_at: new Date().toISOString() }, { whatsapp_phone: "+50670000000" }]) {
      expect((await admin.rpc("admin_update_listing", { p_listing: s.id, p_patch: patch })).error?.message).toBe("Ese dato no se puede cambiar aquí.");
    }
    expect((await h.owner("owner").getOwn(s.id))?.status).toBe("draft");
  });

  it("Storage: el admin sube a la carpeta de una casa ajena y borra lo que ninguna foto enlaza; el anfitrión no sube a una ajena", async () => {
    const theirs = await h.seed({ status: "active", as: "other" });
    const folder = folderOf(theirs.id);
    expect((await owner.storage.from("listings").upload(`${folder}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
    expect((await admin.storage.from("listings").upload(`${folder}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
    // Registrada como foto, el objeto ya no se borra; sin registrar, sí.
    const registered = folderOf(theirs.id);
    expect((await admin.storage.from("listings").upload(`${registered}/800.jpg`, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
    expect((await admin.rpc("admin_add_listing_photo", { p_listing: theirs.id, p_path: registered })).error).toBeNull();
    await admin.storage.from("listings").remove([`${folder}/800.jpg`, `${registered}/800.jpg`]);
    const names = (await h.objects(theirs.id)).map((o) => o.name);
    expect(names).toContain(`${registered}/800.jpg`);
    expect(names).not.toContain(`${folder}/800.jpg`);
  });

  it("el anfitrión sigue con sus RPCs de siempre (núcleos extraídos sin cambiar las reglas)", async () => {
    const s = await h.seed({ status: "active", photos: 1 });
    expect((await owner.rpc("update_listing_live", { p_listing: s.id, p_patch: { capacity: 5 } })).error).toBeNull();
    const photo = await firstPhoto(s.id);
    expect((await owner.rpc("remove_listing_photo", { p_photo: photo })).error?.message).toBe("Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.");
    expect((await owner.rpc("reorder_listing_photos", { p_listing: s.id, p_ids: [photo] })).error).toBeNull();
    expect((await owner.rpc("save_listing_days", { p_listing: s.id, p_days: [addDays(costaRicaToday(Date.now()), 2)], p_available: false })).error).toBeNull();
    // El de otro, no: el mismo mensaje de siempre.
    expect((await other.rpc("update_listing_live", { p_listing: s.id, p_patch: { capacity: 5 } })).error?.message).toBe(M.notFound);
    expect((await other.rpc("save_listing_days", { p_listing: s.id, p_days: [addDays(costaRicaToday(Date.now()), 2)], p_available: false })).error?.message).toBe(M.notFound);
    const draft = await h.seed({ status: "draft" });
    expect((await other.rpc("add_listing_photo", { p_listing: draft.id, p_path: folderOf(draft.id) })).error?.message).toBe(M.notFound);
    expect((await other.rpc("submit_listing", { p_listing: draft.id })).error?.message).toBe(M.notFound);
    expect(await h.adminActions(s.id)).toEqual([]);
  });
});
