// Migración reabrir_casas_cerradas (ronda de Ana 2026-11-02, ticket 04): «Cerrar la casa hasta…» sale de la app y las casas
// que estuvieran cerradas se abren, con sus noches y precios intactos. La RPC set_listing_available y el trabajo
// bnbtico-reabrir-casas siguen en la base (se retiran más adelante), y «Marcar una reserva» guarda con save_listing_days.
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reservationDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { SubscriptionHarness } from "../contract/harness";
import { serviceClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const MIGRATION = new URL("../../../../supabase/migrations/20261102234920_reabrir_casas_cerradas.sql", import.meta.url);
const day = (offset: number) => costaRicaToday(Date.now() + offset * 86_400_000);
const stateOf = async (id: string) => (await serviceClient().from("listings").select("status, available, reopen_at").eq("id", id).single()).data;

describe("migración reabrir_casas_cerradas", () => {
  let h: SubscriptionHarness;
  beforeAll(async () => {
    h = await postgrestHarness();
  }, 90_000);
  beforeEach(() => h.reset());

  it("abre las casas cerradas (con o sin fecha, también una parada) sin tocar su estado, sus días ni sus precios", async () => {
    const withDate = await h.seed({ status: "active" });
    const noDate = await h.seed({ status: "active" });
    const stopped = await h.seed({ status: "active" });
    const open = await h.seed({ status: "active" });
    await h.calendar("owner").save(withDate.id, { days: [day(5)], available: false, priceCrc: 66_000 });
    await h.setClosed(withDate.id, true, day(20));
    await h.setClosed(noDate.id, true);
    await h.setClosed(stopped.id, true, day(3));
    await h.billing("owner").stop(stopped.id);
    expect((await stateOf(withDate.id))?.available).toBe(false);

    sql(`begin;\n${readFileSync(MIGRATION, "utf8")}\ncommit;`);

    expect(await stateOf(withDate.id)).toMatchObject({ status: "active", available: true, reopen_at: null });
    expect(await stateOf(noDate.id)).toMatchObject({ status: "active", available: true, reopen_at: null });
    expect(await stateOf(stopped.id)).toMatchObject({ status: "inactive", available: true, reopen_at: null });
    expect(await stateOf(open.id)).toMatchObject({ status: "active", available: true, reopen_at: null });
    expect(await h.calendar("owner").days(withDate.id)).toEqual([{ day: day(5), available: false, specialPriceCrc: 66_000 }]);
  });

  it("la RPC y el trabajo nocturno siguen en la base (se retiran más adelante)", () => {
    expect(sql("select count(*) from pg_proc where proname = 'set_listing_available'")).not.toBe("0");
    expect(sql("select count(*) from cron.job where jobname = 'bnbtico-reabrir-casas'")).toBe("1");
  });

  it("«Marcar una reserva» guarda las noches de llegada a salida − 1 como ocupadas con save_listing_days, sin tocar precios", async () => {
    const l = await h.seed({ status: "active" });
    const me = h.calendar("owner");
    await me.save(l.id, { days: [day(11)], priceCrc: 77_000 });
    await me.save(l.id, { days: reservationDays(day(10), day(13)), available: false });
    expect(await me.days(l.id)).toEqual([
      { day: day(10), available: false, specialPriceCrc: null },
      { day: day(11), available: false, specialPriceCrc: 77_000 },
      { day: day(12), available: false, specialPriceCrc: null },
    ]);
  });
});
