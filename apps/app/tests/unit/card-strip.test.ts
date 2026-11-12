// Fotos deslizables de la tarjeta de Explorar (ticket 09 de la ronda del 2 nov, alcance del 2026-11-04): qué foto marca el
// contador y hasta cuál se monta mientras se desliza la tira.
import { describe, expect, it } from "vitest";
import { stripStep } from "../../src/client/card-strip";
import { stripDots } from "../../src/shared/photo-dots";

describe("stripStep", () => {
  it("al empezar a deslizar monta la foto 2 y la 3 (la que viene), y el contador sigue en la 1", () => {
    expect(stripStep({ scrollLeft: 10, width: 375, count: 5, reach: 0 })).toEqual({ index: 0, reach: 2 });
  });
  it("en la foto 2, el contador dice 2 y ya está montada la 3", () => {
    expect(stripStep({ scrollLeft: 375, width: 375, count: 5, reach: 2 })).toEqual({ index: 1, reach: 2 });
  });
  it("el contador cambia a mitad de camino", () => {
    expect(stripStep({ scrollLeft: 190, width: 375, count: 5, reach: 2 })?.index).toBe(1);
    expect(stripStep({ scrollLeft: 180, width: 375, count: 5, reach: 2 })?.index).toBe(0);
  });
  it("lo montado no se desmonta al volver", () => {
    expect(stripStep({ scrollLeft: 0, width: 375, count: 5, reach: 4 })).toEqual({ index: 0, reach: 4 });
  });
  it("nunca pasa de la última foto", () => {
    expect(stripStep({ scrollLeft: 1500, width: 375, count: 5, reach: 3 })).toEqual({ index: 4, reach: 4 });
    expect(stripStep({ scrollLeft: 400, width: 375, count: 2, reach: 0 })).toEqual({ index: 1, reach: 1 });
  });
  it("sin ancho (tira oculta) no cambia nada", () => {
    expect(stripStep({ scrollLeft: 0, width: 0, count: 5, reach: 1 })).toBeNull();
  });
});

// Puntitos de la tarjeta (2026-11-03, sustituyen al «1 / N»): como mucho cinco; si hay más fotos, la ventana sigue a la foto
// actual y los extremos que tienen más fotos detrás salen pequeños.
describe("stripDots", () => {
  const shape = (index: number, count: number) => stripDots(index, count).map((d) => (d.on ? "O" : d.small ? "." : "o")).join("");
  it("con cinco fotos o menos, un puntito por foto y la actual marcada", () => {
    expect(shape(0, 3)).toBe("Ooo");
    expect(shape(4, 5)).toBe("ooooO");
  });
  it("con más de cinco, cinco puntitos: el extremo con más fotos detrás, pequeño", () => {
    expect(shape(0, 8)).toBe("Oooo.");
    expect(shape(2, 8)).toBe("ooOo.");
    expect(shape(4, 8)).toBe(".oOo.");
    expect(shape(7, 8)).toBe(".oooO");
  });
  it("cada puntito dice qué foto es", () => {
    expect(stripDots(4, 8).map((d) => d.photo)).toEqual([2, 3, 4, 5, 6]);
  });
  it("una sola foto, sin puntitos", () => {
    expect(stripDots(0, 1)).toEqual([]);
  });
});
