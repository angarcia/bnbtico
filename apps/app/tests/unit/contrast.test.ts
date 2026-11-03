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

/** Un color `#RRGGBB`, una variable del :root, `var(--x)` o `color-mix(in srgb, A p%, B)` (con «transparent», sobre el
 *  crema de `--bg`, que es el fondo de la app): se resuelve a `#RRGGBB`. */
function hex(token: string, map: Record<string, string> = vars): string {
  const value = (token.startsWith("--") ? map[token] : token)?.trim();
  if (!value) throw new Error(`${token} no está en el :root`);
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (ref) return hex(ref[1]!, map);
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/.exec(value);
  if (mix) {
    const a = hex(mix[1]!, map);
    const b = hex(mix[3]!.trim() === "transparent" ? "--bg" : mix[3]!.trim(), map);
    const p = Number(mix[2]) / 100;
    const ch = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16);
    return `#${[1, 3, 5].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error(`${token} no es un color #RRGGBB (${value})`);
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
  ["--fg-title", "--bg"],
  ["--primary-on", "--primary"],
  ["#FFFBF2", "--brand-ink"],
  ["--brand-ink", "--bg"],
  ["--fg", "--sun"],
  ["--muted", "--bg"],
  ["--sun-ink", "--sun-soft"],
  ["--state-ink", "--state-soft"],
  ["--cal-busy-ink", "--cal-busy"],
  ["--when-pick-ink", "--when-pick"],
  // La estancia elegida en el calendario de la ficha (ticket 08 de la ronda del 2 nov): el número y el precio sobre la banda
  // (con el verde de los libres debajo, hasta un 12 % más) y el número de un ocupado bajo la banda (en tinta, no en terracota: sobre la banda no llega a 4,5).
  ["--fg", "color-mix(in srgb, var(--primary) 12%, var(--stay-band))"],
  ["--fg", "color-mix(in srgb, var(--brand) 25%, var(--bg))"],
  ["--muted", "--review-soft"],
  ["--fg", "--surface-2"],
  ["--muted", "--surface-2"],
  // El precio de la casilla «Alquiler mensual» de la ficha (13 px en --muted sobre la casilla, crema con 70 % de blanco).
  ["--muted", "color-mix(in srgb, var(--surface) 70%, var(--bg))"],
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
  // «Revisar y enviar»: los avisos no obligatorios van en ocre (publicar avanza siempre, 2026-10-30).
  ["review-row.is-warn", "--sun-ink", "--sun-soft"],
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

  it("las filas de aviso de «Revisar y enviar» pintan etiqueta, texto y flecha en --sun-ink", () => {
    expect(css).toContain(".review-row.is-warn .review-label,.review-row.is-warn .review-text,.review-row.is-warn svg{color:var(--sun-ink)}");
  });

  it("terracota de texto #B44C30 y margen de 16 px", () => {
    expect(vars["--brand-ink"]).toBe("#B44C30");
    expect(vars["--gutter"]).toBe("16px");
  });
});

describe("contraste del tema oscuro", () => {
  const dark = darkVars(css);
  /** En el tema oscuro, la variable del bloque oscuro o, si no la cambia, la del claro. */
  const darkHex = (token: string) => hex(token, { ...vars, ...dark });
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
