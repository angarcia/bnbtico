import { adminAccionesContract } from "../contract/admin-acciones.contract";
import { postgrestHarness } from "./postgrest-harness";

adminAccionesContract("PostgREST (Supabase local)", postgrestHarness);
