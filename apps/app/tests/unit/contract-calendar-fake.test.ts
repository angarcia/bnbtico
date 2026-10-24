import { calendarContract } from "../contract/calendar.contract";
import { fakeHarness } from "./fake-harness";

calendarContract("fake en memoria", async () => fakeHarness());
