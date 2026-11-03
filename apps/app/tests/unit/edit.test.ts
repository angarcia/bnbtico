import { describe, expect, it } from "vitest";
import { editLabel, fieldTitle, editOverview, editSummary, editedFields, editFieldFromParam, mergeEdit, parseField, planEdit, photoPill, reviewNotice, type ListingEdit } from "../../src/domain/edit";
import { isPublished, can } from "../../src/domain/can";
import { TITLE_LENGTH_ERROR } from "../../src/domain/listing-rules";
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
    expect(planEdit(activeListing, "caracteristicas", { features: ["wifi", "parking"], parkingPaid: null })).toEqual({ error: "Indique si el parqueo es gratuito o de pago." });
    expect(planEdit(activeListing, "capacidad", { capacity: 2, bedrooms: 1, bathrooms: 1 })).toEqual({ immediate: {} });
  });
  it("fieldTitle: una Habitación no cuenta habitaciones («Personas y baños»)", () => {
    expect(fieldTitle("capacidad", "habitacion")).toBe("Personas y baños");
    expect(fieldTitle("capacidad", "completo")).toBe("Personas, habitaciones y baños");
    expect(fieldTitle("capacidad", null)).toBe("Personas, habitaciones y baños");
    expect(fieldTitle("capacidad")).toBe("Personas, habitaciones y baños");
    expect(fieldTitle("nombre", "habitacion")).toBe("Nombre");
  });
  it("planEdit: la capacidad de una Habitación no pide habitaciones (el formulario no las manda) y se queda en 1", () => {
    const room = { ...activeListing, kind: "habitacion" as const, bathroomShared: true, bedrooms: 1 };
    expect(parseField("capacidad", formInput([["capacity", "3"], ["bathrooms", "1"]]))).toEqual({ capacity: 3, bedrooms: null, bathrooms: 1 });
    expect(planEdit(room, "capacidad", { capacity: 3, bedrooms: null, bathrooms: 1 })).toEqual({ immediate: { capacity: 3 } });
    // Un dato viejo (null) se corrige al guardar.
    expect(planEdit({ ...room, bedrooms: null }, "capacidad", { capacity: 2, bedrooms: null, bathrooms: 1 })).toEqual({ immediate: { bedrooms: 1 } });
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
    expect(planEdit(activeListing, "tipo", { kind: "habitacion", bathroomShared: null })).toEqual({ error: "Indique si el baño es privado o compartido." });
    expect(planEdit(activeListing, "tipo", { kind: "completo", bathroomShared: true })).toEqual({ reviewed: { kind: "completo", bathroomShared: null } });
    expect(planEdit(activeListing, "ubicacion", { lat: 9.65, lng: -82.75, province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cahuita", zoneId: null, zoneSource: "district" })).toEqual({
      reviewed: { lat: 9.65, lng: -82.75, zone: "Cahuita", zoneId: null, zoneSource: "district" },
    });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "nombre", { title: "Casa Coco" })).toEqual({ reviewed: { title: "Casa Coco" } });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("planEdit: la descripción valida sobre la edición pendiente", () => {
    const pending = { ...activeListing, edit: edit({ title: "Casa Coco frente al mar" }) };
    expect(planEdit(pending, "descripcion", { description: "Corta" })).toMatchObject({ error: expect.stringContaining("descripción") });
    expect(planEdit({ ...activeListing, edit: edit({ title: "Casa" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("planEdit: un nombre aprobado de más de 32 caracteres no impide cambiar otro dato; uno nuevo de 33 sí falla", () => {
    const legacy = { ...activeListing, title: "N".repeat(40) };
    expect(planEdit(legacy, "descripcion", { description: "D".repeat(100) })).toEqual({ reviewed: { description: "D".repeat(100) } });
    expect(planEdit(legacy, "descripcion", { description: "Corta" })).toMatchObject({ error: expect.stringContaining("descripción") });
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
