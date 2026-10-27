// Escritor del tipo de cambio del cron (ticket 21): PostgREST con la service role y fetch a secas, como la telemetría
// (sin supabase-js en el cron). Un tipo por día: si el cron corre dos veces, el segundo pisa al primero.
import type { FxRate } from "../../domain/fx";

export interface PostgrestFxWriter {
  save(rate: FxRate): Promise<void>;
}

export function createFxWriter(supabaseUrl: string, serviceKey: string, fetcher: typeof fetch): PostgrestFxWriter {
  return {
    async save(rate) {
      const res = await fetcher(`${supabaseUrl}/rest/v1/fx_rates?on_conflict=day`, {
        method: "POST",
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ day: rate.day, crc_per_usd: rate.crcPerUsd, source: rate.source }),
      });
      if (!res.ok) throw new Error(`PostgREST ${res.status} en fx_rates: ${(await res.text()).slice(0, 300)}`);
    },
  };
}
