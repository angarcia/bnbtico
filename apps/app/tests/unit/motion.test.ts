// Movimiento (client/motion.ts): qué transición toca en cada navegación, a qué tarjeta va la foto que vuela, dirección de
// los pasos del asistente y cómo aparecen las tarjetas de Explorar.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterRender, revealClass, stepEnter, transitionTypes, viewTransitions } from "../../src/client/motion";

const at = (pathname: string, search = "") => ({ pathname, search });

describe("transitionTypes", () => {
  it("Explorar → ficha abre y ficha → Explorar cierra", () => {
    expect(transitionTypes({ fromLocation: at("/explorar"), toLocation: at("/casa/CT-1001") }, false)).toEqual(["listing-open"]);
    expect(transitionTypes({ fromLocation: at("/casa/CT-1001"), toLocation: at("/explorar") }, false)).toEqual(["listing-close"]);
  });
  it("Explorar con búsqueda en la URL cuenta igual (la búsqueda no está en pathname)", () => {
    expect(transitionTypes({ fromLocation: at("/explorar", "?prov=Todas&min=44000"), toLocation: at("/casa/CT-1001") }, false)).toEqual(["listing-open"]);
    expect(transitionTypes({ fromLocation: at("/casa/CT-1001"), toLocation: at("/explorar", "?prov=Todas") }, false)).toEqual(["listing-close"]);
  });
  it("con movimiento reducido, ninguna", () => {
    expect(transitionTypes({ fromLocation: at("/explorar"), toLocation: at("/casa/CT-1001") }, true)).toBe(false);
    expect(transitionTypes({ fromLocation: at("/casa/CT-1001"), toLocation: at("/explorar") }, true)).toBe(false);
  });
  it("sin ubicación anterior (primera carga), ninguna", () => {
    expect(transitionTypes({ toLocation: at("/casa/CT-1001") }, false)).toBe(false);
    expect(transitionTypes({ toLocation: at("/explorar") }, false)).toBe(false);
  });
  it("el resto de rutas son instantáneas", () => {
    const none = [
      ["/explorar", "/favoritos"],
      ["/explorar", "/explorar"],
      ["/favoritos", "/casa/CT-1001"],
      ["/casa/CT-1001", "/cuenta"],
      ["/casa/CT-1001", "/casa/CT-1002"],
      ["/explorar", "/propietario/casas/abc"],
      ["/propietario", "/explorar"],
    ];
    for (const [from, to] of none) expect(transitionTypes({ fromLocation: at(from!), toLocation: at(to!) }, false), `${from} → ${to}`).toBe(false);
  });
});

// Un DOM mínimo: tarjetas `a.listing-card[href]` con su `.photo`.
interface FakePhoto {
  style: { viewTransitionName: string };
}
function cards(...ids: string[]) {
  const list = ids.map((id) => ({ href: `/casa/${id}`, photo: { style: { viewTransitionName: "" } } as FakePhoto }));
  const doc = {
    querySelectorAll: (sel: string) => {
      if (sel === ".listing-card .photo") return list.map((c) => c.photo);
      if (sel === "a.listing-card") return list.map((c) => ({ getAttribute: (n: string) => (n === "href" ? c.href : null), querySelector: () => c.photo }));
      throw new Error(`selector inesperado: ${sel}`);
    },
  };
  vi.stubGlobal("document", doc);
  return Object.fromEntries(ids.map((id, i) => [id, list[i]!.photo])) as Record<string, FakePhoto>;
}
const named = (photos: Record<string, FakePhoto>) => Object.entries(photos).filter(([, p]) => p.style.viewTransitionName === "listing-photo").map(([id]) => id);
const event = (from: string | undefined, to: string) => ({ fromLocation: from ? at(from) : undefined, toLocation: at(to) });

describe("viewTransitions: la foto compartida", () => {
  let reduced = false;
  beforeEach(() => {
    reduced = false;
    vi.stubGlobal("CSS", { supports: () => true });
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  });
  afterEach(() => {
    afterRender(event("/", "/"));
    vi.unstubAllGlobals();
  });
  const types = () => {
    const vt = viewTransitions();
    if (!vt) throw new Error("sin View Transitions");
    return vt.types;
  };

  it("sin tipos de transición en el navegador no se pide ninguna", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    expect(viewTransitions()).toBe(false);
  });

  it("al abrir, solo la tarjeta de esa casa lleva el nombre (en el estado viejo, antes de la captura)", () => {
    const p = cards("CT-1", "CT-2", "CT-3");
    p["CT-3"]!.style.viewTransitionName = "listing-photo";
    expect(types()(event("/explorar", "/casa/CT-2"))).toEqual(["listing-open"]);
    expect(named(p)).toEqual(["CT-2"]);
  });

  it("al volver, la tarjeta de la casa de la que se vuelve recibe el nombre cuando Explorar ya está pintada", () => {
    cards();
    expect(types()(event("/explorar", "/casa/CT-2"))).toEqual(["listing-open"]);
    const p = cards("CT-1", "CT-2");
    expect(types()(event("/casa/CT-2", "/explorar"))).toEqual(["listing-close"]);
    expect(named(p), "las tarjetas nuevas aún no existen al pedir la transición").toEqual([]);
    afterRender(event("/casa/CT-2", "/explorar"));
    expect(named(p)).toEqual(["CT-2"]);
  });

  it("el nombre solo vale para la vuelta inmediata: otro montaje de Explorar no lo recupera", () => {
    cards("CT-1", "CT-2");
    types()(event("/casa/CT-2", "/explorar"));
    afterRender(event("/casa/CT-2", "/explorar"));
    // Explorar → Favoritos (instantáneo) → Explorar: tarjetas nuevas, ninguna con nombre.
    types()(event("/explorar", "/favoritos"));
    afterRender(event("/explorar", "/favoritos"));
    const p = cards("CT-1", "CT-2");
    types()(event("/favoritos", "/explorar"));
    afterRender(event("/favoritos", "/explorar"));
    expect(named(p)).toEqual([]);
  });

  it("si la vuelta no llega a pintarse, la siguiente navegación olvida la casa", () => {
    cards("CT-1", "CT-2");
    types()(event("/casa/CT-2", "/explorar"));
    // La navegación se sustituye por otra antes de pintar (sin onRendered de la vuelta).
    types()(event("/casa/CT-2", "/cuenta"));
    const p = cards("CT-1", "CT-2");
    afterRender(event("/cuenta", "/explorar"));
    expect(named(p)).toEqual([]);
  });

  it("una ficha distinta nunca recibe la foto de otra tarjeta", () => {
    const p = cards("CT-1", "CT-2");
    types()(event("/explorar", "/casa/CT-1"));
    expect(named(p)).toEqual(["CT-1"]);
    types()(event("/casa/CT-1", "/explorar"));
    afterRender(event("/casa/CT-1", "/explorar"));
    expect(named(p)).toEqual(["CT-1"]);
    types()(event("/explorar", "/casa/CT-2"));
    expect(named(p)).toEqual(["CT-2"]);
  });

  it("con movimiento reducido no se nombra ninguna tarjeta", () => {
    reduced = true;
    const p = cards("CT-1");
    expect(types()(event("/explorar", "/casa/CT-1"))).toBe(false);
    types()(event("/casa/CT-1", "/explorar"));
    afterRender(event("/casa/CT-1", "/explorar"));
    expect(named(p)).toEqual([]);
  });
});

describe("stepEnter: dirección de los pasos del asistente", () => {
  it("avanzar entra por la derecha y volver por la izquierda", () => {
    expect(stepEnter(2, 3)).toBe("forward");
    expect(stepEnter(1, 9)).toBe("forward");
    expect(stepEnter(5, 4)).toBe("back");
  });
  it("sin cambio, en la primera pantalla o en un paso que no existe, sin animación", () => {
    expect(stepEnter(3, 3)).toBeUndefined();
    expect(stepEnter(null, 3)).toBeUndefined();
    expect(stepEnter(3, null)).toBeUndefined();
  });
});

describe("revealClass: las tarjetas de Explorar", () => {
  it("mientras carga, o si ya estaban en la caché (nunca esperó), salen sin animación", () => {
    expect(revealClass({ loading: true, waited: true, firstFilters: true })).toBe("");
    expect(revealClass({ loading: false, waited: false, firstFilters: true })).toBe("");
    expect(revealClass({ loading: false, waited: false, firstFilters: false })).toBe("");
  });
  it("tras esperar: en la primera carga una tras otra; al cambiar los filtros, todas a la vez", () => {
    expect(revealClass({ loading: false, waited: true, firstFilters: true })).toBe(" reveal stagger");
    expect(revealClass({ loading: false, waited: true, firstFilters: false })).toBe(" reveal");
  });
});
