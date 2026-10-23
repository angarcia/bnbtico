import { describe, expect, it } from "vitest";
import { landingOnly, robotsTxt, shareBase } from "../../src/domain/seo";
import { parsePublicId, publicPath, publicUrl } from "../../src/domain/share";

describe("parsePublicId", () => {
  it.each([
    ["ct-1001", "CT-1001"],
    [" CT-1001 ", "CT-1001"],
    ["CT-123456", "CT-123456"],
  ])("normaliza %s", (input, expected) => expect(parsePublicId(input)).toBe(expected));
  it.each(["CT-12", "casa", "CT-1001x", "", "CT-1001/../admin"])("rechaza %s", (input) => expect(parsePublicId(input)).toBeNull());
});

it("publicPath y publicUrl", () => {
  expect(publicPath("CT-1001")).toBe("/casa/CT-1001");
  expect(publicUrl("CT-1001", "https://bnbtico.com/")).toBe("https://bnbtico.com/casa/CT-1001");
});

describe("shareBase", () => {
  it("usa bnbtico.com en producción", () => {
    expect(shareBase("production", "https://bnbtico-production.workers.dev")).toBe("https://bnbtico.com");
  });
  it("usa el origen actual en pruebas y en local", () => {
    expect(shareBase("pruebas", "https://nueva.bnbtico.com/")).toBe("https://nueva.bnbtico.com");
    expect(shareBase("local", "http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
    expect(shareBase("local", null)).toBe("https://bnbtico.com");
  });
});

describe("robots.txt", () => {
  it("en producción permite indexar y anuncia el sitemap", () => {
    expect(robotsTxt("production")).toBe("User-agent: *\nAllow: /\nSitemap: https://bnbtico.com/sitemap.xml\n");
  });
  it("en pruebas y en local pide no indexar", () => {
    expect(robotsTxt("pruebas")).toBe("User-agent: *\nDisallow: /\n");
    expect(robotsTxt("local")).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("landingOnly", () => {
  it("producción sirve solo la portada hasta que LAUNCHED sea exactamente «true»", () => {
    expect(landingOnly({ ENVIRONMENT: "production" })).toBe(true);
    expect(landingOnly({ ENVIRONMENT: "production", LAUNCHED: "false" })).toBe(true);
    expect(landingOnly({ ENVIRONMENT: "production", LAUNCHED: "1" })).toBe(true);
    expect(landingOnly({ ENVIRONMENT: "production", LAUNCHED: "true" })).toBe(false);
  });
  it("pruebas y local siempre tienen la app entera", () => {
    expect(landingOnly({ ENVIRONMENT: "pruebas" })).toBe(false);
    expect(landingOnly({ ENVIRONMENT: "local", LAUNCHED: "false" })).toBe(false);
  });
});
