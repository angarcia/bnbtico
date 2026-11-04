// El escondido común de las tarjetas flotantes (tarjetas flotantes, tanda 1): `chromeAway` decide con el desplazamiento y
// `html.chrome-away` (global.css) esconde todas las piezas `.chrome-hide` a la vez, salvo la que tiene el foco.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHROME_THRESHOLD, chromeAway } from "../../src/client/hiding-chrome";

const css = readFileSync(new URL("../../src/styles/global.css", import.meta.url), "utf8");

describe("chromeAway", () => {
  it("esconde al bajar, muestra al subir y arriba del todo", () => {
    expect(chromeAway(200, 100)).toBe(true);
    expect(chromeAway(100, 200)).toBe(false);
    expect(chromeAway(0, 50)).toBe(false);
  });
  it(`no cambia con un movimiento menor al umbral (${CHROME_THRESHOLD} px)`, () => {
    expect(chromeAway(104, 100)).toBeNull();
    expect(chromeAway(96, 100)).toBeNull();
  });
});

describe("html.chrome-away en global.css", () => {
  it("ya no queda la clase vieja de la barra de pestañas", () => {
    expect(css).not.toContain("tabbar-away");
  });
  it("esconde las piezas .chrome-hide con su desplazamiento propio, salvo la que tiene el foco del teclado", () => {
    expect(css).toContain("html.chrome-away .chrome-hide:not(:has(:focus-visible)){transform:var(--away);opacity:0;pointer-events:none}");
  });
  it("con movimiento reducido solo se funde: sin desplazamiento", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.chrome-hide\{transition:opacity [^}]+\}html\.chrome-away \.chrome-hide:not\(:has\(:focus-visible\)\)\{transform:none\}\}/);
  });
});

describe("tarjeta flotante (.float-card)", () => {
  it("opaca por defecto y translúcida con desenfoque donde se puede (también con el prefijo de Safari)", () => {
    expect(css).toContain(".float-card{background:var(--float-bg-solid);border:1px solid var(--float-edge);box-shadow:var(--float-shadow)}");
    expect(css).toContain("@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.float-card{background:var(--float-bg);-webkit-backdrop-filter:var(--float-blur);backdrop-filter:var(--float-blur)}");
  });
});
