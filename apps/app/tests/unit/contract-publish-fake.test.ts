import { publishContract } from "../contract/publish.contract";
import { fakeHarness } from "./fake-harness";

publishContract("fake en memoria", async () => fakeHarness());
