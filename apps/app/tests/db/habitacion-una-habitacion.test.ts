// Migración habitacion_una_habitacion (ronda de Ana del 2026-11-02, ticket 03): una Habitación es siempre 1 habitación, sea
// cual sea el camino que escribe `listings`, y listing_edit_check no pide habitaciones si el tipo resultante es Habitación.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn, signInAdmin, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

/** El arreglo de datos de la migración, tal cual. */
const FIX = "begin; select set_config('app.allow_status', 'on', true); update public.listings set bedrooms = 1 where kind = 'habitacion' and bedrooms is distinct from 1; commit;";
const bedroomsOf = async (id: string) => (await serviceClient().from("listings").select("bedrooms").eq("id", id).single()).data?.bedrooms;

describe("migración habitacion_una_habitacion", () => {
  let h: ListingsHarness;
  let owner: SupabaseClient<Database>;
  let admin: SupabaseClient<Database>;

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
    admin = await signInAdmin();
  }, 90_000);
  beforeEach(() => h.reset());

  const approveKind = async (id: string) => {
    const seen = (await serviceClient().from("listing_edit_fields").select("submitted_at").eq("listing_id", id).eq("field", "kind").single()).data!.submitted_at;
    return admin.rpc("review_edit_field", { p_listing: id, p_field: "kind", p_decision: "approve", p_note: "", p_submitted_at: seen });
  };

  it("el arreglo de datos deja en 1 las Habitaciones con null, 0 o más (también las activas); un completo no se toca", async () => {
    const a = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    const d = await h.seed({ status: "draft", draft: { kind: "habitacion", bathroomShared: true } });
    const z = await h.seed({ status: "draft", draft: { kind: "habitacion", bathroomShared: false } });
    const full = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 3 } });
    // Estado de antes de la migración: sin el trigger, con valores sueltos.
    sql(`begin; alter table public.listings disable trigger listings_habitacion_una;
      select set_config('app.allow_status', 'on', true);
      update public.listings set bedrooms = null where id = '${a.id}';
      update public.listings set bedrooms = 4 where id = '${d.id}';
      update public.listings set bedrooms = 0 where id = '${z.id}';
      alter table public.listings enable trigger listings_habitacion_una; commit;`);
    expect([await bedroomsOf(a.id), await bedroomsOf(d.id), await bedroomsOf(z.id)]).toEqual([null, 4, 0]);
    sql(FIX);
    expect([await bedroomsOf(a.id), await bedroomsOf(d.id), await bedroomsOf(z.id), await bedroomsOf(full.id)]).toEqual([1, 1, 1, 3]);
    expect((await serviceClient().from("listings").select("status").eq("id", a.id).single()).data?.status).toBe("active");
  });

  it("el trigger fija 1 al crear una Habitación, al elegir ese tipo y al intentar escribir otro valor; un completo no se toca", async () => {
    const { id } = await h.seed({ status: "draft", draft: { kind: "completo", bedrooms: 3 } });
    expect((await owner.from("listings").update({ kind: "habitacion" }).eq("id", id)).error).toBeNull();
    expect(await bedroomsOf(id)).toBe(1);
    expect((await owner.from("listings").update({ bedrooms: 5 }).eq("id", id)).error).toBeNull();
    expect(await bedroomsOf(id)).toBe(1);
    expect((await owner.from("listings").update({ kind: "completo", bedrooms: 2 }).eq("id", id)).error).toBeNull();
    expect(await bedroomsOf(id)).toBe(2);
    // Por SQL, como el servicio (listings_protect deja pasar), y al insertar ya como Habitación: también 1.
    const updated = sql(`begin; select set_config('app.allow_status', 'on', true);
      update public.listings set kind = 'habitacion', bedrooms = 7 where id = '${id}' returning bedrooms; commit;`);
    expect(updated.split("\n").at(-1)).toBe("1"); // la primera línea es el «on» del set_config
    const inserted = sql(`begin; insert into public.listings (owner_id, title, description, province, whatsapp_phone, kind, bedrooms)
      select owner_id, '', '', 'Limón', whatsapp_phone, 'habitacion', 6 from public.listings where id = '${id}' returning bedrooms; rollback;`);
    expect(inserted).toBe("1");
  });

  it("no choca con listings_protect: una casa activa sigue congelada para su anfitrión", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    const { error } = await owner.from("listings").update({ bedrooms: 3 }).eq("id", id);
    expect(error?.message).toBe("Esta casa está publicada: cambie sus datos desde Mis casas.");
    expect(await bedroomsOf(id)).toBe(1);
  });

  it("update_listing_live en una Habitación guarda la capacidad y deja 1 habitación aunque mande otra cifra", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { capacity: 3, bedrooms: 4 } })).error).toBeNull();
    expect((await serviceClient().from("listings").select("capacity, bedrooms").eq("id", id).single()).data).toEqual({ capacity: 3, bedrooms: 1 });
  });

  it("aprobar un cambio de tipo de completo (3 hab.) a Habitación deja 1; también desde un estudio de 0", async () => {
    for (const bedrooms of [3, 0]) {
      const { id } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms } });
      const saved = await owner.rpc("save_edit", { p_listing: id, p_patch: { kind: "habitacion", bathroom_shared: true } });
      expect(saved.error, `${bedrooms} hab.`).toBeNull();
      expect(await bedroomsOf(id)).toBe(bedrooms); // pendiente: aún no cambia
      expect((await approveKind(id)).data).toBe("approved");
      expect((await serviceClient().from("listings").select("kind, bedrooms, status").eq("id", id).single()).data).toEqual({ kind: "habitacion", bedrooms: 1, status: "active" });
    }
  });

  it("listing_edit_check ya no pide habitaciones al cambiar el nombre (editar sigue las reglas de crear, ticket 12)", async () => {
    // Una casa de las de antes (tipo «casa») con 0 habitaciones: hasta el ticket 12 un cambio con revisión las pedía; ahora
    // cada dato se valida solo y las habitaciones son de la capacidad (avisan en la app).
    const { id } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 0 } });
    sql(`begin; select set_config('app.allow_status', 'on', true); update public.listings set kind = 'casa' where id = '${id}'; commit;`);
    const { error } = await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco del Caribe" } });
    expect(error).toBeNull();
  });

  it("el filtro de Explorar «bedrooms >= 1» encuentra la Habitación que antes era un estudio", async () => {
    const { id, publicId } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 0 } });
    expect((await anonClient().from("listings_public").select("public_id").gte("bedrooms", 1).eq("public_id", publicId)).data).toEqual([]);
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { kind: "habitacion", bathroom_shared: false } })).error).toBeNull();
    expect((await approveKind(id)).error).toBeNull();
    expect((await anonClient().from("listings_public").select("public_id, bedrooms").gte("bedrooms", 1).eq("public_id", publicId)).data).toEqual([{ public_id: publicId, bedrooms: 1 }]);
  });
});
