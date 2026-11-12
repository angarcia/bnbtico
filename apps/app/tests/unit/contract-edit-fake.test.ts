import { editContract } from "../contract/edit.contract";
import { fakeHarness } from "./fake-harness";

editContract("fake en memoria", async () => fakeHarness());
