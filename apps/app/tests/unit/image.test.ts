import { describe, expect, it } from "vitest";
import { ACCEPTED_TYPES, MAX_SIDE, VARIANT_SIZES, acceptsImage, photoPath, photoSrcSet, targetSize, variantPath } from "../../src/domain/image";

describe("acceptsImage", () => {
  it("acepta jpg/png/webp por tipo o por extensión", () => {
    expect(ACCEPTED_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(acceptsImage({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(acceptsImage({ type: "", name: "b.JPG" })).toBe(true);
    expect(acceptsImage({ type: "", name: "c.jpeg" })).toBe(true);
    expect(acceptsImage({ type: "image/png", name: "d" })).toBe(true);
    expect(acceptsImage({ type: "", name: "e.webp" })).toBe(true);
  });
  it("rechaza HEIC/HEIF y otros formatos que el navegador no decodifica", () => {
    expect(acceptsImage({ type: "image/heic", name: "iphone.heic" })).toBe(false);
    expect(acceptsImage({ type: "", name: "iphone.HEIF" })).toBe(false);
    expect(acceptsImage({ type: "application/pdf", name: "plano.pdf" })).toBe(false);
    expect(acceptsImage({ type: "video/mp4", name: "tour.mp4" })).toBe(false);
  });
});

describe("targetSize", () => {
  it("reduce el lado mayor a 1600 manteniendo la proporción", () => {
    expect(MAX_SIDE).toBe(1600);
    expect(targetSize(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(targetSize(3000, 4000)).toEqual({ w: 1200, h: 1600 });
  });
  it("no agranda imágenes pequeñas", () => {
    expect(targetSize(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

it("photoPath", () => expect(photoPath("abc", "u1")).toBe("abc/u1.jpg"));

describe("variantes", () => {
  const url = (p: string) => `https://s/${p}`;
  it("tres tamaños", () => expect(VARIANT_SIZES).toEqual([480, 800, 1600]));
  it("una foto anterior se usa tal cual en cualquier tamaño", () => {
    expect(variantPath("l1/u1.jpg", 800)).toBe("l1/u1.jpg");
    expect(photoSrcSet("l1/u1.jpg", url)).toBeNull();
  });
  it("una foto nueva es una carpeta con 480/800/1600", () => {
    expect(variantPath("l1/u1", 800)).toBe("l1/u1/800.jpg");
    expect(photoSrcSet("l1/u1", url)).toBe("https://s/l1/u1/480.jpg 480w, https://s/l1/u1/800.jpg 800w");
  });
});

describe("variantUrl", () => {
  it("una foto con variantes apunta a su tamaño; una anterior, al único archivo", async () => {
    const { variantUrl } = await import("../../src/domain/image");
    expect(variantUrl({ path: "casa/abc", url: "https://s/listings/casa/abc" }, 480)).toBe("https://s/listings/casa/abc/480.jpg");
    expect(variantUrl({ path: "casa/abc.jpg", url: "https://s/listings/casa/abc.jpg" }, 480)).toBe("https://s/listings/casa/abc.jpg");
  });
});
