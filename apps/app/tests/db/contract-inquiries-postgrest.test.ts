import { favoritesContract } from "../contract/favorites.contract";
import { inquiriesContract } from "../contract/inquiries.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
const shared = () => (harness ??= postgrestHarness());
inquiriesContract("PostgREST (Supabase local)", shared);
favoritesContract("PostgREST (Supabase local)", shared);
