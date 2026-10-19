import { describe, expect, it } from "vitest";
import { parsePublicId, previewText, publicUrl, shareBase } from "@/lib/listings/share";

describe("parsePublicId", () => {
  it.each([
    ["ct-1001", "CT-1001"],
    [" CT-1001 ", "CT-1001"],
    ["CT-123456", "CT-123456"],
  ])("normaliza %s", (input, expected) => expect(parsePublicId(input)).toBe(expected));
  it.each(["CT-12", "casa", "CT-1001x", "", "CT-1001/../admin"])("rechaza %s", (input) => expect(parsePublicId(input)).toBeNull());
});

it("publicUrl", () => expect(publicUrl("CT-1001", "https://bnbtico.com")).toBe("https://bnbtico.com/casa/CT-1001"));

describe("shareBase", () => {
  it("usa bnbtico.com en producción sin etapa", () => {
    expect(shareBase({ NODE_ENV: "production" }, "https://bnbtico.vercel.app")).toBe("https://bnbtico.com");
  });
  it("usa el origen actual en pruebas y en local", () => {
    expect(shareBase({ NODE_ENV: "production", NEXT_PUBLIC_STAGE: "pruebas" }, "https://pruebas.bnbtico.com")).toBe("https://pruebas.bnbtico.com");
    expect(shareBase({ NODE_ENV: "development" }, "http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(shareBase({ NODE_ENV: "development" }, null)).toBe("https://bnbtico.com");
  });
});

it("previewText", () => {
  expect(previewText({ kind: "casa", zone: "Manzanillo", province: "Limón", capacity: 5, nightlyPriceCrc: 85000 })).toBe(
    "Casa en Manzanillo, Limón · 5 personas · ₡85\u00a0000 por noche · orientativo",
  );
});
