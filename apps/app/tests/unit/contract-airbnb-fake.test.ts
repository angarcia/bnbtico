import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { airbnbContract } from "../contract/airbnb.contract";
import { fakeHarness } from "./fake-harness";

airbnbContract("fake en memoria", async () => {
  const h = fakeHarness();
  return { h, service: createFakeAirbnbService(h.db) };
});
