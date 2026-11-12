import { describe, expect, it } from "vitest";
import { edgeSpeed, shiftBetween, slotAt, type Slot } from "../../src/client/publish/photo-drag";

const slots: Slot[] = [
  { left: 0, top: 0, width: 220, height: 224 },
  { left: 228, top: 0, width: 106, height: 108 },
  { left: 228, top: 116, width: 106, height: 108 },
  { left: 0, top: 232, width: 106, height: 108 },
  { left: 114, top: 232, width: 106, height: 108 },
  { left: 228, top: 232, width: 106, height: 108 },
];

describe("geometría de arrastrar fotos", () => {
  it("slotAt: dentro de una casilla", () => {
    expect(slotAt(slots, 110, 112, 4)).toBe(0);
    expect(slotAt(slots, 280, 170, 0)).toBe(2);
    expect(slotAt(slots, 150, 300, 0)).toBe(4);
  });
  it("slotAt: en un hueco o fuera de la rejilla, la última casilla mostrada", () => {
    expect(slotAt(slots, 224, 50, 3)).toBe(3);
    expect(slotAt(slots, 100, 900, 1)).toBe(1);
    expect(slotAt(slots, -40, 10, 5)).toBe(5);
  });
  it("shiftBetween", () => {
    expect(shiftBetween(slots[3]!, slots[4]!)).toEqual({ x: 114, y: 0, s: 1 });
    const toCover = shiftBetween(slots[4]!, slots[0]!);
    expect(toCover.x).toBe(-114);
    expect(toCover.y).toBe(-232);
    expect(toCover.s).toBeCloseTo(220 / 106, 5);
  });
  it("edgeSpeed", () => {
    expect(edgeSpeed(100, 100, 500)).toBe(-12);
    expect(edgeSpeed(124, 100, 500)).toBe(-6);
    expect(edgeSpeed(148, 100, 500)).toBe(0);
    expect(edgeSpeed(300, 100, 500)).toBe(0);
    expect(edgeSpeed(476, 100, 500)).toBe(6);
    expect(edgeSpeed(500, 100, 500)).toBe(12);
    expect(edgeSpeed(530, 100, 500)).toBe(12);
    expect(edgeSpeed(40, 100, 500)).toBe(-12);
  });
});
