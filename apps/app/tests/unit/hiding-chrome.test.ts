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

// Tras probar la tanda 1 (Daniel, 2026-11-04): la barra de abajo vuelve a ser plana y pegada al borde, pero se sigue escondiendo.
describe("barra de abajo (.tabbar) en global.css", () => {
  const rule = css.match(/\n\.tabbar\{[^}]*\}/)![0];
  it("plana: a todo el ancho, pegada abajo, opaca y con la línea fina arriba; sin píldora ni desenfoque", () => {
    expect(rule).toContain("position:fixed;bottom:0;left:0;right:0;margin:0 auto;width:100%;max-width:560px");
    expect(rule).toContain("height:calc(var(--nav-h) + env(safe-area-inset-bottom))");
    expect(rule).toContain("background:var(--bg);border-top:2px solid var(--line-nav)");
    expect(rule).not.toMatch(/border-radius|backdrop-filter|box-shadow/);
    expect(css).toContain("--nav-h:84px;");
    expect(css).not.toMatch(/--tab-on|--tab-ink|--tabbar-h/);
  });
  it("sale entera por abajo con el escondido común", () => {
    expect(rule).toContain("--away:translateY(100%)");
  });
});
