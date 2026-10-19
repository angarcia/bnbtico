import { describe, expect, it } from "vitest";
import { ACCEPTED_TYPES, MAX_SIDE, acceptsImage, photoPath, targetSize } from "@/lib/image";

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
