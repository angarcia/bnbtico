import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRIVATE_KEYS } from "../../src/client/account";
import { forgetOwnListings, ownListingsHint, rememberOwnListings } from "../../src/shared/own-listings";

const g = globalThis as { window?: unknown; localStorage?: unknown };
const before = { window: g.window, localStorage: g.localStorage };

beforeAll(() => {
  const data = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  g.window = globalThis;
});

afterAll(() => {
  g.window = before.window;
  g.localStorage = before.localStorage;
});

describe("pista de las casas propias en el teléfono", () => {
  it("cuenta los CT-#### guardados y 0 sin nada", () => {
    expect(ownListingsHint()).toBe(0);
    rememberOwnListings(["CT-1001", "CT-1002"]);
    expect(ownListingsHint()).toBe(2);
    rememberOwnListings([]);
    expect(ownListingsHint()).toBe(0);
    rememberOwnListings(["CT-1001"]);
    forgetOwnListings();
    expect(ownListingsHint()).toBe(0);
  });

  it("own-activity es privada", () => expect(PRIVATE_KEYS.has("own-activity")).toBe(true));
});
