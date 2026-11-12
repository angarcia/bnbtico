import { ownerListingsContract } from "../contract/owner-listings.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
ownerListingsContract("PostgREST (Supabase local)", () => (harness ??= postgrestHarness()));
