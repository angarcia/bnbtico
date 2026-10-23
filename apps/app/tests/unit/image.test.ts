import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  MAX_SIDE,
  PHOTO_CACHE_SECONDS,
  VARIANT_QUALITY,
  VARIANT_SIZES,
  acceptsImage,
  isPhotoFolder,
  photoFolder,
  photoObjectPaths,
  photoPath,
  photoSrcSet,
  targetSize,
  variantPath,
  variantTargets,
  variantUrl,
} from "../../src/domain/image";

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
  it("la URL de una foto nueva es la de 800; variantUrl pasa a otro tamaño; una anterior se queda en su único archivo", () => {
    expect(variantUrl({ path: "casa/abc", url: "https://s/listings/casa/abc/800.jpg" }, 480)).toBe("https://s/listings/casa/abc/480.jpg");
    expect(variantUrl({ path: "casa/abc", url: "https://s/listings/casa/abc/800.jpg" }, 800)).toBe("https://s/listings/casa/abc/800.jpg");
    expect(variantUrl({ path: "casa/abc.jpg", url: "https://s/listings/casa/abc.jpg" }, 480)).toBe("https://s/listings/casa/abc.jpg");
  });
});

describe("subida en tres variantes (ticket 08)", () => {
  const L = "0b8f4c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
  const U = "1c9e5d2f-3e4b-4c6d-9e0f-1a2b3c4d5e6f";
  it("JPEG calidad 0,8 y caché de un año", () => {
    expect(VARIANT_QUALITY).toBe(0.8);
    expect(PHOTO_CACHE_SECONDS).toBe(31_536_000);
  });
  it("lado mayor 480/800/1600 manteniendo la proporción", () => {
    expect(variantTargets(4000, 3000)).toEqual([
      { size: 480, w: 480, h: 360 },
      { size: 800, w: 800, h: 600 },
      { size: 1600, w: 1600, h: 1200 },
    ]);
    expect(variantTargets(3000, 4000).map((t) => [t.w, t.h])).toEqual([
      [360, 480],
      [600, 800],
      [1200, 1600],
    ]);
  });
  it("nunca agranda: una foto pequeña se queda en su tamaño en las variantes mayores", () => {
    expect(variantTargets(640, 480).map((t) => [t.size, t.w, t.h])).toEqual([
      [480, 480, 360],
      [800, 640, 480],
      [1600, 640, 480],
    ]);
  });
  it("carpeta <casa>/<uuid> con los tres objetos dentro", () => {
    expect(photoFolder(L, U)).toBe(`${L}/${U}`);
    expect(isPhotoFolder(L, `${L}/${U}`)).toBe(true);
    expect(isPhotoFolder(L, `${L}/${U}.jpg`)).toBe(false);
    expect(isPhotoFolder(L, `${U}/${U}`)).toBe(false);
    expect(isPhotoFolder(L, `${L}/${U}/800.jpg`)).toBe(false);
    expect(photoObjectPaths(`${L}/${U}`)).toEqual([`${L}/${U}/480.jpg`, `${L}/${U}/800.jpg`, `${L}/${U}/1600.jpg`]);
  });
  it("borrar una foto anterior quita su único archivo", () => expect(photoObjectPaths(`${L}/${U}.jpg`)).toEqual([`${L}/${U}.jpg`]));
});
