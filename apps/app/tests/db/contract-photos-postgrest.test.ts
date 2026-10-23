import { photosContract } from "../contract/photos.contract";
import { postgrestHarness } from "./postgrest-harness";

let harness: ReturnType<typeof postgrestHarness> | null = null;
photosContract("PostgREST (Supabase local)", () => (harness ??= postgrestHarness()));
