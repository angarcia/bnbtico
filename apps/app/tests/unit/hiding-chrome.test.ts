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

// Tarjetas flotantes, tanda 2: los botones de la ficha usan el mismo escondido; en el ordenador se quedan sobre la foto.
describe("botones de arriba de la ficha en global.css", () => {
  it("fijos arriba a 12 px de los bordes y del área segura, salen hacia arriba y escondidos no responden", () => {
    expect(css).toContain(".hero-top{position:fixed;top:var(--float-top);left:var(--float-gap);right:var(--float-gap);max-width:536px;margin:0 auto;z-index:6;display:flex;justify-content:space-between;pointer-events:none;--away:translateY(calc(-100% - var(--float-top) - 8px))}");
    expect(css).toContain("html.chrome-away .hero-top:not(:has(:focus-visible)) *{pointer-events:none}");
  });
  it("en el ordenador no se fijan ni se esconden", () => {
    expect(css).toContain("html.chrome-away .listing-view > .hero-top.chrome-hide{transform:none;opacity:1}");
  });
});

// Tarjetas flotantes, tanda 2: las barras de acción de los formularios son tarjetas flotantes fuertes que no se esconden.
describe("barras de acción (.sticky-actions) en global.css", () => {
  const rule = css.match(/\n\.sticky-actions\{[^}]*\}/)![0];
  it("flotan a 12 px de los bordes y del área segura, centradas sin transform, con el respaldo opaco", () => {
    expect(rule).toContain("left:var(--float-gap);right:var(--float-gap);bottom:var(--float-bottom);margin:0 auto");
    expect(rule).toContain("background:var(--float-bg-solid)");
    expect(rule).not.toContain("transform");
    expect(css).toContain("{.sticky-actions{background:var(--float-bg-strong);-webkit-backdrop-filter:var(--float-blur);backdrop-filter:var(--float-blur)}}");
  });
  it("no se esconden: no llevan .chrome-hide ni su desplazamiento", () => {
    expect(rule).not.toContain("--away");
    expect(css).not.toMatch(/chrome-away[^{]*\.sticky-actions/);
  });
  it("los huecos de debajo dejan sitio a la barra y su separación (66 + 12)", () => {
    expect(css).toContain(".sticky-spacer{height:78px}");
    expect(css).toContain(".publish-form::after{content:\"\";flex:none;height:calc(78px + var(--kb,0px) + env(safe-area-inset-bottom))}");
  });
});
