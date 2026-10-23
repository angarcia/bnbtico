import { photosContract } from "../contract/photos.contract";
import { fakeHarness } from "./fake-harness";

photosContract("fake en memoria", async () => fakeHarness());
