// Contraste WCAG de los pares de colores que llevan texto (spec «Densidad y tarjetas», § Accessibility): todos ≥ 4,5:1
// en el tema claro. Lee las variables del primer bloque `:root{…}` de global.css que define `--bg`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/styles/global.css", import.meta.url), "utf8");

function rootVars(source: string): Record<string, string> {
  for (const m of source.matchAll(/:root\{([^}]*)\}/g)) {
    const body = m[1]!;
    if (!/--bg:/.test(body)) continue;
    const vars: Record<string, string> = {};
    for (const d of body.matchAll(/(--[\w-]+):([^;]+);/g)) vars[d[1]!] = d[2]!.trim();
    return vars;
  }
  throw new Error("no hay un :root con --bg en global.css");
}

const vars = rootVars(css);

/** Un color `#RRGGBB` o una variable del :root que lo sea. */
function hex(token: string): string {
  const value = token.startsWith("--") ? vars[token] : token;
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${token} no es un color #RRGGBB (${value})`);
  return value;
}

function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

const PAIRS: [string, string][] = [
  ["--fg", "--bg"],
  ["--primary-on", "--primary"],
  ["#FFFBF2", "--brand-ink"],
  ["--brand-ink", "--bg"],
  ["--fg", "--sun"],
  ["--muted", "--bg"],
  ["--sun-ink", "--sun-soft"],
  ["--state-ink", "--state-soft"],
  ["--cal-busy-ink", "--cal-busy"],
  ["--when-pick-ink", "--when-pick"],
  ["--muted", "--review-soft"],
  ["--fg", "--surface-2"],
  ["--muted", "--surface-2"],
  ["--busy-ink", "--busy"],
];

// Etiquetas de estado de las tarjetas (`.state-*` en global.css): texto sobre fondo, en los dos temas.
const STATE_LABELS: [string, string, string][] = [
  ["state-ok", "--state-ink", "--state-soft"],
  ["state-draft", "--fg", "--surface-2"],
  ["state-review", "--muted", "--review-soft"],
  ["state-pay", "--sun-ink", "--sun-soft"],
  ["state-off", "--muted", "--surface-2"],
  ["state-bad", "--busy-ink", "--busy"],
];

// Tema oscuro: el contador sobre --brand-ink lleva texto --bg (override de `.count-badge` en global.css).
function darkVars(source: string): Record<string, string> {
  const m = source.match(/@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/);
  if (!m) throw new Error("no hay bloque oscuro en global.css");
  const vars: Record<string, string> = {};
  for (const d of m[1]!.matchAll(/(--[\w-]+):([^;]+);/g)) vars[d[1]!] = d[2]!.trim();
  return vars;
}

describe("contraste de los colores de texto (tema claro)", () => {
  it.each(PAIRS)("%s sobre %s ≥ 4,5:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATE_LABELS)(".%s: %s sobre %s", (cls, fg, bg) => {
    expect(css).toContain(`.${cls}{background:var(${bg});color:var(${fg})}`);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("terracota de texto #B44C30 y margen de 16 px", () => {
    expect(vars["--brand-ink"]).toBe("#B44C30");
    expect(vars["--gutter"]).toBe("16px");
  });
});

describe("contraste del tema oscuro", () => {
  const dark = darkVars(css);
  /** En el tema oscuro, la variable del bloque oscuro o, si no la cambia, la del claro. */
  const darkHex = (token: string) => dark[token] ?? hex(token);
  const darkContrast = (a: string, b: string) => {
    const [l1, l2] = [luminance(darkHex(a)), luminance(darkHex(b))].sort((x, y) => y - x) as [number, number];
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it.each(STATE_LABELS)(".%s: %s sobre %s ≥ 4,5:1", (cls, fg, bg) => {
    expect(css).toContain(`.${cls}{background:var(${bg});color:var(${fg})}`);
    expect(darkContrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("texto --bg sobre el contador --brand-ink ≥ 4,5:1", () => {
    expect(css).toMatch(/\.count-badge\{color:var\(--bg\)\}/);
    const fg = dark["--bg"]!;
    const bg = dark["--brand-ink"]!;
    const [l1, l2] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
    expect((l1 + 0.05) / (l2 + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
