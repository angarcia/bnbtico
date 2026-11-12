import { adminEditaContract } from "../contract/admin-edita.contract";
import { fakeHarness } from "./fake-harness";

adminEditaContract("fake en memoria", async () => fakeHarness());
