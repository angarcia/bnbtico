import { describe, expect, it } from "vitest";
import { gaId } from "@/lib/analytics";

describe("identificador de Google Analytics", () => {
  it("sin variable usa el de bnbtico", () => {
    expect(gaId({})).toBe("G-PZ17LLFS6S");
  });
  it("acepta otro identificador válido", () => {
    expect(gaId({ NEXT_PUBLIC_GA_ID: "G-ABC123" })).toBe("G-ABC123");
  });
  it("cualquier otro valor lo desactiva (Vercel no admite variables vacías)", () => {
    expect(gaId({ NEXT_PUBLIC_GA_ID: "off" })).toBeNull();
    expect(gaId({ NEXT_PUBLIC_GA_ID: "" })).toBeNull();
    expect(gaId({ NEXT_PUBLIC_GA_ID: "0" })).toBeNull();
  });
});
