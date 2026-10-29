import { describe, expect, it } from "vitest";
import { setupReturnUrls } from "../../src/domain/payments";

describe("setupReturnUrls", () => {
  it("con casa: ?pago=ok&casa= y el hash; cancelar sin pago=ok", () => {
    expect(setupReturnUrls("https://bnbtico.com/", "CT-1042")).toEqual({
      successUrl: "https://bnbtico.com/propietario/suscripcion?pago=ok&casa=CT-1042#pago=CT-1042",
      cancelUrl: "https://bnbtico.com/propietario/suscripcion?casa=CT-1042#pago=CT-1042",
    });
  });
  it("sin casa: como hasta ahora", () => {
    expect(setupReturnUrls("https://bnbtico.com", null)).toEqual({
      successUrl: "https://bnbtico.com/propietario/suscripcion?pago=ok",
      cancelUrl: "https://bnbtico.com/propietario/suscripcion",
    });
  });
});
