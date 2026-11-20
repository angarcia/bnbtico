// Estructura y contenido comunes (historia 07, paso 5): un texto y un tono por estado y contexto, las etiquetas, avisos,
// contadores y esqueletos con su semántica, y ninguna pantalla vuelve a escribir a mano las clases de estos componentes.
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

// Que ninguna pantalla escriba a mano estas clases, y los restos retirados, lo vigila tests/unit/consistencia.test.ts.
