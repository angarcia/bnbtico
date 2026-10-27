import { describe, expect, it } from "vitest";
import { barRole, effectiveRole } from "../../src/client/role";

// Regla única del modo (B12c): la barra y Cuenta dicen lo mismo en todas las pantallas.
describe("effectiveRole", () => {
  it("sin sesión, siempre cliente", () => {
    for (const stored of ["guest", "owner", "admin"] as const) expect(effectiveRole(stored, { status: "signed-out", aal: null })).toBe("guest");
  });
  it("propietario y cliente, tal como se guardaron", () => {
    expect(effectiveRole("owner", { status: "signed-in", aal: "aal1" })).toBe("owner");
    expect(effectiveRole("guest", { status: "signed-in", aal: "aal2" })).toBe("guest");
  });
  it("admin solo con el segundo código (aal2); con aal1 vuelve a cliente", () => {
    expect(effectiveRole("admin", { status: "signed-in", aal: "aal2" })).toBe("admin");
    expect(effectiveRole("admin", { status: "signed-in", aal: "aal1" })).toBe("guest");
  });
  it("mientras se lee la sesión guardada, el modo guardado (sin saltos de barra)", () => {
    expect(effectiveRole("admin", { status: "loading", aal: null })).toBe("admin");
    expect(effectiveRole("owner", { status: "loading", aal: null })).toBe("owner");
  });
});

describe("barRole", () => {
  it("las zonas mandan: /admin es del admin y /propietario del propietario", () => {
    expect(barRole("admin", "guest")).toBe("admin");
    expect(barRole("owner", "guest")).toBe("owner");
    expect(barRole("owner", "admin")).toBe("owner");
  });
  it("fuera de las zonas (Cuenta, Explorar, Favoritos), el modo", () => {
    expect(barRole(null, "admin")).toBe("admin");
    expect(barRole(null, "owner")).toBe("owner");
    expect(barRole(null, "guest")).toBe("guest");
  });
});
