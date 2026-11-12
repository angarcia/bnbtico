import { reminderSendContract } from "../contract/reminders-send.contract";
import { postgrestHarness } from "./postgrest-harness";

reminderSendContract("PostgREST (Supabase local)", postgrestHarness);
