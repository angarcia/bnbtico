// Tipo de cambio diario (ticket 21): la tabla fx_rates la lee cualquiera y solo la escribe la service role (el cron del
// worker); contrato de la lectura contra PostgREST local, escribiendo con el mismo escritor del worker.
import { describe, expect, it } from "vitest";
import { createAnonListings } from "../../src/data/postgrest/client";
import { createFxWriter } from "../../src/data/postgrest/fx";
import { fxContract } from "../contract/fx.contract";
import { anonClient, localSupabase, serviceClient, signIn, sql } from "./local";

const resetRates = async () => void sql("delete from public.fx_rates where source <> 'constante'");

fxContract("PostgREST (Supabase local)", async () => {
  const { url, anonKey, serviceKey } = localSupabase();
  const writer = createFxWriter(url, serviceKey, (i, init) => fetch(i, init));
  return { anon: createAnonListings(url, anonKey), putRate: (r) => writer.save(r), resetRates };
});

describe("fx_rates · permisos", () => {
  it("anon y authenticated solo leen", () => {
    for (const role of ["anon", "authenticated"]) {
      expect(sql(`select has_table_privilege('${role}', 'public.fx_rates', 'select')`)).toBe("t");
      for (const priv of ["insert", "update", "delete", "truncate"]) {
        expect(sql(`select has_table_privilege('${role}', 'public.fx_rates', '${priv}')`), `${role} ${priv}`).toBe("f");
      }
    }
  });

  it("anon lee por PostgREST y no puede escribir", async () => {
    const db = anonClient();
    const sel = await db.from("fx_rates").select("day, crc_per_usd, source").eq("source", "constante").single();
    expect(sel.data).toEqual({ day: "2026-10-26", crc_per_usd: 510, source: "constante" });
    const ins = await db.from("fx_rates").insert({ day: "2030-01-01", crc_per_usd: 1, source: "fawazahmed0" });
    expect(ins.error?.code).toBe("42501");
  });

  it("un usuario con sesión tampoco escribe", async () => {
    const db = await signIn("other");
    const upd = await db.from("fx_rates").update({ crc_per_usd: 1 }).eq("source", "constante");
    expect(upd.error?.code).toBe("42501");
  });

  it("la base rechaza un tipo fuera de 300–900 o una fuente desconocida, aunque venga de la service role", async () => {
    const db = serviceClient();
    expect((await db.from("fx_rates").insert({ day: "2030-01-01", crc_per_usd: 1200, source: "fawazahmed0" })).error?.code).toBe("23514");
    expect((await db.from("fx_rates").insert({ day: "2030-01-01", crc_per_usd: 455, source: "bccr" })).error?.code).toBe("23514");
    await resetRates();
  });
});
