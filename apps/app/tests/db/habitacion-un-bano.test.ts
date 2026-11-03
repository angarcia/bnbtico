// Migración habitacion_un_bano (ronda de Ana del 2026-11-02, ticket 03, ajuste de Daniel del 2026-11-03): una Habitación es
// siempre 1 baño, como ya era 1 habitación, sea cual sea el camino que escribe `listings`; update_listing_live no le pide baños.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import type { ListingsHarness } from "../contract/harness";
import { serviceClient, signIn, signInAdmin, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

/** El arreglo de datos de la migración, tal cual. */
const FIX =
  "begin; select set_config('app.allow_status', 'on', true); update public.listings set bedrooms = 1, bathrooms = 1 where kind = 'habitacion' and (bedrooms is distinct from 1 or bathrooms is distinct from 1); commit;";
const roomsOf = async (id: string) => (await serviceClient().from("listings").select("bedrooms, bathrooms").eq("id", id).single()).data;

describe("migración habitacion_un_bano", () => {
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

  it("el arreglo de datos deja en 1 los baños de las Habitaciones con null, 0 o más (también las activas); un completo no se toca", async () => {
    const a = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    const d = await h.seed({ status: "draft", draft: { kind: "habitacion", bathroomShared: true } });
    const z = await h.seed({ status: "draft", draft: { kind: "habitacion", bathroomShared: false } });
    const full = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 3, bathrooms: 2 } });
    // Estado de antes de la migración: sin el trigger, con valores sueltos.
    sql(`begin; alter table public.listings disable trigger listings_habitacion_una;
      select set_config('app.allow_status', 'on', true);
      update public.listings set bathrooms = null where id = '${a.id}';
      update public.listings set bathrooms = 3 where id = '${d.id}';
      update public.listings set bathrooms = 0 where id = '${z.id}';
      alter table public.listings enable trigger listings_habitacion_una; commit;`);
    expect([(await roomsOf(a.id))?.bathrooms, (await roomsOf(d.id))?.bathrooms, (await roomsOf(z.id))?.bathrooms]).toEqual([null, 3, 0]);
    sql(FIX);
    expect([await roomsOf(a.id), await roomsOf(d.id), await roomsOf(z.id), await roomsOf(full.id)]).toEqual([
      { bedrooms: 1, bathrooms: 1 },
      { bedrooms: 1, bathrooms: 1 },
      { bedrooms: 1, bathrooms: 1 },
      { bedrooms: 3, bathrooms: 2 },
    ]);
    expect((await serviceClient().from("listings").select("status").eq("id", a.id).single()).data?.status).toBe("active");
  });

  it("el trigger fija 1 baño al crear una Habitación, al elegir ese tipo y al intentar escribir otro valor; un completo no se toca", async () => {
    const { id } = await h.seed({ status: "draft", draft: { kind: "completo", bedrooms: 3, bathrooms: 2 } });
    expect((await owner.from("listings").update({ kind: "habitacion" }).eq("id", id)).error).toBeNull();
    expect(await roomsOf(id)).toEqual({ bedrooms: 1, bathrooms: 1 });
    // Solo los baños en el UPDATE: también dispara el trigger.
    expect((await owner.from("listings").update({ bathrooms: 4 }).eq("id", id)).error).toBeNull();
    expect(await roomsOf(id)).toEqual({ bedrooms: 1, bathrooms: 1 });
    expect((await owner.from("listings").update({ bathrooms: null }).eq("id", id)).error).toBeNull();
    expect(await roomsOf(id)).toEqual({ bedrooms: 1, bathrooms: 1 });
    expect((await owner.from("listings").update({ kind: "completo", bedrooms: 2, bathrooms: 3 }).eq("id", id)).error).toBeNull();
    expect(await roomsOf(id)).toEqual({ bedrooms: 2, bathrooms: 3 });
    // Por SQL, como el servicio (listings_protect deja pasar), y al insertar ya como Habitación: también 1.
    const updated = sql(`begin; select set_config('app.allow_status', 'on', true);
      update public.listings set kind = 'habitacion', bathrooms = 7 where id = '${id}' returning bathrooms; commit;`);
    expect(updated.split("\n").at(-1)).toBe("1"); // la primera línea es el «on» del set_config
    const inserted = sql(`begin; insert into public.listings (owner_id, title, description, province, whatsapp_phone, kind, bedrooms, bathrooms)
      select owner_id, '', '', 'Limón', whatsapp_phone, 'habitacion', 6, 5 from public.listings where id = '${id}' returning bedrooms || '/' || bathrooms; rollback;`);
    expect(inserted).toBe("1/1");
  });

  it("no choca con listings_protect: una Habitación activa sigue congelada para su anfitrión", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    const { error } = await owner.from("listings").update({ bathrooms: 3 }).eq("id", id);
    expect(error?.message).toBe("Esta casa está publicada: cambie sus datos desde Mis casas.");
    expect(await roomsOf(id)).toEqual({ bedrooms: 1, bathrooms: 1 });
  });

  it("update_listing_live no pide baños a una Habitación: sin baños, con null o con otra cifra guarda y deja 1", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    for (const p_patch of [{ capacity: 3 }, { capacity: 3, bathrooms: null }, { capacity: 3, bathrooms: 0 }, { capacity: 3, bathrooms: 4, bedrooms: 2 }]) {
      expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch })).error, JSON.stringify(p_patch)).toBeNull();
      expect((await serviceClient().from("listings").select("capacity, bedrooms, bathrooms").eq("id", id).single()).data).toEqual({ capacity: 3, bedrooms: 1, bathrooms: 1 });
    }
  });

  it("update_listing_live sigue pidiendo baños y habitaciones a un alojamiento completo", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 2, bathrooms: 2 } });
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { bathrooms: 0 } })).error?.message).toBe("Indique el número de baños (mínimo 1).");
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { bathrooms: null } })).error?.message).toBe("Indique el número de baños (mínimo 1).");
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { bedrooms: null } })).error?.message).toBe(
      "Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.",
    );
    expect(await roomsOf(id)).toEqual({ bedrooms: 2, bathrooms: 2 });
  });

  it("aprobar un cambio de tipo de completo (2 baños) a Habitación deja 1 baño", async () => {
    const { id } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 3, bathrooms: 2 } });
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { kind: "habitacion", bathroom_shared: true } })).error).toBeNull();
    expect(await roomsOf(id)).toEqual({ bedrooms: 3, bathrooms: 2 }); // pendiente: aún no cambia
    expect((await approveKind(id)).data).toBe("approved");
    expect((await serviceClient().from("listings").select("kind, bedrooms, bathrooms, status").eq("id", id).single()).data).toEqual({
      kind: "habitacion",
      bedrooms: 1,
      bathrooms: 1,
      status: "active",
    });
  });

  it("submit_listing envía una Habitación cuyo paso 4 no mandó baños", async () => {
    const { id } = await h.seed({ status: "draft", photos: 1, draft: { kind: "habitacion", bathroomShared: false } });
    expect((await owner.from("listings").update({ bathrooms: null }).eq("id", id)).error).toBeNull();
    expect((await owner.rpc("submit_listing", { p_listing: id })).error).toBeNull();
    expect((await serviceClient().from("listings").select("status, bathrooms").eq("id", id).single()).data).toEqual({ status: "review", bathrooms: 1 });
  });
});
