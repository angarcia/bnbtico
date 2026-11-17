// Migración revision_sin_rechazo (historia 27): review_listing solo aprueba o pide cambios. Un cliente desactualizado que
// aún envía «reject» recibe un error y la casa sigue en revisión, sin decisión registrada; tampoco cuenta un motivo vacío.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { REVIEW_MESSAGES } from "../../src/domain/review";
import type { ListingsHarness } from "../contract/harness";
import { TEST_PHONES, serviceClient, signInAdmin } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: ListingsHarness;
let admin: SupabaseClient<Database>;

beforeAll(async () => {
  h = await postgrestHarness();
  admin = await signInAdmin();
  await serviceClient().rpc("seed_admin", { p_phone: TEST_PHONES.admin });
}, 60_000);

async function stateOf(id: string) {
  const row = await serviceClient().from("listings").select("status, review_note, reviewed_at").eq("id", id).single();
  const actions = await serviceClient().from("admin_actions").select("action").eq("target_listing_id", id);
  return { ...row.data, actions: (actions.data ?? []).map((a) => a.action) };
}

describe("revisión sin «Rechazar»", () => {
  it("un «reject» de un cliente antiguo no rechaza: la casa sigue en revisión y no se registra nada", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "review" });
    const { error } = await admin.rpc("review_listing", { p_listing: id, p_decision: "reject", p_note: "Es un duplicado." });
    expect(error?.message).toBe(REVIEW_MESSAGES.rejectRetired);
    expect(await stateOf(id)).toEqual({ status: "review", review_note: null, reviewed_at: null, actions: [] });
  });

  it("pedir cambios sin motivo (vacío o solo espacios) no registra la decisión", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "review" });
    for (const note of ["", "   "]) {
      const { error } = await admin.rpc("review_listing", { p_listing: id, p_decision: "changes", p_note: note });
      expect(error?.message).toBe(REVIEW_MESSAGES.noteRequired);
    }
    expect(await stateOf(id)).toEqual({ status: "review", review_note: null, reviewed_at: null, actions: [] });
  });

  it("una rechazada de antes conserva su estado, su motivo y su línea en admin_actions, que el admin lee", async () => {
    await h.reset();
    const { id } = await h.seed({ status: "rejected" });
    expect(await stateOf(id)).toMatchObject({ status: "rejected", review_note: "Faltan fotos del baño.", actions: ["listing.reject"] });
    const log = await admin.from("admin_actions").select("action, reason").eq("target_listing_id", id);
    expect(log.data).toEqual([{ action: "listing.reject", reason: "Faltan fotos del baño." }]);
  });
});
