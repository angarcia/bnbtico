// Migración listings_alta_segura: un anuncio nuevo solo puede nacer como borrador sin revisión y con el WhatsApp del
// perfil del dueño; el WhatsApp de la casa no se cambia por REST. Antes, un propietario podía insertar directamente una
// casa «active» (saltándose la revisión) con cualquier número.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, serviceClient, signIn } from "./local";

describe("migración listings_alta_segura", () => {
  let owner: SupabaseClient<Database>;
  let ownerId: string;
  const base = () => ({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: TEST_PHONES.owner });

  beforeAll(async () => {
    owner = await signIn("owner");
    ownerId = (await owner.auth.getUser()).data.user!.id;
    await serviceClient().from("listings").delete().not("id", "is", null);
  });

  it("no se puede crear una casa ya activa, en revisión o con fecha de revisión", async () => {
    for (const extra of [{ status: "active" as const }, { status: "review" as const }, { reviewed_at: new Date().toISOString() }, { review_note: "ok" }]) {
      const { error } = await owner.from("listings").insert({ ...base(), ...extra });
      expect(error?.message, JSON.stringify(extra)).toBe("Un anuncio nuevo empieza como borrador.");
    }
    const { count } = await serviceClient().from("listings").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("el WhatsApp de la casa es siempre el del perfil al crearla", async () => {
    const { data, error } = await owner.from("listings").insert({ ...base(), whatsapp_phone: "+50600000000" }).select("whatsapp_phone, status").single();
    expect(error).toBeNull();
    expect(data).toEqual({ whatsapp_phone: TEST_PHONES.owner, status: "draft" });
  });

  it("y no se cambia después por REST", async () => {
    const { data } = await owner.from("listings").insert(base()).select("id").single();
    const { error } = await owner.from("listings").update({ whatsapp_phone: "+50600000000" }).eq("id", data!.id);
    expect(error?.message).toBe("No puede cambiar ese dato.");
  });

  it("el servicio (pruebas, tareas del worker) sigue pudiendo sembrar en cualquier estado", async () => {
    const { error } = await serviceClient().from("listings").insert({ ...base(), status: "active", whatsapp_phone: "+50688889999" });
    expect(error).toBeNull();
  });
});
