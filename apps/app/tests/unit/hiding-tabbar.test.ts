import { describe, expect, it } from "vitest";
import { tabBarAway } from "../../src/client/hiding-tabbar";

describe("tabBarAway", () => {
  it("esconde al bajar, muestra al subir y arriba del todo", () => {
    expect(tabBarAway(200, 100)).toBe(true);
    expect(tabBarAway(100, 200)).toBe(false);
    expect(tabBarAway(0, 50)).toBe(false);
  });
  it("no cambia con un movimiento menor al umbral", () => {
    expect(tabBarAway(104, 100)).toBeNull();
    expect(tabBarAway(96, 100)).toBeNull();
  });
});
