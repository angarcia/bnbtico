import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { airbnbLimiteContract } from "../contract/airbnb-limite.contract";
import { localSupabase } from "./local";
import { postgrestHarness } from "./postgrest-harness";

airbnbLimiteContract("PostgREST local", async () => {
  const h = await postgrestHarness();
  const local = localSupabase();
  return { h, service: createAirbnbService({ supabaseUrl: local.url, ...local, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) }) };
});
