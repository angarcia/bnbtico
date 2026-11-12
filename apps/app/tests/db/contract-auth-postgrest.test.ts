import { authContract } from "../contract/auth.contract";
import { postgrestAuthHarness } from "./postgrest-auth-harness";

authContract("Supabase local", postgrestAuthHarness);
