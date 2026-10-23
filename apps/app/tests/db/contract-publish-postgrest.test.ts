import { publishContract } from "../contract/publish.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
publishContract("PostgREST (Supabase local)", () => (harness ??= postgrestHarness()));
