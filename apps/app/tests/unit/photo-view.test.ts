import { describe, expect, it } from "vitest";
import { FICHA_PHOTO, fichaBand } from "../../src/domain/photo-view";

// La franja «Lo que se ve en la ficha» del editor de fotos de escritorio (historia 06): la ficha pinta cada foto en una caja
// de 832 × 480 con object-fit: cover centrado, así que de una foto se ve una franja centrada con esa proporción.
describe("la franja de la ficha", () => {
  const R = FICHA_PHOTO.width / FICHA_PHOTO.height;

  it("una vertical se ve entera de ancho y solo por el centro de alto", () => {
    const band = fichaBand(2 / 3);
    if (!band) throw new Error("sin franja");
    expect(band.left).toBe(0);
    expect(band.width).toBe(1);
    expect(band.height).toBeCloseTo(2 / 3 / R, 6);
    expect(band.top).toBeCloseTo((1 - band.height) / 2, 6);
  });

  it("una más ancha que la ficha (16:9) se ve entera de alto y recortada por los lados", () => {
    const band = fichaBand(16 / 9);
    if (!band) throw new Error("sin franja");
    expect(band.top).toBe(0);
    expect(band.height).toBe(1);
    expect(band.width).toBeCloseTo(R / (16 / 9), 6);
    expect(band.left).toBeCloseTo((1 - band.width) / 2, 6);
  });

  it("con la proporción de la ficha se ve entera", () => {
    expect(fichaBand(R)).toEqual({ left: 0, top: 0, width: 1, height: 1 });
  });

  it("una proporción imposible no pinta franja", () => {
    expect(fichaBand(0)).toBeNull();
    expect(fichaBand(Number.NaN)).toBeNull();
    expect(fichaBand(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
