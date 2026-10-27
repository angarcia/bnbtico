import { reminderSendContract } from "../contract/reminders-send.contract";
import { fakeHarness } from "./fake-harness";

reminderSendContract("fake en memoria", async () => fakeHarness());
