// Migración fase4_calendario: listing_days y listing_rates solo se escriben con RPCs, la reapertura nocturna con pg_cron
// (no la llama nadie desde la app) y una sola purga de la ficha por guardado. Cada caso siembra sus propias casas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { SubscriptionHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: SubscriptionHarness;
let owner: SupabaseClient<Database>;
let ownerId: string;

const day = (offset: number) => costaRicaToday(Date.now() + offset * 86_400_000);

beforeAll(async () => {
  h = await postgrestHarness();
  owner = await signIn("owner");
  ownerId = (await owner.auth.getUser()).data.user!.id;
}, 90_000);

// El tope de 5 borradores sin enviar cuenta los que dejan otros casos y archivos: cada caso empieza sin casas.
beforeEach(async () => {
  await h.reset();
}, 60_000);

describe("escrituras directas cerradas", () => {
  it("ni el dueño ni un anónimo insertan, cambian o borran filas de listing_days o listing_rates", async () => {
    const l = await h.seed({ status: "active" });
    await h.calendar("owner").save(l.id, { days: [day(2)], available: false });
    for (const [who, client] of [["dueño", owner], ["anónimo", anonClient()]] as const) {
      const days = client.from("listing_days");
      expect((await days.insert({ listing_id: l.id, day: day(3), available: false })).error?.code, who).toBe("42501");
      expect((await days.update({ available: true }).eq("listing_id", l.id)).error?.code, who).toBe("42501");
      expect((await days.delete().eq("listing_id", l.id)).error?.code, who).toBe("42501");
      const rates = client.from("listing_rates");
      expect((await rates.insert({ listing_id: l.id, base_weekend_crc: 50_000 })).error?.code, who).toBe("42501");
      expect((await rates.update({ base_weekend_crc: 1 }).eq("listing_id", l.id)).error?.code, who).toBe("42501");
      expect((await rates.delete().eq("listing_id", l.id)).error?.code, who).toBe("42501");
    }
    const left = await serviceClient().from("listing_days").select("day, available").eq("listing_id", l.id);
    expect(left.data).toEqual([{ day: day(2), available: false }]);
  });

  it("el dueño sigue leyendo sus días por REST y un anónimo no puede guardar con la RPC", async () => {
    const l = await h.seed({ status: "draft" });
    await h.calendar("owner").save(l.id, { days: [day(4)], available: false });
    expect((await owner.from("listing_days").select("day").eq("listing_id", l.id)).data).toEqual([{ day: day(4) }]);
    expect((await anonClient().from("listing_days").select("day").eq("listing_id", l.id)).data).toEqual([]);
    const anon = await anonClient().rpc("save_listing_days", { p_listing: l.id, p_days: [day(5)], p_available: false });
    expect(anon.error?.code).toBe("42501");
  });
});

describe("reapertura nocturna", () => {
  it("reopen_due_listings no la puede llamar un anónimo ni un usuario con sesión", async () => {
    for (const client of [anonClient(), owner]) {
      const { error } = await client.rpc("reopen_due_listings", { p_today: day(1) });
      expect(error?.code).toBe("42501");
    }
  });

  it("el trabajo bnbtico-reabrir-casas está registrado a las 06:00 UTC (medianoche en Costa Rica)", () => {
    const job = sql("select schedule || '|' || command || '|' || active from cron.job where jobname = 'bnbtico-reabrir-casas'");
    expect(job).toBe("0 6 * * *|select public.reopen_due_listings()|true");
  });

  it("abre una casa activa y una parada cuya fecha llegó sin cambiar su estado; deja las de fecha futura", async () => {
    const active = await h.seed({ status: "active" });
    const hidden = await h.seed({ status: "active" });
    const later = await h.seed({ status: "active" });
    await h.setClosed(active.id, true, day(1));
    await h.setClosed(hidden.id, true, day(1));
    await h.billing("owner").stop(hidden.id);
    await h.setClosed(later.id, true, day(2));
    const { data, error } = await serviceClient().rpc("reopen_due_listings", { p_today: day(1) });
    expect(error).toBeNull();
    expect(data).toBeGreaterThanOrEqual(2);
    const rows = await serviceClient().from("listings").select("id, status, available, reopen_at").in("id", [active.id, hidden.id, later.id]);
    const byId = new Map(rows.data!.map((r) => [r.id, r]));
    expect(byId.get(active.id)).toMatchObject({ status: "active", available: true, reopen_at: null });
    expect(byId.get(hidden.id)).toMatchObject({ status: "inactive", available: true, reopen_at: null });
    expect(byId.get(later.id)).toMatchObject({ status: "active", available: false, reopen_at: day(2) });
  });
});

/**
 * La cola de pg_net se mira dentro de una transacción que se deshace (como en admin-aal2-purga.test.ts): los secretos
 * de Vault se crean en ella y nada sale de verdad.
 */
const inTransaction = (body: string) => sql(`begin;\n${body}\nrollback;`);
const withSecrets = `
  select vault.create_secret('https://nueva.example.test/', 'worker_purge_url') is not null;
  select vault.create_secret('secreto-de-prueba', 'worker_purge_secret') is not null;
`;
const asOwner = () => `set local role authenticated;
  select set_config('request.jwt.claims', '${JSON.stringify({ sub: ownerId, role: "authenticated", aal: "aal1" })}', true);`;
const queueOf = (publicId: string) => `
  reset role;
  select count(*) from net.http_request_queue where url = 'https://nueva.example.test/_purge/${publicId}';
`;
const lastLine = (out: string) => out.split("\n").at(-1);
const thirtyDays = "array(select (now() at time zone 'America/Costa_Rica')::date + i from generate_series(1, 30) i)";

describe("una purga de la ficha por guardado", () => {
  it("guardar 30 días de una casa activa encola exactamente una purga", async () => {
    const l = await h.seed({ status: "active" });
    const out = inTransaction(`${withSecrets}${asOwner()}
      select public.save_listing_days('${l.id}', ${thirtyDays}, false, 95000) is null;
      ${queueOf(l.publicId)}`);
    expect(lastLine(out)).toBe("1");
  });

  it("cerrar con fecha encola una y abrir otra", async () => {
    const l = await h.seed({ status: "active" });
    const close = inTransaction(`${withSecrets}${asOwner()}
      select public.set_listing_available('${l.id}', false, '${day(10)}') is null;
      ${queueOf(l.publicId)}`);
    expect(lastLine(close)).toBe("1");
    await h.setClosed(l.id, true);
    const open = inTransaction(`${withSecrets}${asOwner()}
      select public.set_listing_available('${l.id}', true) is null;
      ${queueOf(l.publicId)}`);
    expect(lastLine(open)).toBe("1");
  });

  it("guardar en un borrador no encola ninguna", async () => {
    const l = await h.seed({ status: "draft" });
    const out = inTransaction(`${withSecrets}${asOwner()}
      select public.save_listing_days('${l.id}', ${thirtyDays}, false, null) is null;
      ${queueOf(l.publicId)}`);
    expect(lastLine(out)).toBe("0");
  });
});
