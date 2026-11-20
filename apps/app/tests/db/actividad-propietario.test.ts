// Migración owner_activity: una fila por casa propia (cualquier estado) con visitas y consultas de los últimos 30 días.
// Solo sale lo de quien llama y sin sesión no se puede llamar. Desde el 2026-11-20 (unificar estadísticas) no hay cifra
// de toques en WhatsApp: `whatsapp_tap` sigue en events como telemetría interna y no cuenta en ninguna cifra del propietario.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, anonClient, serviceClient, signIn } from "./local";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

describe("migración owner_activity", () => {
  const service = serviceClient();
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let active: { id: string; public_id: string };
  let draft: { id: string; public_id: string };
  let foreign: { id: string; public_id: string };

  const event = (name: string, publicId: string, daysAgo = 0) => ({ name, listing_public_id: publicId, page: "ficha", path: `/casa/${publicId}`, build: "prueba", created_at: ago(daysAgo) });
  const many = (n: number, make: () => ReturnType<typeof event>) => Array.from({ length: n }, make);

  beforeAll(async () => {
    owner = await signIn("owner");
    other = await signIn("other");
    const admin = await signIn("admin");
    const ownerId = (await owner.auth.getUser()).data.user!.id;
    const otherId = (await other.auth.getUser()).data.user!.id;
    const house = (owner_id: string, status: "active" | "draft", title: string, phone: string) => ({
      owner_id, status, title, description: "x", province: "Limón", whatsapp_phone: phone, capacity: 2, bedrooms: 1, bathrooms: 1, accepts_nightly: true, nightly_price_crc: 30000,
    });
    await service.from("listings").delete().not("id", "is", null);
    active = (await service.from("listings").insert(house(ownerId, "active", "Casa activa", TEST_PHONES.owner)).select("id, public_id").single()).data!;
    draft = (await service.from("listings").insert(house(ownerId, "draft", "Borrador", TEST_PHONES.owner)).select("id, public_id").single()).data!;
    foreign = (await service.from("listings").insert(house(otherId, "active", "Ajena", TEST_PHONES.other)).select("id, public_id").single()).data!;

    const events = [
      ...many(3, () => event("listing_view", active.public_id)),
      ...many(2, () => event("listing_view", active.public_id, 31)),
      ...many(2, () => event("whatsapp_tap", active.public_id)),
      event("whatsapp_tap", active.public_id, 31),
      event("page_view", active.public_id),
      ...many(4, () => event("listing_view", foreign.public_id)),
    ];
    expect((await service.from("events").insert(events)).error).toBeNull();

    for (const client of [other, admin]) {
      const created = await client.rpc("create_inquiry", { p_public_id: active.public_id, p_arrival: null, p_departure: null, p_people: null } as never);
      expect(created.error).toBeNull();
    }
    const adminId = (await admin.auth.getUser()).data.user!.id;
    const old = ago(31);
    expect((await service.from("inquiries").update({ created_at: old, updated_at: old }).eq("client_id", adminId)).error).toBeNull();
  });

  it("solo las casas de quien llama, la más reciente primero, en cualquier estado", async () => {
    const { data, error } = await owner.rpc("owner_activity");
    expect(error).toBeNull();
    expect(data).toEqual([
      { listing_id: draft.id, public_id: draft.public_id, views: 0, inquiries: 0 },
      { listing_id: active.id, public_id: active.public_id, views: 3, inquiries: 1 },
    ]);
    expect((await other.rpc("owner_activity")).data!.map((r) => r.public_id)).toEqual([foreign.public_id]);
  });

  it("sin sesión no se puede llamar", async () => expect((await anonClient().rpc("owner_activity")).error?.code).toBe("42501"));

  it("owner_listing_stats da las mismas cifras que owner_activity, y una casa ajena no expone nada", async () => {
    const { data, error } = await owner.rpc("owner_listing_stats", { p_listing: active.id });
    expect(error).toBeNull();
    expect(data).toEqual([{ views: 3, inquiries: 1 }]);
    expect((await other.rpc("owner_listing_stats", { p_listing: active.id })).error?.message).toBe("No encontramos ese anuncio.");
    expect((await anonClient().rpc("owner_listing_stats", { p_listing: active.id })).error?.code).toBe("42501");
  });

  it("las consultas creadas por 3bstays (source support) también cuentan", async () => {
    const ownerId = (await owner.auth.getUser()).data.user!.id;
    const otherId = (await other.auth.getUser()).data.user!.id;
    const row = { listing_id: active.id, client_id: otherId, owner_id: ownerId, whatsapp_phone: TEST_PHONES.owner, source: "support" };
    const support = (await service.from("inquiries").insert(row).select("id").single()).data!;
    try {
      expect((await owner.rpc("owner_activity")).data!.find((r) => r.listing_id === active.id)!.inquiries).toBe(2);
      expect((await owner.rpc("owner_listing_stats", { p_listing: active.id })).data![0]!.inquiries).toBe(2);
    } finally {
      expect((await service.from("inquiries").delete().eq("id", support.id)).error).toBeNull();
    }
  });

  it("la ventana es de 30 días para visitas y consultas", async () => {
    const counts = async () => (await owner.rpc("owner_activity")).data!.find((r) => r.listing_id === active.id)!;
    const recent = async (name: string) => (await service.from("events").select("id").eq("name", name).eq("listing_public_id", active.public_id).gt("created_at", ago(1))).data!.map((r) => r.id as number);
    const move = async (ids: number[], daysAgo: number) => expect((await service.from("events").update({ created_at: ago(daysAgo) }).in("id", ids)).error).toBeNull();

    const views = await recent("listing_view");
    await move([views[0]!], 29);
    await move(views.slice(1), 31);
    const inquiry = (await service.from("inquiries").select("id").eq("listing_id", active.id).gt("created_at", ago(1))).data![0]!;
    const setInquiry = async (daysAgo: number) => expect((await service.from("inquiries").update({ created_at: ago(daysAgo), updated_at: ago(daysAgo) }).eq("id", inquiry.id)).error).toBeNull();

    await setInquiry(29);
    expect(await counts()).toMatchObject({ views: 1, inquiries: 1 });
    await setInquiry(31);
    expect(await counts()).toMatchObject({ views: 1, inquiries: 0 });
  });
});
