import { publicReadsContract } from "../contract/public-reads.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
publicReadsContract("PostgREST (Supabase local)", () => (harness ??= postgrestHarness()));
