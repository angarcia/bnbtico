import { describe, expect, it } from "vitest";
import { setupReturnUrls } from "../../src/domain/payments";
import { scopeBilling, scopeFix } from "../../src/domain/subscription-scope";

describe("setupReturnUrls", () => {
  it("con casa: ?pago=ok&casa= y el hash; cancelar sin pago=ok", () => {
    expect(setupReturnUrls("https://3bstays.com/", "CT-1042")).toEqual({
      successUrl: "https://3bstays.com/propietario/suscripcion?pago=ok&casa=CT-1042#pago=CT-1042",
      cancelUrl: "https://3bstays.com/propietario/suscripcion?casa=CT-1042#pago=CT-1042",
    });
  });
  it("sin casa: como hasta ahora", () => {
    expect(setupReturnUrls("https://3bstays.com", null)).toEqual({
      successUrl: "https://3bstays.com/propietario/suscripcion?pago=ok",
      cancelUrl: "https://3bstays.com/propietario/suscripcion",
    });
  });
});

const houses = [{ house: { publicId: "CT-1001" } }, { house: { publicId: "CT-1002" } }];

describe("scopeBilling", () => {
  it("una casa propia: la acota", () => {
    expect(scopeBilling(houses, "CT-1002")).toEqual({ scoped: houses[1], all: houses, unknown: false });
  });
  it("sin casa: todas", () => {
    expect(scopeBilling(houses, undefined)).toEqual({ scoped: null, all: houses, unknown: false });
  });
  it("casa ajena: desconocida", () => {
    expect(scopeBilling(houses, "CT-9999")).toEqual({ scoped: null, all: houses, unknown: true });
  });
  it("sin casas y con casa: desconocida", () => {
    expect(scopeBilling([], "CT-1001").unknown).toBe(true);
  });
});

describe("scopeFix", () => {
  it("nada que corregir", () => {
    expect(scopeFix({}, { unknown: false, settled: true })).toBeNull();
  });
  it("quita pago=ok", () => {
    expect(scopeFix({ pago: "ok" }, { unknown: false, settled: true })).toEqual({});
  });
  it("quita pago=ok y conserva la casa", () => {
    expect(scopeFix({ pago: "ok", casa: "CT-1001" }, { unknown: false, settled: true })).toEqual({ casa: "CT-1001" });
  });
  it("casa desconocida con datos asentados: la quita", () => {
    expect(scopeFix({ casa: "CT-9999" }, { unknown: true, settled: true })).toEqual({});
  });
  it("casa desconocida sin asentar: no la toca", () => {
    expect(scopeFix({ casa: "CT-9999" }, { unknown: true, settled: false })).toBeNull();
  });
  it("sin asentar quita pago=ok pero conserva la casa", () => {
    expect(scopeFix({ pago: "ok", casa: "CT-9999" }, { unknown: true, settled: false })).toEqual({ casa: "CT-9999" });
  });
});
