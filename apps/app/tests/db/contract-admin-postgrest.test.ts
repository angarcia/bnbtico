import { adminContract } from "../contract/admin.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
adminContract("PostgREST (Supabase local)", () => (harness ??= postgrestHarness()));
