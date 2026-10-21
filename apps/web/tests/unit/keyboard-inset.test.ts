import { describe, expect, it } from "vitest";
import { keyboardInset } from "@/lib/forms/keyboard-inset";

// iOS no encoge la página con el teclado: la ventana visible (visualViewport) se hace más baja que window.innerHeight.
// El hueco que tapa el teclado se añade como relleno para que el campo se pueda desplazar a la vista.

describe("keyboardInset", () => {
  it("sin teclado, cero", () => {
    expect(keyboardInset({ innerHeight: 667, viewportHeight: 667, viewportOffsetTop: 0 })).toBe(0);
  });
  it("con el teclado de iOS abierto, la altura que tapa", () => {
    expect(keyboardInset({ innerHeight: 667, viewportHeight: 357, viewportOffsetTop: 0 })).toBe(310);
  });
  it("si Safari ya desplazó la vista, descuenta ese desplazamiento", () => {
    expect(keyboardInset({ innerHeight: 667, viewportHeight: 357, viewportOffsetTop: 100 })).toBe(210);
  });
  it("barras del navegador que cambian de tamaño (menos de 100 px) no cuentan como teclado", () => {
    expect(keyboardInset({ innerHeight: 667, viewportHeight: 600, viewportOffsetTop: 0 })).toBe(0);
  });
  it("Android con resizes-content: innerHeight y la vista encogen juntos, cero", () => {
    expect(keyboardInset({ innerHeight: 357, viewportHeight: 357, viewportOffsetTop: 0 })).toBe(0);
  });
});

import { scrollTopToCenter } from "@/lib/forms/keyboard-inset";

describe("scrollTopToCenter", () => {
  it("centra el campo en la parte visible (encima del teclado), no en la pantalla completa", () => {
    // Campo de 52 px cuyo borde superior está a 332 px del arriba de la ventana; visible: 357 px.
    expect(scrollTopToCenter({ scrollY: 0, elementTop: 332, elementHeight: 52, viewportHeight: 357, viewportOffsetTop: 0 })).toBe(180);
  });
  it("suma el desplazamiento actual y descuenta el de la vista visible", () => {
    expect(scrollTopToCenter({ scrollY: 100, elementTop: 332, elementHeight: 52, viewportHeight: 357, viewportOffsetTop: 40 })).toBe(240);
  });
  it("nunca devuelve un desplazamiento negativo", () => {
    expect(scrollTopToCenter({ scrollY: 0, elementTop: 10, elementHeight: 52, viewportHeight: 357, viewportOffsetTop: 0 })).toBe(0);
  });
});
