import { adminHousesContract } from "../contract/admin-houses.contract";
import { fakeHarness } from "./fake-harness";

adminHousesContract("fake en memoria", async () => fakeHarness());
