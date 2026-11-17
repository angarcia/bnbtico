// Habitaciones detrás de la feature flag `rooms` (historia #62, decisiones del 2026-11-17): apagada, Filtros no tiene tipo
// de alojamiento, un `?tipo=` viejo se ignora sin dejar un filtro oculto y el mínimo de dormitorios sigue funcionando.
import { describe, expect, it } from "vitest";
import { extrasCount, normalizeSearch, parseFilters, toSearchParams } from "../../src/domain/filters";

describe("Filtros con las habitaciones apagadas", () => {
  it("?tipo=habitacion o ?tipo=completo se ignoran: sin filtro de tipo", () => {
    for (const tipo of ["habitacion", "completo"]) {
      expect(parseFilters({ tipo }, [], { rooms: false }).kind).toBeNull();
      expect(normalizeSearch({ tipo }, undefined, "nights", false)).toEqual({});
    }
  });
  it("el mínimo de dormitorios vale sin tipo y cuenta como filtro", () => {
    const f = parseFilters({ beds: "3" }, [], { rooms: false });
    expect(f.beds).toBe(3);
    expect(extrasCount(f)).toBe(1);
    expect(toSearchParams(f).toString()).toBe("beds=3");
    expect(normalizeSearch({ beds: "3", tipo: "habitacion" }, undefined, "nights", false)).toEqual({ beds: "3" });
  });
  it("encendidas, como antes: el tipo filtra y los dormitorios piden «completo»", () => {
    expect(parseFilters({ tipo: "habitacion" }, []).kind).toBe("habitacion");
    expect(parseFilters({ beds: "3" }, []).beds).toBe(0);
    expect(parseFilters({ beds: "3", tipo: "completo" }, []).beds).toBe(3);
  });
});
