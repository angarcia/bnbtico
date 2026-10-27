import { describe, expect, it } from "vitest";
import { launchedFor, supportNumbersCheck } from "../../src/domain/support";

// Revisión UX A12: Ayuda es el único canal de atención; no puede abrirse la app sin sus números de WhatsApp.
describe("números de WhatsApp de atención en el build", () => {
  it("lanzada y sin alguno de los dos números: error (el build se detiene)", () => {
    expect(supportNumbersCheck({ launched: true, owners: "", guests: "+50660000000" })?.level).toBe("error");
    expect(supportNumbersCheck({ launched: true, owners: "+50660000000", guests: undefined })?.level).toBe("error");
  });
  it("sin lanzar y sin números: solo aviso (la portada se sigue desplegando)", () => {
    const check = supportNumbersCheck({ launched: false, owners: undefined, guests: "" });
    expect(check?.level).toBe("warning");
    expect(check?.message).toContain("WA_OWNERS / WA_GUESTS sin configurar");
  });
  it("con los dos números, nada que decir", () => {
    expect(supportNumbersCheck({ launched: true, owners: "+50660000000", guests: "+50660000001" })).toBeNull();
    expect(supportNumbersCheck({ launched: false, owners: " +50660000000 ", guests: "+50660000001" })).toBeNull();
  });
  it("LAUNCHED se lee del entorno de wrangler que se despliega; sin entorno, el nivel superior", () => {
    const config = { vars: { LAUNCHED: "true" }, env: { production: { vars: { LAUNCHED: "false" } }, pruebas: { vars: {} } } };
    expect(launchedFor(config, "production")).toBe(false);
    expect(launchedFor(config, "pruebas")).toBe(false);
    expect(launchedFor(config, undefined)).toBe(true);
    expect(launchedFor({ env: { production: { vars: { LAUNCHED: "true" } } } }, "production")).toBe(true);
  });
});
