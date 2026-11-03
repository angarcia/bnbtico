import { adminEditaContract } from "../contract/admin-edita.contract";
import { postgrestHarness } from "./postgrest-harness";

adminEditaContract("PostgREST (Supabase local)", postgrestHarness);
