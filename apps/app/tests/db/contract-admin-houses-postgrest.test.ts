import { adminHousesContract } from "../contract/admin-houses.contract";
import { postgrestHarness } from "./postgrest-harness";

adminHousesContract("PostgREST (Supabase local)", postgrestHarness);
