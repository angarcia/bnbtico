import { describe, expect, it } from "vitest";
import { BATHS_OPTIONS, BEDS_OPTIONS, effectiveFilters, colonesToPriceInput, priceInputToColones, priceRangeInvalid, extrasCount, normalizeSearch, parseFilters, searchFor, searchFromString, searchToString, stayRange, toSearchParams } from "../../src/domain/filters";
import { listingsQuery } from "../../src/client/queries";

// Portado de tests/prototype/explorar-filtros.cjs y zona-caribe.cjs.

describe("parseFilters · provincia", () => {
  it("sin provincia: Todas, también cuando Limón tiene casas (todo el país; el Caribe va primero en la consulta)", () => {
    expect(parseFilters({}, ["Limón", "Guanacaste"]).prov).toBe("Todas");
    expect(parseFilters({}, ["Guanacaste"]).prov).toBe("Todas");
    expect(parseFilters({}, []).prov).toBe("Todas");
  });
  it("respeta la provincia elegida y «Todas»", () => {
    expect(parseFilters({ prov: "Guanacaste" }, ["Limón", "Guanacaste"]).prov).toBe("Guanacaste");
    expect(parseFilters({ prov: "Todas" }, ["Limón"]).prov).toBe("Todas");
  });
  it("un enlace viejo con ?prov= sigue filtrando por esa provincia; una provincia sin casas cae a Todas", () => {
    expect(parseFilters({ prov: "Limón" }, ["Limón"]).prov).toBe("Limón");
    expect(parseFilters({ prov: "Cartago" }, ["Limón"]).prov).toBe("Todas");
    expect(parseFilters({ prov: "Marte" }, ["Guanacaste"]).prov).toBe("Todas");
  });
});

describe("parseFilters · resto", () => {
  it("ppl entero de 1 a 50; beds solo con valores de la lista", () => {
    expect(BEDS_OPTIONS).toEqual([0, 1, 2, 3, 4]);
    expect(parseFilters({ ppl: "4", beds: "2" }, []).ppl).toBe(4);
    expect(parseFilters({ ppl: "4", beds: "2" }, []).beds).toBe(2);
    expect(parseFilters({ ppl: "5", beds: "9" }, [])).toMatchObject({ ppl: 5, beds: 0 });
    expect(parseFilters({ ppl: "0" }, []).ppl).toBe(0);
    expect(parseFilters({ ppl: "50" }, []).ppl).toBe(50);
  });
  it("features solo con '1' y solo las conocidas", () => {
    expect(parseFilters({ pool: "1", pets: "0", wifi: "1", jacuzzi: "1" }, []).features).toEqual(["pool", "wifi"]);
  });
  it("precios aceptan separadores; min > max = sin rango (no se intercambian); inválidos → 0", () => {
    expect(parseFilters({ min: "30.000", max: "90 000" }, [])).toMatchObject({ min: 30000, max: 90000 });
    expect(parseFilters({ min: "90000", max: "30000" }, [])).toMatchObject({ min: 0, max: 0 });
    expect(parseFilters({ min: "30000", max: "30000" }, [])).toMatchObject({ min: 30000, max: 30000 });
    expect(parseFilters({ min: "abc", max: "-5" }, [])).toMatchObject({ min: 0, max: 0 });
    expect(parseFilters({ min: "90000" }, [])).toMatchObject({ min: 90000, max: 0 });
  });
  it("open viene de ?mas=1", () => {
    expect(parseFilters({ mas: "1" }, []).open).toBe(true);
    expect(parseFilters({}, []).open).toBe(false);
  });
});

describe("extrasCount", () => {
  it("cuenta habitaciones, características y precios; no la provincia ni las personas", () => {
    expect(extrasCount(parseFilters({ prov: "Guanacaste" }, ["Guanacaste"]))).toBe(0);
    expect(extrasCount(parseFilters({ ppl: "2", beds: "1", pool: "1", ev: "1", min: "1000", max: "2000" }, []))).toBe(5);
  });
});

describe("toSearchParams", () => {
  it("omite valores por defecto (sin provincia, «Todas»)", () => {
    expect(toSearchParams(parseFilters({}, ["Limón"])).toString()).toBe("");
    expect(toSearchParams(parseFilters({ prov: "Todas" }, ["Limón"])).toString()).toBe("");
  });
  it("una provincia de un enlace viejo viaja en la URL", () => {
    expect(toSearchParams(parseFilters({ prov: "Limón" }, ["Limón"])).toString()).toBe("prov=Lim%C3%B3n");
  });
  it("conserva lo elegido, sin `mas`", () => {
    const params = toSearchParams(parseFilters({ prov: "Todas", ppl: "4", pool: "1", min: "30000", mas: "1" }, ["Limón"]));
    expect(params.has("prov")).toBe(false);
    expect(params.get("ppl")).toBe("4");
    expect(params.get("pool")).toBe("1");
    expect(params.get("min")).toBe("30000");
    expect(params.has("mas")).toBe(false);
    expect(params.has("max")).toBe(false);
  });
});

describe("baños y tipo de alojamiento", () => {
  it("banos: entero de la lista (1–3); tipo: completo o habitacion", () => {
    expect(BATHS_OPTIONS).toEqual([0, 1, 2, 3]);
    expect(parseFilters({ banos: "2", tipo: "habitacion" }, [])).toMatchObject({ baths: 2, kind: "habitacion" });
    expect(parseFilters({ banos: "9", tipo: "casa" }, [])).toMatchObject({ baths: 0, kind: null });
    expect(parseFilters({}, [])).toMatchObject({ baths: 0, kind: null });
  });
  it("entran en extrasCount, toSearchParams, normalizeSearch y el «Limpiar»", () => {
    const f = parseFilters({ banos: "2", tipo: "completo" }, []);
    expect(extrasCount(f)).toBe(2);
    expect(extrasCount(parseFilters({ banos: "1" }, []))).toBe(1);
    expect(toSearchParams(f).toString()).toBe("banos=2&tipo=completo");
    expect(normalizeSearch({ banos: "2", tipo: "completo", raro: "x" })).toEqual({ banos: "2", tipo: "completo" });
    expect(normalizeSearch({ banos: "7", tipo: "otro" })).toEqual({});
    expect(searchFor(f)).toEqual({ banos: "2", tipo: "completo" });
    expect(toSearchParams(parseFilters({}, [])).toString()).toBe("");
  });
  it("con el mensual siguen contando (no dependen de las fechas ni del precio)", () => {
    expect(extrasCount(parseFilters({ mensual: "1", banos: "2", tipo: "habitacion" }, []))).toBe(2);
  });
});

describe("búsqueda en la URL de Explorar", () => {
  it("normalizeSearch deja solo claves conocidas, en texto y sin valores por defecto", () => {
    expect(normalizeSearch({ prov: "Guanacaste", pool: "1", ppl: "4", min: "50.000", raro: "x", wifi: "0", modo: "otra" })).toEqual({ prov: "Guanacaste", ppl: "4", pool: "1", min: "50000" });
    expect(normalizeSearch({ modo: "monthly", mas: "1", beds: 9 })).toEqual({ mensual: "1", mas: "1" });
    expect(normalizeSearch({ modo: "both" })).toEqual({});
    expect(normalizeSearch({ mensual: "1", modo: "nightly" })).toEqual({ mensual: "1" });
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
    expect(searchFor(f)).toEqual({ min: "44000", max: "50000" });
    expect(searchFor(parseFilters({}, ["Limón"]))).toEqual({});
  });
});

describe("precio en la moneda elegida (ticket 15)", () => {
  it("en colones, la entrada es la cifra en colones", () => {
    expect(priceInputToColones("30.000", "CRC", 510)).toBe(30000);
    expect(priceInputToColones("", "CRC", 510)).toBeNull();
    expect(priceInputToColones("abc", "CRC", 510)).toBeNull();
  });
  it("en dólares se convierte a colones enteros con el tipo vigente", () => {
    expect(priceInputToColones("100", "USD", 510)).toBe(51000);
    expect(priceInputToColones("$ 1,000", "USD", 510)).toBe(510000);
    expect(priceInputToColones("12.5", "USD", 510)).toBe(6375);
    expect(priceInputToColones("-3", "USD", 510)).toBeNull();
    expect(priceInputToColones("100", "USD", 455.07)).toBe(45507);
  });
  it("y vuelve a mostrarse en la moneda elegida", () => {
    expect(colonesToPriceInput(51000, "USD", 510)).toBe("100");
    expect(colonesToPriceInput(30000, "CRC", 510)).toBe("30000");
    expect(colonesToPriceInput(0, "USD", 510)).toBe("");
  });
  it("rango inválido solo con los dos límites y mínimo > máximo", () => {
    expect(priceRangeInvalid(90000, 30000)).toBe(true);
    expect(priceRangeInvalid(30000, 90000)).toBe(false);
    expect(priceRangeInvalid(90000, 0)).toBe(false);
    expect(priceRangeInvalid(0, 30000)).toBe(false);
  });
});

describe("alquiler mensual (?mensual=1)", () => {
  const base = parseFilters({}, []);
  it("mensual=1 marca el filtro; sin él o con otro valor, no", () => {
    expect(parseFilters({}, []).monthly).toBe(false);
    expect(parseFilters({ mensual: "1" }, []).monthly).toBe(true);
    expect(parseFilters({ mensual: "0" }, []).monthly).toBe(false);
  });
  it("enlaces viejos: modo=monthly es mensual; nightly, both y otros se descartan", () => {
    expect(parseFilters({ modo: "monthly" }, []).monthly).toBe(true);
    expect(parseFilters({ modo: "nightly" }, []).monthly).toBe(false);
    expect(parseFilters({ modo: "both" }, []).monthly).toBe(false);
    expect(parseFilters({ modo: "otra" }, []).monthly).toBe(false);
  });
  it("en la URL: mensual=1 y el rango se conserva; nunca modo", () => {
    const params = toSearchParams({ ...base, monthly: true, min: 40000, max: 90000 });
    expect(params.toString()).toBe("mensual=1&min=40000&max=90000");
    expect(params.has("modo")).toBe(false);
    expect(toSearchParams(parseFilters({ modo: "monthly" }, [])).has("modo")).toBe(false);
  });
  it("con el mensual la consulta no aplica el rango por noche", () => {
    expect(effectiveFilters({ ...base, monthly: true, min: 40000, max: 90000 })).toMatchObject({ min: 0, max: 0, monthly: true });
    const off = { ...base, monthly: false, min: 40000, max: 90000 };
    expect(effectiveFilters(off)).toEqual(off);
  });
  it("extrasCount no cuenta el rango con el mensual, ni el mensual mismo", () => {
    expect(extrasCount({ ...base, monthly: true, min: 40000, max: 90000, beds: 2 })).toBe(1);
    expect(extrasCount({ ...base, monthly: false, min: 40000, max: 90000, beds: 2 })).toBe(3);
  });
  it("ida y vuelta por searchFor", () => {
    expect(searchFor(parseFilters({ mensual: "1", prov: "Limón" }, ["Limón"]))).toEqual({ mensual: "1", prov: "Limón" }); // un ?prov= viejo se conserva
    expect(searchFor(parseFilters({ mensual: "1", prov: "Todas" }, ["Limón"]))).toEqual({ mensual: "1" });
  });
});

describe("zona, fechas y personas en la URL de Explorar", () => {
  const T = "2026-11-01";
  it("normalizeSearch aplica la ventana de fechas con hoy", () => {
    expect(normalizeSearch({ zona: "704-cocles", llegada: "2026-11-23", salida: "2026-11-27", ppl: "4" }, T)).toEqual({ zona: "704-cocles", llegada: "2026-11-23", salida: "2026-11-27", ppl: "4" });
    expect(normalizeSearch({ llegada: "2026-10-31", salida: "2026-11-02" }, T)).toEqual({}); // llegada ayer: fuera las dos
    expect(normalizeSearch({ llegada: "2026-11-01", salida: "2026-11-02" }, T)).toEqual({ llegada: "2026-11-01", salida: "2026-11-02" });
    expect(normalizeSearch({ llegada: "2026-11-05", salida: "2026-11-05" }, T)).toEqual({}); // salida = llegada
    expect(normalizeSearch({ llegada: "2026-11-05" }, T)).toEqual({}); // una sola
    expect(normalizeSearch({ llegada: "2027-10-30", salida: "2027-11-02" }, T)).toEqual({}); // salida > hoy + 365
    expect(normalizeSearch({ llegada: "2027-10-31", salida: "2027-11-01" }, T)).toEqual({ llegada: "2027-10-31", salida: "2027-11-01" }); // = hoy + 365
    expect(normalizeSearch({ mensual: "1", desde: "2027-10-02" }, T)).toEqual({ mensual: "1", desde: "2027-10-02" }); // hoy + 335
    expect(normalizeSearch({ mensual: "1", desde: "2027-10-03" }, T)).toEqual({ mensual: "1" });
  });
  it("personas de 1 a 50, zona con su forma, mapa como bandera", () => {
    expect(normalizeSearch({ ppl: "13" })).toEqual({ ppl: "13" });
    expect(normalizeSearch({ ppl: "51" })).toEqual({});
    expect(normalizeSearch({ ppl: "2.5" })).toEqual({});
    expect(normalizeSearch({ zona: "Cocles" })).toEqual({});
    expect(normalizeSearch({ mapa: "1" })).toEqual({ mapa: "1" });
  });
  it("sin hoy, solo forma y orden de las fechas", () => {
    expect(normalizeSearch({ llegada: "2020-01-05", salida: "2020-01-07" })).toEqual({ llegada: "2020-01-05", salida: "2020-01-07" });
    expect(normalizeSearch({ llegada: "2020-01-07", salida: "2020-01-05" })).toEqual({});
    expect(normalizeSearch({ llegada: "2026-02-30", salida: "2026-03-02" })).toEqual({});
  });
  it("la zona manda sobre la provincia y se descarta si no está entre las zonas cargadas", () => {
    const f = parseFilters({ zona: "704-cocles", prov: "Guanacaste" }, ["Guanacaste", "Limón"]);
    expect(f.zone).toBe("704-cocles");
    expect(toSearchParams(f).toString()).toBe("zona=704-cocles"); // la zona manda: sin prov
    expect(parseFilters({ zona: "704-cocles" }, ["Limón"], { zoneIds: ["704-puerto-viejo"] }).zone).toBeNull();
  });
  it("stayRange: mensual [desde, desde + 30); por noches [llegada, salida)", () => {
    const m = parseFilters({ mensual: "1", desde: "2026-12-01", llegada: "2026-11-23", salida: "2026-11-27" }, ["Limón"], { today: T });
    expect(stayRange(m)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(stayRange({ ...m, monthly: false })).toEqual({ from: "2026-11-23", to: "2026-11-27" });
    expect(toSearchParams(m).get("llegada")).toBe("2026-11-23"); // se conserva en la URL
    expect(stayRange(parseFilters({}, ["Limón"]))).toBeNull();
  });
  it("extrasCount no cuenta zona, fechas ni personas", () => {
    expect(extrasCount(parseFilters({ ppl: "4", zona: "704-cocles", llegada: "2026-11-23", salida: "2026-11-27", beds: "2" }, ["Limón"]))).toBe(1);
  });
  it("effectiveFilters: el mensual quita llegada, salida y rango; por noches quita desde", () => {
    const f = parseFilters({ mensual: "1", desde: "2026-12-01", llegada: "2026-11-23", salida: "2026-11-27", min: "1000" }, ["Limón"]);
    expect(effectiveFilters(f)).toMatchObject({ arrival: null, departure: null, monthlyFrom: "2026-12-01", min: 0 });
    expect(effectiveFilters({ ...f, monthly: false })).toMatchObject({ arrival: "2026-11-23", departure: "2026-11-27", monthlyFrom: null, min: 1000 });
  });
  it("mapa no entra en los filtros ni en la clave de la consulta", () => {
    expect(listingsQuery(parseFilters({ mapa: "1" }, ["Limón"])).queryKey).toEqual(listingsQuery(parseFilters({}, ["Limón"])).queryKey);
    expect(toSearchParams(parseFilters({ mapa: "1" }, ["Limón"])).has("mapa")).toBe(false);
  });
});
