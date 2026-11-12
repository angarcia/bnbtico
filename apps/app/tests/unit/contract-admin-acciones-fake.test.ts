import { adminAccionesContract } from "../contract/admin-acciones.contract";
import { fakeHarness } from "./fake-harness";

adminAccionesContract("fake en memoria", async () => fakeHarness());
