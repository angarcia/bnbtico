import { ownerDeleteContract } from "../contract/owner-delete.contract";
import { postgrestHarness } from "./postgrest-harness";

ownerDeleteContract("PostgREST (Supabase local)", postgrestHarness);
