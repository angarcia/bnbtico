import { describe, expect, it } from "vitest";
import { enterKeyHintFor, nextFieldIndex } from "../../src/client/publish/enter-next";

describe("«Siguiente» y «Listo» en el teclado", () => {
  it("Enter pasa al siguiente campo; en el último envía", () => {
    expect(nextFieldIndex(3, 0)).toBe(1);
    expect(nextFieldIndex(3, 1)).toBe(2);
    expect(nextFieldIndex(3, 2)).toBeNull();
    expect(nextFieldIndex(1, 0)).toBeNull();
    expect(nextFieldIndex(3, -1)).toBeNull();
  });
  it("la tecla dice «Siguiente» salvo en el último campo", () => {
    expect([0, 1, 2].map((i) => enterKeyHintFor(3, i))).toEqual(["next", "next", "done"]);
    expect(enterKeyHintFor(1, 0)).toBe("done");
  });
});
