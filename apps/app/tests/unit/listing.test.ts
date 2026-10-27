import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVINCE,
  FEATURES,
  KINDS,
  KIND_LABELS,
  PROVINCES,
  STATUS_LABELS,
  STEP_NAMES,
  emptyDraft,
  normalize,
  parseColones,
  planStep,
  resumeStep,
  validateAll,
  validateStep,
  type Feature,
  type ListingDraft,
} from "../../src/domain/listing";
import { formInput, parseStep } from "../../src/domain/step-forms";

// Modelo del diseño v1 (docs/diseno-v1.md, punto 11): Vacacional / Mensual (una o las dos), Alojamiento completo /
// Habitación (con baño privado o compartido), contadores, un precio por modalidad. Copy en usted.
// Desde 2026-10-21 el formulario va en 9 pantallas sin scroll: 1 alojamiento, 2 dónde está, 3 mapa, 4 capacidad,
// 5 características, 6 nombre y descripción, 7 fotos, 8 precio, 9 enviar.

const fd = (entries: [string, string][]) => formInput(entries);

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
    description: "Casa de madera a 80 m de la playa, con rancho, hamacas y un jardín grande donde se ven monos.",
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
  it("los 9 pasos del formulario, en orden", () => {
    expect(STEP_NAMES).toEqual(["Alojamiento", "Ubicación", "Mapa", "Capacidad", "Características", "Nombre", "Fotos", "Precio", "Enviar"]);
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

  it("paso 2 exige provincia de la lista, cantón de esa provincia y zona", () => {
    const d = validDraft();
    expect(validateStep(2, d)).toBeNull();
    expect(validateStep(2, { ...d, province: "Marte" })).toBe("Elija la provincia.");
    expect(validateStep(2, { ...d, canton: "  " })).toBe("Elija el cantón.");
    expect(validateStep(2, { ...d, canton: "Nicoya" })).toBe("Elija un cantón de la provincia.");
    expect(validateStep(2, { ...d, zone: " " })).toBe("Indique la zona, playa o barrio.");
    expect(validateStep(2, { ...d, lat: null, lng: null })).toBeNull(); // el pin va en el paso 3
  });

  it("paso 3 exige el pin dentro de Costa Rica", () => {
    const d = validDraft();
    expect(validateStep(3, d)).toBeNull();
    expect(validateStep(3, { ...d, lat: null })).toBe("Marque en el mapa la ubicación aproximada.");
    expect(validateStep(3, { ...d, lat: 40.4, lng: -3.7 })).toBe("Marque un punto dentro de Costa Rica.");
  });

  it("paso 4: alojamiento completo admite 0 habitaciones (estudio); una habitación no", () => {
    const d = validDraft();
    expect(validateStep(4, { ...d, kind: "completo", bedrooms: 0 })).toBeNull();
    expect(validateStep(4, { ...d, kind: "habitacion", bedrooms: 0, bathroomShared: false })).toBe("Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.");
  });

  it("paso 4: habitaciones vacías o 1.5 fallan", () => {
    const d = validDraft();
    expect(validateStep(4, { ...d, bedrooms: null })).toMatch(/habitaciones/);
    expect(validateStep(4, { ...d, bedrooms: 1.5 })).toMatch(/habitaciones/);
  });

  it("paso 4: personas y baños mínimo 1; habitación exige baño privado o compartido", () => {
    const d = validDraft();
    expect(validateStep(4, { ...d, capacity: 0 })).toBe("Indique cuántas personas pueden alojarse (mínimo 1).");
    expect(validateStep(4, { ...d, bathrooms: 0 })).toBe("Indique el número de baños (mínimo 1).");
    expect(validateStep(4, { ...d, kind: "habitacion", bedrooms: 1, bathroomShared: null })).toBe("Indique si el baño es privado o compartido.");
    expect(validateStep(4, { ...d, kind: "habitacion", bedrooms: 1, bathroomShared: true })).toBeNull();
    expect(validateStep(4, { ...d, title: " " })).toBeNull(); // el nombre va en el paso 6
  });

  it("paso 5: parqueo exige tipo; sin características también vale", () => {
    const d = validDraft();
    expect(validateStep(5, { ...d, features: ["parking"], parkingPaid: null })).toBe("Indique si el parqueo es gratuito o de pago.");
    expect(validateStep(5, { ...d, features: ["parking"], parkingPaid: false })).toBeNull();
    expect(validateStep(5, { ...d, features: [] })).toBeNull();
  });

  it("paso 6: nombre y descripción", () => {
    const d = validDraft();
    expect(validateStep(6, d)).toBeNull();
    expect(validateStep(6, { ...d, title: " " })).toBe("Póngale un nombre a la casa.");
    expect(validateStep(6, { ...d, description: " " })).toBe("Escriba una descripción.");
    expect(validateStep(6, { ...d, title: "Casa" })).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    expect(validateStep(6, { ...d, title: "C".repeat(5) })).toBeNull();
    expect(validateStep(6, { ...d, title: "C".repeat(61) })).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    expect(validateStep(6, { ...d, description: "x".repeat(79) })).toBe("La descripción debe tener entre 80 y 2000 caracteres.");
    expect(validateStep(6, { ...d, description: ` ${"x".repeat(80)} ` })).toBeNull();
    expect(validateStep(6, { ...d, description: "x".repeat(2001) })).toBe("La descripción debe tener entre 80 y 2000 caracteres.");
    // Se cuentan caracteres, no unidades UTF-16 (como char_length en SQL): un emoji es uno.
    expect(validateStep(6, { ...d, title: `${"C".repeat(59)}🌴` })).toBeNull();
  });

  it("paso 7: 4 fotos falla, 5 pasa, 16 falla", () => {
    const d = validDraft();
    expect(validateStep(7, { ...d, photoCount: 4 })).toBe("Agregue al menos 5 fotos.");
    expect(validateStep(7, { ...d, photoCount: 5 })).toBeNull();
    expect(validateStep(7, { ...d, photoCount: 16 })).toBe("Máximo 15 fotos.");
  });

  it("paso 8: un precio por modalidad", () => {
    const d = validDraft();
    expect(validateStep(8, { ...d, nightlyPriceCrc: Number.NaN })).toBe("Indique el precio por noche en colones.");
    expect(validateStep(8, { ...d, nightlyPriceCrc: 0 })).toBe("Indique el precio por noche en colones.");
    expect(validateStep(8, d)).toBeNull();
    const both = { ...d, acceptsMonthly: true };
    expect(validateStep(8, both)).toBe("Indique el precio por mes en colones.");
    expect(validateStep(8, { ...both, monthlyPriceCrc: 480000 })).toBeNull();
    const monthlyOnly = { ...d, acceptsNightly: false, acceptsMonthly: true, nightlyPriceCrc: null, monthlyPriceCrc: 480000 };
    expect(validateStep(8, monthlyOnly)).toBeNull();
  });

  it("paso 9 no pide nada nuevo: la comprobación completa la hace validateAll al enviar", () => {
    expect(validateStep(9, emptyDraft())).toBeNull();
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

describe("parseStep (zod, misma semántica que el parser anterior)", () => {
  it("paso 1 lee tipo y modalidades como casillas", () => {
    expect(parseStep(1, fd([["kind", "completo"], ["modes", "nightly"], ["modes", "monthly"]]))).toEqual({ kind: "completo", acceptsNightly: true, acceptsMonthly: true });
    expect(parseStep(1, fd([["kind", "x"]]))).toEqual({ kind: null, acceptsNightly: false, acceptsMonthly: false });
  });
  it("paso 2 lee provincia, cantón y zona; paso 3 el pin", () => {
    expect(parseStep(2, fd([["province", "Limón"], ["canton", "Talamanca"], ["zone", " Manzanillo "]]))).toEqual({ province: "Limón", canton: "Talamanca", zone: "Manzanillo" });
    expect(parseStep(3, fd([["lat", "9.63"], ["lng", "-82.65"]]))).toEqual({ lat: 9.63, lng: -82.65 });
    expect(parseStep(3, fd([["lat", ""], ["lng", "x"]]))).toEqual({ lat: null, lng: null });
  });
  it("paso 4 lee contadores y baño", () => {
    const base: [string, string][] = [["capacity", "4"], ["bedrooms", "2"], ["bathrooms", "1"]];
    expect(parseStep(4, fd([...base, ["bathroomShared", "shared"]]))).toEqual({ capacity: 4, bedrooms: 2, bathrooms: 1, bathroomShared: true });
    expect(parseStep(4, fd([...base, ["bathroomShared", "private"]]))).toMatchObject({ bathroomShared: false });
    expect(parseStep(4, fd(base))).toMatchObject({ bathroomShared: null });
  });
  it("paso 5 lee características y tipo de parqueo", () => {
    expect(parseStep(5, fd([["features", "wifi"], ["features", "parking"], ["features", "nada"], ["parkingPaid", "paid"]]))).toEqual({ features: ["wifi", "parking"], parkingPaid: true });
    expect(parseStep(5, fd([]))).toEqual({ features: [], parkingPaid: null });
  });
  it("paso 6 recorta nombre y descripción", () => {
    expect(parseStep(6, fd([["title", " Casa "], ["description", " Linda "]]))).toEqual({ title: "Casa", description: "Linda" });
    expect(parseStep(6, fd([["title", "x".repeat(120)], ["description", "y".repeat(2100)]]))).toEqual({ title: "x".repeat(60), description: "y".repeat(2000) });
  });
  it("paso 8 usa parseColones para los dos precios", () => {
    expect(parseStep(8, fd([["nightlyPriceCrc", "85.000"], ["monthlyPriceCrc", "₡480 000"]]))).toEqual({ nightlyPriceCrc: 85000, monthlyPriceCrc: 480000 });
    expect(parseStep(8, fd([["nightlyPriceCrc", ""]]))).toEqual({ nightlyPriceCrc: null, monthlyPriceCrc: null });
  });
  it("paso 9 no cambia nada", () => {
    expect(parseStep(9, fd([["title", "no"]]))).toEqual({});
  });
  it("paso 7 ignora cualquier número de fotos del formulario: lo da la lista del servidor", () => {
    expect(parseStep(7, fd([["photoCount", "12"]]))).toEqual({});
  });
  it("formInput agrupa claves repetidas e ignora archivos", () => {
    expect(formInput([["modes", "nightly"], ["modes", "monthly"], ["foto", new Blob()]])).toEqual({ modes: ["nightly", "monthly"] });
  });
});

describe("validateAll", () => {
  it("devuelve el primer paso con error", () => {
    expect(validateAll(emptyDraft())).toEqual({ step: 1, error: "Elija Alojamiento completo o Habitación." });
    expect(validateAll({ ...validDraft(), photoCount: 2 })).toEqual({ step: 7, error: "Agregue al menos 5 fotos." });
    expect(validateAll({ ...validDraft(), canton: "Nicoya" })).toEqual({ step: 2, error: "Elija un cantón de la provincia." });
    expect(validateAll({ ...validDraft(), lat: null })).toEqual({ step: 3, error: "Marque en el mapa la ubicación aproximada." });
    expect(validateAll(validDraft())).toBeNull();
  });
});

describe("planStep (guardar una pantalla)", () => {
  it("valida la pantalla sobre el borrador mezclado y no devuelve cambios si falla", () => {
    expect(planStep(emptyDraft(), 1, { kind: "completo" })).toEqual({ error: "Marque Vacacional, Mensual o las dos." });
    expect(planStep({ ...validDraft(), kind: "habitacion", bathroomShared: null }, 4, { capacity: 2, bedrooms: 1, bathrooms: 1 })).toEqual({ error: "Indique si el baño es privado o compartido." });
  });

  it("devuelve solo las columnas que cambian, incluidas las que limpia normalize", () => {
    const current = { ...validDraft(), kind: "habitacion" as const, bathroomShared: true, acceptsNightly: true, nightlyPriceCrc: 42000 };
    const plan = planStep(current, 1, { kind: "completo", acceptsNightly: false, acceptsMonthly: true });
    expect(plan).toEqual({
      changes: { kind: "completo", acceptsNightly: false, acceptsMonthly: true, bathroomShared: null, nightlyPriceCrc: null, monthlyMode: "amount" },
      next: expect.objectContaining({ kind: "completo", bathroomShared: null, nightlyPriceCrc: null, monthlyMode: "amount" }),
    });
  });

  it("sin mensual se limpian modo y precio mensual; quitar parqueo limpia su tipo", () => {
    const monthly = { ...validDraft(), acceptsMonthly: true, monthlyMode: "amount" as const, monthlyPriceCrc: 480000 };
    expect(planStep(monthly, 1, { kind: "completo", acceptsNightly: true, acceptsMonthly: false })).toEqual({
      changes: { acceptsMonthly: false, monthlyMode: null, monthlyPriceCrc: null },
      next: expect.anything(),
    });
    const parking = { ...validDraft(), features: ["parking", "wifi"] as Feature[], parkingPaid: true };
    expect(planStep(parking, 5, { features: ["wifi"], parkingPaid: true })).toEqual({ changes: { features: ["wifi"], parkingPaid: null }, next: expect.anything() });
  });

  it("nada que cambiar: cambios vacíos", () => {
    expect(planStep(validDraft(), 2, { province: "Limón", canton: "Talamanca", zone: "Manzanillo" })).toEqual({ changes: {}, next: expect.anything() });
  });

  it("paso 7: el número de fotos es el del borrador (servidor), nunca el del parche", () => {
    expect(planStep({ ...validDraft(), photoCount: 4 }, 7, { photoCount: 9 })).toEqual({ error: "Agregue al menos 5 fotos." });
    expect(planStep({ ...validDraft(), photoCount: 5 }, 7, { photoCount: 0 })).toEqual({ changes: {}, next: expect.objectContaining({ photoCount: 5 }) });
  });
});

// Revisión UX A1/A5: «Seguir publicando» abre el primer paso con algo pendiente, no siempre el 1.
describe("paso donde retomar un borrador", () => {
  it("el primero que falta; todo completo → el 9 (revisar y enviar)", () => {
    expect(resumeStep(emptyDraft())).toBe(1);
    expect(resumeStep({ ...validDraft(), zone: "" })).toBe(2);
    expect(resumeStep({ ...validDraft(), photoCount: 2 })).toBe(7);
    expect(resumeStep({ ...validDraft(), nightlyPriceCrc: null })).toBe(8);
    expect(resumeStep(validDraft())).toBe(9);
  });
});
