import { describe, expect, it } from "vitest";
import { BEACON_MAX_BYTES, pageType, parseBeacon, safePath } from "../../src/domain/telemetry";

describe("telemetría · tipo de página y ruta", () => {
  it("clasifica cada ruta de la app", () => {
    expect(pageType("/")).toBe("inicio");
    expect(pageType("/explorar")).toBe("explorar");
    expect(pageType("/explorar/filtros")).toBe("filtros");
    expect(pageType("/casa/CT-1015")).toBe("ficha");
    expect(pageType("/favoritos")).toBe("favoritos");
    expect(pageType("/cuenta")).toBe("cuenta");
    expect(pageType("/cuenta/codigo")).toBe("cuenta");
    expect(pageType("/ayuda")).toBe("ayuda");
    expect(pageType("/propietario/publicar/abc/3")).toBe("publicar");
    expect(pageType("/propietario/casas")).toBe("propietario");
    expect(pageType("/admin/anuncios/x")).toBe("admin");
    expect(pageType("/algo-raro")).toBe("otra");
  });

  it("guarda solo la ruta, sin consulta ni fragmento, con los uuid ocultos y acotada", () => {
    expect(safePath("/explorar?prov=Todas#pago=CT-1")).toBe("/explorar");
    expect(safePath("/propietario/casas/0b7c2c1e-3f0a-4b9e-9d7e-2a1b3c4d5e6f/enviada")).toBe("/propietario/casas/:id/enviada");
    expect(safePath("https://nueva.bnbtico.com/casa/CT-1015?x=1")).toBe("/casa/CT-1015");
    expect(safePath("/" + "a".repeat(500)).length).toBe(200);
  });
});

describe("telemetría · validación de balizas", () => {
  const base = { path: "/casa/CT-1015", build: "abc123" };

  it("acepta una métrica de web-vitals y deduce la página de la ruta", () => {
    const r = parseBeacon("vitals", JSON.stringify({ ...base, name: "LCP", value: 1234.5, rating: "good", id: "v5-1", navigationType: "navigate" }));
    expect(r).toEqual({ ok: true, row: { name: "LCP", value: 1234.5, rating: "good", metric_id: "v5-1", navigation_type: "navigate", page: "ficha", path: "/casa/CT-1015", build: "abc123" } });
  });

  it("rechaza métricas desconocidas, valores negativos o no numéricos", () => {
    expect(parseBeacon("vitals", JSON.stringify({ ...base, name: "FID", value: 1, id: "x" })).ok).toBe(false);
    expect(parseBeacon("vitals", JSON.stringify({ ...base, name: "CLS", value: -1, id: "x" })).ok).toBe(false);
    expect(parseBeacon("vitals", JSON.stringify({ ...base, name: "INP", value: "9", id: "x" })).ok).toBe(false);
  });

  it("acepta un error con pila y recorta lo largo", () => {
    const r = parseBeacon("errors", JSON.stringify({ ...base, kind: "error", message: "x".repeat(2000), stack: "at f (a.js:1:2)", source: "/assets/index.js", line: 1, col: 2 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.row as { message: string }).message).toHaveLength(500);
      expect(r.row).toMatchObject({ kind: "error", page: "ficha", line: 1, col: 2, stack: "at f (a.js:1:2)" });
    }
  });

  it("acepta los eventos de primera parte y exige casa válida en los de ficha", () => {
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "page_view" })).ok).toBe(true);
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "listing_view", listing: "CT-1015" }))).toEqual({
      ok: true,
      row: { name: "listing_view", listing_public_id: "CT-1015", page: "ficha", path: "/casa/CT-1015", build: "abc123" },
    });
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "whatsapp_tap", listing: "CT-1015" })).ok).toBe(true);
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "inquiry_created", listing: "CT-1015" }))).toEqual({
      ok: true,
      row: { name: "inquiry_created", listing_public_id: "CT-1015", page: "ficha", path: "/casa/CT-1015", build: "abc123" },
    });
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "inquiry_created" })).ok).toBe(false);
    // Revisión UX C4: el paso del asistente que se abre, con la casa y la ruta sin el id del borrador.
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "wizard_step", listing: "CT-1015", path: "/propietario/publicar/2f8c5a1e-0d6b-4c1e-9a7e-3b1c2d4e5f60/7" }))).toEqual({
      ok: true,
      row: { name: "wizard_step", listing_public_id: "CT-1015", page: "publicar", path: "/propietario/publicar/:id/7", build: "abc123" },
    });
    // Fase 6, ticket 01: «Escribir a bnbtico por WhatsApp» en Explorar, sin casa y sin el mensaje ni los filtros.
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "search_help_tap", path: "/explorar?prov=Todas&pool=1" }))).toEqual({
      ok: true,
      row: { name: "search_help_tap", page: "explorar", path: "/explorar", build: "abc123" },
    });
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "search_help_tap", path: "/explorar", text: "Hola", prov: "Limón" }))).toEqual({
      ok: true,
      row: { name: "search_help_tap", page: "explorar", path: "/explorar", build: "abc123" },
    });
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "listing_view", listing: "drop table" })).ok).toBe(false);
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "signup" })).ok).toBe(false);
  });

  it("rechaza JSON roto, cuerpos que no son objetos y los demasiado grandes", () => {
    expect(parseBeacon("events", "{no es json")).toEqual({ ok: false, status: 400 });
    expect(parseBeacon("events", "[1,2]")).toEqual({ ok: false, status: 400 });
    expect(parseBeacon("events", JSON.stringify({ ...base, name: "page_view", pad: "x".repeat(BEACON_MAX_BYTES) }))).toEqual({ ok: false, status: 413 });
  });
});
