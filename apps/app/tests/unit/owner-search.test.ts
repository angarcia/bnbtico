import { describe, expect, it } from "vitest";
import { actividadSearch, calendarioSearch, pasoSearch, suscripcionSearch } from "../../src/client/owner-search";

const UUID = "6f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a";

describe("suscripcionSearch", () => {
  it("conserva pago=ok y casa", () => {
    expect(suscripcionSearch({ pago: "ok", casa: "CT-1042" })).toEqual({ pago: "ok", casa: "CT-1042" });
  });
  it.each([[{ casa: "CT-104" }], [{ casa: "ct-1042" }], [{ casa: "CT-1042 " }], [{ casa: 1042 }], [{ pago: "si" }]])("descarta %j", (p) => {
    expect(suscripcionSearch(p)).toEqual({});
  });
  it("acepta más de cuatro cifras", () => {
    expect(suscripcionSearch({ casa: "CT-10420" })).toEqual({ casa: "CT-10420" });
  });
});

describe("actividadSearch", () => {
  it("conserva el uuid", () => {
    expect(actividadSearch({ casa: UUID })).toEqual({ casa: UUID });
  });
  it.each([[{ casa: "CT-1042" }], [{ casa: "x" }], [{}]])("descarta %j", (p) => {
    expect(actividadSearch(p)).toEqual({});
  });
});

describe("calendarioSearch", () => {
  it("casa uuid y mes válido", () => {
    expect(calendarioSearch({ casa: UUID, mes: "2026-11" })).toEqual({ casa: UUID, mes: "2026-11" });
  });
  it("descarta mes 13 y casa no uuid", () => {
    expect(calendarioSearch({ casa: "x", mes: "2026-13" })).toEqual({});
  });
});

describe("pasoSearch (corregir un dato desde «Revisar y enviar»)", () => {
  it("solo acepta volver=revisar; lo demás se descarta", () => {
    expect(pasoSearch({ volver: "revisar" })).toEqual({ volver: "revisar" });
    expect(pasoSearch({ volver: "otra" })).toEqual({});
    expect(pasoSearch({ volver: ["revisar"] })).toEqual({});
    expect(pasoSearch({})).toEqual({});
  });
});
