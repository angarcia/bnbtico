import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { createFakeIcalExportService } from "../../src/data/fake/ical-export";
import { icalExportContract } from "../contract/ical-export.contract";
import { fakeHarness } from "./fake-harness";

icalExportContract("fake en memoria", async () => {
  const h = fakeHarness();
  return { h, service: createFakeIcalExportService(h.db), imports: createFakeAirbnbService(h.db) };
});
