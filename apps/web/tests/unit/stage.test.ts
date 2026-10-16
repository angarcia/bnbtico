import { describe, expect, it } from "vitest";
import { appEnabled } from "@/lib/stage";

describe("qué se muestra en cada entorno", () => {
  it("bnbtico.com (producción sin NEXT_PUBLIC_STAGE) solo muestra «Muy pronto»", () => {
    expect(appEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(appEnabled({ NODE_ENV: "production", NEXT_PUBLIC_STAGE: "" })).toBe(false);
  });
  it("pruebas.bnbtico.com y local muestran la app", () => {
    expect(appEnabled({ NODE_ENV: "production", NEXT_PUBLIC_STAGE: "pruebas" })).toBe(true);
    expect(appEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});
