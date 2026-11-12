// Escritor de la telemetría del worker: PostgREST con la service role, con fetch a secas (sin supabase-js: el worker no
// necesita sesión y así no carga el cliente para cada baliza). Las tablas no tienen privilegios para anon ni authenticated.
import { BEACON_TABLE, type BeaconRow, type BeaconTable } from "../../domain/telemetry";

export interface PostgrestTelemetry {
  insert(table: BeaconTable, row: BeaconRow & { country: string | null }): Promise<void>;
  /** Borra en las tres tablas lo anterior a `before` (ISO) y devuelve cuántas filas. */
  prune(before: string): Promise<number>;
}

export function createTelemetryWriter(supabaseUrl: string, serviceKey: string, fetcher: typeof fetch): PostgrestTelemetry {
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const endpoint = (table: BeaconTable) => `${supabaseUrl}/rest/v1/${table}`;

  return {
    async insert(table, row) {
      const res = await fetcher(endpoint(table), { method: "POST", headers: { ...headers, prefer: "return=minimal" }, body: JSON.stringify(row) });
      if (!res.ok) throw new Error(`PostgREST ${res.status} en ${table}: ${(await res.text()).slice(0, 300)}`);
    },
    async prune(before) {
      let removed = 0;
      for (const table of Object.values(BEACON_TABLE)) {
        const res = await fetcher(`${endpoint(table)}?created_at=lt.${encodeURIComponent(before)}`, {
          method: "DELETE",
          headers: { ...headers, prefer: "return=minimal, count=exact" },
        });
        if (!res.ok) throw new Error(`PostgREST ${res.status} al recortar ${table}`);
        removed += Number(res.headers.get("content-range")?.split("/")[1] ?? 0) || 0;
      }
      return removed;
    },
  };
}
