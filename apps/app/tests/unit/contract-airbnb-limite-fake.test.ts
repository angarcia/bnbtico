import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { airbnbLimiteContract } from "../contract/airbnb-limite.contract";
import { fakeHarness } from "./fake-harness";

airbnbLimiteContract("fake en memoria", async () => {
  const h = fakeHarness();
  return { h, service: createFakeAirbnbService(h.db) };
});
