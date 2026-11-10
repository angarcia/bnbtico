import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { reservationAvailabilityContract } from "../contract/reservation-availability.contract";
import { icalExportHarness } from "./ical-export-harness";
import { localSupabase } from "./local";

reservationAvailabilityContract("PostgREST local", async () => {
  const h = await icalExportHarness();
  const local = localSupabase();
  return { h, service: createAirbnbService({ ...local, supabaseUrl: local.url, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) }) };
});
