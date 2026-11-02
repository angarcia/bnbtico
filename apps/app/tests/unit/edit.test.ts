import { describe, expect, it } from "vitest";
import { editLabel, fieldTitle, fieldWarning, type FormField, editOverview, editSummary, editedFields, editFieldFromParam, mergeEdit, parseField, planEdit, photoPill, reviewNotice, type ListingEdit } from "../../src/domain/edit";
import { isPublished, can } from "../../src/domain/can";
import type { Listing, ListingDraft } from "../../src/domain/listing";
import { DESCRIPTION_LENGTH_ERROR, MONTHLY_PRICE_ERROR, NIGHTLY_PRICE_ERROR, TITLE_EMPTY_ERROR, TITLE_LENGTH_ERROR } from "../../src/domain/listing-rules";
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
  it("fieldTitle: una Habitación no tiene habitaciones que contar", () => {
    expect(fieldTitle("capacidad", "habitacion")).toBe("Personas y baños");
    expect(fieldTitle("capacidad", "completo")).toBe("Personas, habitaciones y baños");
    expect(fieldTitle("capacidad", null)).toBe("Personas, habitaciones y baños");
    expect(fieldTitle("nombre", "habitacion")).toBe("Nombre");
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
    expect(planEdit(activeListing, "caracteristicas", { features: ["wifi", "parking"], parkingPaid: null })).toEqual({ immediate: { features: ["wifi", "parking"] }, warning: "Indique si el parqueo es gratuito o de pago." });
    expect(planEdit(activeListing, "capacidad", { capacity: 2, bedrooms: 1, bathrooms: 1 })).toEqual({ immediate: {} });
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
        expect(planEdit(activeListing, "tipo", { kind: "completo", bathroomShared: true })).toEqual({ reviewed: { kind: "completo", bathroomShared: null } });
    expect(planEdit(activeListing, "ubicacion", { lat: 9.65, lng: -82.75, province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cahuita", zoneId: null, zoneSource: "district" })).toEqual({
      reviewed: { lat: 9.65, lng: -82.75, zone: "Cahuita", zoneId: null, zoneSource: "district" },
    });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "nombre", { title: "Casa Coco" })).toEqual({ reviewed: { title: "Casa Coco" } });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("planEdit: la descripción valida sobre la edición pendiente", () => {
    const pending = { ...activeListing, edit: edit({ title: "Casa Coco frente al mar" }) };
    expect(planEdit(pending, "descripcion", { description: "Corta" })).toMatchObject({ reviewed: { description: "Corta" }, warning: expect.stringContaining("descripción") });
    expect(planEdit({ ...activeListing, edit: edit({ title: "Casa" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("planEdit: un nombre aprobado de más de 32 caracteres no impide cambiar otro dato; uno nuevo de 33 sí falla", () => {
    const legacy = { ...activeListing, title: "N".repeat(40) };
    expect(planEdit(legacy, "descripcion", { description: "D".repeat(100) })).toEqual({ reviewed: { description: "D".repeat(100) } });
    expect(planEdit(legacy, "descripcion", { description: "Corta" })).toMatchObject({ reviewed: { description: "Corta" }, warning: expect.stringContaining("descripción") });
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
// Una tabla de casos por dato: lo que hace crear (obligatorio que bloquea, aviso en ocre o nada) con la casa resultante,
// frente a lo que hace editar (planEdit). Mismo resultado, salvo la excepción de los datos que se publican al momento:
// uno que ya tenía valor válido no se puede dejar vacío ni inválido.
type Outcome = "blocks" | "warns" | "ok";
const STEPS: Record<FormField, number[]> = { nombre: [6], descripcion: [6], tipo: [1], ubicacion: [2], capacidad: [4], caracteristicas: [5], precio: [8] };

/** Lo que haría el asistente con la casa resultante: el dato bloquea (requiredProblems), avisa (warnings) o está bien. */
function createOutcome(field: FormField, d: ListingDraft): Outcome {
  if (requiredProblems(d).some((p) => STEPS[field].includes(p.step) && (field !== "descripcion" || p.step !== 6))) return "blocks";
  if (field === "nombre" || field === "tipo" || field === "ubicacion") return "ok";
  return warnings(d).some((w) => STEPS[field].includes(w.step)) ? "warns" : "ok";
}
const editOutcome = (l: Listing, field: FormField, patch: Partial<ListingDraft>): { outcome: Outcome; error?: string } => {
  const plan = planEdit(l, field, patch);
  if ("error" in plan) return { outcome: "blocks", error: plan.error };
  return { outcome: plan.warning ? "warns" : "ok" };
};
const resulting = (l: Listing, patch: Partial<ListingDraft>): ListingDraft => ({ ...mergeEdit(l, null), ...patch });
const short50 = "D".repeat(50);

describe("editar sigue las reglas de crear · tabla por dato", () => {
  const nobath = { ...activeListing, bathrooms: null };
  const nocap = { ...activeListing, capacity: null };
  const cases: { name: string; row: Listing; field: FormField; patch: Partial<ListingDraft>; create: Outcome; edit: Outcome; error?: string }[] = [
    { name: "nombre de 4 caracteres", row: activeListing, field: "nombre", patch: { title: "Casa" }, create: "blocks", edit: "blocks", error: TITLE_LENGTH_ERROR },
    { name: "nombre vacío", row: activeListing, field: "nombre", patch: { title: "" }, create: "blocks", edit: "blocks", error: TITLE_EMPTY_ERROR },
    { name: "nombre de 33", row: activeListing, field: "nombre", patch: { title: "N".repeat(33) }, create: "blocks", edit: "blocks", error: TITLE_LENGTH_ERROR },
    { name: "nombre bueno con descripción de 50 (renombrar)", row: { ...activeListing, description: short50 }, field: "nombre", patch: { title: "Casa Coco frente al mar" }, create: "ok", edit: "ok" },
    { name: "descripción de 50", row: activeListing, field: "descripcion", patch: { description: short50 }, create: "warns", edit: "warns" },
    { name: "descripción vacía", row: activeListing, field: "descripcion", patch: { description: "" }, create: "warns", edit: "warns" },
    { name: "descripción de 80", row: activeListing, field: "descripcion", patch: { description: "D".repeat(80) }, create: "ok", edit: "ok" },
    { name: "tipo sin elegir", row: { ...activeListing, kind: null }, field: "tipo", patch: { kind: null }, create: "blocks", edit: "blocks", error: "Elija Alojamiento completo o Habitación." },
    { name: "ubicación sin punto", row: activeListing, field: "ubicacion", patch: { lat: null, lng: null }, create: "blocks", edit: "blocks", error: "Marque en el mapa la ubicación aproximada." },
    { name: "capacidad sin dato antes y sin dato ahora", row: nocap, field: "capacidad", patch: { capacity: null, bedrooms: 1, bathrooms: 1 }, create: "warns", edit: "warns" },
    { name: "baños sin dato antes y sin dato ahora", row: nobath, field: "capacidad", patch: { capacity: 2, bedrooms: 1, bathrooms: null }, create: "warns", edit: "warns" },
    { name: "parqueo sin tipo (antes sin parqueo)", row: activeListing, field: "caracteristicas", patch: { features: ["wifi", "parking"], parkingPaid: null }, create: "warns", edit: "warns" },
    { name: "precio por noche vacío", row: activeListing, field: "precio", patch: { nightlyPriceCrc: null }, create: "blocks", edit: "blocks", error: NIGHTLY_PRICE_ERROR },
    { name: "precio al mes mal escrito (antes vacío)", row: { ...activeListing, acceptsMonthly: true }, field: "precio", patch: { acceptsMonthly: true, monthlyPriceCrc: Number.NaN }, create: "warns", edit: "warns" },
    { name: "precio al mes vacío", row: { ...activeListing, acceptsMonthly: true, monthlyPriceCrc: 600000 }, field: "precio", patch: { acceptsMonthly: true, monthlyPriceCrc: null }, create: "ok", edit: "ok" },
    { name: "precio bueno con la casa sin baños", row: nobath, field: "precio", patch: { nightlyPriceCrc: 55000 }, create: "ok", edit: "ok" },
  ];
  for (const c of cases) {
    it(`${c.name}: crear ${c.create}, editar ${c.edit}`, () => {
      expect(createOutcome(c.field, resulting(c.row, c.patch))).toBe(c.create);
      const e = editOutcome(c.row, c.field, c.patch);
      expect(e.outcome).toBe(c.edit);
      if (c.error) expect(e.error).toBe(c.error);
    });
  }

  it("excepción: un dato publicado al momento que ya tenía valor válido no se puede dejar vacío ni inválido (crear solo avisa)", () => {
    const withParking = { ...activeListing, features: ["wifi", "parking"] as Listing["features"], parkingPaid: true };
    const monthly = { ...activeListing, acceptsMonthly: true, monthlyPriceCrc: 600000 };
    const exceptions: [string, Listing, FormField, Partial<ListingDraft>, string][] = [
      ["personas a 0", activeListing, "capacidad", { capacity: 0, bedrooms: 1, bathrooms: 1 }, "Indique cuántas personas pueden alojarse (mínimo 1)."],
      ["personas vacías", activeListing, "capacidad", { capacity: null, bedrooms: 1, bathrooms: 1 }, "Indique cuántas personas pueden alojarse (mínimo 1)."],
      ["baños vacíos", activeListing, "capacidad", { capacity: 2, bedrooms: 1, bathrooms: null }, "Indique el número de baños (mínimo 1)."],
      ["habitaciones vacías", activeListing, "capacidad", { capacity: 2, bedrooms: null, bathrooms: 1 }, "Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0."],
      ["tipo de parqueo vaciado", withParking, "caracteristicas", { features: ["wifi", "parking"], parkingPaid: null }, "Indique si el parqueo es gratuito o de pago."],
      ["precio al mes mal escrito (antes con valor)", monthly, "precio", { acceptsMonthly: true, monthlyPriceCrc: Number.NaN }, MONTHLY_PRICE_ERROR],
    ];
    for (const [name, row, field, patch, message] of exceptions) {
      expect(createOutcome(field, resulting(row, patch)), `crear: ${name}`).toBe("warns");
      expect(editOutcome(row, field, patch), `editar: ${name}`).toEqual({ outcome: "blocks", error: message });
    }
  });

  it("editar un dato valida solo ese dato: la casa sin baños cambia el precio y renombra con una descripción corta", () => {
    expect(planEdit({ ...activeListing, bathrooms: null }, "precio", { nightlyPriceCrc: 55000 })).toEqual({ immediate: { nightlyPriceCrc: 55000 } });
    expect(planEdit({ ...activeListing, description: short50 }, "nombre", { title: "Casa Coco frente al mar" })).toEqual({ reviewed: { title: "Casa Coco frente al mar" } });
    // La edición pendiente con otro dato mal tampoco estorba.
    expect(planEdit({ ...activeListing, edit: edit({ description: short50 }) }, "nombre", { title: "Casa Coco" })).toEqual({ reviewed: { title: "Casa Coco" } });
  });

  it("la descripción: de 50 se guarda con aviso; el tope de 2000 es duro", () => {
    expect(planEdit(activeListing, "descripcion", { description: short50 })).toEqual({ reviewed: { description: short50 }, warning: DESCRIPTION_LENGTH_ERROR });
    expect(planEdit(activeListing, "descripcion", { description: "" })).toEqual({ reviewed: { description: "" }, warning: DESCRIPTION_EMPTY_WARNING });
    expect(planEdit(activeListing, "descripcion", { description: "D".repeat(2001) })).toEqual({ error: DESCRIPTION_LENGTH_ERROR });
  });

  it("tipo: Habitación sin baño elegido se guarda (aviso en capacidad), pero sin tipo no", () => {
    expect(planEdit(activeListing, "tipo", { kind: "habitacion", bathroomShared: null })).toEqual({ reviewed: { kind: "habitacion", bathroomShared: null } });
    const room = { ...activeListing, kind: "habitacion" as const, bedrooms: 1, bathroomShared: null };
    expect(fieldWarning("capacidad", mergeEdit(room, null))).toBe("Indique si el baño es privado o compartido.");
  });

  it("un nombre viejo de más de 32 no impide guardar la descripción (con aviso)", () => {
    expect(planEdit({ ...activeListing, title: "N".repeat(40) }, "descripcion", { description: short50 })).toEqual({ reviewed: { description: short50 }, warning: DESCRIPTION_LENGTH_ERROR });
  });

  it("un nombre sin tocar no se envía ni se recorta (nombre viejo de más de 32)", () => {
    const legacy = { ...activeListing, title: "N".repeat(40) };
    const parsed = parseField("nombre", formInput([["title", "N".repeat(40)]]), mergeEdit(legacy, null));
    expect(parsed).toEqual({});
    expect(planEdit(legacy, "nombre", parsed)).toEqual({ reviewed: {} });
    expect(parseField("nombre", formInput([["title", "N".repeat(41)]]), mergeEdit(legacy, null))).toEqual({ title: "N".repeat(32) });
  });

  it("fieldWarning: el aviso de cada dato sobre la casa tal como está", () => {
    expect(fieldWarning("descripcion", { ...mergeEdit(activeListing, null), description: short50 })).toBe(DESCRIPTION_LENGTH_ERROR);
    expect(fieldWarning("descripcion", { ...mergeEdit(activeListing, null), title: "N".repeat(40), description: "" })).toBe(DESCRIPTION_EMPTY_WARNING);
    expect(fieldWarning("capacidad", { ...mergeEdit(activeListing, null), bathrooms: null })).toBe("Indique el número de baños (mínimo 1).");
    expect(fieldWarning("nombre", mergeEdit(activeListing, null))).toBeNull();
    expect(fieldWarning("precio", mergeEdit(activeListing, null))).toBeNull();
  });
});
