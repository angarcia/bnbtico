import { adminContract } from "../contract/admin.contract";
import { fakeHarness } from "./fake-harness";

adminContract("fake en memoria", async () => fakeHarness());
