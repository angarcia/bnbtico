import { editContract } from "../contract/edit.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
editContract("PostgREST (Supabase local)", () => (harness ??= postgrestHarness()));
