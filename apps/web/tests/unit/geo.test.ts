import { describe, expect, it } from "vitest";
import { JITTER_METERS, approximate, distanceMeters, inCostaRica } from "@/lib/listings/geo";

describe("approximate", () => {
  const origin = { lat: 9.63, lng: -82.65 };
  it("es determinista y queda a menos de 500 m, nunca en el punto exacto", () => {
    const a = approximate(origin.lat, origin.lng, "CT-1001");
    const b = approximate(origin.lat, origin.lng, "CT-1001");
    expect(a).toEqual(b);
    const d = distanceMeters(origin, a);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThanOrEqual(JITTER_METERS);
  });
  it("seeds distintos dan puntos distintos", () => {
    expect(approximate(origin.lat, origin.lng, "CT-1001")).not.toEqual(approximate(origin.lat, origin.lng, "CT-1002"));
  });
});

describe("distanceMeters", () => {
  it("un grado de latitud son ~111 km", () => {
    expect(Math.round(distanceMeters({ lat: 9, lng: -84 }, { lat: 10, lng: -84 }) / 1000)).toBe(111);
  });
});

describe("inCostaRica", () => {
  it("acepta puntos del país y rechaza el resto", () => {
    expect(inCostaRica(9.98, -83.03)).toBe(true);
    expect(inCostaRica(10.63, -85.44)).toBe(true);
    expect(inCostaRica(0, 0)).toBe(false);
    expect(inCostaRica(40.4, -3.7)).toBe(false);
  });
});
