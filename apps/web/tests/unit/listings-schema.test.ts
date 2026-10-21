import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVINCE,
  FEATURES,
  KINDS,
  KIND_LABELS,
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

// Modelo del diseño v1 (docs/diseno-v1.md, pantallas 11–15): Vacacional / Mensual (una o las dos), Alojamiento completo /
// Habitación (con baño privado o compartido), contadores, un precio por modalidad. Copy en usted.

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

function validDraft(): ListingDraft {
  return {
    ...emptyDraft(),
    kind: "completo",
    acceptsNightly: true,
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
  };
}

describe("constantes", () => {
  it("las 9 características en el orden del prototipo", () => {
    expect(FEATURES.map(([k]) => k)).toEqual(["pool", "pets", "wifi", "ac", "parking", "ev", "kids_free", "beachfront", "bbq"]);
    expect(FEATURES.map(([, l]) => l)).toEqual(["Piscina", "Mascotas", "Wifi", "Aire acondicionado", "Parqueo", "Cargador eléctrico", "Niños pequeños gratis", "Frente al mar", "Rancho/BBQ"]);
  });
  it("tipos del diseño v1; los antiguos conservan etiqueta", () => {
    expect(KINDS).toEqual(["completo", "habitacion"]);
    expect(KIND_LABELS.completo).toBe("Alojamiento completo");
    expect(KIND_LABELS.habitacion).toBe("Habitación");
    expect(KIND_LABELS.casa).toBe("Casa");
    expect(KIND_LABELS.apartamento).toBe("Apartamento");
  });
  it("provincias en el orden del prototipo y Limón por defecto", () => {
    expect(PROVINCES).toEqual(["Guanacaste", "Puntarenas", "Limón", "Alajuela", "San José", "Heredia", "Cartago"]);
    expect(DEFAULT_PROVINCE).toBe("Limón");
  });
  it("etiquetas de estado con los colores del diseño", () => {
    expect(STATUS_LABELS.review).toEqual({ label: "En revisión", badge: "badge-review" });
    expect(STATUS_LABELS.active).toEqual({ label: "Activa", badge: "badge-ok" });
    expect(STATUS_LABELS.payment_due).toEqual({ label: "Pendiente de pago", badge: "badge-sun" });
    expect(STATUS_LABELS.rejected).toEqual({ label: "Rechazada", badge: "badge-bad" });
    expect(STATUS_LABELS.draft).toEqual({ label: "Borrador", badge: "badge-mute" });
  });
});

describe("parseColones", () => {
  it.each([["95000", 95000], ["95.000", 95000], ["95 000", 95000], ["₡95 000", 95000], ["1.250.000", 1250000]])("acepta %s", (input, expected) => expect(parseColones(input)).toBe(expected));
  it.each(["95,50", "95.5", "abc", "-1", "12.34.5"])("rechaza %s", (input) => expect(Number.isNaN(parseColones(input))).toBe(true));
  it("vacío es null", () => expect(parseColones("  ")).toBeNull());
});

describe("validateStep", () => {
  it("paso 1 exige tipo y al menos una modalidad", () => {
    const d = emptyDraft();
    expect(validateStep(1, d)).toBe("Elija Alojamiento completo o Habitación.");
    d.kind = "habitacion";
    expect(validateStep(1, d)).toBe("Marque Vacacional, Mensual o las dos.");
    d.acceptsMonthly = true;
    expect(validateStep(1, d)).toBeNull();
  });

  it("paso 2 exige provincia de la lista, cantón, zona y pin dentro de Costa Rica", () => {
    const d = validDraft();
    expect(validateStep(2, d)).toBeNull();
    expect(validateStep(2, { ...d, province: "Marte" })).toBe("Complete provincia, cantón y zona aproximada.");
    expect(validateStep(2, { ...d, canton: "  " })).toBe("Complete provincia, cantón y zona aproximada.");
    expect(validateStep(2, { ...d, lat: null })).toBe("Marque en el mapa la ubicación aproximada.");
    expect(validateStep(2, { ...d, lat: 40.4, lng: -3.7 })).toBe("Marque un punto dentro de Costa Rica.");
  });

  it("paso 3: alojamiento completo admite 0 habitaciones (estudio); una habitación no", () => {
    const d = validDraft();
    expect(validateStep(3, { ...d, kind: "completo", bedrooms: 0 })).toBeNull();
    expect(validateStep(3, { ...d, kind: "habitacion", bedrooms: 0, bathroomShared: false })).toBe("Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.");
  });

  it("paso 3: habitaciones vacías o 1.5 fallan", () => {
    const d = validDraft();
    expect(validateStep(3, { ...d, bedrooms: null })).toMatch(/habitaciones/);
    expect(validateStep(3, { ...d, bedrooms: 1.5 })).toMatch(/habitaciones/);
  });

  it("paso 3: personas y baños mínimo 1; habitación exige baño privado o compartido; parqueo exige tipo", () => {
    const d = validDraft();
    expect(validateStep(3, { ...d, capacity: 0 })).toBe("Indique cuántas personas pueden alojarse (mínimo 1).");
    expect(validateStep(3, { ...d, bathrooms: 0 })).toBe("Indique el número de baños (mínimo 1).");
    expect(validateStep(3, { ...d, kind: "habitacion", bedrooms: 1, bathroomShared: null })).toBe("Indique si el baño es privado o compartido.");
    expect(validateStep(3, { ...d, kind: "habitacion", bedrooms: 1, bathroomShared: true })).toBeNull();
    expect(validateStep(3, { ...d, title: " " })).toBe("Complete el nombre de la casa y la descripción.");
    expect(validateStep(3, { ...d, features: ["parking"], parkingPaid: null })).toBe("Indique si el parqueo es gratuito o de pago.");
  });

  it("paso 4: 4 fotos falla, 5 pasa, 16 falla", () => {
    const d = validDraft();
    expect(validateStep(4, { ...d, photoCount: 4 })).toBe("Agregue al menos 5 fotos.");
    expect(validateStep(4, { ...d, photoCount: 5 })).toBeNull();
    expect(validateStep(4, { ...d, photoCount: 16 })).toBe("Máximo 15 fotos.");
  });

  it("paso 5: un precio por modalidad", () => {
    const d = validDraft();
    expect(validateStep(5, { ...d, nightlyPriceCrc: Number.NaN })).toBe("Indique el precio por noche en colones.");
    expect(validateStep(5, { ...d, nightlyPriceCrc: 0 })).toBe("Indique el precio por noche en colones.");
    expect(validateStep(5, d)).toBeNull();
    const both = { ...d, acceptsMonthly: true };
    expect(validateStep(5, both)).toBe("Indique el precio por mes en colones.");
    expect(validateStep(5, { ...both, monthlyPriceCrc: 480000 })).toBeNull();
    const monthlyOnly = { ...d, acceptsNightly: false, acceptsMonthly: true, nightlyPriceCrc: null, monthlyPriceCrc: 480000 };
    expect(validateStep(5, monthlyOnly)).toBeNull();
  });
});

describe("normalize", () => {
  it("quitar parqueo limpia parkingPaid", () => {
    expect(normalize({ ...validDraft(), features: ["wifi"], parkingPaid: true }).parkingPaid).toBeNull();
  });
  it("sin mensual no hay precio mensual; con mensual el modo es 'amount'", () => {
    const n = normalize({ ...validDraft(), acceptsMonthly: false, monthlyMode: "amount", monthlyPriceCrc: 150000, minMonths: 2 });
    expect([n.monthlyMode, n.monthlyPriceCrc, n.minMonths]).toEqual([null, null, null]);
    expect(normalize({ ...validDraft(), acceptsMonthly: true, monthlyPriceCrc: 480000 }).monthlyMode).toBe("amount");
  });
  it("sin vacacional no hay precio por noche; sin habitación no hay dato del baño", () => {
    expect(normalize({ ...validDraft(), acceptsNightly: false, acceptsMonthly: true, monthlyPriceCrc: 1 }).nightlyPriceCrc).toBeNull();
    expect(normalize({ ...validDraft(), kind: "completo", bathroomShared: true }).bathroomShared).toBeNull();
  });
});

describe("parseStepForm", () => {
  it("paso 1 lee tipo y modalidades como casillas", () => {
    expect(parseStepForm(1, fd([["kind", "completo"], ["modes", "nightly"], ["modes", "monthly"]]))).toEqual({ kind: "completo", acceptsNightly: true, acceptsMonthly: true });
    expect(parseStepForm(1, fd([["kind", "x"]]))).toEqual({ kind: null, acceptsNightly: false, acceptsMonthly: false });
  });
  it("paso 3 lee contadores, baño y características", () => {
    const base: [string, string][] = [["capacity", "4"], ["bedrooms", "2"], ["bathrooms", "1"], ["title", " Casa "], ["description", "Linda"]];
    expect(parseStepForm(3, fd([...base, ["features", "wifi"], ["features", "parking"], ["parkingPaid", "paid"], ["bathroomShared", "shared"]]))).toMatchObject({
      capacity: 4, bedrooms: 2, bathrooms: 1, title: "Casa", features: ["wifi", "parking"], parkingPaid: true, bathroomShared: true,
    });
    expect(parseStepForm(3, fd([...base, ["bathroomShared", "private"]]))).toMatchObject({ bathroomShared: false, parkingPaid: null });
    expect(parseStepForm(3, fd(base))).toMatchObject({ bathroomShared: null });
  });
  it("paso 5 usa parseColones para los dos precios", () => {
    expect(parseStepForm(5, fd([["nightlyPriceCrc", "85.000"], ["monthlyPriceCrc", "₡480 000"]]))).toEqual({ nightlyPriceCrc: 85000, monthlyPriceCrc: 480000 });
    expect(parseStepForm(5, fd([["nightlyPriceCrc", ""]]))).toEqual({ nightlyPriceCrc: null, monthlyPriceCrc: null });
  });
});

describe("validateAll", () => {
  it("devuelve el primer paso con error", () => {
    expect(validateAll(emptyDraft())).toEqual({ step: 1, error: "Elija Alojamiento completo o Habitación." });
    expect(validateAll({ ...validDraft(), photoCount: 2 })).toEqual({ step: 4, error: "Agregue al menos 5 fotos." });
    expect(validateAll(validDraft())).toBeNull();
  });
});
