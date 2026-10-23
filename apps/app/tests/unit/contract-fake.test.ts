import { publicReadsContract } from "../contract/public-reads.contract";
import { fakeHarness } from "./fake-harness";

publicReadsContract("fake en memoria", async () => fakeHarness());
