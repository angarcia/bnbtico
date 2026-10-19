import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVINCE,
  FEATURES,
  PROVINCES,
  STATUS_LABELS,
  emptyDraft,
  normalize,
  parseColones,
  parseStepForm,
  validateAll,
  validateStep,
  type ListingDraft,
} from "@/lib/listings/schema";

// Portado de tests/prototype/publication.cjs (validación del formulario) y de las reglas de CLAUDE.md.

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

/** Borrador válido hasta el paso indicado (inclusive). */
function validDraft(): ListingDraft {
  return {
    ...emptyDraft(),
    kind: "casa",
    acceptsMonthly: false,
    province: "Limón",
    canton: "Talamanca",
    zone: "Manzanillo",
    lat: 9.63,
    lng: -82.65,
    capacity: 5,
    bedrooms: 2,
    bathrooms: 2,
    title: "Casa Manzanillo",
    description: "Casa de madera a 80 m de la playa.",
    features: ["wifi"],
    photoCount: 5,
    nightlyPriceCrc: 85000,
    minNights: 2,
  };
}

describe("constantes", () => {
  it("las 9 características en el orden del prototipo", () => {
    expect(FEATURES.map(([k]) => k)).toEqual(["pool", "pets", "wifi", "ac", "parking", "ev", "kids_free", "beachfront", "bbq"]);
    expect(FEATURES.map(([, l]) => l)).toEqual(["Piscina", "Mascotas", "Wifi", "Aire acondicionado", "Parqueo", "⚡ Cargador eléctrico", "Niños pequeños gratis", "Frente al mar", "Rancho / BBQ"]);
  });
  it("provincias en el orden del prototipo y Limón por defecto", () => {
    expect(PROVINCES).toEqual(["Guanacaste", "Puntarenas", "Limón", "Alajuela", "San José", "Heredia", "Cartago"]);
    expect(DEFAULT_PROVINCE).toBe("Limón");
  });
  it("etiquetas de estado", () => {
    expect(STATUS_LABELS.review).toEqual({ label: "Pendiente de revisión", badge: "badge-warn" });
    expect(STATUS_LABELS.active).toEqual({ label: "Activa", badge: "badge-ok" });
    expect(STATUS_LABELS.rejected).toEqual({ label: "Rechazada", badge: "badge-bad" });
    expect(STATUS_LABELS.draft).toEqual({ label: "Borrador", badge: "badge-mute" });
  });
});

describe("parseColones", () => {
  it.each([
    ["95000", 95000],
    ["95.000", 95000],
    ["95 000", 95000],
    ["95 000", 95000],
    ["₡95 000", 95000],
    ["1.250.000", 1250000],
  ])("acepta %s", (input, expected) => expect(parseColones(input)).toBe(expected));
  it.each(["95,50", "95.5", "abc", "-1", "12.34.5"])("rechaza %s", (input) => expect(Number.isNaN(parseColones(input))).toBe(true));
  it("vacío es null", () => expect(parseColones("  ")).toBeNull());
});

describe("validateStep", () => {
  it("paso 1 exige tipo y respuesta mensual explícita", () => {
    const d = emptyDraft();
    expect(validateStep(1, d)).toBe("Elegí Casa, Apartamento o Habitación.");
    d.kind = "apartamento";
    expect(validateStep(1, d)).toBe("Respondé si aceptás alquiler mensual.");
    d.acceptsMonthly = false;
    expect(validateStep(1, d)).toBeNull();
  });

  it("paso 2 exige provincia de la lista, cantón, zona y pin", () => {
    const d = validDraft();
    expect(validateStep(2, d)).toBeNull();
    expect(validateStep(2, { ...d, province: "Marte" })).toBe("Completá provincia, cantón y zona aproximada.");
    expect(validateStep(2, { ...d, canton: "  " })).toBe("Completá provincia, cantón y zona aproximada.");
    expect(validateStep(2, { ...d, zone: "" })).toBe("Completá provincia, cantón y zona aproximada.");
    expect(validateStep(2, { ...d, lat: null })).toBe("Marcá en el mapa la ubicación aproximada.");
  });

  it("paso 3: estudio con 0 habitaciones pasa; casa con 0 falla", () => {
    const d = validDraft();
    expect(validateStep(3, { ...d, kind: "apartamento", bedrooms: 0 })).toBeNull();
    expect(validateStep(3, { ...d, kind: "casa", bedrooms: 0 })).toBe("Indicá las habitaciones ofrecidas; solo un apartamento tipo estudio puede tener 0.");
  });

  it("paso 3: habitaciones vacías o 1.5 fallan, no se convierten en 0", () => {
    const d = validDraft();
    expect(validateStep(3, { ...d, bedrooms: null })).toMatch(/habitaciones/);
    expect(validateStep(3, { ...d, bedrooms: 1.5 })).toMatch(/habitaciones/);
    expect(validateStep(3, { ...d, bedrooms: Number.NaN })).toMatch(/habitaciones/);
  });

  it("paso 3: personas y baños mínimo 1; parqueo marcado exige tipo", () => {
    const d = validDraft();
    expect(validateStep(3, { ...d, capacity: 0 })).toBe("Indicá cuántas personas pueden alojarse (mínimo 1).");
    expect(validateStep(3, { ...d, bathrooms: 0 })).toBe("Indicá el número de baños disponibles (mínimo 1).");
    expect(validateStep(3, { ...d, title: " " })).toBe("Completá el título y la descripción.");
    expect(validateStep(3, { ...d, features: ["parking"], parkingPaid: null })).toBe("Indicá si el parqueo es gratuito o de pago.");
    expect(validateStep(3, { ...d, features: ["parking"], parkingPaid: false })).toBeNull();
  });

  it("paso 4: 4 fotos falla, 5 pasa, 16 falla", () => {
    const d = validDraft();
    expect(validateStep(4, { ...d, photoCount: 4 })).toBe("Agregá al menos 5 fotos.");
    expect(validateStep(4, { ...d, photoCount: 5 })).toBeNull();
    expect(validateStep(4, { ...d, photoCount: 16 })).toBe("Máximo 15 fotos.");
  });

  it("paso 5: precio NaN o 0 falla; minNights 0 falla", () => {
    const d = validDraft();
    expect(validateStep(5, { ...d, nightlyPriceCrc: Number.NaN })).toBe("Indicá un precio por noche en colones, mayor que cero y sin decimales.");
    expect(validateStep(5, { ...d, nightlyPriceCrc: 0 })).toBe("Indicá un precio por noche en colones, mayor que cero y sin decimales.");
    expect(validateStep(5, { ...d, minNights: 0 })).toBe("Indicá la estancia mínima en noches.");
    expect(validateStep(5, d)).toBeNull();
  });

  it("paso 5: mensual sin modo falla; amount sin importe falla; contact pasa; minMonths vacío pasa y 0 falla", () => {
    const d = { ...validDraft(), acceptsMonthly: true };
    expect(validateStep(5, d)).toBe("Elegí indicar un precio mensual o Consultar con el propietario.");
    expect(validateStep(5, { ...d, monthlyMode: "amount" })).toBe("Indicá un precio mensual válido.");
    expect(validateStep(5, { ...d, monthlyMode: "amount", monthlyPriceCrc: -1 })).toBe("Indicá un precio mensual válido.");
    expect(validateStep(5, { ...d, monthlyMode: "amount", monthlyPriceCrc: 450000 })).toBeNull();
    expect(validateStep(5, { ...d, monthlyMode: "contact", monthlyPriceCrc: null })).toBeNull();
    expect(validateStep(5, { ...d, monthlyMode: "contact", minMonths: 0 })).toBe("La estancia mínima en meses debe ser un número entero mayor que cero.");
    expect(validateStep(5, { ...d, monthlyMode: "contact", minMonths: 3 })).toBeNull();
  });
});

describe("normalize", () => {
  it("quitar parqueo limpia parkingPaid", () => {
    expect(normalize({ ...validDraft(), features: ["wifi"], parkingPaid: true }).parkingPaid).toBeNull();
    expect(normalize({ ...validDraft(), features: ["parking"], parkingPaid: true }).parkingPaid).toBe(true);
  });
  it("acceptsMonthly=false limpia lo mensual", () => {
    const n = normalize({ ...validDraft(), acceptsMonthly: false, monthlyMode: "amount", monthlyPriceCrc: 150000, minMonths: 2 });
    expect([n.monthlyMode, n.monthlyPriceCrc, n.minMonths]).toEqual([null, null, null]);
  });
  it("monthlyMode=contact limpia el importe", () => {
    expect(normalize({ ...validDraft(), acceptsMonthly: true, monthlyMode: "contact", monthlyPriceCrc: 150000 }).monthlyPriceCrc).toBeNull();
  });
});

describe("parseStepForm", () => {
  it("paso 1 lee tipo y mensual como booleano explícito", () => {
    expect(parseStepForm(1, fd([["kind", "casa"], ["acceptsMonthly", "yes"]]))).toEqual({ kind: "casa", acceptsMonthly: true });
    expect(parseStepForm(1, fd([["kind", "x"], ["acceptsMonthly", ""]]))).toEqual({ kind: null, acceptsMonthly: null });
  });
  it("paso 2 lee ubicación y coordenadas", () => {
    expect(parseStepForm(2, fd([["province", "Limón"], ["canton", " Talamanca "], ["zone", "Manzanillo"], ["lat", "9.63"], ["lng", "-82.65"]]))).toEqual({
      province: "Limón", canton: "Talamanca", zone: "Manzanillo", lat: 9.63, lng: -82.65,
    });
    expect(parseStepForm(2, fd([["province", "Limón"], ["canton", ""], ["zone", ""], ["lat", ""], ["lng", ""]]))).toMatchObject({ lat: null, lng: null });
  });
  it("paso 3 lee features múltiples y parkingPaid", () => {
    const base: [string, string][] = [["capacity", "4"], ["bedrooms", ""], ["bathrooms", "1.5"], ["title", " Casa "], ["description", "Linda"]];
    const p = parseStepForm(3, fd([...base, ["features", "wifi"], ["features", "parking"], ["parkingPaid", "paid"]]));
    expect(p).toMatchObject({ capacity: 4, bedrooms: null, title: "Casa", description: "Linda", features: ["wifi", "parking"], parkingPaid: true });
    expect(Number.isNaN(p.bathrooms)).toBe(true);
    expect(parseStepForm(3, fd([...base, ["parkingPaid", "free"]]))).toMatchObject({ features: [], parkingPaid: false });
    expect(parseStepForm(3, fd([...base, ["parkingPaid", ""]]))).toMatchObject({ parkingPaid: null });
    expect(parseStepForm(3, fd([...base, ["features", "jacuzzi"]]))).toMatchObject({ features: [] });
  });
  it("paso 4 lee photoCount", () => expect(parseStepForm(4, fd([["photoCount", "5"]]))).toEqual({ photoCount: 5 }));
  it("paso 5 usa parseColones para precios", () => {
    expect(parseStepForm(5, fd([["nightlyPriceCrc", "85.000"], ["minNights", "2"], ["monthlyMode", "amount"], ["monthlyPriceCrc", "₡450 000"], ["minMonths", ""]]))).toEqual({
      nightlyPriceCrc: 85000, minNights: 2, monthlyMode: "amount", monthlyPriceCrc: 450000, minMonths: null,
    });
    expect(parseStepForm(5, fd([["nightlyPriceCrc", ""], ["minNights", ""], ["monthlyMode", "otro"]]))).toMatchObject({ nightlyPriceCrc: null, minNights: null, monthlyMode: null });
  });
});

describe("validateAll", () => {
  it("devuelve el primer paso con error", () => {
    expect(validateAll(emptyDraft())).toEqual({ step: 1, error: "Elegí Casa, Apartamento o Habitación." });
    expect(validateAll({ ...validDraft(), photoCount: 2 })).toEqual({ step: 4, error: "Agregá al menos 5 fotos." });
    expect(validateAll(validDraft())).toBeNull();
  });
});
