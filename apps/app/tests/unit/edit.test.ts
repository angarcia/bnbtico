import { describe, expect, it } from "vitest";
import { editLabel, fieldTitle, fieldWarning, editOverview, editSummary, editedFields, editFieldFromParam, mergeEdit, parseField, photoPill, reviewNotice, type FormField, type ListingEdit } from "../../src/domain/edit";
import { planEdit } from "../../src/domain/edit-plan";
import { isPublished, can } from "../../src/domain/can";
import type { Listing, ListingDraft } from "../../src/domain/listing";
import {
  BATHROOM_SHARED_ERROR,
  BATHROOMS_ERROR,
  BEDROOMS_ERROR,
  CAPACITY_ERROR,
  DESCRIPTION_LENGTH_ERROR,
  MONTHLY_PRICE_ERROR,
  NIGHTLY_PRICE_ERROR,
  PARKING_ERROR,
  TITLE_EMPTY_ERROR,
  TITLE_LENGTH_ERROR,
} from "../../src/domain/listing-rules";
import { DESCRIPTION_EMPTY_WARNING, requiredProblems, warnings } from "../../src/domain/publish-rules";
import { formInput } from "../../src/domain/step-forms";
import { activeListing } from "./fixtures";

const edit = (p: Partial<ListingEdit> = {}): ListingEdit => ({ status: "review", fields: {}, title: null, kind: null, bathroomShared: null, description: null, location: null, submittedAt: null, photos: [], ...p });
const photo = (id: string) => ({ id, path: `x/${id}`, position: 0, url: `u/${id}`, status: "review" as const, reviewNote: null, submittedAt: "2026-10-30T10:00:00Z" });

describe("editar una casa publicada · dominio", () => {
  it("isPublished: activa, pendiente de pago o inactiva con primera publicación", () => {
    expect(isPublished({ status: "active", firstPublishedAt: "2026-10-01" })).toBe(true);
    expect(isPublished({ status: "inactive", firstPublishedAt: "2026-10-01" })).toBe(true);
    expect(isPublished({ status: "payment_due", firstPublishedAt: "2026-10-01" })).toBe(true);
    expect(isPublished({ status: "draft", firstPublishedAt: "2026-10-01" })).toBe(false);
    expect(isPublished({ status: "active", firstPublishedAt: null })).toBe(false);
  });
  it("una casa activa ya no se reabre; con cambios pedidos o rechazada sí", () => {
    expect(can({ status: "active", reviewedAt: "x" }, "reopen")).toBe(false);
    expect(can({ status: "changes", reviewedAt: "x" }, "reopen")).toBe(true);
    expect(can({ status: "rejected", reviewedAt: "x" }, "reopen")).toBe(true);
  });
  it("editLabel (revisión por dato, A5): «Cambios en revisión» o «Cambios pedidos»", () => {
    expect(editLabel(null)).toBeNull();
    expect(editLabel(edit({ status: "review" }))).toEqual({ label: "Cambios en revisión", badge: "state-review" });
    expect(editLabel(edit({ status: "changes" }))).toEqual({ label: "Cambios pedidos", badge: "state-review" });
  });
  it("editOverview: «review» con algo esperando al admin y su envío más antiguo; si no, «changes»", () => {
    const at = (status: "review" | "changes", submittedAt: string) => ({ status, reviewNote: null, submittedAt });
    expect(editOverview([at("review", "2026-10-30T12:00:00Z"), at("changes", "2026-10-29T08:00:00Z"), at("review", "2026-10-30T09:00:00Z")])).toEqual({
      status: "review",
      submittedAt: "2026-10-30T09:00:00Z",
    });
    expect(editOverview([at("changes", "2026-10-29T08:00:00Z")])).toEqual({ status: "changes", submittedAt: null });
  });
  it("reviewNotice nombra lo que los clientes siguen viendo", () => {
    const base = "Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven";
    expect(reviewNotice("nombre", activeListing)).toBe(`${base} «${activeListing.title}».`);
    expect(reviewNotice("ubicacion", activeListing)).toBe(`${base} «${activeListing.zone}».`);
    expect(reviewNotice("descripcion", activeListing)).toBe(`${base} la descripción de ahora.`);
  });
  it("editSummary y editedFields", () => {
    expect(editSummary(edit({ title: "Casa Coco frente al mar", description: "", photos: [photo("a"), photo("b")] }))).toBe("nombre, descripción, 2 fotos nuevas");
    expect(editSummary(edit({ photos: [photo("a")] }))).toBe("1 foto nueva");
    expect(editSummary(edit({ bathroomShared: true }))).toBe("tipo");
    expect(editSummary(edit())).toBe("");
    expect(editedFields(edit({ location: { lat: 9.65, lng: -82.75, zone: "Cocles", zoneId: "704-cocles", zoneSource: "list" }, title: "Otro nombre" }))).toEqual(["nombre", "ubicacion"]);
  });
  it("mergeEdit superpone lo cambiado y cuenta las fotos nuevas", () => {
    const m = mergeEdit(activeListing, edit({ title: "Casa Coco", kind: "habitacion", bathroomShared: true, photos: [photo("a")] }));
    expect(m).toMatchObject({ title: "Casa Coco", kind: "habitacion", bathroomShared: true, description: activeListing.description, photoCount: 6 });
    expect(mergeEdit(activeListing, edit({ kind: "completo", bathroomShared: true })).bathroomShared).toBeNull();
    expect(mergeEdit(activeListing, edit({ description: "" })).description).toBe("");
    expect(mergeEdit(activeListing, edit({ location: { lat: 9.65, lng: -82.75, zone: "Cocles", zoneId: "704-cocles", zoneSource: "list" } }))).toMatchObject({ lat: 9.65, lng: -82.75, zone: "Cocles", zoneId: "704-cocles", zoneSource: "list" });
    expect(mergeEdit(activeListing, null)).toMatchObject({ title: activeListing.title, photoCount: 5 });
  });
  it("planEdit: precio al momento, solo lo que cambia", () => {
    expect(planEdit(activeListing, "precio", { nightlyPriceCrc: 55000, acceptsMonthly: false, monthlyPriceCrc: null })).toEqual({ immediate: { nightlyPriceCrc: 55000 } });
    expect(planEdit(activeListing, "precio", { nightlyPriceCrc: 0 })).toEqual({ error: "Indique el precio por noche en colones." });
    // Antes sin parqueo: se puede añadir sin decir si se paga (como al crear: aviso en ocre).
    expect(planEdit(activeListing, "caracteristicas", { features: ["wifi", "parking"], parkingPaid: null })).toEqual({ immediate: { features: ["wifi", "parking"] }, warning: PARKING_ERROR });
    expect(planEdit(activeListing, "capacidad", { capacity: 2, bedrooms: 1, bathrooms: 1 })).toEqual({ immediate: {} });
  });
  it("fieldTitle: una Habitación solo pregunta personas («Personas»; el baño va con el tipo)", () => {
    expect(fieldTitle("capacidad", "habitacion")).toBe("Personas");
    expect(fieldTitle("capacidad", "completo")).toBe("Personas, dormitorios y baños");
    expect(fieldTitle("capacidad", null)).toBe("Personas, dormitorios y baños");
    expect(fieldTitle("capacidad")).toBe("Personas, dormitorios y baños");
    expect(fieldTitle("nombre", "habitacion")).toBe("Nombre");
  });
  it("planEdit: la capacidad de una Habitación no pide habitaciones ni baños (el formulario solo manda personas) y se quedan en 1", () => {
    const room = { ...activeListing, kind: "habitacion" as const, bathroomShared: true, bedrooms: 1, bathrooms: 1 };
    expect(parseField("capacidad", formInput([["capacity", "3"]]))).toEqual({ capacity: 3, bedrooms: null, bathrooms: null });
    expect(planEdit(room, "capacidad", { capacity: 3, bedrooms: null, bathrooms: null })).toEqual({ immediate: { capacity: 3 } });
    // Un dato viejo (null o más de 1) se corrige al guardar.
    expect(planEdit({ ...room, bedrooms: null, bathrooms: 2 }, "capacidad", { capacity: 2, bedrooms: null, bathrooms: null })).toEqual({ immediate: { bedrooms: 1, bathrooms: 1 } });
  });
  it("planEdit: un estudio (0 habitaciones) puede pasar a Habitación; la base fija 1 al aprobar", () => {
    const studio = { ...activeListing, bedrooms: 0 };
    expect(planEdit(studio, "tipo", { kind: "habitacion", bathroomShared: false })).toEqual({ reviewed: { kind: "habitacion", bathroomShared: false } });
  });
  it("planEdit: lo que limpia normalize también se envía", () => {
    const monthly = { ...activeListing, acceptsMonthly: true, monthlyPriceCrc: 600000 };
    expect(planEdit(monthly, "precio", { nightlyPriceCrc: 42000, acceptsMonthly: false })).toEqual({ immediate: { acceptsMonthly: false, monthlyPriceCrc: null } });
    const parking = { ...activeListing, features: ["wifi", "parking"] as typeof activeListing.features, parkingPaid: true };
    expect(planEdit(parking, "caracteristicas", { features: ["wifi"], parkingPaid: true })).toEqual({ immediate: { features: ["wifi"], parkingPaid: null } });
  });
  it("planEdit: nombre, tipo y ubicación van a revisión; con cambios en revisión se pueden volver a cambiar", () => {
    expect(planEdit(activeListing, "nombre", { title: "Casa Coco frente al mar" })).toEqual({ reviewed: { title: "Casa Coco frente al mar" } });
    expect(planEdit(activeListing, "nombre", { title: "Casa" })).toEqual({ error: TITLE_LENGTH_ERROR });
    // Como al crear: el baño sin elegir no bloquea, avisa (en la fila Tipo, donde se elige).
    expect(planEdit(activeListing, "tipo", { kind: "habitacion", bathroomShared: null })).toEqual({ reviewed: { kind: "habitacion", bathroomShared: null }, warning: BATHROOM_SHARED_ERROR });
    expect(planEdit(activeListing, "tipo", { kind: "completo", bathroomShared: true })).toEqual({ reviewed: { kind: "completo", bathroomShared: null } });
    expect(planEdit(activeListing, "ubicacion", { lat: 9.65, lng: -82.75, province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cahuita", zoneId: null, zoneSource: "district" })).toEqual({
      reviewed: { lat: 9.65, lng: -82.75, zone: "Cahuita", zoneId: null, zoneSource: "district" },
    });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "nombre", { title: "Casa Coco" })).toEqual({ reviewed: { title: "Casa Coco" } });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("planEdit: la descripción valida sobre la edición pendiente", () => {
    const pending = { ...activeListing, edit: edit({ title: "Casa Coco frente al mar" }) };
    expect(planEdit(pending, "descripcion", { description: "Corta" })).toEqual({ reviewed: { description: "Corta" }, warning: DESCRIPTION_LENGTH_ERROR });
    expect(planEdit({ ...activeListing, edit: edit({ title: "Casa" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("planEdit: un nombre aprobado de más de 32 caracteres no impide cambiar otro dato; uno nuevo de 33 sí falla", () => {
    const legacy = { ...activeListing, title: "N".repeat(40) };
    expect(planEdit(legacy, "descripcion", { description: "D".repeat(100) })).toEqual({ reviewed: { description: "D".repeat(100) } });
    // Un nombre viejo fuera de la regla no calla el aviso de la descripción.
    expect(planEdit(legacy, "descripcion", { description: "Corta" })).toEqual({ reviewed: { description: "Corta" }, warning: DESCRIPTION_LENGTH_ERROR });
    expect(planEdit(legacy, "tipo", { kind: "completo", bathroomShared: null })).toEqual({ reviewed: { kind: "completo", bathroomShared: null } });
    expect(planEdit(legacy, "nombre", { title: "T".repeat(33) })).toEqual({ error: TITLE_LENGTH_ERROR });
  });
  it("parseField solo devuelve las claves de su dato", () => {
    expect(parseField("nombre", formInput([["title", " Casa Coco "], ["description", "x"]]))).toEqual({ title: "Casa Coco" });
    expect(parseField("tipo", formInput([["kind", "habitacion"], ["bathroomShared", "shared"]]))).toEqual({ kind: "habitacion", bathroomShared: true });
    expect(parseField("precio", formInput([["nightlyPriceCrc", "55 000"], ["acceptsMonthly", "no"], ["capacity", "3"]]))).toEqual({ nightlyPriceCrc: 55000, acceptsMonthly: false, monthlyPriceCrc: null });
  });
  it("editFieldFromParam y photoPill", () => {
    expect(editFieldFromParam("precio")).toBe("precio");
    expect(editFieldFromParam("fotos")).toBe("fotos");
    expect(editFieldFromParam("calendario")).toBeNull();
    expect(photoPill(5, 0)).toBe("5 fotos · Editar");
    expect(photoPill(5, 1)).toBe("5 fotos · 1 nueva en revisión · Editar");
    expect(photoPill(5, 2)).toBe("5 fotos · 2 nuevas en revisión · Editar");
    expect(photoPill(1, 0)).toBe("1 foto · Editar");
  });
});

// ---------- Editar sigue las reglas de crear (ronda de Ana del 2026-11-02, ticket 12) ----------
// Tabla por dato: lo que hace el asistente con la casa resultante (bloquea con requiredProblems, avisa con warnings o nada)
// frente a lo que hace planEdit. Mismo resultado, salvo la excepción de los datos que se publican al momento: uno que ya
// tenía un valor válido no se puede dejar vacío ni inválido.
type Outcome = "bloquea" | "avisa" | "nada";
/** La pantalla del asistente de cada dato (el baño de una Habitación es de la 4, pero en la edición va con el tipo). */
const STEP_OF: Record<FormField, number> = { nombre: 6, descripcion: 6, tipo: 1, ubicacion: 2, capacidad: 4, caracteristicas: 5, precio: 8 };

function createOutcome(field: FormField, d: ListingDraft): { outcome: Outcome; message?: string } {
  const step = STEP_OF[field];
  // En la pantalla 6 el obligatorio es el nombre; la descripción solo avisa.
  const required = field === "descripcion" ? undefined : requiredProblems(d).find((p) => p.step === step);
  if (required) return { outcome: "bloquea", message: required.error };
  if (field === "nombre" || field === "ubicacion") return { outcome: "nada" };
  // El aviso de la pantalla 4 se reparte: en la edición, el baño de una Habitación va con el tipo (A5) y lo demás con la
  // capacidad. Para el tipo solo cuenta el baño; para la capacidad, todo menos el baño.
  const checked = field === "tipo" ? { ...d, capacity: 1, bedrooms: 1, bathrooms: 1 } : field === "capacidad" ? { ...d, bathroomShared: d.bathroomShared ?? false } : d;
  const warned = warnings(checked).find((w) => w.step === (field === "tipo" ? 4 : step));
  return warned ? { outcome: "avisa", message: warned.error } : { outcome: "nada" };
}
function editOutcome(l: Listing, field: FormField, patch: Partial<ListingDraft>): { outcome: Outcome; message?: string } {
  const plan = planEdit(l, field, patch);
  if ("error" in plan) return { outcome: "bloquea", message: plan.error };
  return plan.warning ? { outcome: "avisa", message: plan.warning } : { outcome: "nada" };
}
const resulting = (l: Listing, patch: Partial<ListingDraft>): ListingDraft => ({ ...mergeEdit(l, l.edit), ...patch });
const D50 = "D".repeat(50);
const room = { ...activeListing, kind: "habitacion" as const, bedrooms: 1, bathrooms: 1, bathroomShared: true };

describe("editar sigue las reglas de crear · tabla por dato", () => {
  const nobath = { ...activeListing, bathrooms: null };
  const nocap = { ...activeListing, capacity: null };
  const nobeds = { ...activeListing, bedrooms: null };
  const cases: { name: string; row: Listing; field: FormField; patch: Partial<ListingDraft>; outcome: Outcome; message?: string }[] = [
    { name: "nombre vacío", row: activeListing, field: "nombre", patch: { title: "" }, outcome: "bloquea", message: TITLE_EMPTY_ERROR },
    { name: "nombre de 4", row: activeListing, field: "nombre", patch: { title: "Casa" }, outcome: "bloquea", message: TITLE_LENGTH_ERROR },
    { name: "nombre de 33", row: activeListing, field: "nombre", patch: { title: "N".repeat(33) }, outcome: "bloquea", message: TITLE_LENGTH_ERROR },
    { name: "nombre de 32 con descripción de 50 (renombrar)", row: { ...activeListing, description: D50 }, field: "nombre", patch: { title: "N".repeat(32) }, outcome: "nada" },
    { name: "descripción de 50", row: activeListing, field: "descripcion", patch: { description: D50 }, outcome: "avisa", message: DESCRIPTION_LENGTH_ERROR },
    { name: "descripción vacía", row: activeListing, field: "descripcion", patch: { description: "" }, outcome: "avisa", message: DESCRIPTION_EMPTY_WARNING },
    { name: "descripción de 80", row: activeListing, field: "descripcion", patch: { description: "D".repeat(80) }, outcome: "nada" },
    { name: "descripción de 2000", row: activeListing, field: "descripcion", patch: { description: "D".repeat(2000) }, outcome: "nada" },
    { name: "tipo sin elegir", row: activeListing, field: "tipo", patch: { kind: null, bathroomShared: null }, outcome: "bloquea", message: "Elija Alojamiento completo o Habitación." },
    { name: "Habitación sin baño elegido", row: activeListing, field: "tipo", patch: { kind: "habitacion", bathroomShared: null }, outcome: "avisa", message: BATHROOM_SHARED_ERROR },
    { name: "Habitación con baño", row: activeListing, field: "tipo", patch: { kind: "habitacion", bathroomShared: false }, outcome: "nada" },
    { name: "tipo de una casa sin habitaciones ni baños", row: { ...activeListing, bedrooms: null, bathrooms: null }, field: "tipo", patch: { kind: "completo", bathroomShared: null }, outcome: "nada" },
    { name: "ubicación sin punto", row: activeListing, field: "ubicacion", patch: { lat: null, lng: null }, outcome: "bloquea", message: "Marque en el mapa la ubicación aproximada." },
    { name: "ubicación de una casa sin habitaciones", row: nobeds, field: "ubicacion", patch: { zone: "Cahuita" }, outcome: "nada" },
    { name: "personas: vacías antes y ahora", row: nocap, field: "capacidad", patch: { capacity: null, bedrooms: 1, bathrooms: 1 }, outcome: "avisa", message: CAPACITY_ERROR },
    { name: "baños: vacíos antes y ahora, cambiando las personas", row: nobath, field: "capacidad", patch: { capacity: 4, bedrooms: 1, bathrooms: null }, outcome: "avisa", message: BATHROOMS_ERROR },
    { name: "habitaciones: vacías antes y ahora", row: nobeds, field: "capacidad", patch: { capacity: 2, bedrooms: null, bathrooms: 1 }, outcome: "avisa", message: BEDROOMS_ERROR },
    { name: "personas de una Habitación (el baño va con el tipo)", row: { ...room, bathroomShared: null }, field: "capacidad", patch: { capacity: 3, bedrooms: null, bathrooms: null }, outcome: "nada" },
    { name: "parqueo sin tipo (antes sin parqueo)", row: activeListing, field: "caracteristicas", patch: { features: ["wifi", "parking"], parkingPaid: null }, outcome: "avisa", message: PARKING_ERROR },
    { name: "precio por noche vacío", row: activeListing, field: "precio", patch: { nightlyPriceCrc: null }, outcome: "bloquea", message: NIGHTLY_PRICE_ERROR },
    { name: "precio por noche mal escrito", row: activeListing, field: "precio", patch: { nightlyPriceCrc: Number.NaN }, outcome: "bloquea", message: NIGHTLY_PRICE_ERROR },
    { name: "precio al mes mal escrito (antes vacío)", row: { ...activeListing, acceptsMonthly: true }, field: "precio", patch: { acceptsMonthly: true, monthlyPriceCrc: Number.NaN }, outcome: "avisa", message: MONTHLY_PRICE_ERROR },
    { name: "precio al mes vacío (antes con valor)", row: { ...activeListing, acceptsMonthly: true, monthlyPriceCrc: 600000 }, field: "precio", patch: { acceptsMonthly: true, monthlyPriceCrc: null }, outcome: "nada" },
    { name: "precio de una casa sin baños", row: nobath, field: "precio", patch: { nightlyPriceCrc: 55000 }, outcome: "nada" },
  ];
  for (const c of cases) {
    it(`${c.name}: crear y editar · ${c.outcome}`, () => {
      const expected = c.message ? { outcome: c.outcome, message: c.message } : { outcome: c.outcome };
      expect(createOutcome(c.field, resulting(c.row, c.patch)), "crear").toEqual(expected);
      expect(editOutcome(c.row, c.field, c.patch), "editar").toEqual(expected);
    });
  }

  it("la excepción: un dato que se publica al momento y ya tenía valor válido no se deja vacío ni inválido (crear solo avisa)", () => {
    const parked = { ...activeListing, features: ["wifi", "parking"] as Listing["features"], parkingPaid: true };
    const monthly = { ...activeListing, acceptsMonthly: true, monthlyPriceCrc: 600000 };
    const exceptions: [string, Listing, FormField, Partial<ListingDraft>, string][] = [
      ["personas vacías", activeListing, "capacidad", { capacity: null, bedrooms: 1, bathrooms: 1 }, CAPACITY_ERROR],
      ["personas a 0", activeListing, "capacidad", { capacity: 0, bedrooms: 1, bathrooms: 1 }, CAPACITY_ERROR],
      ["habitaciones vacías", activeListing, "capacidad", { capacity: 2, bedrooms: null, bathrooms: 1 }, BEDROOMS_ERROR],
      ["baños vacíos", activeListing, "capacidad", { capacity: 2, bedrooms: 1, bathrooms: null }, BATHROOMS_ERROR],
      ["tipo de parqueo vaciado", parked, "caracteristicas", { features: ["wifi", "parking"], parkingPaid: null }, PARKING_ERROR],
      ["precio al mes mal escrito (antes con valor)", monthly, "precio", { nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: Number.NaN }, MONTHLY_PRICE_ERROR],
    ];
    for (const [name, row, field, patch, message] of exceptions) {
      expect(createOutcome(field, resulting(row, patch)), `crear: ${name}`).toEqual({ outcome: "avisa", message });
      expect(editOutcome(row, field, patch), `editar: ${name}`).toEqual({ outcome: "bloquea", message });
    }
  });

  it("lo que no tenía valor se guarda vacío; lo que la tabla no admite, también (como «Continuar» al crear)", () => {
    expect(planEdit({ ...activeListing, capacity: null }, "capacidad", { capacity: 0, bedrooms: 1, bathrooms: 1 })).toEqual({ immediate: {}, warning: CAPACITY_ERROR });
    expect(planEdit(activeListing, "precio", { nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: Number.NaN })).toEqual({ immediate: { acceptsMonthly: true }, warning: MONTHLY_PRICE_ERROR });
    // Quitar el parqueo o el mensual que tenían valor vale: no es dejarlo vacío, es cambiarlo.
    const parked = { ...activeListing, features: ["wifi", "parking"] as Listing["features"], parkingPaid: false };
    expect(planEdit(parked, "caracteristicas", { features: ["wifi"], parkingPaid: null })).toEqual({ immediate: { features: ["wifi"], parkingPaid: null } });
  });

  it("editar un dato valida solo ese dato: lo demás mal de la casa (o de la edición pendiente) no estorba", () => {
    expect(planEdit({ ...activeListing, bathrooms: null, capacity: null }, "precio", { nightlyPriceCrc: 55000, acceptsMonthly: false, monthlyPriceCrc: null })).toEqual({ immediate: { nightlyPriceCrc: 55000 } });
    expect(planEdit({ ...activeListing, description: D50 }, "nombre", { title: "Casa Coco frente al mar" })).toEqual({ reviewed: { title: "Casa Coco frente al mar" } });
    expect(planEdit({ ...activeListing, edit: edit({ description: D50 }) }, "nombre", { title: "Casa Coco" })).toEqual({ reviewed: { title: "Casa Coco" } });
    expect(planEdit({ ...activeListing, title: "N".repeat(40), bedrooms: null }, "tipo", { kind: "habitacion", bathroomShared: true })).toEqual({ reviewed: { kind: "habitacion", bathroomShared: true } });
  });

  it("la descripción: el tope de 2000 es duro", () => {
    expect(planEdit(activeListing, "descripcion", { description: "D".repeat(2001) })).toEqual({ error: DESCRIPTION_LENGTH_ERROR });
  });

  it("un nombre sin tocar no se envía ni se recorta (un nombre viejo de más de 32); uno tocado sí, con el tope del campo", () => {
    const legacy = { ...activeListing, title: "N".repeat(40) };
    const shown = mergeEdit(legacy, null);
    expect(parseField("nombre", formInput([["title", ` ${"N".repeat(40)} `]]), shown)).toEqual({});
    expect(planEdit(legacy, "nombre", {})).toEqual({ reviewed: {} });
    expect(parseField("nombre", formInput([["title", "M".repeat(40)]]), shown)).toEqual({ title: "M".repeat(32) });
  });

  it("un tipo viejo (casa, apartamento) sin tocar se queda como está; elegir Habitación sí lo cambia", () => {
    const old = mergeEdit({ ...activeListing, kind: "casa" }, null);
    expect(parseField("tipo", formInput([["kind", "completo"]]), old)).toEqual({ kind: "casa", bathroomShared: null });
    expect(parseField("tipo", formInput([["kind", "habitacion"], ["bathroomShared", "private"]]), old)).toEqual({ kind: "habitacion", bathroomShared: false });
    expect(planEdit({ ...activeListing, kind: "casa" }, "tipo", { kind: "casa", bathroomShared: null })).toEqual({ reviewed: { kind: "casa", bathroomShared: null } });
  });

  it("fieldWarning: el aviso en ocre de cada fila de la ficha editable, el mismo que «Revisar y enviar»", () => {
    const d = mergeEdit(activeListing, null);
    expect(fieldWarning("descripcion", { ...d, description: D50 })).toBe(DESCRIPTION_LENGTH_ERROR);
    expect(fieldWarning("descripcion", { ...d, title: "N".repeat(40), description: "" })).toBe(DESCRIPTION_EMPTY_WARNING);
    expect(fieldWarning("capacidad", { ...d, bathrooms: null })).toBe(BATHROOMS_ERROR);
    expect(fieldWarning("caracteristicas", { ...d, features: ["parking"], parkingPaid: null })).toBe(PARKING_ERROR);
    // El baño de una Habitación avisa en la fila Tipo (donde se elige), no en Personas.
    const r = mergeEdit({ ...room, bathroomShared: null }, null);
    expect(fieldWarning("tipo", r)).toBe(BATHROOM_SHARED_ERROR);
    expect(fieldWarning("capacidad", r)).toBeNull();
    expect(fieldWarning("capacidad", { ...r, capacity: null })).toBe(CAPACITY_ERROR);
    for (const f of ["nombre", "ubicacion", "precio", "tipo", "capacidad"] as const) expect(fieldWarning(f, d)).toBeNull();
  });
});
