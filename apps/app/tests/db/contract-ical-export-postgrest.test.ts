import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { createIcalExportService } from "../../src/data/postgrest/ical-export";
import { icalExportContract } from "../contract/ical-export.contract";
import { localSupabase } from "./local";
import { icalExportHarness } from "./ical-export-harness";

icalExportContract("PostgREST (Supabase local)", async () => {
  const local = localSupabase();
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(local.url).hostname)) throw new Error("Esta suite requiere Supabase local.");
  const cfg = { supabaseUrl: local.url, anonKey: local.anonKey, serviceKey: local.serviceKey, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };
  return { h: await icalExportHarness(), service: createIcalExportService(cfg), imports: createAirbnbService(cfg) };
});
