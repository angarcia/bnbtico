import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { createIcalExportService } from "../../src/data/postgrest/ical-export";
import { airbnbManagementContract } from "../contract/airbnb-management.contract";
import { icalExportHarness } from "./ical-export-harness";
import { localSupabase } from "./local";

airbnbManagementContract("PostgREST local", async () => {
  const h = await icalExportHarness();
  const local = localSupabase();
  const cfg = { supabaseUrl: local.url, ...local, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };
  return { h, service: createAirbnbService(cfg), exports: createIcalExportService(cfg) };
});
