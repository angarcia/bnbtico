import { ownerListingsContract } from "../contract/owner-listings.contract";
import { fakeHarness } from "./fake-harness";

ownerListingsContract("fake en memoria", async () => fakeHarness());
