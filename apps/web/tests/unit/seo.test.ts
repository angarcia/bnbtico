import { describe, expect, it } from "vitest";
import { robotsFor } from "@/lib/seo";
import sitemap from "../../app/sitemap";

describe("robots y sitemap", () => {
  it("en bnbtico.com permite indexar y anuncia el sitemap", () => {
    expect(robotsFor({ NODE_ENV: "production" })).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: "https://bnbtico.com/sitemap.xml" });
  });
  it("en pruebas y en local pide no indexar", () => {
    expect(robotsFor({ NODE_ENV: "production", NEXT_PUBLIC_STAGE: "pruebas" }).rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(robotsFor({ NODE_ENV: "development" }).rules).toEqual({ userAgent: "*", disallow: "/" });
  });
  it("el sitemap incluye la portada con el dominio real", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://bnbtico.com/");
  });
});
