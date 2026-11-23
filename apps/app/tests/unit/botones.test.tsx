// Botones comunes (historia 07, paso 2): cada variante sale de una sola regla de styles/01-base.css, `pending` avisa y
// bloquea, el botón de icono siempre tiene nombre y ninguna pantalla escribe las clases de botón a mano.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, ButtonLink, ButtonPlaceholder, IconButton, TextButton, type ButtonVariant } from "../../src/shared/ui/button";
import { readCss } from "../read-css";

const css = readCss();
const SRC = new URL("../../src/", import.meta.url).pathname;
const STYLES = join(SRC, "styles");

/** Las declaraciones de la única regla propia de `selector` en 01-base.css (la que no lo agrupa con otros), o de la única que lo nombra. */
function rule(selector: string): string {
  const base = readFileSync(join(STYLES, "01-base.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = base.split("}").map((chunk) => chunk.split("{")).filter((p) => p.length === 2);
  const own = rules.filter((p) => p[0]!.trim() === selector);
  const found = own.length ? own : rules.filter((p) => p[0]!.split(",").map((s) => s.trim()).includes(selector));
  expect(found, `una sola regla para ${selector} en 01-base.css`).toHaveLength(1);
  return found[0]![1]!;
}

const classOf = (html: string) => /class="([^"]*)"/.exec(html)?.[1]?.split(" ") ?? [];

describe("Button: el aspecto lo dan la variante y el tamaño", () => {
  const looks: Record<ButtonVariant, { cls: string; decl: RegExp }> = {
    primary: { cls: "btn-primary", decl: /background:var\(--state-soft\);color:var\(--primary\)/ },
    secondary: { cls: "btn-secondary", decl: /background:transparent;border-color:color-mix\(in srgb,var\(--primary\) 45%,transparent\);color:var\(--primary-ink\)/ },
    pay: { cls: "btn-sun", decl: /background:color-mix\(in srgb,var\(--sun\) 70%,transparent\)/ },
    whatsapp: { cls: "btn-wa", decl: /background:var\(--wa\);color:var\(--wa-ink\)/ },
    danger: { cls: "btn-danger", decl: /background:color-mix\(in srgb,var\(--brand\) 12%,transparent\);color:var\(--brand-ink\)/ },
  };
  for (const [variant, { cls, decl }] of Object.entries(looks) as [ButtonVariant, { cls: string; decl: RegExp }][]) {
    it(`${variant}: ${cls}, con su regla única`, () => {
      expect(classOf(renderToString(<Button variant={variant}>Hola</Button>))).toEqual(["btn", cls]);
      expect(rule(`.${cls}`)).toMatch(decl);
    });
  }

  it("tamaños de 44, 52 y 56 px y a todo el ancho con `block`", () => {
    expect(rule(".btn")).toContain("min-height:var(--hit)");
    expect(rule(".btn-lg")).toContain("min-height:52px");
    expect(rule(".btn-xl")).toContain("min-height:56px");
    expect(classOf(renderToString(<Button variant="primary" size="lg" block>Hola</Button>))).toEqual(["btn", "btn-primary", "btn-lg", "btn-block"]);
    expect(classOf(renderToString(<ButtonLink variant="secondary" size="xl" href="/x">Hola</ButtonLink>))).toEqual(["btn", "btn-secondary", "btn-xl"]);
  });

  it("un solo desactivado, con los tokens y sin bajar la opacidad", () => {
    const disabled = rule(".btn:disabled");
    expect(disabled).toContain("background:var(--disabled-bg);color:var(--disabled-fg)");
    expect(disabled).not.toMatch(/opacity:(?!1\b)/);
    expect(css).not.toMatch(/\.btn[\w-]*(\.[\w-]+)*:disabled[^{]*\{[^}]*opacity:\.\d/);
  });

  it("sin alias ni clases muertas: btn-soft, btn-outline, btn-ghost, btn-outline-bad, btn-danger-outline, btn-sm, btn-header, btn-round, btn-note, popup-cancel", () => {
    for (const dead of ["btn-soft", "btn-outline", "btn-ghost", "btn-outline-bad", "btn-danger-outline", "btn-sm", "btn-header", "btn-round", "btn-note", "popup-cancel", "btn-more", "cal-cancel", "cal-save"]) {
      expect(css, dead).not.toMatch(new RegExp(`\\.${dead}(?![\\w-])`));
    }
  });

  it("con ratón, en escritorio, primary, secondary y danger responden al pasar por encima", () => {
    const desk = readFileSync(join(STYLES, "13-escritorio.css"), "utf8");
    for (const cls of ["btn-primary", "btn-secondary", "btn-danger"]) expect(desk).toMatch(new RegExp(`@media \\(hover: hover\\)[\\s\\S]*\\.${cls}:hover`));
  });

  it("`pending` pone aria-busy y disabled; el texto lo pone quien lo usa", () => {
    const html = renderToString(<Button variant="primary" pending>Guardando…</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Guardando…");
    const idle = renderToString(<Button variant="primary">Guardar</Button>);
    expect(idle).not.toContain("aria-busy");
    expect(idle).not.toContain("disabled");
    expect(idle).toContain('type="button"');
  });

  it("el icono va delante del texto y la caja sin hidratar se ve igual", () => {
    expect(renderToString(<Button variant="whatsapp" size="xl" block icon={<svg />}>Contactar</Button>)).toMatch(/<svg><\/svg>Contactar<\/button>$/);
    expect(renderToString(<ButtonPlaceholder variant="whatsapp" size="xl" block aria-hidden="true">Contactar</ButtonPlaceholder>)).toBe('<span aria-hidden="true" class="btn btn-wa btn-xl btn-block">Contactar</span>');
  });
});

describe("TextButton e IconButton", () => {
  it("TextButton: link, quiet y danger, siempre de 44 px", () => {
    expect(classOf(renderToString(<TextButton tone="link">a</TextButton>))).toEqual(["btn-link"]);
    expect(classOf(renderToString(<TextButton tone="quiet">a</TextButton>))).toEqual(["btn-text"]);
    expect(classOf(renderToString(<TextButton tone="danger">a</TextButton>))).toEqual(["btn-text-danger"]);
    expect(css).toMatch(/\.btn-link,\.btn-text,\.btn-text-danger\{[^}]*min-height:var\(--hit\)/);
    expect(rule(".btn-text-danger")).toContain("color:var(--brand-ink)");
  });

  it("IconButton: 44 × 44 y el nombre accesible es obligatorio", () => {
    const html = renderToString(<IconButton label="Cerrar" tone="overlay"><svg /></IconButton>);
    expect(html).toContain('aria-label="Cerrar"');
    expect(classOf(html)).toEqual(["icon-btn", "overlay"]);
    expect(rule(".icon-btn")).toMatch(/width:var\(--hit\);height:var\(--hit\)/);
    // @ts-expect-error: sin `label` no compila.
    expect(renderToString(<IconButton><svg /></IconButton>)).not.toContain("aria-label=");
  });

  it("quitar foto: área de 44 con el dibujo de 36", () => {
    expect(css).toMatch(/\.photos-grid \.remove\{[^}]*background:none/);
    expect(css).toMatch(/\.photos-grid \.remove::before\{[^}]*inset:4px/);
    expect(css).not.toMatch(/\.cal-arrow\{[^}]*width:40px/);
  });
});

// Que ninguna pantalla escriba las clases de botón a mano lo vigila tests/unit/consistencia.test.ts (historia 07, paso 6).
describe("las pantallas usan los componentes", () => {
  it("ninguna pantalla cambia la altura de un botón con su propio CSS", () => {
    const offenders = readdirSync(STYLES)
      .filter((f) => f !== "01-base.css" && f.endsWith(".css"))
      .flatMap((f) =>
        [...readFileSync(join(STYLES, f), "utf8").matchAll(/([^{}]*\.(?:btn|icon-btn)\b[^{}]*)\{([^}]*)\}/g)]
          .filter((m) => /min-height|(?:^|;)\s*height/.test(m[2]!))
          .map((m) => `${f}: ${m[1]!.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
