// Migración eliminar_casa_anfitrion (historia 28): lo que el contrato no ve desde la app. Sin sesión no se ejecuta, la fila
// guarda quién la eliminó, nadie escribe deleted_by por REST, la exportación iCal queda invalidada y dos peticiones a la vez
// solo eliminan una vez.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { OWNER_DELETE_MESSAGES as M } from "../../src/domain/owner-delete";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: ListingsHarness;
let owner: SupabaseClient<Database>;

beforeAll(async () => {
  h = await postgrestHarness();
  owner = await signIn("owner");
}, 60_000);

const row = async (id: string) =>
  (await serviceClient().from("listings").select("deleted_at, deleted_reason, deleted_by, status, owner_id").eq("id", id).single()).data!;

describe("eliminar casa del anfitrión en la base", () => {
  it("sin sesión no se puede llamar y la casa no cambia", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "active" });
    const { error } = await anonClient().rpc("delete_own_listing", { p_listing: id });
    expect(error).not.toBeNull();
    expect((await row(id)).deleted_at).toBeNull();
  });

  it("la fila guarda cuándo, quién y el motivo fijo; los datos y el estado se conservan", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "active" });
    expect((await owner.rpc("delete_own_listing", { p_listing: id })).error).toBeNull();
    const r = await row(id);
    expect(r.deleted_at).not.toBeNull();
    expect(r.deleted_reason).toBe("Eliminada por el anfitrión.");
    expect(r.deleted_by).toBe(r.owner_id);
    expect(r.status).toBe("active");
  });

  it("nadie escribe deleted_by por REST, ni al insertar una casa", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "draft" });
    const me = (await owner.auth.getUser()).data.user!.id;
    const upd = await owner.from("listings").update({ deleted_by: me }).eq("id", id).select("id");
    expect(upd.error).not.toBeNull(); // restricción listings_deleted_by_coherent: no hay quién sin cuándo
    expect((await row(id)).deleted_by).toBeNull();
    const ins = await owner.from("listings").insert({ owner_id: me, title: "x", description: "", province: "Limón", whatsapp_phone: "+50687770001", deleted_by: me });
    expect(ins.error).not.toBeNull();
  });

  it("invalida la exportación iCal de la casa", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "active" });
    expect((await owner.rpc("owner_ical_export", { p_listing: id, p_generate: true })).error).toBeNull();
    const before = await serviceClient().from("ical_exports").select("token, revoked_at").eq("listing_id", id).single();
    expect(before.data?.token).toBeTruthy();
    await owner.rpc("delete_own_listing", { p_listing: id });
    const after = await serviceClient().from("ical_exports").select("token, revoked_at").eq("listing_id", id).single();
    expect(after.data?.token).toBeNull();
    expect(after.data?.revoked_at).not.toBeNull();
  });

  it("dos peticiones a la vez: una elimina y la otra no encuentra la casa", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "active" });
    const results = await Promise.all([owner.rpc("delete_own_listing", { p_listing: id }), owner.rpc("delete_own_listing", { p_listing: id })]);
    const errors = results.map((r) => r.error?.message ?? null).sort();
    expect(errors).toEqual([M.notFound, null].sort());
    expect((await row(id)).deleted_at).not.toBeNull();
  });
});
