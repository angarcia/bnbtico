import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { createFakeIcalExportService } from "../../src/data/fake/ical-export";
import { airbnbManagementContract } from "../contract/airbnb-management.contract";
import { fakeHarness } from "./fake-harness";

airbnbManagementContract("fake en memoria", async () => {
  const h = fakeHarness();
  return { h, service: createFakeAirbnbService(h.db), exports: createFakeIcalExportService(h.db) };
});
