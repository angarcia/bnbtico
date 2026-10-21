// Integración contra Supabase local: permisos que la revisión de la fase 2 encontró abiertos en 0001.
// Nadie se marca admin por REST; la tabla `listings` no expone WhatsApp ni coordenadas exactas; una casa activa no se
// edita sin volver a revisión; las fotos y Storage respetan el estado; los borradores nulos no mienten.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { opts, signIn as signInWith } from "./helpers";
import { beforeAll, describe, expect, it } from "vitest";
import { distanceMeters } from "@/lib/listings/geo";

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

const complete = {
  kind: "completo",
  accepts_nightly: true,
  title: "Cabina Cahuita",
  description: "Cabina frente al parque.",
  province: "Limón",
  canton: "Talamanca",
  zone: "Cahuita",
  lat: 9.7366,
  lng: -82.8431,
  capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  features: ["wifi"],
  nightly_price_crc: 42000,
  accepts_monthly: false,
};

describe.skipIf(!url || !anonKey || !serviceKey)("permisos fase 2", () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let other: SupabaseClient;
  let reviewer: SupabaseClient;
  let anon: SupabaseClient;
  let ownerId: string;
  let activeId: string;
  let activePublicId: string;

  async function newDraft(): Promise<string> {
    const { data, error } = await owner.from("listings").insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: OWNER, accepts_nightly: false }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }
  async function addPhotos(client: SupabaseClient, id: string, n = 5) {
    const { error } = await client.from("listing_photos").insert(Array.from({ length: n }, (_, i) => ({ listing_id: id, path: `${id}/${i}.jpg`, position: i })));
    return error;
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, opts);
    await admin.from("listings").delete().not("id", "is", null);
    owner = await signIn(OWNER, "Yorleny Prueba");
    other = await signIn(OTHER, "Ana Prueba");
    reviewer = await signIn(ADMIN, "Admin Prueba");
    anon = createClient(url!, anonKey!, opts);
    ownerId = (await owner.auth.getUser()).data.user!.id;
    await admin.rpc("seed_admin", { p_phone: ADMIN });
    // Una casa activa para las comprobaciones.
    activeId = await newDraft();
    await owner.from("listings").update(complete).eq("id", activeId);
    await addPhotos(owner, activeId);
    const sent = await owner.rpc("submit_listing", { p_listing: activeId });
    if (sent.error) throw sent.error;
    const approved = await reviewer.rpc("review_listing", { p_listing: activeId, p_decision: "approve", p_note: "" });
    if (approved.error) throw approved.error;
    activePublicId = (await admin.from("listings").select("public_id").eq("id", activeId).single()).data!.public_id;
  }, 60_000);

  it("un usuario no puede marcarse admin, dueño ni verificado por REST", async () => {
    for (const patch of [{ is_admin: true }, { is_owner: true }, { is_active: false }, { phone_verified_at: new Date().toISOString() }, { phone: "+50600000000" }]) {
      const { error } = await other.from("profiles").update(patch).eq("id", (await other.auth.getUser()).data.user!.id);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    const { error } = await other.from("profiles").update({ full_name: "Ana Prueba", description: "hola" }).eq("id", (await other.auth.getUser()).data.user!.id);
    expect(error).toBeNull();
  });

  it("la tabla listings no se lee desde fuera: ni anon ni otro usuario ven la casa activa", async () => {
    expect((await anon.from("listings").select("id, whatsapp_phone, lat").eq("id", activeId)).data).toEqual([]);
    expect((await other.from("listings").select("id, whatsapp_phone, lat").eq("id", activeId)).data).toEqual([]);
    const mine = await owner.from("listings").select("id, whatsapp_phone").eq("id", activeId).single();
    expect(mine.data?.whatsapp_phone).toBe(OWNER);
  });

  it("la vista pública sigue abierta, con fotos, y sus coordenadas están desplazadas hasta 500 m", async () => {
    const { data } = await anon.from("listings_public").select("public_id, lat, lng").eq("public_id", activePublicId).single();
    expect(data?.public_id).toBe(activePublicId);
    const d = distanceMeters({ lat: complete.lat, lng: complete.lng }, { lat: data!.lat, lng: data!.lng });
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThanOrEqual(500);
    const again = await anon.from("listings_public").select("lat, lng").eq("public_id", activePublicId).single();
    expect(again.data).toEqual({ lat: data!.lat, lng: data!.lng });
    const photos = await anon.from("listing_photos").select("path").eq("listing_id", activeId);
    expect(photos.data?.length).toBe(5);
  });

  it("una casa activa no se edita por REST sin volver a borrador", async () => {
    const title = await owner.from("listings").update({ title: "Título cambiado sin revisión" }).eq("id", activeId);
    expect(title.error?.message).toContain("no se puede editar");
    const phone = await owner.from("listings").update({ whatsapp_phone: "+50600000000" }).eq("id", activeId);
    expect(phone.error).not.toBeNull();
    expect(await addPhotos(owner, activeId, 1)).not.toBeNull();
    const del = await owner.from("listing_photos").delete().eq("listing_id", activeId).select("id");
    expect(del.data).toEqual([]);
    const avail = await owner.rpc("set_listing_available", { p_listing: activeId, p_available: false });
    expect(avail.error).toBeNull();
  });

  it("Storage: solo el dueño sube a la carpeta de su borrador; no a una ajena ni a una casa activa", async () => {
    const draft = await newDraft();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
    const own = await owner.storage.from("listings").upload(`${draft}/a.jpg`, blob, { contentType: "image/jpeg" });
    expect(own.error).toBeNull();
    const intruder = await other.storage.from("listings").upload(`${draft}/b.jpg`, blob, { contentType: "image/jpeg" });
    expect(intruder.error).not.toBeNull();
    const toActive = await owner.storage.from("listings").upload(`${activeId}/c.jpg`, blob, { contentType: "image/jpeg" });
    expect(toActive.error).not.toBeNull();
    const removal = await other.storage.from("listings").remove([`${draft}/a.jpg`]);
    expect(removal.data ?? []).toEqual([]);
    await owner.from("listings").delete().eq("id", draft);
  });

  it("el borrador nace sin tipo, sin respuesta mensual y sin números inventados", async () => {
    const draft = await newDraft();
    const { data } = await owner.from("listings").select("kind, accepts_nightly, accepts_monthly, bathroom_shared, capacity, bedrooms, bathrooms, nightly_price_crc, min_nights").eq("id", draft).single();
    expect(data).toEqual({ kind: null, accepts_nightly: false, accepts_monthly: null, bathroom_shared: null, capacity: null, bedrooms: null, bathrooms: null, nightly_price_crc: null, min_nights: null });
    const sent = await owner.rpc("submit_listing", { p_listing: draft });
    expect(sent.error?.message).toBe("Elija Alojamiento completo o Habitación.");
    await owner.from("listings").update({ kind: "habitacion" }).eq("id", draft);
    expect((await owner.rpc("submit_listing", { p_listing: draft })).error?.message).toBe("Marque Vacacional, Mensual o las dos.");
    await owner.from("listings").update({ ...complete, kind: "habitacion", bedrooms: 1, lat: 40.4, lng: -3.7 }).eq("id", draft);
    await addPhotos(owner, draft);
    expect((await owner.rpc("submit_listing", { p_listing: draft })).error?.message).toBe("Marque un punto dentro de Costa Rica.");
    await owner.from("listings").update({ lat: 9.7, lng: -82.8 }).eq("id", draft);
    expect((await owner.rpc("submit_listing", { p_listing: draft })).error?.message).toBe("Indique si el baño es privado o compartido.");
    await owner.from("listings").update({ bathroom_shared: false }).eq("id", draft);
    expect((await owner.rpc("submit_listing", { p_listing: draft })).data).toBe("review");
    // Solo mensual: exige precio por mes, no por noche.
    const monthly = await newDraft();
    await owner.from("listings").update({ ...complete, accepts_nightly: false, accepts_monthly: true, nightly_price_crc: null }).eq("id", monthly);
    await addPhotos(owner, monthly);
    expect((await owner.rpc("submit_listing", { p_listing: monthly })).error?.message).toBe("Indique el precio por mes en colones.");
    await owner.from("listings").update({ monthly_price_crc: 480000, monthly_mode: "amount" }).eq("id", monthly);
    expect((await owner.rpc("submit_listing", { p_listing: monthly })).data).toBe("review");
    await admin.from("listings").delete().in("id", [draft, monthly]);
  });

  it("editar una casa activa la vuelve borrador, pero ese borrador no se puede borrar", async () => {
    const { error } = await owner.from("listings").update({ status: "draft" }).eq("id", activeId);
    expect(error).toBeNull();
    const del = await owner.from("listings").delete().eq("id", activeId).select("id");
    expect(del.data).toEqual([]);
    expect((await anon.rpc("listing_link_state", { p_public_id: activePublicId })).data).toBe("blocked");
  });
});
