// El TOTP de las pruebas y el del fake, contra los vectores del RFC 6238 (SHA-1, secreto «12345678901234567890»).
import { describe, expect, it } from "vitest";
import { totpAt } from "../../src/data/fake/totp";
import { totp } from "../contract/totp";

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1234567890, "005924"],
  [2000000000, "279037"],
];

describe("TOTP (RFC 6238)", () => {
  it.each(VECTORS)("a los %i s da %s", async (seconds, code) => {
    expect(totp(SECRET, seconds * 1000)).toBe(code);
    expect(await totpAt(SECRET, seconds * 1000)).toBe(code);
  });
});
