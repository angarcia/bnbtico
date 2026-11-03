import { describe, expect, it } from "vitest";
import { HISTOGRAM_BUCKETS, bucketInRange, limitsToSlider, priceBounds, priceHistogram, sliderToLimits } from "../../src/domain/price-slider";

describe("priceBounds · topes del deslizador", () => {
  it("sin precios (o ninguno válido) no hay deslizador", () => {
    expect(priceBounds([])).toBeNull();
    expect(priceBounds([null, 0, -5])).toBeNull();
  });
  it("del más bajo al más alto, redondeados al paso hacia fuera", () => {
    const b = priceBounds([22_300, 45_000, 149_100])!;
    expect(b.step).toBe(5_000);
    expect(b.lo).toBe(20_000);
    expect(b.hi).toBe(150_000);
  });
  it("el paso es 1, 2 o 5 por una potencia de 10 y nunca baja de ₡1 000", () => {
    expect(priceBounds([30_000, 31_000])!.step).toBe(1_000);
    expect(priceBounds([10_000, 1_010_000])!.step).toBe(50_000);
  });
  it("un único precio (o todos iguales) deja un rango de un paso", () => {
    const b = priceBounds([40_000, 40_000])!;
    expect(b.lo).toBe(40_000);
    expect(b.hi).toBe(41_000);
  });
  it("un precio que ya es múltiplo del paso queda dentro de los topes", () => {
    const b = priceBounds([20_000, 150_000])!;
    expect(b.lo).toBeLessThanOrEqual(20_000);
    expect(b.hi).toBeGreaterThanOrEqual(150_000);
  });
});

describe("priceHistogram · cubetas", () => {
  const bounds = { lo: 0, hi: 100_000, step: 1_000 };
  it("reparte los precios en cubetas iguales entre los topes; el tope de arriba cae en la última", () => {
    const h = priceHistogram([0, 1_000, 99_999, 100_000, 50_000], bounds, 10);
    expect(h).toHaveLength(10);
    expect(h[0]).toBe(2);
    expect(h[5]).toBe(1);
    expect(h[9]).toBe(2);
    expect(h.reduce((a, b) => a + b, 0)).toBe(5);
  });
  it("ignora nulos y precios fuera de los topes", () => {
    expect(priceHistogram([null, -1, 200_000], bounds, 10).every((n) => n === 0)).toBe(true);
  });
  it("por defecto usa HISTOGRAM_BUCKETS cubetas", () => {
    expect(priceHistogram([1], bounds)).toHaveLength(HISTOGRAM_BUCKETS);
  });
});

describe("bucketInRange · barra dentro o fuera del rango", () => {
  const bounds = { lo: 0, hi: 100_000, step: 1_000 };
  it("la cubeta cuenta si cualquier parte suya cae en el rango elegido", () => {
    // 10 cubetas de ₡10 000: el rango 25 000–45 000 toca las cubetas 2, 3 y 4.
    const inside = Array.from({ length: 10 }, (_, i) => bucketInRange(i, bounds, 10, 25_000, 45_000));
    expect(inside).toEqual([false, false, true, true, true, false, false, false, false, false]);
  });
  it("todo el rango (de tope a tope) las pinta todas", () => {
    expect(Array.from({ length: 10 }, (_, i) => bucketInRange(i, bounds, 10, 0, 100_000)).every(Boolean)).toBe(true);
  });
});

describe("sliderToLimits / limitsToSlider · URL y deslizador", () => {
  const bounds = { lo: 20_000, hi: 150_000, step: 5_000 };
  it("el tope de abajo es «sin mínimo» y el de arriba «sin máximo» (0 = sin límite, como la URL)", () => {
    expect(sliderToLimits(20_000, 150_000, bounds)).toEqual({ min: 0, max: 0 });
    expect(sliderToLimits(35_000, 150_000, bounds)).toEqual({ min: 35_000, max: 0 });
    expect(sliderToLimits(20_000, 90_000, bounds)).toEqual({ min: 0, max: 90_000 });
  });
  it("sin límites el deslizador va de tope a tope", () => {
    expect(limitsToSlider(0, 0, bounds)).toEqual([20_000, 150_000]);
  });
  it("los límites de la URL fuera de los topes se acercan a ellos, sin cruzarse", () => {
    expect(limitsToSlider(5_000, 900_000, bounds)).toEqual([20_000, 150_000]);
    expect(limitsToSlider(60_000, 0, bounds)).toEqual([60_000, 150_000]);
    expect(limitsToSlider(140_000, 30_000, bounds)).toEqual([30_000, 30_000]);
  });
});
