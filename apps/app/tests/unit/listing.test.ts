import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVINCE,
  DESCRIPTION_LENGTH_ERROR,
  MIN_PHOTOS_TO_APPROVE,
  TITLE_LENGTH_ERROR,
  FEATURES,
  KINDS,
  KIND_LABELS,
  MONTHLY_PRICE_ERROR,
  NIGHTLY_PRICE_ERROR,
  PROVINCES,
  STATUS_LABELS,
  STEP_COUNT,
  STEP_NAMES,
  STEPS,
  emptyDraft,
  isFreshDraft,
  isProposedZone,
  locationLine,
  nextStep,
  normalize,
  previousStep,
  parseColones,
  planStep,
  resumeStep,
  stepFromParam,
  stepPosition,
  wizardStage,
  validateAll,
  validateStep,
  type Feature,
  type ListingDraft,
} from "../../src/domain/listing";
import { formInput, parseStep } from "../../src/domain/step-forms";

// Modelo del diseño v1 (docs/diseno-v1.md, punto 11) con «Alquiler mensual» como característica (2026-10-27): toda casa
// se alquila por noches (precio por noche obligatorio) y puede aceptar alquiler por meses con precio al mes opcional.
// Alojamiento completo / Habitación (con baño privado o compartido), contadores. Copy en usted.
// Desde 2026-10-27 (ubicación por punto) el formulario va en 8 pantallas sin scroll, con ids de URL estables: 1 alojamiento,
// 2 ¿dónde está su casa? (mapa, cantón y zona), 4 capacidad, 5 características, 6 nombre y descripción, 7 fotos, 8 precio,
// 9 enviar. El 3 (el mapa de antes) se retiró y lleva al 2.

const fd = (entries: [string, string][]) => formInput(entries);

function validDraft(): ListingDraft {
  return {
    ...emptyDraft(),
    kind: "completo",
    acceptsNightly: true,
    acceptsMonthly: false,
    province: "Limón",
    canton: "Talamanca",
    district: "Cahuita",
    zone: "Manzanillo",
    zoneId: "704-manzanillo",
    zoneSource: "list",
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
  it("las 8 pantallas del formulario, en orden, con ids de URL estables (el 3 se retiró)", () => {
    expect(STEPS).toEqual([1, 2, 4, 5, 6, 7, 8, 9]);
    expect(STEP_COUNT).toBe(8);
    expect(STEP_NAMES).toEqual(["Alojamiento", "Ubicación", "Capacidad", "Características", "Nombre", "Fotos", "Precio", "Enviar"]);
    expect(stepPosition(1)).toBe(1);
    expect(stepPosition(2)).toBe(2);
    expect(stepPosition(4)).toBe(3);
    expect(stepPosition(9)).toBe(8);
  });
  it("de la URL al paso: el 3 viejo lleva al 2; lo demás que no es un paso, a ninguno", () => {
    expect(stepFromParam("3")).toEqual({ redirect: 2 });
    expect(stepFromParam("2")).toEqual({ step: 2 });
    expect(stepFromParam("9")).toEqual({ step: 9 });
    for (const bad of ["10", "x", "0", "", "02", "2.0"]) expect(stepFromParam(bad), bad).toBeNull();
  });
  it("siguiente y anterior saltan el 3", () => {
    expect(nextStep(2)).toBe(4);
    expect(nextStep(1)).toBe(2);
    expect(nextStep(9)).toBeNull();
    expect(previousStep(4)).toBe(2);
    expect(previousStep(2)).toBe(1);
    expect(previousStep(1)).toBeNull();
  });
  it("etiquetas de estado con los colores del diseño", () => {
    expect(STATUS_LABELS.review).toEqual({ label: "En revisión", badge: "badge-review" });
    expect(STATUS_LABELS.active).toEqual({ label: "Activa", badge: "badge-ok" });
    expect(STATUS_LABELS.changes).toEqual({ label: "Cambios pedidos", badge: "badge-review" });
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
  it("emptyDraft: toda casa por noches y «Alquiler mensual» en No", () => {
    expect(emptyDraft()).toMatchObject({ acceptsNightly: true, acceptsMonthly: false });
  });

  it("paso 1 solo exige el tipo", () => {
    const d = emptyDraft();
    expect(validateStep(1, d)).toBe("Elija Alojamiento completo o Habitación.");
    expect(validateStep(1, { ...d, kind: "completo", acceptsNightly: false, acceptsMonthly: false })).toBeNull();
  });

  it("paso 2: el pin, un punto en tierra de Costa Rica con cantón y provincia, y la zona", () => {
    const d = validDraft();
    expect(validateStep(2, d)).toBeNull();
    expect(validateStep(2, { ...d, lat: null, lng: null })).toBe("Marque en el mapa la ubicación aproximada.");
    expect(validateStep(2, { ...d, lng: null })).toBe("Marque en el mapa la ubicación aproximada.");
    expect(validateStep(2, { ...d, lat: 40.4, lng: -3.7 })).toBe("Ponga el punto sobre tierra, dentro de Costa Rica.");
    expect(validateStep(2, { ...d, canton: " " })).toBe("Ponga el punto sobre tierra, dentro de Costa Rica.");
    expect(validateStep(2, { ...d, province: "" })).toBe("Ponga el punto sobre tierra, dentro de Costa Rica.");
    expect(validateStep(2, { ...d, zone: " " })).toBe("Elija la zona.");
    expect(validateStep(2, { ...d, zoneSource: null })).toBe("Elija la zona.");
    expect(validateStep(2, { ...d, zoneId: null })).toBe("Elija la zona.");
    expect(validateStep(2, { ...d, zone: "Sixaola", zoneSource: "district", zoneId: null, district: "Cahuita" })).toBe("Elija la zona.");
    expect(validateStep(2, { ...d, zone: "Cahuita", zoneSource: "district", zoneId: null, district: "Cahuita" })).toBeNull();
    expect(validateStep(2, { ...d, zone: "x".repeat(61), zoneSource: "other", zoneId: null })).toBe("La zona puede tener como mucho 60 caracteres.");
    expect(validateStep(2, { ...d, zone: ` ${"x".repeat(59)}🌴 `, zoneSource: "other", zoneId: null })).toBeNull(); // caracteres, sin los extremos
    expect(validateStep(2, { ...d, zone: "Rancho Escondido", zoneSource: "other", zoneId: null })).toBeNull();
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

  it("paso 6: la descripción es opcional; si se escribe, de 80 a 2000", () => {
    const d = validDraft();
    expect(validateStep(6, d)).toBeNull();
    expect(validateStep(6, { ...d, description: "" })).toBeNull();
    expect(validateStep(6, { ...d, description: "   " })).toBeNull();
    expect(validateStep(6, { ...d, description: "a".repeat(79) })).toBe("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
    expect(validateStep(6, { ...d, description: "a".repeat(80) })).toBeNull();
    expect(validateStep(6, { ...d, description: ` ${"x".repeat(80)} ` })).toBeNull();
    expect(validateStep(6, { ...d, description: "a".repeat(2001) })).toBe(DESCRIPTION_LENGTH_ERROR);
  });

  it("paso 6: nombre de 5 a 32 caracteres", () => {
    expect(validateStep(6, { ...validDraft(), title: "" })).toBe("Póngale un nombre a la casa.");
    expect(validateStep(6, { ...validDraft(), title: " " })).toBe("Póngale un nombre a la casa.");
    expect(validateStep(6, { ...validDraft(), title: "Casa" })).toBe("El nombre de la casa debe tener entre 5 y 32 caracteres.");
    expect(validateStep(6, { ...validDraft(), title: "C".repeat(5) })).toBeNull();
    expect(validateStep(6, { ...validDraft(), title: "a".repeat(32) })).toBeNull();
    expect(validateStep(6, { ...validDraft(), title: "a".repeat(33) })).toBe(TITLE_LENGTH_ERROR);
    // Se cuentan caracteres, no unidades UTF-16 (como char_length en SQL): un emoji es uno.
    expect(validateStep(6, { ...validDraft(), title: `${"C".repeat(31)}🌴` })).toBeNull();
  });

  it("paso 7: con 0 y con 15 fotos pasa; con 16 falla", () => {
    const d = validDraft();
    expect(validateStep(7, { ...d, photoCount: 0 })).toBeNull();
    expect(validateStep(7, { ...d, photoCount: 15 })).toBeNull();
    expect(validateStep(7, { ...d, photoCount: 16 })).toBe("Máximo 15 fotos.");
  });

  it("aprobar pide al menos una foto", () => expect(MIN_PHOTOS_TO_APPROVE).toBe(1));

  it("paso 8: el precio por noche siempre es obligatorio", () => {
    const d = validDraft();
    expect(NIGHTLY_PRICE_ERROR).toBe("Indique el precio por noche en colones.");
    expect(validateStep(8, { ...d, nightlyPriceCrc: null })).toBe(NIGHTLY_PRICE_ERROR);
    expect(validateStep(8, { ...d, nightlyPriceCrc: null, acceptsMonthly: true, monthlyPriceCrc: 480000 })).toBe(NIGHTLY_PRICE_ERROR);
    expect(validateStep(8, { ...d, nightlyPriceCrc: Number.NaN })).toBe(NIGHTLY_PRICE_ERROR);
    expect(validateStep(8, { ...d, nightlyPriceCrc: 0 })).toBe(NIGHTLY_PRICE_ERROR);
    expect(validateStep(8, d)).toBeNull();
  });

  it("paso 8: el precio al mes es opcional, pero si se indica es un entero positivo", () => {
    const d = validDraft();
    expect(MONTHLY_PRICE_ERROR).toBe("Indique el precio al mes en colones o déjelo vacío.");
    expect(validateStep(8, { ...d, acceptsMonthly: true, monthlyPriceCrc: null })).toBeNull();
    expect(validateStep(8, { ...d, acceptsMonthly: true, monthlyPriceCrc: 0 })).toBe(MONTHLY_PRICE_ERROR);
    expect(validateStep(8, { ...d, acceptsMonthly: true, monthlyPriceCrc: Number.NaN })).toBe(MONTHLY_PRICE_ERROR);
    expect(validateStep(8, { ...d, acceptsMonthly: true, monthlyPriceCrc: -5 })).toBe(MONTHLY_PRICE_ERROR);
    expect(validateStep(8, { ...d, acceptsMonthly: false, monthlyPriceCrc: 0 })).toBeNull();
    expect(validateStep(8, { ...d, nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: 480000 })).toBeNull();
  });

  it("paso 9 no pide nada nuevo: la comprobación completa la hace validateAll al enviar", () => {
    expect(validateStep(9, emptyDraft())).toBeNull();
  });
});

describe("normalize", () => {
  it("quitar parqueo limpia parkingPaid", () => {
    expect(normalize({ ...validDraft(), features: ["wifi"], parkingPaid: true }).parkingPaid).toBeNull();
  });
  it("sin mensual no hay precio al mes; con mensual el modo antiguo no se toca", () => {
    expect(normalize({ ...validDraft(), acceptsMonthly: false, monthlyPriceCrc: 150000 }).monthlyPriceCrc).toBeNull();
    expect(normalize({ ...validDraft(), acceptsMonthly: true, monthlyPriceCrc: 480000 }).monthlyMode).toBeNull();
  });
  it("solo una zona de la lista lleva zoneId: el distrito y «Otra…» no", () => {
    expect(normalize({ ...validDraft(), zoneSource: "other", zoneId: "704-cocles" }).zoneId).toBeNull();
    expect(normalize({ ...validDraft(), zoneSource: "district", zoneId: "704-cocles" }).zoneId).toBeNull();
    expect(normalize({ ...validDraft(), zoneSource: "list", zoneId: "704-cocles" }).zoneId).toBe("704-cocles");
  });
  it("toda casa se alquila por noches; sin habitación no hay dato del baño", () => {
    expect(normalize({ ...validDraft(), acceptsNightly: false }).acceptsNightly).toBe(true);
    expect(normalize({ ...validDraft(), kind: "completo", bathroomShared: true }).bathroomShared).toBeNull();
  });
});

describe("parseStep (zod, misma semántica que el parser anterior)", () => {
  it("paso 1 solo lee el tipo (el campo antiguo de modalidades se ignora)", () => {
    expect(parseStep(1, fd([["kind", "completo"], ["modes", "nightly"]]))).toEqual({ kind: "completo" });
    expect(parseStep(1, fd([["kind", "x"]]))).toEqual({ kind: null });
  });
  it("paso 2 lee el pin, lo que dio place_at y la zona con su origen", () => {
    const base: [string, string][] = [["lat", "9.63"], ["lng", "-82.65"], ["province", "Limón"], ["canton", "Talamanca"], ["district", "Cahuita"], ["zone", " Manzanillo "]];
    expect(parseStep(2, fd([...base, ["zoneId", "704-manzanillo"], ["zoneSource", "list"]]))).toEqual({
      lat: 9.63,
      lng: -82.65,
      province: "Limón",
      canton: "Talamanca",
      district: "Cahuita",
      zone: "Manzanillo",
      zoneId: "704-manzanillo",
      zoneSource: "list",
    });
    expect(parseStep(2, fd([...base, ["zoneId", ""], ["zoneSource", "other"]]))).toMatchObject({ zoneId: null, zoneSource: "other" });
    expect(parseStep(2, fd([["lat", ""], ["lng", "x"], ["zoneSource", "inventada"]]))).toMatchObject({ lat: null, lng: null, zoneId: null, zoneSource: null });
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
    expect(parseStep(6, fd([["title", "x".repeat(120)], ["description", "y".repeat(2100)]]))).toEqual({ title: "x".repeat(32), description: "y".repeat(2000) });
  });
  it("paso 8: precio por noche, «¿Acepta alquiler por meses?» (No por defecto) y precio al mes opcional", () => {
    expect(parseStep(8, fd([["nightlyPriceCrc", "85.000"]]))).toEqual({ nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null });
    expect(parseStep(8, fd([["nightlyPriceCrc", "85000"], ["acceptsMonthly", "yes"], ["monthlyPriceCrc", ""]]))).toEqual({ nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: null });
    expect(parseStep(8, fd([["nightlyPriceCrc", "85000"], ["acceptsMonthly", "yes"], ["monthlyPriceCrc", "₡480 000"]]))).toEqual({ nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: 480000 });
    expect(parseStep(8, fd([["nightlyPriceCrc", "85000"], ["acceptsMonthly", "no"], ["monthlyPriceCrc", "480000"]]))).toEqual({ nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null });
    expect(parseStep(8, fd([["nightlyPriceCrc", ""]]))).toEqual({ nightlyPriceCrc: null, acceptsMonthly: false, monthlyPriceCrc: null });
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
  it("sin fotos y sin descripción se puede enviar; más de 15, no", () => {
    expect(validateAll({ ...validDraft(), photoCount: 0, description: "" })).toBeNull();
    expect(validateAll({ ...validDraft(), photoCount: 16 })).toEqual({ step: 7, error: "Máximo 15 fotos." });
    expect(resumeStep({ ...validDraft(), photoCount: 0 })).toBe(9);
  });

  it("devuelve el primer paso con error", () => {
    expect(validateAll(emptyDraft())).toEqual({ step: 1, error: "Elija Alojamiento completo o Habitación." });
    expect(validateAll({ ...validDraft(), photoCount: 16 })).toEqual({ step: 7, error: "Máximo 15 fotos." });
    expect(validateAll({ ...validDraft(), zoneSource: null })).toEqual({ step: 2, error: "Elija la zona." });
    expect(validateAll({ ...validDraft(), lat: null })).toEqual({ step: 2, error: "Marque en el mapa la ubicación aproximada." });
    expect(validateAll(validDraft())).toBeNull();
  });
});

describe("planStep (guardar una pantalla)", () => {
  it("valida la pantalla sobre el borrador mezclado y no devuelve cambios si falla", () => {
    expect(planStep(emptyDraft(), 1, { kind: null })).toEqual({ error: "Elija Alojamiento completo o Habitación." });
    expect(planStep({ ...validDraft(), kind: "habitacion", bathroomShared: null }, 4, { capacity: 2, bedrooms: 1, bathrooms: 1 })).toEqual({ error: "Indique si el baño es privado o compartido." });
  });

  it("devuelve solo las columnas que cambian, incluidas las que limpia normalize", () => {
    const current = { ...validDraft(), kind: "habitacion" as const, bathroomShared: true, nightlyPriceCrc: 42000 };
    const plan = planStep(current, 1, { kind: "completo" });
    expect(plan).toEqual({
      changes: { kind: "completo", bathroomShared: null },
      next: expect.objectContaining({ kind: "completo", bathroomShared: null, nightlyPriceCrc: 42000, acceptsNightly: true }),
    });
  });

  it("pasar «Alquiler mensual» a No limpia el precio al mes; quitar parqueo limpia su tipo", () => {
    const monthlyDraft = { ...validDraft(), acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 85000 };
    expect(planStep(monthlyDraft, 8, { nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null })).toEqual({
      changes: { acceptsMonthly: false, monthlyPriceCrc: null },
      next: expect.anything(),
    });
    const parking = { ...validDraft(), features: ["parking", "wifi"] as Feature[], parkingPaid: true };
    expect(planStep(parking, 5, { features: ["wifi"], parkingPaid: true })).toEqual({ changes: { features: ["wifi"], parkingPaid: null }, next: expect.anything() });
  });

  it("nada que cambiar: cambios vacíos", () => {
    expect(planStep(validDraft(), 2, { province: "Limón", canton: "Talamanca", zone: "Manzanillo", zoneId: "704-manzanillo", zoneSource: "list" })).toEqual({ changes: {}, next: expect.anything() });
  });

  it("paso 7: el número de fotos es el del borrador (servidor), nunca el del parche", () => {
    expect(planStep({ ...validDraft(), photoCount: 4 }, 7, { photoCount: 9 })).toEqual({ changes: {}, next: expect.objectContaining({ photoCount: 4 }) });
    expect(planStep({ ...validDraft(), photoCount: 5 }, 7, { photoCount: 0 })).toEqual({ changes: {}, next: expect.objectContaining({ photoCount: 5 }) });
  });
});

// Revisión UX A1/A5: «Seguir publicando» abre el primer paso con algo pendiente, no siempre el 1.
describe("paso donde retomar un borrador", () => {
  it("el primero que falta; todo completo → el 9 (revisar y enviar)", () => {
    expect(resumeStep(emptyDraft())).toBe(1);
    expect(resumeStep({ ...validDraft(), zone: "" })).toBe(2);
    expect(resumeStep({ ...validDraft(), lat: null, lng: null })).toBe(2); // con zona pero sin pin: el 2, nunca el 3
    expect(resumeStep({ ...validDraft(), photoCount: 0 })).toBe(9);
    expect(resumeStep({ ...validDraft(), nightlyPriceCrc: null })).toBe(8);
    expect(resumeStep(validDraft())).toBe(9);
  });
});

// Revisión UX C4 (punto 4): las pantallas en tres etapas (8 desde que el mapa se unió al paso 2).
describe("etapas del asistente", () => {
  it("Su casa (1, 2, 4, 5), Fotos y texto (6, 7), Precio (8, 9), con la posición dentro de la etapa", () => {
    expect(wizardStage(1)).toEqual({ name: "Su casa", index: 0, position: 1, size: 4, first: 1 });
    expect(wizardStage(2)).toEqual({ name: "Su casa", index: 0, position: 2, size: 4, first: 1 });
    expect(wizardStage(4)).toEqual({ name: "Su casa", index: 0, position: 3, size: 4, first: 1 });
    expect(wizardStage(5)).toEqual({ name: "Su casa", index: 0, position: 4, size: 4, first: 1 });
    expect(wizardStage(6)).toEqual({ name: "Fotos y texto", index: 1, position: 1, size: 2, first: 6 });
    expect(wizardStage(7)).toEqual({ name: "Fotos y texto", index: 1, position: 2, size: 2, first: 6 });
    expect(wizardStage(8)).toEqual({ name: "Precio", index: 2, position: 1, size: 2, first: 8 });
    expect(wizardStage(9)).toEqual({ name: "Precio", index: 2, position: 2, size: 2, first: 8 });
  });
});

describe("línea de la ubicación", () => {
  it("«zona · distrito, cantón, provincia»", () => {
    expect(locationLine({ zone: "Cocles", district: "Cahuita", canton: "Talamanca", province: "Limón" })).toBe("Cocles · Cahuita, Talamanca, Limón");
  });
  it("sin repetir la zona cuando es el distrito, y sin huecos", () => {
    expect(locationLine({ zone: "Cahuita", district: "Cahuita", canton: "Talamanca", province: "Limón" })).toBe("Cahuita, Talamanca, Limón");
    expect(locationLine({ zone: "Cocles", district: "", canton: "Talamanca", province: "Limón" })).toBe("Cocles · Talamanca, Limón");
    expect(locationLine({ zone: "", district: "", canton: "", province: "" })).toBe("");
  });
  it("zona propuesta por el dueño solo con «Otra…»", () => {
    expect(isProposedZone({ zoneSource: "other" })).toBe(true);
    expect(isProposedZone({ zoneSource: "list" })).toBe(false);
    expect(isProposedZone({ zoneSource: null })).toBe(false);
  });
});

describe("isFreshDraft (qué tener a mano, arriba del paso 1)", () => {
  it("un borrador recién creado, sin nada rellenado", () => {
    expect(isFreshDraft(emptyDraft())).toBe(true);
    expect(isFreshDraft({ ...emptyDraft(), province: "Puntarenas" })).toBe(true); // la provincia viene puesta
  });
  it("con cualquier cosa rellenada, ya no", () => {
    expect(isFreshDraft({ ...emptyDraft(), kind: "completo" })).toBe(false);
    expect(isFreshDraft({ ...emptyDraft(), acceptsMonthly: true })).toBe(false);
    expect(isFreshDraft({ ...emptyDraft(), title: "Casa" })).toBe(false);
    expect(isFreshDraft({ ...emptyDraft(), photoCount: 1 })).toBe(false);
    expect(isFreshDraft({ ...emptyDraft(), features: ["wifi"] })).toBe(false);
    expect(isFreshDraft(validDraft())).toBe(false);
  });
});
