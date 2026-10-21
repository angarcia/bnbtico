import { describe, expect, it } from "vitest";
import { enterKeyHintFor, nextFieldIndex } from "@/lib/forms/enter-next";

// Formulario de publicar: «Siguiente» en el teclado salta al campo siguiente del paso; en el último, «Listo» envía el paso.

describe("nextFieldIndex", () => {
  it("salta al siguiente campo del paso", () => {
    expect(nextFieldIndex(3, 0)).toBe(1);
    expect(nextFieldIndex(3, 1)).toBe(2);
  });
  it("en el último campo no hay siguiente: se envía el paso", () => {
    expect(nextFieldIndex(3, 2)).toBeNull();
    expect(nextFieldIndex(1, 0)).toBeNull();
  });
  it("un índice fuera de la lista no salta a ningún sitio", () => {
    expect(nextFieldIndex(3, -1)).toBeNull();
    expect(nextFieldIndex(3, 7)).toBeNull();
  });
});

describe("enterKeyHintFor", () => {
  it("«next» salvo en el último campo, que lleva «done»", () => {
    expect(enterKeyHintFor(3, 0)).toBe("next");
    expect(enterKeyHintFor(3, 1)).toBe("next");
    expect(enterKeyHintFor(3, 2)).toBe("done");
    expect(enterKeyHintFor(1, 0)).toBe("done");
  });
});
