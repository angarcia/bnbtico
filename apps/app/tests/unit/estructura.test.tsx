// Estructura y contenido comunes (historia 07, paso 5): un texto y un tono por estado y contexto, las etiquetas, avisos,
// contadores y esqueletos con su semántica, y ninguna pantalla vuelve a escribir a mano las clases de estos componentes.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ListingStatus } from "../../src/domain/listing";
import { houseLabel } from "../../src/domain/admin-houses";
import { STATUS_TEXTS, editStatusLabel, holdLabel, statusLabel } from "../../src/domain/status-label";
import { CountBadge, EmptyState, LoadError, Notice, Skeleton, StatusTag } from "../../src/shared/structure";

const STATUSES: ListingStatus[] = ["draft", "review", "changes", "rejected", "payment_due", "active", "inactive"];
const classOf = (html: string) => /class="([^"]*)"/.exec(html)?.[1]?.split(" ") ?? [];

describe("domain/status-label: un solo texto por estado", () => {
  it("cada estado tiene un texto y un tono, sin clases CSS", () => {
    for (const status of STATUSES) {
      const label = statusLabel(status);
      expect(label.text.length, status).toBeGreaterThan(0);
      expect(Object.keys(label).sort()).toEqual(["text", "tone"]);
      expect(label.tone).not.toMatch(/badge|state-/);
    }
  });

  it("el propietario lee los textos de siempre", () => {
    expect(STATUSES.map((s) => statusLabel(s).text)).toEqual(["Borrador", "En revisión", "Cambios pedidos", "Rechazada", "Pendiente de pago", "Activa", "Inactiva"]);
  });

  it("la lista «Casas» del admin dice lo mismo que el resto (decisión de Ana del 2026-11-20): sin textos propios", () => {
    expect(Object.keys(STATUS_TEXTS).sort()).toEqual([...STATUSES].sort());
    expect(houseLabel({ status: "draft", hold: null })).toEqual({ text: "Borrador", tone: "draft" });
    expect(houseLabel({ status: "payment_due", hold: null })).toEqual({ text: "Pendiente de pago", tone: "pay" });
  });

  it("la retención y la edición tienen su texto según dónde se lean", () => {
    expect(holdLabel("paused", "photo")).toEqual({ text: "Pausada por 3bstays", tone: "review" });
    expect(holdLabel("blocked", "row")).toEqual({ text: "Bloqueada", tone: "bad" });
    expect(editStatusLabel("review", "card").text).toBe("Cambios en revisión");
    expect(editStatusLabel("review", "field").text).toBe("En revisión");
    expect(editStatusLabel("changes", "field")).toEqual({ text: "Cambios pedidos", tone: "changes" });
  });
});

describe("StatusTag", () => {
  it("en una fila: la píldora redonda con el tono de su estado", () => {
    expect(classOf(renderToString(<StatusTag label={statusLabel("active")} />))).toEqual(["badge", "badge-ok"]);
    expect(classOf(renderToString(<StatusTag label={statusLabel("payment_due")} tight />))).toEqual(["badge", "badge-sun", "badge-tight"]);
    expect(renderToString(<StatusTag label={statusLabel("payment_due")} />)).toContain(">Pendiente de pago<");
    // El borrador en arena, también en una fila (como sobre la foto).
    expect(classOf(renderToString(<StatusTag label={statusLabel("draft")} />))).toEqual(["badge"]);
  });
  it("sobre la foto y en la fila de un dato", () => {
    expect(classOf(renderToString(<StatusTag placement="photo" label={statusLabel("draft")} />))).toEqual(["state", "state-draft"]);
    expect(classOf(renderToString(<StatusTag placement="field" label={editStatusLabel("changes", "field")} />))).toEqual(["tag-rev", "is-changes"]);
    expect(classOf(renderToString(<StatusTag placement="field" label={editStatusLabel("review", "field")} />))).toEqual(["tag-rev", "is-pending"]);
  });
});

describe("Notice y LoadError", () => {
  it("el error siempre con role=alert, sin tener que elegirlo; los demás sin rol salvo `announce`", () => {
    expect(renderToString(<Notice tone="error">Falló</Notice>)).toMatch(/^<p class="note" role="alert">Falló<\/p>$/);
    expect(renderToString(<Notice tone="sun">Ojo</Notice>)).toBe('<p class="note note-sun">Ojo</p>');
    expect(renderToString(<Notice announce>Guardado</Notice>)).toContain('role="status"');
    expect(renderToString(<Notice tone="review" inline small>Le pedimos cambios</Notice>)).toBe('<p class="note-review small">Le pedimos cambios</p>');
  });
  it("el error de carga: rojo, con role=alert, el texto de siempre y «Reintentar»", () => {
    const html = renderToString(<LoadError onRetry={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.");
    expect(html).toMatch(/<button[^>]*>Reintentar<\/button>/);
  });
});

describe("CountBadge, Skeleton y EmptyState", () => {
  it("un solo contador; con 0, nada", () => {
    expect(renderToString(<CountBadge n={0} />)).toBe("");
    expect(classOf(renderToString(<CountBadge n={3} />))).toEqual(["count-badge", "count-tab", "num"]);
    expect(classOf(renderToString(<CountBadge n={2} placement="filters" />))).toEqual(["count-badge", "count-filters", "num"]);
  });
  it("el esqueleto se anuncia con aria-busy y su aria-label; la rejilla sin etiqueta queda oculta", () => {
    const row = renderToString(<Skeleton shape="row" label="Cargando sus casas" />);
    expect(row).toContain('aria-busy="true"');
    expect(row).toContain('aria-label="Cargando sus casas"');
    expect(row.match(/class="sk /g)).toHaveLength(2);
    expect(renderToString(<Skeleton shape="calendar" label="Cargando su calendario" />)).not.toContain('class="sk ');
    const grid = renderToString(<Skeleton shape="grid" count={2} />);
    expect(grid).toContain('aria-hidden="true"');
    expect(grid.match(/class="listing-card"/g)).toHaveLength(2);
  });
  it("estado vacío en tarjeta, con su título, o sin caja", () => {
    expect(renderToString(<EmptyState title="Nada" text={<p>Vacío</p>} />)).toBe('<section class="card stack"><h3>Nada</h3><p>Vacío</p></section>');
    expect(renderToString(<EmptyState framed={false} placement="fav-empty" text={<p>Vacío</p>} />)).toBe('<section class="stack fav-empty"><p>Vacío</p></section>');
  });
});

// ---------- Consistencia: las pantallas no escriben estas clases ----------

const SRC = new URL("../../src/", import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx$/.test(e.name) ? [p] : [];
  });
}

/** Las clases que solo pintan los componentes de shared/structure.tsx, shared/card.tsx, shared/closed-field.tsx y ScreenHeader (client/chrome.tsx). */
const OWNED = new Set([
  "card", "card-solid", "card-arena", "card-sun", "card-soft", "note", "note-solid", "note-arena", "note-sun", "note-review", "note-plain",
  "note-col", "list", "list-item", "list-item-sun", "badge", "badge-ok", "badge-sun", "badge-review", "badge-mute", "badge-bad", "badge-new",
  "badge-admin", "badge-tight", "badge-count", "state", "state-ok", "state-pay", "state-review", "state-draft", "state-off", "state-bad",
  "tag-rev", "skeleton", "owner-skeleton", "account-skeleton", "sub-skeleton", "cal-skeleton", "count-badge", "nav-count",
  "house-inquiries-count", "search-fold", "picker-pill", "date-box", "header-flow", "header-root", "placeholder-card", "fav-empty",
]);
/** archivo (relativo a src/) → clases que puede escribir, con su motivo. */
const ALLOW: Record<string, Set<string>> = {
  "shared/structure.tsx": OWNED, // los componentes
  "shared/card.tsx": OWNED,
  "shared/closed-field.tsx": OWNED,
  "client/chrome.tsx": new Set(["header-flow", "header-root"]), // ScreenHeader
  // La ficha SSR no puede usar ScreenHeader (lleva Link del router): su cabecera de estado se queda escrita aquí.
  "shared/status-pages.tsx": new Set(["header-root"]),
};

/** Las clases de cada `className=…` de un archivo (literales, plantillas y ramas de un ternario). */
function classTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g)) {
    const raw = m[1] ?? [...(m[2] ?? "").matchAll(/"([^"]*)"|`([^`]*)`/g)].map((x) => (x[1] ?? x[2] ?? "").replace(/\$\{[^}]*\}/g, " ")).join(" ");
    out.push(...raw.split(/\s+/).filter(Boolean));
  }
  return out;
}

describe("consistencia: ninguna pantalla escribe a mano las clases de la estructura común", () => {
  it("ni tarjetas, avisos, filas, etiquetas, esqueletos, contadores, campos cerrados ni cabeceras", () => {
    const offenders: string[] = [];
    for (const root of ["client", "shared"])
      for (const file of files(join(SRC, root))) {
        const rel = relative(SRC, file);
        const allowed = ALLOW[rel] ?? new Set<string>();
        for (const cls of classTokens(readFileSync(file, "utf8"))) if (OWNED.has(cls) && !allowed.has(cls)) offenders.push(`${rel}: ${cls}`);
      }
    expect(offenders).toEqual([]);
  });

  it("los textos de escritorio están en el DOM, no en `content:` del CSS (D6/D7)", () => {
    const desktop = readFileSync(join(SRC, "styles/13-escritorio.css"), "utf8");
    expect([...desktop.matchAll(/content:\s*"([^"]+)"/g)].map((m) => m[1])).toEqual([]);
  });

  it("sin las variables y clases retiradas", () => {
    const css = readdirSync(join(SRC, "styles")).map((f) => readFileSync(join(SRC, "styles", f), "utf8")).join("\n");
    for (const dead of ["--ok:", "--warn:", "--cal-free", "--selection-ink", "--float-r-bar", ".soon", ".nav-count", ".house-inquiries-count", ".badge-count", ".card-arena", ".note-arena", ".note-plain", ".badge-warn", ".badge-sel"])
      expect(css, dead).not.toContain(dead);
  });
});
