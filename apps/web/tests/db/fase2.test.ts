// Integración contra Supabase local (pnpm db:start). Se salta sin SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.local.
// Comprueba la migración de la fase 2: RLS, trigger de protección, RPCs de envío y revisión, vista pública y seed de admin.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { opts, signIn as signInWith } from "./helpers";
import { beforeAll, describe, expect, it } from "vitest";

try {
  process.loadEnvFile(new URL("../../.env.local", import.meta.url).pathname);
} catch {
  /* sin .env.local: las pruebas se saltan */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OWNER = "+50687770001";
const OTHER = "+50688881234";
const ADMIN = "+50688990001";

const signIn = (phone: string, name: string) => signInWith(url!, anonKey!, phone, name);

describe.skipIf(!url || !anonKey || !serviceKey)("migración fase 2", () => {
  let admin: SupabaseClient; // clave de servicio
  let owner: SupabaseClient;
  let other: SupabaseClient;
  let reviewer: SupabaseClient; // cuenta con is_admin
  let anon: SupabaseClient;
  let ownerId: string;
  let listingId: string;
  let publicId: string;

  const complete = {
    kind: "completo",
    accepts_nightly: true,
    title: "Casa Manzanillo, a pie de playa",
    description: "Casa de madera a 80 m de la playa.",
    province: "Limón",
    canton: "Talamanca",
    zone: "Manzanillo",
    lat: 9.63,
    lng: -82.65,
    capacity: 5,
    bedrooms: 2,
    bathrooms: 2,
    features: ["parking", "beachfront"],
    parking_paid: false,
    nightly_price_crc: 85000,
    accepts_monthly: true,
    monthly_mode: "amount",
    monthly_price_crc: 900000,
  };

  async function newDraft(client: SupabaseClient, uid: string) {
    const { data, error } = await client
      .from("listings")
      .insert({ owner_id: uid, title: "", description: "", province: "Limón", whatsapp_phone: OWNER })
      .select("id, public_id, status")
      .single();
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, opts);
    const cleanup = await admin.from("listings").delete().not("id", "is", null);
    if (cleanup.error) throw cleanup.error;
    owner = await signIn(OWNER, "Yorleny Prueba");
    other = await signIn(OTHER, "Ana Prueba");
    reviewer = await signIn(ADMIN, "Admin Prueba");
    anon = createClient(url!, anonKey!, opts);
    ownerId = (await owner.auth.getUser()).data.user!.id;
    const seeded = await admin.rpc("seed_admin", { p_phone: ADMIN });
    if (seeded.error) throw seeded.error;
  }, 60_000);

  it("el dueño crea un borrador y la fila nace con CT-#### y status draft", async () => {
    const row = await newDraft(owner, ownerId);
    listingId = row.id;
    publicId = row.public_id;
    expect(publicId).toMatch(/^CT-\d{4,}$/);
    expect(row.status).toBe("draft");
  });

  it("el dueño no puede activar su propia casa", async () => {
    const { error } = await owner.from("listings").update({ status: "active" }).eq("id", listingId);
    expect(error?.message).toContain("Solo bnbtico puede cambiar el estado");
  });

  it("submit_listing rechaza sin 5 fotos", async () => {
    const { error: up } = await owner.from("listings").update(complete).eq("id", listingId);
    expect(up).toBeNull();
    const { error } = await owner.rpc("submit_listing", { p_listing: listingId });
    expect(error?.message).toBe("Agregue al menos 5 fotos.");
  });

  it("submit_listing pasa a review con datos completos y falla al repetir", async () => {
    const photos = Array.from({ length: 5 }, (_, i) => ({ listing_id: listingId, path: `${listingId}/${i}.jpg`, position: i }));
    const { error: ph } = await owner.from("listing_photos").insert(photos);
    expect(ph).toBeNull();
    const first = await owner.rpc("submit_listing", { p_listing: listingId });
    expect(first.error).toBeNull();
    expect(first.data).toBe("review");
    const second = await owner.rpc("submit_listing", { p_listing: listingId });
    expect(second.error?.message).toBe("Este anuncio ya está en revisión.");
  });

  it("otro usuario no ve la casa en review ni puede enviarla", async () => {
    const { data, error: readError } = await other.from("listings").select("id").eq("id", listingId);
    expect(readError).toBeNull();
    expect(data).toEqual([]);
    const { error } = await other.rpc("submit_listing", { p_listing: listingId });
    expect(error?.message).toBe("No encontramos ese anuncio.");
  });

  it("review_listing exige motivo para cambios y rechazo", async () => {
    const changes = await reviewer.rpc("review_listing", { p_listing: listingId, p_decision: "changes", p_note: "   " });
    expect(changes.error?.message).toContain("Escriba un motivo");
    const reject = await reviewer.rpc("review_listing", { p_listing: listingId, p_decision: "reject", p_note: "" });
    expect(reject.error?.message).toContain("Escriba un motivo");
    const asOwner = await owner.rpc("review_listing", { p_listing: listingId, p_decision: "approve", p_note: "" });
    expect(asOwner.error?.message).toBe("Solo bnbtico puede revisar anuncios.");
  });

  it("review_listing aprueba, registra admin_actions y marca is_owner", async () => {
    const { data, error } = await reviewer.rpc("review_listing", { p_listing: listingId, p_decision: "approve", p_note: "" });
    expect(error).toBeNull();
    expect(data).toBe("active");
    const actions = await reviewer.from("admin_actions").select("action").eq("target_listing_id", listingId);
    expect(actions.error).toBeNull();
    expect(actions.data?.map((a) => a.action)).toEqual(["listing.approve"]);
    const profile = await admin.from("profiles").select("is_owner").eq("id", ownerId).single();
    expect(profile.data?.is_owner).toBe(true);
    const again = await reviewer.rpc("review_listing", { p_listing: listingId, p_decision: "reject", p_note: "tarde" });
    expect(again.error?.message).toBe("Este anuncio ya tiene una decisión.");
  });

  it("anon ve la casa activa en listings_public y listing_link_state devuelve active", async () => {
    const { data, error } = await anon.from("listings_public").select("public_id, canton, min_nights, monthly_mode, owner_whatsapp_verified").eq("public_id", publicId);
    expect(error).toBeNull();
    expect(data).toEqual([{ public_id: publicId, canton: "Talamanca", min_nights: null, monthly_mode: "amount", owner_whatsapp_verified: true }]);
    const state = await anon.rpc("listing_link_state", { p_public_id: publicId });
    expect(state.data).toBe("active");
    expect((await anon.rpc("listing_link_state", { p_public_id: "CT-1" })).data).toBeNull();
  });

  it("set_listing_available oculta consultas sin sacar la ficha", async () => {
    const asOther = await other.rpc("set_listing_available", { p_listing: listingId, p_available: false });
    expect(asOther.error?.message).toBe("Solo puede cambiar la disponibilidad de una casa activa.");
    const { error } = await owner.rpc("set_listing_available", { p_listing: listingId, p_available: false });
    expect(error).toBeNull();
    const { data } = await anon.from("listings_public").select("available").eq("public_id", publicId).single();
    expect(data?.available).toBe(false);
  });

  it("una casa activa que el dueño vuelve a borrador deja de ser pública y el enlace queda blocked", async () => {
    const { error } = await owner.from("listings").update({ status: "draft" }).eq("id", listingId);
    expect(error).toBeNull();
    expect((await anon.rpc("listing_link_state", { p_public_id: publicId })).data).toBe("blocked");
    const { data } = await anon.from("listings_public").select("public_id").eq("public_id", publicId);
    expect(data).toEqual([]);
  });

  it("el dueño no puede cambiar datos protegidos", async () => {
    const { error } = await owner.from("listings").update({ review_note: "me apruebo" }).eq("id", listingId);
    expect(error?.message).toContain("No puede cambiar ese dato");
  });

  it("el dueño borra solo borradores", async () => {
    const second = await newDraft(owner, ownerId);
    await owner.from("listings").update(complete).eq("id", second.id);
    await owner.from("listing_photos").insert(Array.from({ length: 5 }, (_, i) => ({ listing_id: second.id, path: `${second.id}/${i}.jpg`, position: i })));
    expect((await owner.rpc("submit_listing", { p_listing: second.id })).data).toBe("review");
    const notDeleted = await owner.from("listings").delete().eq("id", second.id).select("id");
    expect(notDeleted.data).toEqual([]);
    // El borrador que fue una casa publicada conserva su CT-####: tampoco se borra.
    const wasPublished = await owner.from("listings").delete().eq("id", listingId).select("id");
    expect(wasPublished.data).toEqual([]);
    const fresh = await newDraft(owner, ownerId);
    const deleted = await owner.from("listings").delete().eq("id", fresh.id).select("id");
    expect(deleted.data).toEqual([{ id: fresh.id }]);
  });

  it("seed_admin no es ejecutable por un usuario normal", async () => {
    const { error } = await owner.rpc("seed_admin", { p_phone: OWNER });
    expect(error).not.toBeNull();
    const profile = await admin.from("profiles").select("is_admin").eq("id", ownerId).single();
    expect(profile.data?.is_admin).toBe(false);
  });
});
