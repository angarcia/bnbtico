import { FakeDb } from "../../src/data/fake/db";
import { createFakeAuth, FAKE_OTP } from "../../src/data/fake/auth";
import { memoryStore, SESSION_STORAGE_KEY } from "../../src/data/storage";
import type { AuthHarness } from "../contract/harness";
import { totp } from "../contract/totp";

export function fakeAuthHarness(db = new FakeDb()): AuthHarness {
  let t = 1_700_000_000_000;
  const stores = { session: memoryStore(), pending: memoryStore(), now: () => t };
  return {
    auth: createFakeAuth(db, stores),
    restart: () => createFakeAuth(db, stores),
    async advance(ms) {
      t += ms;
    },
    code: FAKE_OTP,
    mfaCode: (secret) => totp(secret, t),
    async makeAdmin() {
      db.profileByPhone("+50688889999")!.isAdmin = true;
    },
    phone: "+50688889999",
    intlPhone: "+14155550100",
    async captureSession() {
      const token = stores.session.getItem(SESSION_STORAGE_KEY);
      return async () => !!token && db.authSessions.has(token);
    },
  };
}
