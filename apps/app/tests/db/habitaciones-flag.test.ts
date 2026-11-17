// Migración habitaciones_flag (historia #62, decisiones del 2026-11-17): con la flag `rooms` apagada en la base ninguna casa
// pasa a ser Habitación, ninguna Habitación se envía a revisión y no se guarda una propuesta de edición a Habitación, por
// cualquier camino y sin que el navegador pueda saltárselo. Encendida, todo vuelve a funcionar (lo cubren el resto de las
// pruebas de habitaciones, con el harness en `rooms` encendida).
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { TEST_PHONES, serviceClient, signIn, sql } from "./local";
import { ROOMS_ON, postgrestHarness } from "./postgrest-harness";

const ROOMS_OFF = { ...ROOMS_ON, p_rooms: false };
const MESSAGE = "Por ahora 3bstays publica solo alojamientos completos.";
const rooms = async (on: boolean) => expect((await serviceClient().rpc("set_feature_flags", on ? ROOMS_ON : ROOMS_OFF)).error).toBeNull();
const kindOf = (id: string) => sql(`select kind || '/' || status from public.listings where id = '${id}';`);

describe("habitaciones con la flag apagada", () => {
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  let owner: SupabaseClient<Database>;

  beforeAll(async () => {
    h = await postgrestHarness();
    owner = await signIn("owner");
  }, 90_000);
  beforeEach(async () => {
    await h.reset();
    await rooms(false);
  });
  afterAll(() => rooms(true));

  it("un alojamiento completo se crea, se edita y se envía como siempre", async () => {
    const l = await h.seed({ status: "review", draft: { kind: "completo" } });
    expect(kindOf(l.id)).toBe("completo/review");
  });

  it("no se crea ni se convierte un borrador en Habitación, ni siquiera llamando directamente a la API", async () => {
    const draft = await h.seed({ status: "draft", draft: { kind: "completo" } });
    const update = await owner.from("listings").update({ kind: "habitacion" }).eq("id", draft.id);
    expect(update.error?.message).toBe(MESSAGE);
    expect(kindOf(draft.id)).toBe("completo/draft");

    const ownerId = (await owner.auth.getUser()).data.user!.id;
    const insert = await owner.from("listings").insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: TEST_PHONES.owner, kind: "habitacion" });
    expect(insert.error?.message).toBe(MESSAGE);
  });

  it("una Habitación guardada antes no se envía a revisión y el borrador se conserva", async () => {
    await rooms(true);
    const draft = await h.seed({ status: "draft", photos: 1, draft: { kind: "habitacion", bathroomShared: true } });
    await rooms(false);
    const submit = await owner.rpc("submit_listing", { p_listing: draft.id });
    expect(submit.error?.message).toBe(MESSAGE);
    expect(kindOf(draft.id)).toBe("habitacion/draft");
  });

  it("una casa publicada no propone pasar a Habitación", async () => {
    const live = await h.seed({ status: "active", draft: { kind: "completo" } });
    const edit = await owner.rpc("save_edit", { p_listing: live.id, p_patch: { kind: "habitacion", bathroom_shared: true } });
    expect(edit.error?.message).toBe(MESSAGE);
    expect(sql(`select count(*) from public.listing_edit_fields where listing_id = '${live.id}' and field = 'kind';`)).toBe("0");
  });
});

describe("el borrado de la migración", () => {
  it("elimina con borrado lógico todas las Habitaciones, en cualquier estado, y descarta las propuestas de pasar a Habitación", async () => {
    const h = await postgrestHarness();
    await h.reset();
    const active = await h.seed({ status: "active", draft: { kind: "habitacion", bathroomShared: true } });
    const draft = await h.seed({ status: "draft", draft: { kind: "habitacion", bathroomShared: false } });
    const full = await h.seed({ status: "active", draft: { kind: "completo" } });
    const owner = await signIn("owner");
    expect((await owner.rpc("save_edit", { p_listing: full.id, p_patch: { kind: "habitacion", bathroom_shared: true } })).error).toBeNull();

    // El bloque de datos de la migración, tal cual (supabase/migrations/20261117170000_habitaciones_flag.sql).
    sql(`with dropped as (
        update public.listing_edits set kind = null, bathroom_shared = null where kind = 'habitacion' returning listing_id
      )
      delete from public.listing_edit_fields f using dropped d where f.listing_id = d.listing_id and f.field = 'kind';
      do $$ declare r record; begin
        perform set_config('app.allow_status', 'on', true);
        for r in select id, public_id from public.listings where kind = 'habitacion' and deleted_at is null loop
          update public.listings set deleted_at = now(), deleted_reason = 'Habitaciones fuera del lanzamiento (decisión del 2026-11-17).' where id = r.id;
          delete from public.subscription_reminders where listing_id = r.id and status = 'queued';
          perform public.purge_listing_page(r.public_id);
        end loop;
      end $$;`);

    for (const l of [active, draft]) expect(sql(`select deleted_at is not null from public.listings where id = '${l.id}';`)).toBe("t");
    expect(sql(`select deleted_at is null and kind = 'completo' from public.listings where id = '${full.id}';`)).toBe("t");
    expect(sql(`select count(*) from public.listing_edit_fields where listing_id = '${full.id}' and field = 'kind';`)).toBe("0");
    expect(await h.anon.getPublic(active.publicId)).toBeNull();
  });
});
