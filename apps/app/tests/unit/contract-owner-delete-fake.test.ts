import { ownerDeleteContract } from "../contract/owner-delete.contract";
import { fakeHarness } from "./fake-harness";

ownerDeleteContract("fake en memoria", async () => fakeHarness());
