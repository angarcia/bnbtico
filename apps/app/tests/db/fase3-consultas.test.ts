// Migración fase3_consultas: permisos que la API no deja ver. El WhatsApp de una casa solo sale de create_inquiry; la
// tabla inquiries no se escribe por REST y su copia del número no se lee; el propietario no lee el perfil del cliente;
// favoritos solo de casas publicadas y sin update; events acepta inquiry_created.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { INQUIRY_MESSAGES } from "../../src/domain/inquiry";
import { TEST_PHONES, anonClient, serviceClient, signIn } from "./local";

describe("migración fase3_consultas", () => {
  const service = serviceClient();
  let owner: SupabaseClient<Database>;
  let client: SupabaseClient<Database>;
  let stranger: SupabaseClient<Database>;
  let ownerId: string;
  let clientId: string;
  let house: { id: string; public_id: string };
  let draftHouse: { id: string };
  let inquiryId: string;

  const listing = (status: "active" | "draft", title: string) => ({
    owner_id: ownerId,
    status,
    title,
    description: "x",
    province: "Limón",
    whatsapp_phone: TEST_PHONES.owner,
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    accepts_nightly: true,
    nightly_price_crc: 30000,
  });

  beforeAll(async () => {
    owner = await signIn("owner");
    client = await signIn("other");
    stranger = await signIn("admin"); // sin segundo factor: un usuario más, sin privilegios de admin
    ownerId = (await owner.auth.getUser()).data.user!.id;
    clientId = (await client.auth.getUser()).data.user!.id;
    await service.from("listings").delete().not("id", "is", null);
    house = (await service.from("listings").insert(listing("active", "Casa activa")).select("id, public_id").single()).data!;
    draftHouse = (await service.from("listings").insert(listing("draft", "Borrador")).select("id").single()).data!;
    const created = await client.rpc("create_inquiry", { p_public_id: house.public_id, p_arrival: null, p_departure: null, p_people: null } as never).single<{ inquiry_id: string; whatsapp_phone: string }>();
    expect(created.error).toBeNull();
    expect(created.data!.whatsapp_phone).toBe(TEST_PHONES.owner);
    inquiryId = created.data!.inquiry_id;
  });

  it("nadie inserta, cambia ni borra consultas por REST; anon no llama a las RPCs", async () => {
    const row = { listing_id: house.id, client_id: clientId, owner_id: ownerId, whatsapp_phone: "+50600000000" };
    expect((await client.from("inquiries").insert(row)).error?.code).toBe("42501");
    expect((await client.from("inquiries").update({ people: 3 }).eq("id", inquiryId)).error?.code).toBe("42501");
    expect((await owner.from("inquiries").update({ owner_opened_at: new Date().toISOString() }).eq("id", inquiryId)).error?.code).toBe("42501");
    expect((await client.from("inquiries").delete().eq("id", inquiryId)).error?.code).toBe("42501");
    expect((await anonClient().rpc("create_inquiry", { p_public_id: house.public_id, p_arrival: null, p_departure: null, p_people: null } as never)).error?.code).toBe("42501");
    expect((await anonClient().rpc("owner_inquiry_details")).error?.code).toBe("42501");
    expect((await anonClient().from("inquiries").select("id")).error?.code).toBe("42501");
  });

  it("la firma anterior sigue registrando la consulta y descarta el texto", async () => {
    const legacy = await client.rpc("create_inquiry", { p_public_id: house.public_id, p_arrival: null, p_departure: null, p_people: null, p_message: "Hola" } as never).single();
    expect(legacy.error).toBeNull();
    expect(legacy.data?.inquiry_id).toBe(inquiryId);
  });

  it("el cliente ve su consulta sin el WhatsApp de la casa; nadie lee esa columna por REST", async () => {
    const own = await client.from("inquiries").select("id, owner_opened_at, source").eq("id", inquiryId);
    expect(own.data).toEqual([{ id: inquiryId, owner_opened_at: null, source: "listing" }]);
    expect((await client.from("inquiries").select("whatsapp_phone")).error?.code).toBe("42501");
    expect((await owner.from("inquiries").select("whatsapp_phone")).error?.code).toBe("42501");
    expect((await client.from("inquiries").select("*")).error?.code).toBe("42501");
    expect((await anonClient().from("listings_public").select("whatsapp_phone")).error).not.toBeNull();
    expect((await client.from("listings").select("whatsapp_phone").eq("id", house.id)).data).toEqual([]);
  });

  it("otro usuario no ve la consulta; el propietario no lee el perfil del cliente (solo owner_inquiry_details)", async () => {
    expect((await stranger.from("inquiries").select("id")).data).toEqual([]);
    expect((await stranger.rpc("owner_inquiry_details")).data).toEqual([]);
    expect((await owner.from("profiles").select("phone").eq("id", clientId)).data).toEqual([]);
    const list = await owner.rpc("owner_inquiry_details");
    expect(list.data![0]).not.toHaveProperty("message");
    const legacy = await owner.rpc("owner_inquiries");
    expect(legacy.error).toBeNull();
    expect(legacy.data?.[0]?.message).toBe("");
    const stored = await service.from("inquiries").select("*").eq("id", inquiryId).single();
    expect(stored.error).toBeNull();
    expect(stored.data).not.toHaveProperty("message");
    expect(list.data!.map((r) => [r.client_name, r.client_phone])).toEqual([["Ana Prueba", TEST_PHONES.other]]);
  });

  it("cuenta desactivada o WhatsApp sin verificar no contactan", async () => {
    const call = () => client.rpc("create_inquiry", { p_public_id: house.public_id, p_arrival: null, p_departure: null, p_people: null } as never);
    try {
      await service.from("profiles").update({ is_active: false }).eq("id", clientId);
      expect((await call()).error?.message).toBe(INQUIRY_MESSAGES.inactiveAccount);
      await service.from("profiles").update({ is_active: true, phone_verified_at: null }).eq("id", clientId);
      expect((await call()).error?.message).toBe(INQUIRY_MESSAGES.unverified);
    } finally {
      await service.from("profiles").update({ is_active: true, phone_verified_at: new Date().toISOString() }).eq("id", clientId);
    }
  });

  it("la consulta guarda la copia del número entregado", async () => {
    const { data } = await service.from("inquiries").select("whatsapp_phone, consent_share_phone").eq("id", inquiryId).single();
    expect(data).toEqual({ whatsapp_phone: TEST_PHONES.owner, consent_share_phone: true });
  });

  it("listings_protect sigue congelando el WhatsApp de la casa", async () => {
    expect((await owner.from("listings").update({ whatsapp_phone: "+50600000000" }).eq("id", house.id)).error?.message).toBe("No puede cambiar ese dato.");
  });

  it("favoritos: solo casas publicadas, solo para uno mismo y sin update", async () => {
    expect((await client.from("favorites").insert({ listing_id: draftHouse.id })).error?.code).toBe("42501");
    expect((await owner.from("favorites").insert({ listing_id: draftHouse.id })).error?.code).toBe("42501");
    expect((await client.from("favorites").insert({ user_id: ownerId, listing_id: house.id })).error?.code).toBe("42501");
    expect((await client.from("favorites").insert({ listing_id: house.id })).error).toBeNull();
    expect((await client.from("favorites").update({ listing_id: draftHouse.id }).eq("listing_id", house.id)).error?.code).toBe("42501");
    expect((await anonClient().from("favorites").select("listing_id")).error?.code).toBe("42501");
    expect((await stranger.from("favorites").select("listing_id")).data).toEqual([]);
    expect((await client.from("favorites").select("user_id, listing_id")).data).toEqual([{ user_id: clientId, listing_id: house.id }]);
  });

  it("events acepta inquiry_created", async () => {
    const ok = await service.from("events").insert({ name: "inquiry_created", listing_public_id: house.public_id, page: "ficha", path: "/casa/x", build: "fase3-test" });
    expect(ok.error).toBeNull();
    expect((await service.from("events").insert({ name: "inquiry_sent", page: "ficha", path: "/", build: "fase3-test" })).error?.code).toBe("23514");
    await service.from("events").delete().eq("build", "fase3-test");
  });
});
