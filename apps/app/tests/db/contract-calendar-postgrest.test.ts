import { calendarContract } from "../contract/calendar.contract";
import { postgrestHarness } from "./postgrest-harness";

calendarContract("PostgREST (Supabase local)", postgrestHarness);
