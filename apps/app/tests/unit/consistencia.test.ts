// Consistencia visual (historia 07, paso 6): las pantallas usan los tokens y los componentes comunes.
//
// 1. CSS: fuera de styles/01-base.css (donde viven los tokens, en :root) y de los bloques :root, ningún color hex o rgb(),
//    border-radius en px, z-index numérico, font-size en px ni sombra que no sea un token.
// 2. TSX: ninguna pantalla escribe a mano la clase de un componente común (botón, hoja, ventana, campo, chip, segmento,
//    contador, tarjeta, aviso, etiqueta o cabecera): esa clase solo la pinta el archivo del componente.
// 3. TSX: ningún `style={…}` con colores, fondos, bordes, radios o sombras.
//
// Cada fallo dice archivo:línea, qué encontró y qué usar. Para añadir una excepción: una entrada en CSS_EXCEPTIONS o en
// CLASS_EXCEPTIONS, con su motivo en `why` (una línea). Ver docs/componentes.md, «Prueba de consistencia y sus excepciones».
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url).pathname;
const TOKENS_FILE = "styles/01-base.css";

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p, ext) : ext.test(e.name) ? [p] : [];
  });
}
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;
/** Borra comentarios y bloques :root conservando los saltos de línea (las líneas de los mensajes siguen siendo las reales). */
const blank = (s: string) => s.replace(/[^\n]/g, " ");

// ---------- 1. CSS ----------

type CssRule = "color" | "radius" | "z-index" | "font-size" | "shadow";
const HINT: Record<CssRule, string> = {
  color: "Use un color de :root (--fg, --muted, --bg, --surface, --on-overlay, --overlay…)",
  radius: "Use --r-control, --r, --r-thumb, --r-tile, --r-sheet, --r-pill o --r-tag",
  "z-index": "Use la escala --z-* (--z-float, --z-bar, --z-banner, --z-panel, --z-topbar, --z-overlay, --z-toast)",
  "font-size": "Use la escala --fs-* (--fs-eyebrow 13 … --fs-h1 34)",
  shadow: "Use --shadow, --shadow-float, --float-shadow o --shadow-action",
};

interface CssException {
  /** Archivo relativo a src/. */
  file: string;
  /** El selector de la regla (prueba contra el selector entero, sin espacios de sobra). */
  selector: RegExp;
  rule: CssRule;
  why: string;
}

const CSS_EXCEPTIONS: CssException[] = [
  // Tamaños de letra de un solo uso, fuera de la escala (títulos de pantalla y de tarjeta, cifras grandes y leyendas).
  { file: "styles/02-app.css", selector: /^\.publish-form h2$/, rule: "font-size", why: "título de etapa del asistente (23 px), de un solo uso" },
  { file: "styles/02-app.css", selector: /^\.price-disclaimer$/, rule: "font-size", why: "letra legal del precio orientativo de la ficha (12 px)" },
  { file: "styles/03-casas.css", selector: /^(?:\.listing-title|\.description-screen h2)$/, rule: "font-size", why: "título de la ficha a 28 px para que quepa a 320 px (decisiones.md)" },
  { file: "styles/03-casas.css", selector: /^\.avatar$/, rule: "font-size", why: "iniciales del avatar (22 px)" },
  { file: "styles/04-explorar.css", selector: /^(?:\.map-card h2|\.search-card-title|\.range-title)$/, rule: "font-size", why: "títulos de un solo uso del mapa y de la búsqueda (19 y 26 px)" },
  { file: "styles/04-explorar.css", selector: /leaflet-control-attribution$/, rule: "font-size", why: "atribución de Leaflet (11 px)" },
  { file: "styles/05-cuenta-propietario.css", selector: /^(?:\.flow-title|\.account-name|\.inquiry-name|\.sub-house-title)$/, rule: "font-size", why: "títulos de un solo uso de Ingresar, Cuenta, Consultas y la suscripción" },
  { file: "styles/05-cuenta-propietario.css", selector: /^(?:\.activity-figures b|\.activity-figures\.lg b|\.sub-price b)$/, rule: "font-size", why: "cifras grandes de Actividad y de la suscripción" },
  { file: "styles/06-publicar.css", selector: /^(?:\.stage-summary h2|\.queue-title)$/, rule: "font-size", why: "título de etapa del asistente y de la cola del admin" },
  { file: "styles/09-calendario.css", selector: /^\.month-grid \.day-sub(?:\.is-long)?$/, rule: "font-size", why: "precio dentro de cada día del calendario (11 y 12 px)" },
  { file: "styles/09-calendario.css", selector: /^(?:\.header-root:has\(\.house-picker\) h1|\.sheet-picker \.sheet-head h2|\.cal-title|\.cal-month-title)$/, rule: "font-size", why: "títulos del Calendario y del selector de casa" },
  { file: "styles/10-ajustes.css", selector: /^\.how-it-works summary::after$/, rule: "font-size", why: "el signo +/− del desplegable «Cómo funciona»" },
  { file: "client/screens/que-es-3bstays.css", selector: /^\.about-(?:guest|owner)/, rule: "font-size", why: "títulos de la pantalla «Qué es 3bstays»" },
  // Blancos y sombras sobre las fotos y el mapa: tienen que verse igual en los dos temas.
  { file: "styles/03-casas.css", selector: /^\.photo-dots i(?:\.on)?$/, rule: "color", why: "puntitos blancos sobre la foto" },
  { file: "styles/03-casas.css", selector: /^\.photo-dots i$/, rule: "shadow", why: "sombra de los puntitos sobre la foto" },
  { file: "styles/03-casas.css", selector: /^\.heart-card$/, rule: "color", why: "corazón blanco sobre la foto" },
  { file: "styles/03-casas.css", selector: /^\.heart-card svg$/, rule: "shadow", why: "sombra del corazón sobre la foto" },
  { file: "styles/03-casas.css", selector: /^\.pin-icon span$/, rule: "shadow", why: "sombra del pin del mapa" },
  { file: "styles/05-cuenta-propietario.css", selector: /^\.state$/, rule: "shadow", why: "sombra de la etiqueta de estado sobre la foto" },
  { file: "styles/04-explorar.css", selector: /^\.map-price(?:\.is-selected)?$/, rule: "shadow", why: "sombra de los precios sobre el mapa" },
  // Leaflet, el QR, la máscara y el aviso de girar.
  { file: "styles/03-casas.css", selector: /^\.map-box$/, rule: "color", why: "fondo del mapa mientras cargan las teselas (Leaflet)" },
  { file: "styles/06-publicar.css", selector: /^\.map-(?:hint|locate)$/, rule: "z-index", why: "controles por encima de los paneles de Leaflet (500)" },
  { file: "styles/10-ajustes.css", selector: /^(?:\.place-search \.zone-pop|\.loc-map > \.place-search)$/, rule: "z-index", why: "buscador sobre el mapa de Leaflet (600/1000)" },
  { file: "styles/10-ajustes.css", selector: /^\.zone-pop$/, rule: "z-index", why: "lista de sugerencias sobre el formulario del paso 2" },
  { file: "styles/05-cuenta-propietario.css", selector: /^\.totp-qr$/, rule: "color", why: "el QR necesita fondo blanco para leerse, también en oscuro" },
  { file: "styles/03-casas.css", selector: /^\.listing-description\.is-clamped$/, rule: "color", why: "máscara de la descripción: #000 es la opacidad, no un color" },
  { file: "styles/12-orientacion.css", selector: /^\.rotate-notice$/, rule: "z-index", why: "aviso de girar el teléfono, por encima de todo" },
  // Sombras de un solo uso de piezas que flotan.
  { file: "styles/07-contacto.css", selector: /^\.sheet$/, rule: "shadow", why: "sombra de la hoja hacia arriba" },
  { file: "styles/09-calendario.css", selector: /^\.cal-panel$/, rule: "shadow", why: "sombra del panel de los días hacia arriba" },
  { file: "styles/13-escritorio.css", selector: /currency-switch button\[aria-pressed="true"\]$/, rule: "shadow", why: "relieve de la moneda elegida en la barra de escritorio" },
  // `box-shadow` que no es una sombra: anillos, rayas y bandas con colores de :root.
  { file: "styles/05-cuenta-propietario.css", selector: /^\.sub-house\.is-target$/, rule: "shadow", why: "anillo verde de la casa resaltada con #pago=" },
  { file: "styles/07-contacto.css", selector: /\.range-weekdays$/, rule: "shadow", why: "raya del fondo bajo los días de la semana fijos" },
  { file: "styles/09-calendario.css", selector: /(?:\.day\.in-range|\.day\.range-end\.is-(?:start|last)|\.day\.in-range:(?:first|last)-child)$/, rule: "shadow", why: "banda del rango elegido que une los días" },
  { file: "styles/13-escritorio.css", selector: /(?:\.desktop-nav|\.site-top-bar)::before$/, rule: "shadow", why: "el fondo de la barra de escritorio extendido a todo el ancho" },
  // Radios de dibujo y redondos.
  { file: "styles/07-contacto.css", selector: /^\.sheet \.grabber$/, rule: "radius", why: "asa de la hoja (2 px)" },
  { file: "styles/08-movimiento.css", selector: /^\.upload-bar$/, rule: "radius", why: "barra de subida de las fotos (2 px)" },
  { file: "styles/09-calendario.css", selector: /^\.month-legend \.swatch$/, rule: "radius", why: "muestra de color de la leyenda (3 px)" },
  { file: "styles/09-calendario.css", selector: /^\.month-grid \.day\.range-end\.is-(?:start|last)$/, rule: "radius", why: "solo las esquinas exteriores del extremo del rango" },
  { file: "styles/03-casas.css", selector: /^\.avatar$/, rule: "radius", why: "avatar redondo de una persona" },
  { file: "styles/05-cuenta-propietario.css", selector: /^\.inquiry-avatar$/, rule: "radius", why: "avatar redondo de una consulta" },
  { file: "styles/13-escritorio.css", selector: /\.tile$/, rule: "radius", why: "cifras de Mis casas y del admin en píldora (escritorio, revisión 2026-11-13)" },
];
/** z-index -1 a 3: orden dentro del propio componente (el ::before detrás, la foto levantada, la fila fija del calendario);
 *  no compite con las capas de la escala --z-*. */
const LOCAL_Z = new Set(["-1", "1", "2", "3"]);

interface CssFinding {
  file: string;
  line: number;
  selector: string;
  rule: CssRule;
  decl: string;
}

function cssFindings(): CssFinding[] {
  const sources = [...files(join(SRC, "styles"), /\.css$/), ...files(join(SRC, "client"), /\.css$/)].filter((f) => relative(SRC, f) !== TOKENS_FILE);
  const out: CssFinding[] = [];
  for (const path of sources) {
    const file = relative(SRC, path);
    const text = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, blank).replace(/:root[^{]*\{[^}]*\}/g, blank);
    for (const rule of text.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
      const selector = rule[1]!.trim().replace(/\s+/g, " ");
      const bodyStart = rule.index! + rule[0].indexOf("{") + 1;
      for (const d of rule[2]!.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
        const [prop, rawValue] = [d[1]!, d[2]!.trim()];
        if (prop.startsWith("--")) continue;
        const value = rawValue.replace(/url\([^)]*\)/g, "");
        // Una sombra (con o sin color propio) cuenta como sombra; el resto de colores sueltos, como color.
        const found: CssRule | null =
          /^(?:box|text)-shadow$/.test(prop) ? (/^(?:none|inherit|var\(--[\w-]+\))$/.test(value) ? null : "shadow")
          : prop === "filter" && /drop-shadow/.test(value) ? "shadow"
          : /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(value) ? "color"
          : prop === "border-radius" && /\d+px/.test(value) ? "radius"
          : prop === "z-index" && /^-?\d+$/.test(value) ? (LOCAL_Z.has(value) ? null : "z-index")
          : prop === "font-size" && /\d+px/.test(value) ? "font-size"
          : null;
        if (found) out.push({ file, line: lineOf(text, bodyStart + d.index!), selector, rule: found, decl: `${prop}: ${rawValue}` });
      }
    }
  }
  return out;
}

const excused = (f: CssFinding) => CSS_EXCEPTIONS.some((e) => e.file === f.file && e.rule === f.rule && e.selector.test(f.selector));

describe("CSS: valores sueltos fuera de los tokens", () => {
  it("ningún color, radio, capa, tamaño de letra ni sombra suelto fuera de 01-base.css (o de una excepción)", () => {
    const offenders = cssFindings()
      .filter((f) => !excused(f))
      .map((f) => `${f.file}:${f.line} «${f.selector}» → ${f.decl}. ${HINT[f.rule]}.`);
    expect(offenders, `Valores sueltos:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("cada excepción sigue haciendo falta (si ya no coincide con nada, se quita)", () => {
    const findings = cssFindings();
    const unused = CSS_EXCEPTIONS.filter((e) => !findings.some((f) => e.file === f.file && e.rule === f.rule && e.selector.test(f.selector)));
    expect(unused.map((e) => `${e.file} ${e.selector} (${e.rule}): ${e.why}`)).toEqual([]);
  });
});

// ---------- 2. Clases de componentes en el TSX ----------

/** Componente → sus clases y dónde viven (solo esos archivos las escriben). */
const COMPONENTS: { name: string; use: string; owners: string[]; classes: RegExp }[] = [
  { name: "botón", use: "Button, ButtonLink, TextButton o IconButton (shared/button.tsx)", owners: ["shared/button.tsx"], classes: /^(?:btn(?:-[\w-]+)?|icon-btn)$/ },
  { name: "hoja o ventana", use: "Sheet, Dialog, FullScreen o ConfirmSheet (shared/overlay.tsx)", owners: ["shared/overlay.tsx"], classes: /^(?:sheet|sheet-head|sheet-backdrop|dialog|dialog-head|dialog-body|dialog-foot)$/ },
  { name: "campo", use: "Field, TextInput, AffixInput, SearchInput, StickyActions (shared/field.tsx) o CodeInput", owners: ["shared/field.tsx", "client/code-input.tsx"], classes: /^(?:field|field-compact|input-money|cal-price|zone-input|search-field|sticky-actions|sticky-spacer|code-boxes|code-input)$/ },
  { name: "chip o segmento", use: "ChoiceChips, Segmented (shared/choice.tsx) o ChoiceCards", owners: ["shared/choice.tsx", "client/publish/wizard-parts.tsx"], classes: /^(?:chip|chip-sm|seg|seg-fill|choice)$/ },
  { name: "contador −/+", use: "Stepper o CounterRow (shared/stepper.tsx)", owners: ["shared/stepper.tsx"], classes: /^(?:stepper|counter|people-stepper|ctl)$/ },
  { name: "tarjeta o fila", use: "Card, List, ListRow… (shared/card.tsx)", owners: ["shared/card.tsx", "shared/structure.tsx"], classes: /^(?:card|card-solid|card-arena|card-sun|card-soft|list|list-item|list-item-sun|placeholder-card|fav-empty)$/ },
  { name: "aviso", use: "Notice o LoadError (shared/structure.tsx)", owners: ["shared/structure.tsx"], classes: /^(?:note|note-[\w-]+)$/ },
  { name: "etiqueta o contador", use: "StatusTag o CountBadge (shared/structure.tsx)", owners: ["shared/structure.tsx"], classes: /^(?:badge|badge-[\w-]+|state|state-[\w-]+|tag-rev|count-badge|nav-count|house-inquiries-count)$/ },
  { name: "esqueleto", use: "Skeleton (shared/structure.tsx)", owners: ["shared/structure.tsx"], classes: /^(?:skeleton|owner-skeleton|account-skeleton|sub-skeleton|cal-skeleton)$/ },
  { name: "campo cerrado", use: "ClosedField (shared/closed-field.tsx)", owners: ["shared/closed-field.tsx"], classes: /^(?:search-fold|picker-pill|date-box)$/ },
  { name: "cabecera", use: "ScreenHeader (client/chrome.tsx)", owners: ["client/chrome.tsx"], classes: /^(?:header-flow|header-root)$/ },
];

/** archivo → clase → motivo. */
const CLASS_EXCEPTIONS: Record<string, Record<string, string>> = {
  "client/screens/explorar.tsx": { chip: "el botón Filtros flotante de Explorar (chip de navegación, no de elección)" },
  "client/screens/admin-casas.tsx": { chip: "chips de filtro de Casas: enlaces, no elección", "chip-sm": "chips de filtro de Casas, pequeños" },
  "client/screens/admin-anuncios.tsx": { chip: "pestañas de la cola en chip: enlaces, no elección", "chip-sm": "pestañas de la cola, pequeñas" },
  "client/screens/actividad.tsx": { "btn-link": "«Abrir WhatsApp» de una consulta: texto propio (inquiry-wa)" },
  "client/card-whatsapp.tsx": { "sheet-backdrop": "fondo atenuado mientras llega el trozo de la hoja de contacto" },
  "client/screens/calendario.tsx": { "sheet-backdrop": "fondo atenuado mientras llega el trozo de «Pausar la casa» y «Marcar una reserva»" },
  "shared/listing-page.tsx": { "sheet-backdrop": "fondo atenuado mientras llega el trozo de la hoja de contacto (ficha SSR)" },
  "shared/contact-sheet.tsx": { sheet: "la hoja de contacto en línea en la ficha de escritorio", "sheet-head": "cabecera de la hoja en línea" },
  "shared/status-pages.tsx": { "header-root": "páginas de estado de la ficha SSR: sin router, no pueden usar ScreenHeader" },
  "client/publish/zone-select.tsx": { field: "caja del selector de zona del paso 2 (lleva un HousePicker, no un control de Field)" },
};

/** Las clases de cada `className=…` (literales, plantillas y ramas de un ternario), con su línea. */
function classTokens(text: string): { cls: string; line: number }[] {
  const out: { cls: string; line: number }[] = [];
  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g)) {
    const raw = m[1] ?? [...(m[2] ?? "").matchAll(/"([^"]*)"|`([^`]*)`/g)].map((x) => (x[1] ?? x[2] ?? "").replace(/\$\{[^}]*\}/g, " ")).join(" ");
    for (const cls of raw.split(/\s+/).filter(Boolean)) out.push({ cls, line: lineOf(text, m.index!) });
  }
  return out;
}

const tsxSources = () => ["client", "shared"].flatMap((root) => files(join(SRC, root), /\.tsx$/));

describe("TSX: las pantallas usan los componentes comunes", () => {
  it("ninguna pantalla escribe a mano la clase de un componente (botón, hoja, ventana, campo, chip, segmento, contador, tarjeta, aviso, etiqueta, cabecera)", () => {
    const offenders: string[] = [];
    for (const path of tsxSources()) {
      const file = relative(SRC, path);
      for (const { cls, line } of classTokens(readFileSync(path, "utf8"))) {
        const c = COMPONENTS.find((k) => k.classes.test(cls));
        if (!c || c.owners.includes(file) || CLASS_EXCEPTIONS[file]?.[cls]) continue;
        offenders.push(`${file}:${line} className «${cls}» (${c.name}): use ${c.use}.`);
      }
    }
    expect(offenders, `Clases de componentes escritas a mano:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("cada excepción de clase sigue haciendo falta", () => {
    const unused = Object.entries(CLASS_EXCEPTIONS).flatMap(([file, classes]) => {
      const used = new Set(classTokens(readFileSync(join(SRC, file), "utf8")).map((t) => t.cls));
      return Object.keys(classes).filter((cls) => !used.has(cls)).map((cls) => `${file}: ${cls}`);
    });
    expect(unused).toEqual([]);
  });

  it("ningún `style={…}` con colores, fondos, bordes, radios o sombras", () => {
    const offenders: string[] = [];
    for (const path of tsxSources()) {
      const text = readFileSync(path, "utf8");
      for (const m of text.matchAll(/style=\{\{([^}]*)\}\}/g))
        if (/\b(?:color|background\w*|border\w*|borderRadius|boxShadow|outline\w*|fill|stroke)\s*:/.test(m[1]!))
          offenders.push(`${relative(SRC, path)}:${lineOf(text, m.index!)} ${m[0].slice(0, 80)}: use una clase del componente con tokens (la CSP tampoco admite estilos en línea).`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

// ---------- Restos que no deben volver ----------

describe("restos retirados", () => {
  it("los textos de escritorio están en el DOM, no en `content:` del CSS (D6/D7)", () => {
    const desktop = readFileSync(join(SRC, "styles/13-escritorio.css"), "utf8");
    expect([...desktop.matchAll(/content:\s*"([^"]+)"/g)].map((m) => m[1])).toEqual([]);
  });

  it("sin las variables y clases retiradas", () => {
    const css = files(join(SRC, "styles"), /\.css$/).map((f) => readFileSync(f, "utf8")).join("\n");
    for (const dead of ["--ok:", "--warn:", "--cal-free", "--selection-ink", "--float-r-bar", ".soon", ".nav-count", ".house-inquiries-count", ".badge-count", ".card-arena", ".note-arena", ".note-plain", ".badge-warn", ".badge-sel"])
      expect(css, dead).not.toContain(dead);
  });
});
