// Migración admin_casas_acciones (spec .scratch/admin-casas-acciones): lo que no pasa por el adaptador y la suite de
// contrato no ve. La retención y el borrado son del admin: el propietario no los toca ni por REST, una casa bloqueada no
// admite ni la edición directa ni las fotos, una eliminada no la lee nadie por REST pero sus datos siguen en la base y las
// funciones de apoyo no se pueden llamar desde fuera.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import type { SubscriptionHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn, signInAdmin, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const REASON = "Datos por confirmar.";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("admin · pausar, bloquear y eliminar · en la base", () => {
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
  beforeEach(() => h.reset());

  const rpc = (db: SupabaseClient<Database>, fn: "admin_pause_listing" | "admin_block_listing", id: string, reason = REASON) => db.rpc(fn, { p_listing: id, p_reason: reason });

  it("las RPCs del admin exigen is_admin() en aal2 también por REST", async () => {
    const s = await h.seed({ status: "active" });
    expect((await rpc(owner, "admin_pause_listing", s.id)).error?.message).toBe(REVIEW_MESSAGES.adminOnly);
    expect((await rpc(anonClient(), "admin_block_listing", s.id)).error).not.toBeNull();
    expect((await rpc(aal1, "admin_pause_listing", s.id)).error?.message).toBe(REVIEW_MESSAGES.mfaRequired);
    expect((await owner.rpc("admin_delete_listing", { p_listing: s.id, p_reason: REASON, p_confirm: s.publicId })).error?.message).toBe(REVIEW_MESSAGES.adminOnly);
    expect((await h.owner("owner").getOwn(s.id))?.adminHold).toBeNull();
  });

  it("las funciones de apoyo no se llaman desde fuera", async () => {
    const s = await h.seed({ status: "active" });
    expect((await owner.rpc("assert_listing_open", { p_listing: s.id })).error).not.toBeNull();
    expect((await admin.rpc("admin_house_for_action", { p_listing: s.id })).error).not.toBeNull();
    expect((await admin.rpc("admin_hold_reason_text", { p_reason: "x" })).error).not.toBeNull();
  });

  it("el propietario no cambia la retención ni el borrado por REST, ni al insertar una casa", async () => {
    const s = await h.seed({ status: "active" });
    await rpc(admin, "admin_pause_listing", s.id);
    const hold = await owner.from("listings").update({ admin_hold: null, admin_hold_reason: null, admin_hold_at: null }).eq("id", s.id);
    expect(hold.error?.message).toBe("No puede cambiar ese dato.");
    const gone = await owner.from("listings").update({ deleted_at: new Date().toISOString(), deleted_reason: "x" }).eq("id", s.id);
    expect(gone.error?.message).toBe("No puede cambiar ese dato.");
    const { data } = await owner.from("listings").select("admin_hold, admin_hold_reason, deleted_at").eq("id", s.id).single();
    expect(data).toEqual({ admin_hold: "paused", admin_hold_reason: REASON, deleted_at: null });

    const id = (await owner.auth.getUser()).data.user!.id;
    const base = { owner_id: id, title: "", description: "", province: "Limón", whatsapp_phone: "+50687770001" };
    expect((await owner.from("listings").insert({ ...base, admin_hold: "paused", admin_hold_reason: "x", admin_hold_at: new Date().toISOString() })).error?.message).toBe("Un anuncio nuevo empieza como borrador.");
    expect((await owner.from("listings").insert({ ...base, deleted_at: new Date().toISOString(), deleted_reason: "x" })).error?.message).toBe("Un anuncio nuevo empieza como borrador.");
  });

  it("una casa bloqueada no se edita ni por REST; una pausada tampoco (ya estaba publicada: se edita desde su ficha)", async () => {
    const s = await h.seed({ status: "active" });
    await rpc(admin, "admin_block_listing", s.id);
    expect((await owner.from("listings").update({ title: "Otro nombre" }).eq("id", s.id)).error?.message).toBe("Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.");
    const { data } = await owner.from("listings").select("title").eq("id", s.id).single();
    expect(data?.title).toBe("Cabina Cahuita");
  });

  it("una casa bloqueada no admite fotos nuevas en Storage; una pausada sí", async () => {
    const blocked = await h.seed({ status: "active" });
    const paused = await h.seed({ status: "active" });
    await rpc(admin, "admin_block_listing", blocked.id);
    await rpc(admin, "admin_pause_listing", paused.id);
    const name = (id: string) => `${id}/${crypto.randomUUID()}/800.jpg`;
    const up = (id: string) => owner.storage.from("listings").upload(name(id), JPEG, { contentType: "image/jpeg" });
    expect((await up(blocked.id)).error).not.toBeNull();
    expect((await up(paused.id)).error).toBeNull();
  });

  it("una casa eliminada no la lee nadie por REST pero sus datos, fotos, consultas y suscripción siguen en la base", async () => {
    const s = await h.seed({ status: "active", draft: { title: "Casa a borrar" } });
    await h.favorites("other").add(s.publicId);
    await h.inquiries("other").create(s.publicId, { arrival: null, departure: null, people: null });
    expect((await admin.rpc("admin_delete_listing", { p_listing: s.id, p_reason: "Duplicada", p_confirm: s.publicId })).error).toBeNull();

    for (const db of [owner, admin, other]) {
      expect((await db.from("listings").select("id").eq("id", s.id)).data).toEqual([]);
      expect((await db.from("listing_photos").select("id").eq("listing_id", s.id)).data).toEqual([]);
      expect((await db.from("subscriptions").select("listing_id").eq("listing_id", s.id)).data).toEqual([]);
    }
    expect((await anonClient().from("listings_public").select("id").eq("public_id", s.publicId)).data).toEqual([]);
    expect((await owner.from("listings").update({ title: "Sigo aquí" }).eq("id", s.id).select("id")).data).toEqual([]);

    const service = serviceClient();
    const row = (await service.from("listings").select("title, deleted_reason, deleted_at, status").eq("id", s.id).single()).data!;
    expect(row).toMatchObject({ title: "Casa a borrar", deleted_reason: "Duplicada", status: "active" });
    expect(row.deleted_at).not.toBeNull();
    expect((await service.from("listing_photos").select("id").eq("listing_id", s.id)).data).toHaveLength(5);
    expect((await service.from("inquiries").select("id").eq("listing_id", s.id)).data).toHaveLength(1);
    expect((await service.from("subscriptions").select("listing_id").eq("listing_id", s.id)).data).toHaveLength(1);
    expect((await service.from("favorites").select("listing_id").eq("listing_id", s.id)).data).toHaveLength(1);
  });

  it("se recupera por SQL: quitar deleted_at la devuelve a su propietario", async () => {
    const s = await h.seed({ status: "active" });
    await admin.rpc("admin_delete_listing", { p_listing: s.id, p_reason: "Por error", p_confirm: s.publicId });
    expect(await h.owner("owner").getOwn(s.id)).toBeNull();
    sql(`begin; select set_config('app.allow_status','on',true); update public.listings set deleted_at = null, deleted_reason = null where id = '${s.id}'; commit;`);
    expect((await h.owner("owner").getOwn(s.id))?.id).toBe(s.id);
    expect(await h.anon.getPublic(s.publicId)).not.toBeNull();
  });

  it("la retención y el borrado dejan su coherencia: no hay retención sin motivo", async () => {
    const s = await h.seed({ status: "active" });
    expect(() => sql(`begin; select set_config('app.allow_status','on',true); update public.listings set admin_hold = 'paused' where id = '${s.id}'; commit;`)).toThrow();
    expect(() => sql(`begin; select set_config('app.allow_status','on',true); update public.listings set admin_hold = 'otra', admin_hold_reason = 'x', admin_hold_at = now() where id = '${s.id}'; commit;`)).toThrow();
    expect(() => sql(`begin; select set_config('app.allow_status','on',true); update public.listings set deleted_at = now() where id = '${s.id}'; commit;`)).toThrow();
  });

  it("la zona de Explorar y las provincias no cuentan las casas pausadas, bloqueadas ni eliminadas", async () => {
    const a = await h.seed({ status: "active" });
    const b = await h.seed({ status: "active" });
    const c = await h.seed({ status: "active" });
    await h.seed({ status: "active", as: "other" });
    expect((await h.anon.zonesWithListings()).find((z) => z.id === "704-cahuita")?.listings).toBe(4);
    await rpc(admin, "admin_pause_listing", a.id);
    await rpc(admin, "admin_block_listing", b.id);
    await admin.rpc("admin_delete_listing", { p_listing: c.id, p_reason: REASON, p_confirm: c.publicId });
    expect((await h.anon.zonesWithListings()).find((z) => z.id === "704-cahuita")?.listings).toBe(1);
    expect(await h.anon.countActive()).toBe(1);
    expect(await h.anon.provincesWithListings()).toEqual(["Limón"]);
  });
});
