import { subscriptionContract } from "../contract/subscription.contract";
import { fakeHarness } from "./fake-harness";

subscriptionContract("fake en memoria", async () => fakeHarness());
