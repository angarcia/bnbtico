import { subscriptionContract } from "../contract/subscription.contract";
import { postgrestHarness } from "./postgrest-harness";

subscriptionContract("PostgREST (Supabase local)", postgrestHarness);
