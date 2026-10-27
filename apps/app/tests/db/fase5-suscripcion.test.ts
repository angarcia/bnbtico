// Migración fase5_suscripcion: tablas sin escrituras desde el navegador, ids de la pasarela que no se leen, RPCs solo del
// servicio, job de pg_cron, plazas bajo candado con dos aprobaciones a la vez, outbox de avisos (nunca dos veces, dos
// reclamos a la vez dan filas distintas, «sending» no se reclama), reloj de pruebas con Vault, una purga por cambio de
// estado y el relleno de la migración sobre casas que ya existen. Cada caso siembra sus propias casas.
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/domain/database.types";
import { costaRicaToday } from "../../src/domain/inquiry";
import { SUBSCRIPTION_MESSAGES as M } from "../../src/domain/subscription";
import type { SubscriptionHarness } from "../contract/harness";
import { anonClient, serviceClient, signIn, signInAdmin, sql, sqlAsync } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: SubscriptionHarness;
let owner: SupabaseClient<Database>;
let other: SupabaseClient<Database>;
let adminId: string;

const today = () => costaRicaToday(Date.now());
const uuid = (s: string) => s.replace(/[^0-9a-f-]/g, "");

beforeAll(async () => {
  h = await postgrestHarness();
  owner = await signIn("owner");
  other = await signIn("other");
  adminId = (await (await signInAdmin()).auth.getUser()).data.user!.id;
}, 90_000);

beforeEach(async () => {
  await h.reset();
}, 60_000);

const claimsOf = (sub: string, aal: "aal1" | "aal2" = "aal1") => `
  set local role authenticated;
  select set_config('request.jwt.claims', '${JSON.stringify({ sub, role: "authenticated", aal })}', true);
`;
/** Transacción que se deshace (Vault y la cola de pg_net, como en admin-aal2-purga.test.ts). */
const inTransaction = (body: string) => sql(`begin;\n${body}\nrollback;`);
const withPurgeSecrets = `
  select vault.create_secret('https://nueva.example.test/', 'worker_purge_url') is not null;
  select vault.create_secret('secreto-de-prueba', 'worker_purge_secret') is not null;
`;
const purgesOf = (publicId: string) => `
  reset role;
  select count(*) from net.http_request_queue where url like '%/_purge/${publicId}';
`;
const lastLine = (out: string) => out.split("\n").at(-1)!;

describe("permisos de las tablas", () => {
  it("ni el dueño ni un anónimo escriben en subscriptions, subscription_reminders, payment_methods, payment_customers o payment_events", async () => {
    const l = await h.seed({ status: "active" });
    const me = h.ownerId("owner");
    for (const [who, c] of [["dueño", owner], ["anónimo", anonClient()]] as const) {
      const subs = c.from("subscriptions");
      expect((await subs.insert({ listing_id: l.id })).error?.code, who).toBe("42501");
      expect((await subs.update({ plan: "paid" }).eq("listing_id", l.id)).error?.code, who).toBe("42501");
      expect((await subs.delete().eq("listing_id", l.id)).error?.code, who).toBe("42501");
      const rem = c.from("subscription_reminders");
      expect((await rem.insert({ listing_id: l.id, days_before: 90 })).error?.code, who).toBe("42501");
      expect((await rem.update({ status: "sent" }).eq("listing_id", l.id)).error?.code, who).toBe("42501");
      expect((await rem.delete().eq("listing_id", l.id)).error?.code, who).toBe("42501");
      const pm = c.from("payment_methods");
      const card = { owner_id: me, provider: "fake", customer_ref: "c", method_ref: "m", brand: "visa", last4: "4242", exp_month: 1, exp_year: 2030 };
      expect((await pm.insert(card)).error?.code, who).toBe("42501");
      expect((await pm.update({ last4: "0000" }).eq("owner_id", me)).error?.code, who).toBe("42501");
      expect((await pm.delete().eq("owner_id", me)).error?.code, who).toBe("42501");
      expect((await c.from("payment_customers").insert({ owner_id: me, provider: "fake", customer_ref: "c" })).error?.code, who).toBe("42501");
      expect((await c.from("payment_events").insert({ provider: "fake", event_id: "e", type: "x" })).error?.code, who).toBe("42501");
    }
    const sub = await serviceClient().from("subscriptions").select("plan, promo_slot").eq("listing_id", l.id).single();
    expect(sub.data).toEqual({ plan: "promo", promo_slot: 1 });
  });

  it("el dueño lee su suscripción y sus avisos; otro propietario no ve nada; un anónimo no puede leer", async () => {
    const l = await h.seed({ status: "active" });
    await h.setDaysLeft(l.id, 30);
    await h.service.runDay(today());
    expect((await owner.from("subscriptions").select("promo_slot").eq("listing_id", l.id)).data).toEqual([{ promo_slot: 1 }]);
    expect((await owner.from("subscription_reminders").select("days_before, status, sent_at").eq("listing_id", l.id)).data).toEqual([{ days_before: 30, status: "queued", sent_at: null }]);
    expect((await other.from("subscriptions").select("listing_id")).data).toEqual([]);
    expect((await other.from("subscription_reminders").select("listing_id")).data).toEqual([]);
    expect((await anonClient().from("subscriptions").select("listing_id")).error?.code).toBe("42501");
    expect((await anonClient().from("subscription_reminders").select("listing_id")).error?.code).toBe("42501");
    // El texto y el número del aviso solo los ve el servicio.
    expect((await owner.from("subscription_reminders").select("body")).error?.code).toBe("42501");
    expect((await owner.from("subscription_reminders").select("*")).error?.code).toBe("42501");
  });

  it("los ids de la pasarela no se leen desde el navegador; clientes y eventos, nada", async () => {
    await h.service.applyPaymentEvent({ provider: "fake", eventId: `evt_${Date.now()}`, type: "setup_completed", ownerId: h.ownerId("owner"), customerRef: "cus_9", methodRef: "pm_9", brand: "visa", last4: "4242", expMonth: 12, expYear: 2029 });
    await h.service.savePaymentCustomer(h.ownerId("owner"), "stripe", "cus_9");
    const visible = await owner.from("payment_methods").select("owner_id, provider, brand, last4, exp_month, exp_year, added_at");
    expect(visible.data).toEqual([{ owner_id: h.ownerId("owner"), provider: "fake", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2029, added_at: expect.any(String) }]);
    for (const cols of ["method_ref", "customer_ref", "*"]) expect((await owner.from("payment_methods").select(cols)).error?.code, cols).toBe("42501");
    expect((await other.from("payment_methods").select("brand")).data).toEqual([]);
    expect((await owner.from("payment_customers").select("owner_id")).error?.code).toBe("42501");
    expect((await owner.from("payment_events").select("event_id")).error?.code).toBe("42501");
    expect((await anonClient().from("payment_methods").select("brand")).error?.code).toBe("42501");
  });
});

describe("permisos de las funciones", () => {
  it("las del servicio dan 42501 a anónimos y usuarios; las del propietario, a anónimos", async () => {
    const l = await h.seed({ status: "active" });
    const me = h.ownerId("owner");
    const serviceOnly = [
      ["run_subscription_day", {}],
      ["claim_reminders", { p_limit: 1 }],
      ["finish_reminders", { p_results: [] }],
      ["save_payment_customer", { p_owner: me, p_provider: "fake", p_ref: "c" }],
      ["apply_payment_event", { p_provider: "fake", p_event_id: "e", p_type: "setup_completed", p_owner: me }],
      ["test_set_offer_days_left", { p_public_id: l.publicId, p_days_left: 1 }],
      ["owner_has_payment_method", { p_owner: me }],
    ] as const;
    for (const [fn, args] of serviceOnly) {
      for (const [who, c] of [["dueño", owner], ["anónimo", anonClient()]] as const) {
        expect((await c.rpc(fn as never, args as never)).error?.code, `${fn} · ${who}`).toBe("42501");
      }
    }
    const ownerOnly = [
      ["owner_billing", {}],
      ["stop_subscription", { p_listing: l.id }],
      ["resume_subscription", { p_listing: l.id }],
      ["payment_setup_context", { p_provider: "stripe" }],
    ] as const;
    for (const [fn, args] of ownerOnly) expect((await anonClient().rpc(fn as never, args as never)).error?.code, fn).toBe("42501");
    expect((await anonClient().rpc("launch_offer_taken")).data).toBe(1);
    expect((await anonClient().rpc("listing_blocked_reason", { p_public_id: l.publicId })).data).toBeNull();
    const row = await serviceClient().from("listings").select("status").eq("id", l.id).single();
    expect(row.data?.status).toBe("active");
  });

  it("el job bnbtico-suscripciones está registrado a las 06:05 UTC (00:05 en Costa Rica)", () => {
    expect(sql("select schedule || '|' || active || '|' || command from cron.job where jobname = 'bnbtico-suscripciones'")).toBe("5 6 * * *|true|select public.run_subscription_day()");
  });
});

describe("plazas bajo candado", () => {
  it("dos aprobaciones a la vez desde dos conexiones toman plazas distintas (la segunda espera a la primera)", async () => {
    const a = await h.seed({ status: "review" });
    const b = await h.seed({ status: "review" });
    const approve = (id: string, hold: number) => `begin;${claimsOf(adminId, "aal2")}
      select review_listing('${uuid(id)}', 'approve', '');
      select pg_sleep(${hold});
      commit;`;
    const first = sqlAsync(approve(a.id, 1.5));
    await new Promise((r) => setTimeout(r, 400));
    const started = Date.now();
    const second = sqlAsync(approve(b.id, 0));
    const [outA, outB] = await Promise.all([first, second]);
    const waited = Date.now() - started;
    expect(outA).toContain("active");
    expect(outB).toContain("active");
    expect(waited).toBeGreaterThan(700);
    const slots = await serviceClient().from("subscriptions").select("listing_id, promo_slot").in("listing_id", [a.id, b.id]);
    expect(Object.fromEntries(slots.data!.map((s) => [s.listing_id, s.promo_slot]))).toEqual({ [a.id]: 1, [b.id]: 2 });
  });
});

describe("outbox de avisos", () => {
  it("el mismo umbral no se encola dos veces: otra pasada no añade nada y la clave lo impide", async () => {
    const l = await h.seed({ status: "active" });
    await h.setDaysLeft(l.id, 10);
    expect((await h.service.runDay(today())).queued).toBe(1);
    expect((await h.service.runDay(today())).queued).toBe(0);
    const dup = await serviceClient().from("subscription_reminders").insert({ listing_id: l.id, days_before: 30, promo_ends_on: today() });
    expect(dup.error?.code).toBe("23505");
  });

  it("dos reclamos a la vez desde dos conexiones devuelven filas distintas, y una fila «sending» no se vuelve a reclamar", async () => {
    for (let k = 0; k < 4; k++) await h.setDaysLeft((await h.seed({ status: "active" })).id, 60);
    expect((await h.service.runDay(today())).queued).toBe(4);
    const ids = (out: string) => JSON.parse(out.split("\n").find((x) => x.startsWith("[")) ?? "[]") as string[];
    const first = sqlAsync(`begin;
      select coalesce(json_agg(id), '[]') from claim_reminders(2);
      select pg_sleep(1.5);
      commit;`);
    await new Promise((r) => setTimeout(r, 400));
    const started = Date.now();
    const second = await sqlAsync(`select coalesce(json_agg(id), '[]') from claim_reminders(10);`);
    const quick = Date.now() - started;
    const [a, b] = [ids(await first), ids(second)];
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(new Set([...a, ...b]).size).toBe(4);
    expect(quick).toBeLessThan(1200); // saltó las filas tomadas, no esperó
    expect(await h.service.claimReminders(10)).toEqual([]);
    expect(sql("select string_agg(distinct status, ',') from subscription_reminders")).toBe("sending");
  });
});

describe("reloj de pruebas", () => {
  it("sin el secreto bnbtico_test_clock en Vault se rechaza; con él, solo mueve el fin de la oferta", async () => {
    const l = await h.seed({ status: "active" });
    expect(sql("select count(*) from vault.secrets where name = 'bnbtico_test_clock'")).toBe("0");
    expect(() => sql(`select test_set_offer_days_left('${l.publicId}', 3)`)).toThrow(/El reloj de pruebas no está habilitado/);
    const out = inTransaction(`
      select vault.create_secret('on', 'bnbtico_test_clock') is not null;
      select test_set_offer_days_left('${l.publicId}', 3);
      select status from listings where id = '${uuid(l.id)}';`);
    expect(out.split("\n").slice(-2)).toEqual([costaRicaToday(Date.now() + 3 * 86_400_000), "active"]);
    const wrong = () => inTransaction(`select vault.create_secret('off', 'bnbtico_test_clock') is not null; select test_set_offer_days_left('${l.publicId}', 3);`);
    expect(wrong).toThrow(/El reloj de pruebas no está habilitado/);
  });
});

describe("purga de la ficha en cada cambio de estado", () => {
  const asOwner = () => claimsOf(h.ownerId("owner"));

  it("parar y reactivar, el fin de la oferta y el método de pago encolan una purga cada uno", async () => {
    const a = await h.seed({ status: "active" });
    const stop = inTransaction(`${withPurgeSecrets}${asOwner()} select stop_subscription('${uuid(a.id)}'); ${purgesOf(a.publicId)}`);
    expect(lastLine(stop)).toBe("1");

    await h.billing("owner").stop(a.id);
    const resume = inTransaction(`${withPurgeSecrets}${asOwner()} select resume_subscription('${uuid(a.id)}'); ${purgesOf(a.publicId)}`);
    expect(lastLine(resume)).toBe("1");
    await h.billing("owner").resume(a.id);

    await h.setDaysLeft(a.id, -1);
    const expire = inTransaction(`${withPurgeSecrets} select run_subscription_day('${today()}') is not null; ${purgesOf(a.publicId)}`);
    expect(lastLine(expire)).toBe("1");

    await h.service.runDay(today());
    const payStop = inTransaction(`${withPurgeSecrets}${asOwner()} select stop_subscription('${uuid(a.id)}'); ${purgesOf(a.publicId)}`);
    expect(lastLine(payStop)).toBe("1");
    const card = inTransaction(`${withPurgeSecrets}
      select apply_payment_event('fake', 'evt-purga', 'setup_completed', '${uuid(h.ownerId("owner"))}', 'cus', 'pm', 'visa', '4242', 12, 2029);
      ${purgesOf(a.publicId)}`);
    expect(lastLine(card)).toBe("1");
  });

  it("pasar al plan de pago sin cambiar de estado no purga", async () => {
    const a = await h.seed({ status: "active" });
    await h.service.applyPaymentEvent({ provider: "fake", eventId: `evt_${Date.now()}`, type: "setup_completed", ownerId: h.ownerId("owner"), customerRef: "c", methodRef: "m", brand: "visa", last4: "4242", expMonth: 1, expYear: 2030 });
    await h.setDaysLeft(a.id, -1);
    const out = inTransaction(`${withPurgeSecrets} select run_subscription_day('${today()}')->>'paid'; ${purgesOf(a.publicId)}`);
    expect(out.split("\n").slice(-2)).toEqual(["1", "0"]);
  });
});

describe("relleno de la migración sobre casas que ya existen", () => {
  it("las casas publicadas alguna vez toman plaza por first_published_at, con el día de Costa Rica, sin tocar listings", async () => {
    const migration = readFileSync(new URL("../../../../supabase/migrations/20261027202238_fase5_suscripcion.sql", import.meta.url), "utf8");
    const backfill = migration.slice(migration.indexOf("-- ---------- 3. Relleno"), migration.indexOf("-- ---------- 4. Funciones"));
    expect(backfill).toContain("insert into public.subscriptions");
    const jan = await h.seed({ status: "active" });
    const night = await h.seed({ status: "active" });
    const editing = await h.seed({ status: "reopened" });
    const never = await h.seed({ status: "review" });
    const out = inTransaction(`
      select set_config('app.allow_status', 'on', true);
      delete from subscriptions;
      update listings set first_published_at = '2026-01-31 15:00Z' where id = '${uuid(jan.id)}';
      update listings set first_published_at = '2026-03-01 03:00Z' where id = '${uuid(night.id)}';
      update listings set first_published_at = '2026-05-10 12:00Z' where id = '${uuid(editing.id)}';
      select set_config('app.allow_status', 'off', true);
      create temp table before_listings on commit drop as select id, status, updated_at from listings;
      ${backfill}
      select coalesce(json_agg(json_build_object('id', s.listing_id, 'slot', s.promo_slot, 'months', s.promo_months, 'ends', s.promo_ends_on, 'plan', s.plan) order by s.promo_slot), '[]') from subscriptions s;
      select count(*) from listings l join before_listings b using (id) where l.status is distinct from b.status or l.updated_at is distinct from b.updated_at;`);
    const lines = out.split("\n");
    expect(lastLine(out)).toBe("0");
    expect(JSON.parse(lines.at(-2)!)).toEqual([
      { id: jan.id, slot: 1, months: 12, ends: "2027-01-31", plan: "promo" },
      { id: night.id, slot: 2, months: 12, ends: "2027-02-28", plan: "promo" },
      { id: editing.id, slot: 3, months: 12, ends: "2027-05-10", plan: "promo" },
    ]);
    expect(lines.at(-2)).not.toContain(never.id);
  });
});

describe("mensajes", () => {
  it("las RPCs usan exactamente los textos de SUBSCRIPTION_MESSAGES", () => {
    const migration = readFileSync(new URL("../../../../supabase/migrations/20261027202238_fase5_suscripcion.sql", import.meta.url), "utf8");
    for (const key of ["notFound", "inactiveAccount", "stop", "resume", "session", "testClockOff"] as const) {
      expect(migration, key).toContain(`'${M[key]}'`);
    }
  });
});
