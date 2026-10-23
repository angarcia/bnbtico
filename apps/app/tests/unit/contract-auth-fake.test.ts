import { authContract } from "../contract/auth.contract";
import { fakeAuthHarness } from "./fake-auth-harness";

authContract("fake en memoria", async () => fakeAuthHarness());
