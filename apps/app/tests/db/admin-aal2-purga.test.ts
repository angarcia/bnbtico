// Migración admin_aal2_y_purga: el admin solo actúa como admin con el segundo factor (aal2), y la base encola la purga de
// la ficha pública con pg_net cuando cambia una casa que es o fue activa (URL y secreto en Vault).
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { TEST_PHONES, serviceClient, signIn, signInAdmin, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: ListingsHarness;
let aal1: SupabaseClient<Database>;
let aal2: SupabaseClient<Database>;

beforeAll(async () => {
  h = await postgrestHarness();
  aal2 = await signInAdmin();
  aal1 = await signIn("admin");
  await serviceClient().rpc("seed_admin", { p_phone: TEST_PHONES.admin });
}, 60_000);

const aalOf = async (c: SupabaseClient<Database>) => (await c.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel;

describe("admin con segundo factor exigido en SQL", () => {
  it("las sesiones de prueba están en aal1 y aal2", async () => {
    expect(await aalOf(aal1)).toBe("aal1");
    expect(await aalOf(aal2)).toBe("aal2");
  });

  it("un admin en aal1 no ve la cola, ni perfiles ajenos, ni el registro de acciones", async () => {
    await h.reset();
    await h.seed({ status: "review" });
    const queue = await aal1.from("listings").select("id").eq("status", "review");
    expect(queue.error).toBeNull();
    expect(queue.data).toEqual([]);
    const profiles = await aal1.from("profiles").select("id").neq("phone", TEST_PHONES.admin);
    expect(profiles.data).toEqual([]);
    const actions = await aal1.from("admin_actions").select("id");
    expect(actions.data).toEqual([]);
    const photos = await aal1.from("listing_photos").select("id");
    expect(photos.data).toEqual([]);
  });

  it("un admin en aal1 no puede revisar: la base le pide el segundo código", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "review" });
    const { error } = await aal1.rpc("review_listing", { p_listing: id, p_decision: "approve", p_note: "" });
    expect(error?.message).toBe("Confirme el segundo código para revisar anuncios.");
    const row = await serviceClient().from("listings").select("status").eq("id", id).single();
    expect(row.data?.status).toBe("review");
  });

  it("ni cambiar el estado por update directo", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "review" });
    const { data } = await aal1.from("listings").update({ status: "active" }).eq("id", id).select("id");
    expect(data ?? []).toEqual([]);
    const row = await serviceClient().from("listings").select("status").eq("id", id).single();
    expect(row.data?.status).toBe("review");
  });

  it("un usuario que no es admin recibe el mensaje de siempre", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "review" });
    const other = await signIn("other");
    const { error } = await other.rpc("review_listing", { p_listing: id, p_decision: "approve", p_note: "" });
    expect(error?.message).toBe("Solo bnbtico puede revisar anuncios.");
  });

  it("el segundo factor es TOTP: seed_admin da al admin el rótulo que GoTrue exige; una cuenta sin él no puede inscribirlo", async () => {
    const factors = await aal2.auth.mfa.listFactors();
    expect(factors.data?.totp.filter((f) => f.status === "verified")).toHaveLength(1);
    expect(factors.data?.all.some((f) => f.factor_type === "phone")).toBe(false);
    const adminId = (await aal2.auth.getUser()).data.user!.id;
    expect((await serviceClient().auth.admin.getUserById(adminId)).data.user?.email).toBe("50688990001@admin.bnbtico.invalid");
    const owner = await signIn("owner");
    const enrolled = await owner.auth.mfa.enroll({ factorType: "totp", friendlyName: "bnbtico admin" });
    expect(enrolled.error?.status).toBe(500);
  });

  it("en aal2 el admin ve la cola con fotos y perfiles, revisa y queda registrado", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "review" });
    const queue = await aal2.from("listings").select("id, listing_photos(id)").eq("status", "review");
    expect(queue.data?.map((l) => l.id)).toEqual([id]);
    expect(queue.data?.[0]?.listing_photos).toHaveLength(5);
    const profiles = await aal2.from("profiles").select("id").neq("phone", TEST_PHONES.admin);
    expect(profiles.data?.length).toBeGreaterThan(0);
    const { error } = await aal2.rpc("review_listing", { p_listing: id, p_decision: "approve", p_note: "" });
    expect(error).toBeNull();
    const actions = await aal2.from("admin_actions").select("action").eq("target_listing_id", id);
    expect(actions.data).toEqual([{ action: "listing.approve" }]);
  });
});

/**
 * La cola de pg_net se mira dentro de una transacción que se deshace: el trabajador de pg_net solo ve filas confirmadas,
 * así que nada sale de verdad y la cola no se vacía antes de leerla. Los secretos de Vault se crean en la misma transacción.
 */
function inTransaction(body: string): string {
  return sql(`begin;\n${body}\nrollback;`);
}

const asAdminAal2 = (adminId: string) => `
  set local role authenticated;
  select set_config('request.jwt.claims', '${JSON.stringify({ sub: adminId, role: "authenticated", aal: "aal2" })}', true);
`;
const withSecrets = `
  select vault.create_secret('https://nueva.example.test/', 'worker_purge_url') is not null;
  select vault.create_secret('secreto-de-prueba', 'worker_purge_secret') is not null;
`;
const queueOf = (publicId: string) => `
  reset role;
  select coalesce(json_agg(json_build_object('method', method, 'url', url, 'auth', headers->>'Authorization')), '[]')
  from net.http_request_queue where url like '%/_purge/${publicId}';
`;
const lastJson = (out: string) => JSON.parse(out.split("\n").at(-1)!);

describe("purga de la ficha con pg_net", () => {
  let adminId: string;
  beforeAll(async () => {
    adminId = (await aal2.auth.getUser()).data.user!.id;
  });

  it("con los secretos en Vault, aprobar encola un POST a <url>/_purge/CT-#### con el secreto", async () => {
    await h.reset();
    const { id, publicId } = await h.seed({ status: "review" });
    const out = inTransaction(`${withSecrets}${asAdminAal2(adminId)}
      select review_listing('${id}', 'approve', '') is not null;
      ${queueOf(publicId)}`);
    expect(lastJson(out)).toEqual([{ method: "POST", url: `https://nueva.example.test/_purge/${publicId}`, auth: "Bearer secreto-de-prueba" }]);
  });

  it("también al cambiar disponibilidad o un dato al momento de una casa activa, y no al editar un borrador que nunca estuvo activo", async () => {
    await h.reset();
    const active = await h.seed({ status: "active" });
    const draft = await h.seed({ status: "draft" });
    const ownerId = (await serviceClient().from("listings").select("owner_id").eq("id", active.id).single()).data!.owner_id;
    const asOwner = `set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: ownerId, role: "authenticated", aal: "aal1" })}', true);`;
    const available = inTransaction(`${withSecrets}${asOwner}
      select set_listing_available('${active.id}', false) is null;
      ${queueOf(active.publicId)}`);
    expect(lastJson(available)).toHaveLength(1);
    // Una casa publicada ya no vuelve a borrador (editar_casa_publicada): sus datos al momento también purgan la ficha.
    const live = inTransaction(`${withSecrets}${asOwner}
      select public.update_listing_live('${active.id}', '{"nightly_price_crc": 51000}'::jsonb) is null;
      ${queueOf(active.publicId)}`);
    expect(lastJson(live)).toHaveLength(1);
    const edited = inTransaction(`${withSecrets}${asOwner}
      update listings set title = 'Otro nombre' where id = '${draft.id}';
      ${queueOf(draft.publicId)}`);
    expect(lastJson(edited)).toEqual([]);
  });

  it("aprobar una edición de una casa activa encola la purga de su ficha", async () => {
    await h.reset();
    const { id, publicId } = await h.seed({ status: "active" });
    const owner = await signIn("owner");
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco frente al mar" } })).error).toBeNull();
    expect((await owner.rpc("submit_edit", { p_listing: id })).error).toBeNull();
    const out = inTransaction(`${withSecrets}${asAdminAal2(adminId)}
      select public.review_edit('${id}', 'approve', '', (select submitted_at from public.listing_edits where listing_id = '${id}')) is not null;
      ${queueOf(publicId)}`);
    expect(lastJson(out).length).toBeGreaterThanOrEqual(1);
  });

  it("sin secretos en Vault, aprobar no encola nada y no falla", async () => {
    await h.reset();
    const { id, publicId } = await h.seed({ status: "review" });
    expect(sql("select count(*) from vault.secrets where name in ('worker_purge_url', 'worker_purge_secret')")).toBe("0");
    const out = inTransaction(`${asAdminAal2(adminId)}
      select review_listing('${id}', 'approve', '');
      ${queueOf(publicId)}`);
    expect(out.split("\n")).toContain("active");
    expect(lastJson(out)).toEqual([]);
  });
});
