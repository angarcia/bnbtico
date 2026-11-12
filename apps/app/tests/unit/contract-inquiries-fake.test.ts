import { favoritesContract } from "../contract/favorites.contract";
import { inquiriesContract } from "../contract/inquiries.contract";
import { fakeHarness } from "./fake-harness";

inquiriesContract("fake en memoria", async () => fakeHarness());
favoritesContract("fake en memoria", async () => fakeHarness());
