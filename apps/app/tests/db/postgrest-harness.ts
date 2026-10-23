// Arnés PostgREST: siembra por el camino real (dueño inserta y edita, sube fotos, envía con submit_listing; el admin
// decide con review_listing; reabrir es el update a borrador que permite el trigger).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostgrestListings } from "../../src/data/postgrest/listings";
import type { Database } from "../../src/domain/database.types";
import { toListingUpdate } from "../../src/domain/rows";
import { COMPLETE, type ListingsHarness, type SeedOwner, type SeedSpec, type Seeded } from "../contract/harness";
import { TEST_NAMES, TEST_PHONES, anonClient, localSupabase, serviceClient, signIn } from "./local";

export async function postgrestHarness(): Promise<ListingsHarness> {
  const service = serviceClient();
  const owners: Record<SeedOwner, SupabaseClient<Database>> = { owner: await signIn("owner"), other: await signIn("other") };
  const admin = await signIn("admin");
  await service.rpc("seed_admin", { p_phone: TEST_PHONES.admin });
  const names = {} as Record<SeedOwner, string>;
  for (const who of ["owner", "other"] as const) {
    const id = (await owners[who].auth.getUser()).data.user!.id;
    names[who] = (await service.from("profiles").select("full_name").eq("id", id).single()).data?.full_name ?? TEST_NAMES[who];
  }
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  async function seed(spec: SeedSpec): Promise<Seeded> {
    const db = owners[spec.as ?? "owner"];
    const ownerId = (await db.auth.getUser()).data.user!.id;
    const draft = { ...COMPLETE, ...spec.draft };
    const created = await db
      .from("listings")
      .insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: TEST_PHONES[spec.as ?? "owner"], accepts_nightly: false })
      .select("id, public_id")
      .single();
    fail("crear borrador", created.error);
    const { id, public_id: publicId } = created.data!;
    fail("editar borrador", (await db.from("listings").update(toListingUpdate(draft)).eq("id", id)).error);
    const n = spec.photos ?? (spec.status === "draft" ? 0 : 5);
    const photoPaths = Array.from({ length: n }, (_, i) => `${id}/foto-${i}.jpg`);
    if (n > 0) {
      const rows = photoPaths.map((path, position) => ({ listing_id: id, path, position })).reverse();
      fail("fotos", (await db.from("listing_photos").insert(rows)).error);
    }
    if (spec.status !== "draft") fail("enviar", (await db.rpc("submit_listing", { p_listing: id })).error);
    const decision = { active: "approve", reopened: "approve", changes: "changes", rejected: "reject" } as const;
    if (spec.status in decision) {
      const d = decision[spec.status as keyof typeof decision];
      fail("revisar", (await admin.rpc("review_listing", { p_listing: id, p_decision: d, p_note: d === "approve" ? "" : "Faltan fotos del baño." })).error);
    }
    if (spec.status === "reopened") fail("reabrir", (await db.from("listings").update({ status: "draft" }).eq("id", id)).error);
    return { id, publicId, exact: { lat: draft.lat!, lng: draft.lng! }, photoPaths };
  }

  return {
    anon: createPostgrestListings(anonClient(), { supabaseUrl: localSupabase().url }),
    async reset() {
      fail("vaciar casas", (await service.from("listings").delete().not("id", "is", null)).error);
    },
    seed,
    ownerName: (who) => names[who],
  };
}
