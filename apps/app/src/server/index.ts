import { createAnonListings } from "../data/postgrest/client";
import { createApp, type CacheLike } from "./app";

export type { Env } from "./app";

export default createApp({
  listings: (env) => createAnonListings(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
  cache: () => (typeof caches === "undefined" ? null : ((caches as unknown as { default: CacheLike }).default ?? null)),
  purgeFetch: (input, init) => fetch(input, init),
});
