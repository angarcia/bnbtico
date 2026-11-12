import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, serviceClient, signIn } from "./local";

describe("permisos conservados al retirar Next", () => {
  let user: SupabaseClient<Database>;
  let userId: string;

  beforeAll(async () => {
    user = await signIn("other");
    const { data, error } = await user.auth.getUser();
    expect(error).toBeNull();
    userId = data.user!.id;
  });

  it.each([
    { is_admin: true },
    { is_owner: true },
    { is_active: false },
    { phone_verified_at: "2026-01-01T00:00:00Z" },
    { phone: "+50600000000" },
  ])("rechaza cambiar una columna protegida del perfil: %j", async (patch) => {
    const service = serviceClient();
    const before = await service.from("profiles").select("is_admin,is_owner,is_active,phone_verified_at,phone").eq("id", userId).single();
    expect(before.error).toBeNull();

    const { error } = await user.from("profiles").update(patch).eq("id", userId);
    expect(error?.code).toBe("42501");

    const after = await service.from("profiles").select("is_admin,is_owner,is_active,phone_verified_at,phone").eq("id", userId).single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("sí permite editar el nombre y la descripción del propio perfil", async () => {
    const before = await user.from("profiles").select("full_name,description").eq("id", userId).single();
    expect(before.error).toBeNull();
    const patch = { full_name: "Ana Prueba Permisos", description: "Prueba de permisos heredados" };
    try {
      const updated = await user.from("profiles").update(patch).eq("id", userId).select("full_name,description").single();
      expect(updated.error).toBeNull();
      expect(updated.data).toEqual(patch);
    } finally {
      const restored = await user.from("profiles").update(before.data!).eq("id", userId);
      expect(restored.error).toBeNull();
    }
  });

  it("seed_admin rechaza al usuario normal y no cambia sus privilegios", async () => {
    const service = serviceClient();
    const before = await service.from("profiles").select("is_admin").eq("id", userId).single();
    expect(before.error).toBeNull();
    expect(before.data?.is_admin).toBe(false);

    const { error } = await user.rpc("seed_admin", { p_phone: TEST_PHONES.other });
    expect(error?.code).toBe("42501");

    const after = await service.from("profiles").select("is_admin").eq("id", userId).single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("el propietario no puede cambiar review_note por REST", async () => {
    const service = serviceClient();
    const created = await service.from("listings").insert({
      owner_id: userId,
      title: "Prueba permisos heredados",
      description: "",
      province: "Limón",
      whatsapp_phone: TEST_PHONES.other,
    }).select("id,review_note").single();
    expect(created.error).toBeNull();
    const listing = created.data!;
    try {
      const { error } = await user.from("listings").update({ review_note: "me apruebo" }).eq("id", listing.id);
      expect(error?.message).toBe("No puede cambiar ese dato.");

      const after = await user.from("listings").select("review_note").eq("id", listing.id).single();
      expect(after.error).toBeNull();
      expect(after.data?.review_note).toBe(listing.review_note);
    } finally {
      const removed = await service.from("listings").delete().eq("id", listing.id);
      expect(removed.error).toBeNull();
    }
  });
});
