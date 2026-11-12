import { describe, expect, it } from "vitest";
import { discardRefusal } from "../../src/domain/can";
import { launchOffer } from "../../src/domain/offer";

describe("oferta de lanzamiento", () => {
  it("primeras 50 casas: 12 meses; quedan las que faltan del tramo", () => {
    expect(launchOffer(0)).toEqual({ months: 12, size: 50, taken: 0, remaining: 50 });
    expect(launchOffer(13)).toEqual({ months: 12, size: 50, taken: 13, remaining: 37 });
    expect(launchOffer(49)).toMatchObject({ months: 12, remaining: 1 });
  });

  it("siguientes 50: seis meses; siguientes 100: tres meses", () => {
    expect(launchOffer(50)).toEqual({ months: 6, size: 50, taken: 0, remaining: 50 });
    expect(launchOffer(99)).toMatchObject({ months: 6, remaining: 1 });
    expect(launchOffer(100)).toEqual({ months: 3, size: 100, taken: 0, remaining: 100 });
    expect(launchOffer(150)).toMatchObject({ months: 3, taken: 50, remaining: 50 });
  });

  it("después de 200 casas ya no hay oferta", () => {
    expect(launchOffer(200)).toBeNull();
    expect(launchOffer(500)).toBeNull();
  });

  it("un recuento raro (negativo o con decimales) no rompe nada", () => {
    expect(launchOffer(-3)).toMatchObject({ months: 12, remaining: 50 });
    expect(launchOffer(12.7)).toMatchObject({ months: 12, remaining: 38 });
  });
});

describe("descartar un borrador", () => {
  it("solo un borrador que nunca se revisó; si no, dice por qué", () => {
    expect(discardRefusal({ status: "draft", reviewedAt: null })).toBeNull();
    expect(discardRefusal({ status: "draft", reviewedAt: "2026-10-01T00:00:00Z" })).toMatch(/ya estuvo publicada/);
    for (const status of ["review", "active", "changes", "rejected", "payment_due", "inactive"] as const) {
      expect(discardRefusal({ status, reviewedAt: null })).toBe("Solo se pueden descartar borradores sin enviar.");
    }
    expect(discardRefusal(null)).toBe("No encontramos ese anuncio.");
  });
});
