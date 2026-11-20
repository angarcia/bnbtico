// Campos comunes (historia 07, paso 4): el campo enlaza su error, su ayuda y su contador; el contador, el segmento y los
// chips tienen un solo marcado y un solo CSS, con áreas de 44 px y foco visible; y ninguna pantalla vuelve a escribir las
// piezas de antes a mano.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChoiceChips, Segmented } from "../../src/shared/choice";
import { AffixInput, Checkbox, Field, TextInput } from "../../src/shared/field";
import { CounterRow, Stepper } from "../../src/shared/stepper";
import { listingFieldError } from "../../src/domain/field-errors";
import { CAPACITY_ERROR, KIND_ERROR, LOCATION_MESSAGES, MONTHLY_PRICE_ERROR, NIGHTLY_PRICE_ERROR, PARKING_ERROR, TITLE_EMPTY_ERROR, TITLE_LENGTH_ERROR } from "../../src/domain/listing-rules";
import { readCss } from "../read-css";

const css = readCss().replace(/\/\*[\s\S]*?\*\//g, "");
const SRC = new URL("../../src/", import.meta.url).pathname;

/** Los selectores de una lista, separados por las comas de fuera de los paréntesis (`:where(a,b)` es uno). */
function selectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  return [...out, current.trim()];
}

/** Las declaraciones de las reglas cuyo selector (o uno de los agrupados) es exactamente `selector`, en todo el CSS. */
function decls(selector: string): string {
  return css
    .split("}")
    .map((chunk) => chunk.split("{"))
    .filter((p) => p.length >= 2 && selectors(p[p.length - 2]!).includes(selector))
    .map((p) => p[p.length - 1]!)
    .join(";");
}

const attr = (html: string, tag: string, name: string) => new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(html)?.[1];

describe("Field: el error va debajo del campo y queda enlazado", () => {
  const html = renderToString(
    <Field id="t" label="Nombre de la casa" error="Póngale un nombre a la casa." hint="Se revisa antes de publicar." count={{ text: "0 / 32" }}>
      {(control) => <TextInput {...control} name="title" />}
    </Field>,
  );

  it("el control lleva el id, aria-invalid y aria-describedby con el error, la ayuda y el contador (en ese orden)", () => {
    expect(attr(html, "input", "id")).toBe("t");
    expect(attr(html, "input", "aria-invalid")).toBe("true");
    expect(attr(html, "input", "aria-describedby")).toBe("t-error t-hint t-count");
    expect(html).toMatch(/<label for="t">Nombre de la casa<\/label>/);
  });

  it("el error, con su id y role=alert, va después del campo", () => {
    expect(html).toMatch(/<p id="t-error" class="field-error" role="alert">Póngale un nombre a la casa\.<\/p>/);
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf('id="t-error"'));
  });

  it("sin error, ni aria-invalid ni el párrafo; describedBy se suma al final", () => {
    const ok = renderToString(<Field id="m" label="Mínimo" describedBy="f-help">{(control) => <TextInput {...control} />}</Field>);
    expect(attr(ok, "input", "aria-invalid")).toBeUndefined();
    expect(attr(ok, "input", "aria-describedby")).toBe("f-help");
    expect(ok).not.toContain("field-error");
  });

  it("compacto para las hojas y etiqueta solo para lectores", () => {
    const compact = renderToString(<Field id="c" label="Motivo" size="compact" labelHidden>{(control) => <TextInput {...control} />}</Field>);
    expect(compact).toContain('class="field field-compact"');
    expect(compact).toMatch(/<label for="c" class="sr-only">Motivo<\/label>/);
  });
});

describe("AffixInput: el signo no se lee y el error marca la caja", () => {
  it("₡ con aria-hidden; con aria-invalid, data-invalid en la caja", () => {
    const html = renderToString(<AffixInput id="p" size="lg" prefix="₡" aria-invalid aria-describedby="p-error" />);
    expect(html).toMatch(/<label class="affix affix-lg" data-invalid="true"><span class="affix-sign" aria-hidden="true">₡<\/span><input/);
    expect(attr(html, "input", "aria-describedby")).toBe("p-error");
    expect(decls(".affix-lg")).toContain("min-height:56px");
    expect(decls(".affix-sm")).toContain("min-height:var(--hit)");
  });
});

describe("Stepper: un solo contador, con nombres únicos y sus topes", () => {
  const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>/g)].map((m) => m[1]!);

  it("«Una persona menos» y «Una persona más»; en el mínimo, «−» desactivado", () => {
    const [less, more] = buttons(renderToString(<Stepper unit="Una persona" value={1} min={1} max={4} onChange={() => undefined} />));
    expect(less).toContain('aria-label="Una persona menos"');
    expect(less).toContain("disabled");
    expect(more).toContain('aria-label="Una persona más"');
    expect(more).not.toContain("disabled");
  });

  it("en el máximo, «+» desactivado", () => {
    const [less, more] = buttons(renderToString(<Stepper unit="Un dormitorio" value={4} min={0} max={4} onChange={() => undefined} />));
    expect(less).not.toContain("disabled");
    expect(more).toContain('aria-label="Un dormitorio más"');
    expect(more).toContain("disabled");
  });

  it("sin indicar, un «–» en gris; con nombre propio para lectores", () => {
    expect(renderToString(<Stepper unit="Una noche" value={0} min={1} max={90} empty onChange={() => undefined} />)).toContain('<b class="num is-empty" aria-live="polite">–</b>');
    expect(renderToString(<Stepper unit="Un dormitorio" value={2} min={0} max={5} display="2+" valueLabel="2 o más" onChange={() => undefined} />)).toContain('aria-label="2 o más">2+</b>');
  });

  it("la fila de contador es la misma pieza, con el campo editable de la hoja de contacto", () => {
    const row = renderToString(<CounterRow label="Baños" unit="Un baño" value={1} min={1} max={30} onChange={() => undefined} />);
    expect(row).toContain('class="counter"');
    expect(row).toContain('aria-label="Un baño menos"');
    const editable = renderToString(
      <Stepper unit="Una persona" value={0} min={1} max={6} onChange={() => undefined} input={{ id: "p", name: "people", placeholder: "–", value: null, onInput: () => undefined }} />,
    );
    const input = /<input[^>]*>/.exec(editable)![0];
    for (const a of ['id="p"', 'class="stepper-input"', 'type="number"', 'name="people"', 'inputMode="numeric"', 'min="1"', 'max="6"']) expect(input).toContain(a);
  });

  it("botones de 44 × 44 y un solo desactivado", () => {
    expect(decls(".stepper button")).toMatch(/width:var\(--hit\);height:var\(--hit\)/);
    expect(decls(".stepper button:disabled")).toBe("background:var(--disabled-bg);color:var(--disabled-fg);cursor:not-allowed");
  });
});

describe("Segmented: una sola elección, 44 px, botones nativos", () => {
  const html = renderToString(
    <Segmented name="acceptsMonthly" labelledBy="q" options={[{ value: "no", label: "No" }, { value: "yes", label: "Sí" }]} value="no" onChange={() => undefined} />,
  );

  it("grupo con su etiqueta, el valor en un campo oculto y aria-pressed en la elegida", () => {
    expect(html).toMatch(/<div class="seg" role="group" aria-labelledby="q"><input type="hidden" name="acceptsMonthly" value="no"\/>/);
    expect(html).toMatch(/<button type="button" aria-pressed="true">No<\/button><button type="button" aria-pressed="false">Sí<\/button>/);
  });

  it("sin elegida (días con disponibilidad distinta), ninguna pulsada", () => {
    expect(renderToString(<Segmented label="Disponibilidad" options={[{ value: "a", label: "A" }]} value={null} onChange={() => undefined} />)).not.toContain('aria-pressed="true"');
  });

  it("botones de 44 px como mínimo, también el de la moneda", () => {
    expect(decls(".seg button")).toMatch(/min-width:var\(--hit\);min-height:var\(--hit\)/);
    expect(css).not.toMatch(/\.currency-switch button\{[^}]*min-height:(3\d)px/);
  });
});

describe("ChoiceChips y ChoiceCards: el estado lo da el input, con foco visible", () => {
  it("con input: casillas nativas dentro de un label sin aria-pressed, y el ✓ en su hueco", () => {
    const html = renderToString(<ChoiceChips type="checkbox" name="features" options={[{ value: "wifi", label: "Wifi" }, { value: "pool", label: "Piscina" }]} selected={["wifi"]} onToggle={() => undefined} />);
    expect(html).not.toMatch(/<label[^>]*aria-pressed/);
    const wifi = /<label class="chip">(<input[^>]*>)Wifi<span class="feature-check" aria-hidden="true">(<svg)?/.exec(html)!;
    for (const a of ['type="checkbox"', 'name="features"', 'value="wifi"', 'checked=""', 'class="sr-input"']) expect(wifi[1]).toContain(a);
    expect(wifi[2]).toBe("<svg");
    expect(html).toMatch(/>Piscina<span class="feature-check" aria-hidden="true"><\/span>/);
  });

  it("con botón (estado en la URL): aria-pressed y nombre largo", () => {
    const html = renderToString(<ChoiceChips as="button" options={[{ value: "ev", label: "Cargador EV", name: "Cargador eléctrico" }]} selected={[]} onToggle={() => undefined} />);
    expect(html).toContain('<button type="button" class="chip" aria-label="Cargador eléctrico" aria-pressed="false">');
  });

  it("foco del teclado visible en chips y tarjetas, elegido con :has(input:checked), y 44 px", () => {
    expect(decls(".chip:has(input:focus-visible)")).toContain("outline:2px solid var(--focus-ring)");
    expect(decls(".choice:has(input:focus-visible)")).toContain("outline:2px solid var(--focus-ring)");
    expect(decls(".chip:has(input:checked)")).toContain("background:var(--chosen)");
    expect(decls(".choice:has(input:checked)")).toContain("background:var(--chosen)");
    expect(decls(".chip")).toContain("min-height:var(--hit)");
    expect(css).not.toMatch(/\.chip-sm\{[^}]*min-height/);
  });

  it("la casilla con su texto ocupa 44 px", () => {
    expect(renderToString(<Checkbox name="check-text">Sin enlaces</Checkbox>)).toBe('<label class="check"><input type="checkbox" name="check-text"/>Sin enlaces</label>');
    expect(decls(".check")).toContain("min-height:var(--hit)");
  });
});

describe("Campos: estados y letra", () => {
  it("desactivado y solo lectura con su aspecto; el error también en un select", () => {
    expect(decls(":where(input,select,textarea):disabled")).toContain("background:var(--disabled-bg);color:var(--disabled-fg)");
    expect(decls(":where(input,textarea)[readonly]")).toContain("background:var(--disabled-bg)");
    expect(decls(':where(input,select,textarea)[aria-invalid="true"]')).toBe("border-color:var(--bad)");
  });

  it("ningún campo con letra de menos de 16 px (el iPhone ampliaría la página)", () => {
    // La letra va en px o con la escala con nombre (`--fs-*`, historia 07 paso 5): se resuelve con el valor de :root.
    const scale = Object.fromEntries([...css.matchAll(/(--fs-[\w-]+):(\d+)px/g)].map((m) => [m[1]!, m[2]!]));
    expect(decls(".decide textarea")).toContain("font-size:var(--fs-note)");
    expect(scale["--fs-note"]).toBe("16");
    for (const rule of css.matchAll(/([^{}]*(?:input|textarea|select)[^{}]*)\{([^}]*)\}/g)) {
      const m = /font-size:(?:(\d+)px|var\((--fs-[\w-]+)\))/.exec(rule[2]!);
      const size = m ? (m[1] ?? scale[m[2]!]) : undefined;
      if (size && !/::placeholder|\.code-input/.test(rule[1]!)) expect(Number(size), rule[1]!.trim()).toBeGreaterThanOrEqual(16);
    }
  });
});

describe("El error de una casa va a su campo", () => {
  it("cada mensaje de las reglas (los mismos que devuelve la base) nombra su campo", () => {
    expect(listingFieldError(NIGHTLY_PRICE_ERROR)).toEqual({ field: "nightlyPriceCrc", message: NIGHTLY_PRICE_ERROR });
    expect(listingFieldError(MONTHLY_PRICE_ERROR)?.field).toBe("monthlyPriceCrc");
    expect(listingFieldError(TITLE_EMPTY_ERROR)?.field).toBe("title");
    expect(listingFieldError(TITLE_LENGTH_ERROR)?.field).toBe("title");
    expect(listingFieldError(CAPACITY_ERROR)?.field).toBe("capacity");
    expect(listingFieldError(PARKING_ERROR)?.field).toBe("parkingPaid");
    expect(listingFieldError(KIND_ERROR)?.field).toBe("kind");
  });

  it("lo que no es de un campo (la ubicación, la red) sigue en el aviso general", () => {
    expect(listingFieldError(LOCATION_MESSAGES.noPin)).toBeNull();
    expect(listingFieldError("No pudimos guardar. Intente de nuevo.")).toBeNull();
    expect(listingFieldError(null)).toBeNull();
  });
});

describe("Ninguna pantalla vuelve a escribir las piezas de antes", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : []));
  const OWN = new Set(["shared/field.tsx", "shared/choice.tsx", "shared/stepper.tsx", "client/code-input.tsx"]);
  const sources = [...files(join(SRC, "client")), ...files(join(SRC, "shared"))].filter((f) => !OWN.has(relative(SRC, f)));

  it("sin contadores, segmentos, códigos, precios ni buscadores a mano, y sin aria-pressed en un label", () => {
    const bad = /className="(?:people-stepper|seg\b|ctl|code-boxes|code-input|input-money|cal-price|zone-input|zone-list|zone-options|search-field|sticky-spacer)|<label[^>]*aria-pressed|className="chip"[^>]*aria-pressed/;
    const found = sources.filter((f) => bad.test(readFileSync(f, "utf8"))).map((f) => relative(SRC, f));
    expect(found).toEqual([]);
  });

  it("y el CSS de esas piezas ya no existe", () => {
    expect(css).not.toMatch(/\.people-stepper|\.input-money|\.cal-price|\.counter \.ctl|\.zone-input|\.zone-option|\.search-field\b/);
    // Un solo reinicio del campo de dentro (.bare-input), no uno por pieza.
    expect(css.match(/input:not\(\[type=checkbox\]\):not\(\[type=file\]\):not\(\[type=radio\]\)\{/g) ?? []).toHaveLength(0);
  });
});
