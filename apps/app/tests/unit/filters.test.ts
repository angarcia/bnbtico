import { describe, expect, it } from "vitest";
import { BEDS_OPTIONS, PEOPLE_OPTIONS, extrasCount, normalizeSearch, parseFilters, provinceChips, searchFor, searchFromString, searchToString, toSearchParams } from "../../src/domain/filters";

// Portado de tests/prototype/explorar-filtros.cjs y zona-caribe.cjs.

describe("parseFilters · provincia", () => {
  it("Limón por defecto si tiene casas; Todas si no", () => {
    expect(parseFilters({}, ["Limón", "Guanacaste"]).prov).toBe("Limón");
    expect(parseFilters({}, ["Guanacaste"]).prov).toBe("Todas");
    expect(parseFilters({}, []).prov).toBe("Todas");
  });
  it("respeta la provincia elegida y «Todas»", () => {
    expect(parseFilters({ prov: "Guanacaste" }, ["Limón", "Guanacaste"]).prov).toBe("Guanacaste");
    expect(parseFilters({ prov: "Todas" }, ["Limón"]).prov).toBe("Todas");
  });
  it("una provincia de la URL sin casas cae al valor por defecto", () => {
    expect(parseFilters({ prov: "Cartago" }, ["Limón"]).prov).toBe("Limón");
    expect(parseFilters({ prov: "Marte" }, ["Guanacaste"]).prov).toBe("Todas");
  });
});

describe("parseFilters · resto", () => {
  it("ppl y beds solo con valores de la lista", () => {
    expect(PEOPLE_OPTIONS).toEqual([0, 2, 4, 6, 8, 12]);
    expect(BEDS_OPTIONS).toEqual([0, 1, 2, 3, 4]);
    expect(parseFilters({ ppl: "4", beds: "2" }, []).ppl).toBe(4);
    expect(parseFilters({ ppl: "4", beds: "2" }, []).beds).toBe(2);
    expect(parseFilters({ ppl: "5", beds: "9" }, [])).toMatchObject({ ppl: 0, beds: 0 });
  });
  it("features solo con '1' y solo las conocidas", () => {
    expect(parseFilters({ pool: "1", pets: "0", wifi: "1", jacuzzi: "1" }, []).features).toEqual(["pool", "wifi"]);
  });
  it("precios aceptan separadores; min > max se intercambian; inválidos → 0", () => {
    expect(parseFilters({ min: "30.000", max: "90 000" }, [])).toMatchObject({ min: 30000, max: 90000 });
    expect(parseFilters({ min: "90000", max: "30000" }, [])).toMatchObject({ min: 30000, max: 90000 });
    expect(parseFilters({ min: "abc", max: "-5" }, [])).toMatchObject({ min: 0, max: 0 });
    expect(parseFilters({ min: "90000" }, [])).toMatchObject({ min: 90000, max: 0 });
  });
  it("open viene de ?mas=1", () => {
    expect(parseFilters({ mas: "1" }, []).open).toBe(true);
    expect(parseFilters({}, []).open).toBe(false);
  });
});

describe("extrasCount", () => {
  it("cuenta personas, habitaciones, características y precios; no la provincia", () => {
    expect(extrasCount(parseFilters({ prov: "Guanacaste" }, ["Guanacaste"]))).toBe(0);
    expect(extrasCount(parseFilters({ ppl: "2", beds: "1", pool: "1", ev: "1", min: "1000", max: "2000" }, []))).toBe(6);
  });
});

describe("toSearchParams", () => {
  it("omite valores por defecto", () => {
    expect(toSearchParams(parseFilters({}, ["Limón"]), { prov: "Limón" }).toString()).toBe("");
  });
  it("conserva lo elegido, sin `mas`", () => {
    const params = toSearchParams(parseFilters({ prov: "Todas", ppl: "4", pool: "1", min: "30000", mas: "1" }, ["Limón"]), { prov: "Limón" });
    expect(params.get("prov")).toBe("Todas");
    expect(params.get("ppl")).toBe("4");
    expect(params.get("pool")).toBe("1");
    expect(params.get("min")).toBe("30000");
    expect(params.has("mas")).toBe(false);
    expect(params.has("max")).toBe(false);
  });
});

it("provinceChips respeta el orden del prototipo", () => {
  expect(provinceChips(["Cartago", "Limón"])).toEqual(["Todas", "Limón", "Cartago"]);
  expect(provinceChips([])).toEqual(["Todas"]);
});

describe("búsqueda en la URL de Explorar", () => {
  it("normalizeSearch deja solo claves conocidas, en texto y sin valores por defecto", () => {
    expect(normalizeSearch({ prov: "Guanacaste", pool: "1", ppl: "4", min: "50.000", raro: "x", wifi: "0", modo: "otra" })).toEqual({ prov: "Guanacaste", ppl: "4", pool: "1", min: "50000" });
    expect(normalizeSearch({ modo: "monthly", mas: "1", beds: 9 })).toEqual({ modo: "monthly", mas: "1" });
    expect(normalizeSearch({})).toEqual({});
  });
  it("lo que deja normalizeSearch da los mismos filtros", () => {
    const raw = { prov: "Todas", min: "50000", max: "44000", beach: "1", beachfront: "1" };
    expect(parseFilters(normalizeSearch(raw), ["Limón"])).toEqual(parseFilters(raw, ["Limón"]));
  });
  it("searchToString y searchFromString usan una query string normal, en orden y sin vacíos", () => {
    expect(searchToString({ prov: "Todas", min: "44000", max: "50000" })).toBe("?prov=Todas&min=44000&max=50000");
    expect(searchToString({ prov: undefined, min: "" })).toBe("");
    expect(searchToString({ prov: "Limón" })).toBe("?prov=Lim%C3%B3n");
    expect(searchFromString("?prov=Lim%C3%B3n&pool=1")).toEqual({ prov: "Limón", pool: "1" });
    expect(searchFromString("")).toEqual({});
  });
  it("searchFor da la búsqueda limpia de unos filtros", () => {
    const f = parseFilters({ prov: "Todas", max: "50000", min: "44000" }, ["Limón"]);
    expect(searchFor(f, ["Limón"])).toEqual({ prov: "Todas", min: "44000", max: "50000" });
    expect(searchFor(parseFilters({}, ["Limón"]), ["Limón"])).toEqual({});
  });
});
