import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { airbnbContract } from "../contract/airbnb.contract";
import { localSupabase } from "./local";
import { postgrestHarness } from "./postgrest-harness";

airbnbContract("PostgREST (Supabase local)", async () => ({
  h: await postgrestHarness(),
  service: createAirbnbService({ ...localSupabase(), supabaseUrl: localSupabase().url, fetch: (i, init) => fetch(i, init) }),
}));
