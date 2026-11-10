import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { reservationAvailabilityContract } from "../contract/reservation-availability.contract";
import { fakeHarness } from "./fake-harness";

reservationAvailabilityContract("fake en memoria", async () => {
  const h = fakeHarness();
  return { h, service: createFakeAirbnbService(h.db) };
});
