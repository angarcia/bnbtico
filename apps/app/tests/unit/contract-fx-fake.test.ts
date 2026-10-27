import { FakeDb } from "../../src/data/fake/db";
import { createFakeListings } from "../../src/data/fake/listings";
import { fxContract } from "../contract/fx.contract";
import { FAKE_SUPABASE_URL } from "./fake-harness";

fxContract("fake en memoria", async () => {
  const db = new FakeDb();
  return {
    anon: createFakeListings(db, { supabaseUrl: FAKE_SUPABASE_URL }),
    async putRate(rate) {
      db.putFxRate(rate);
    },
    async resetRates() {
      db.resetFxRates();
    },
  };
});
