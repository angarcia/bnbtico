import { describe, expect, it } from "vitest";
import { DESCRIPTION_CLAMP_LINES, descriptionParagraphs, isLongDescription } from "../../src/domain/description";

describe("descriptionParagraphs", () => {
  it("separa los párrafos por líneas en blanco y quita los vacíos", () => {
    expect(descriptionParagraphs("Uno.\n\nDos.\n \n\n  Tres.  \n")).toEqual(["Uno.", "Dos.", "Tres."]);
  });
  it("un salto de línea suelto sigue dentro del mismo párrafo", () => {
    expect(descriptionParagraphs("Línea 1\nLínea 2\n\nOtro")).toEqual(["Línea 1\nLínea 2", "Otro"]);
  });
  it("con saltos de Windows también", () => {
    expect(descriptionParagraphs("Uno.\r\n\r\nDos.")).toEqual(["Uno.", "Dos."]);
  });
  it("vacía o en blanco, ningún párrafo", () => {
    expect(descriptionParagraphs("  \n\n ")).toEqual([]);
  });
});

describe("isLongDescription", () => {
  it("un párrafo corto no lleva «Ver más»", () => {
    expect(isLongDescription("Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho.")).toBe(false);
  });
  it("un texto que en el teléfono pasa de unas 9 líneas sí", () => {
    expect(isLongDescription("a ".repeat(200))).toBe(true);
  });
  it("cuenta los saltos y los espacios entre párrafos, no solo los caracteres", () => {
    const short = Array.from({ length: 6 }, (_, i) => `Párrafo ${i}.`).join("\n\n");
    expect(short.length).toBeLessThan(100);
    expect(isLongDescription(short)).toBe(true);
    expect(isLongDescription("Uno.\n\nDos.\n\nTres.")).toBe(false);
  });
  it("recorta a 8 líneas", () => {
    expect(DESCRIPTION_CLAMP_LINES).toBe(8);
  });
});
