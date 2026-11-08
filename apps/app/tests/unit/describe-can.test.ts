import { describe as group, expect, it } from "vitest";
import { can, type ListingAction } from "../../src/domain/can";
import { capacityLine, capacitySummary, cardPrice, accommodationLabel, describe } from "../../src/domain/describe";
import { emptyDraft, type Listing, type ListingStatus, type PublicListing } from "../../src/domain/listing";

const NOW = Date.parse("2026-10-22T12:00:00Z");
const BASE = "https://bnbtico.com";

function owned(over: Partial<Listing> = {}): Listing {
  return {
    ...emptyDraft(),
    id: "l1",
    publicId: "CT-1042",
    ownerId: "o1",
    status: "active",
    available: true,
    reopenAt: null,
    reviewNote: null,
    reviewedAt: "2026-10-20T10:00:00Z",
    firstPublishedAt: "2026-10-20T10:00:00Z",
    whatsappPhone: "+50687770001",
    createdAt: "2026-10-18T10:00:00Z",
    updatedAt: "2026-10-21T10:00:00Z",
    photos: [],
    edit: null, adminHold: null,
    kind: "completo",
    zone: "Manzanillo",
    province: "Limón",
    capacity: 5,
    title: "Casa Manzanillo",
    acceptsNightly: true,
    nightlyPriceCrc: 85000,
    ...over,
  };
}

const publicOf = (l: Listing): PublicListing => ({
  id: l.id,
  publicId: l.publicId,
  kind: l.kind ?? "completo",
  title: l.title,
  description: l.description,
  province: l.province,
  canton: l.canton,
  zone: l.zone,
  approx: null,
  capacity: l.capacity ?? 0,
  bedrooms: l.bedrooms ?? 0,
  bathrooms: l.bathrooms ?? 0,
  bathroomShared: null,
  features: [],
  parkingPaid: null,
  acceptsNightly: l.acceptsNightly,
  nightlyPriceCrc: l.nightlyPriceCrc,
  minNights: null,
  acceptsMonthly: l.acceptsMonthly === true,
  monthlyMode: null,
  monthlyPriceCrc: l.monthlyPriceCrc,
  minMonths: null,
  available: l.available,
  reopenAt: null,
  ownerName: "Yorleny",
  ownerWhatsappVerified: true,
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
  photos: [],
});

group("describe · precios", () => {
  it.each([
    ["solo por noche", { nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null }, { amount: 85000, unit: "noche" }, null],
    ["mensual con precio", { nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: 350000 }, { amount: 85000, unit: "noche" }, { amount: 350000, unit: "mes" }],
    ["mensual a negociar", { nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null }, { amount: 45000, unit: "noche" }, { negotiable: true }],
    ["mensual con 0 guardado es a negociar", { nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: 0 }, { amount: 45000, unit: "noche" }, { negotiable: true }],
    ["precio al mes sin aceptar mensual no cuenta", { nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: 480000 }, { amount: 85000, unit: "noche" }, null],
    ["borrador sin precio", { nightlyPriceCrc: null, acceptsMonthly: false, monthlyPriceCrc: null }, null, null],
  ] as const)("%s", (_, over, main, monthly) => {
    for (const d of [describe(owned(over), { base: BASE, now: NOW }), describe(publicOf(owned(over)), { base: BASE })]) {
      expect(d.mainPrice).toEqual(main);
      expect(d.monthly).toEqual(monthly);
    }
  });

  it("la tarjeta: el precio por noche aunque acepte mensual; con fechas y total, el total (search.test.ts)", () => {
    const monthly = { nightlyPriceCrc: 85000, acceptsMonthly: true, monthlyPriceCrc: 350000 };
    expect(cardPrice(monthly, 0)).toEqual({ amount: 85000, unit: "noche" });
    expect(cardPrice({ ...monthly, stayTotalCrc: 2_975_000 }, 35)).toEqual({ stayTotalCrc: 2_975_000, nights: 35 });
  });
});

group("describe · situación y etiqueta por estado", () => {
  it.each<[string, Partial<Listing>, string, string]>([
    ["activa", { status: "active" }, "Activa", "Visible en Explorar y con su enlace"],
    ["activa no disponible", { status: "active", available: false }, "Pausado", "Pausado: no aparece en Explorar"],
    ["en revisión desde ayer", { status: "review", updatedAt: "2026-10-21T10:00:00Z" }, "En revisión", "Enviada ayer. Le avisamos por WhatsApp."],
    ["en revisión desde hoy", { status: "review", updatedAt: "2026-10-22T09:00:00Z" }, "En revisión", "Enviada hoy. Le avisamos por WhatsApp."],
    ["cambios pedidos", { status: "changes" }, "Cambios pedidos", "Le pedimos cambios. Corríjalos y reenvíe."],
    ["rechazada", { status: "rejected" }, "Rechazada", "Rechazada. Si quiere, publique una nueva."],
    ["borrador nunca enviado", { status: "draft", reviewedAt: null }, "Borrador", "Borrador sin enviar."],
    ["borrador que estuvo publicada", { status: "draft" }, "Borrador", "Estuvo publicada: al enviarla volverá a revisión."],
    ["pendiente de pago", { status: "payment_due" }, "Pendiente de pago", "La ficha vuelve a verse al pagar."],
    ["inactiva", { status: "inactive" }, "Inactiva", "Parada · no aparece en Explorar"],
  ])("%s", (_, over, label, situation) => {
    const d = describe(owned(over), { base: BASE, now: NOW });
    expect(d.statusLabel).toBe(label);
    expect(d.situation).toBe(situation);
  });

  it("una casa vista por el público no tiene línea de situación", () => {
    expect(describe(publicOf(owned()), { base: BASE }).situation).toBeNull();
    expect(describe(publicOf(owned({ available: false })), { base: BASE }).statusLabel).toBe("Pausado");
  });
});

group("describe · enlace y vista previa", () => {
  it("enlace con la base que se pase", () => {
    expect(describe(owned(), { base: "https://nueva.bnbtico.com/" }).shareUrl).toBe("https://nueva.bnbtico.com/casa/CT-1042");
  });

  it.each<[string, Partial<Listing>, string]>([
    ["vacacional", {}, "Alojamiento completo en Manzanillo, Limón · 5 personas · ₡85\u00a0000 por noche · orientativo"],
    ["mensual", { nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null }, "Alojamiento completo en Manzanillo, Limón · 5 personas · ₡45\u00a0000 por noche · orientativo"],
    ["habitación para una persona", { kind: "habitacion", capacity: 1 }, "Habitación en Manzanillo, Limón · 1 persona · ₡85\u00a0000 por noche · orientativo"],
    ["tipo anterior al diseño v1", { kind: "casa" }, "Casa en Manzanillo, Limón · 5 personas · ₡85\u00a0000 por noche · orientativo"],
    ["borrador sin tipo ni precio", { kind: null, capacity: null, nightlyPriceCrc: null, title: "Mi cabina" }, "Mi cabina"],
    ["sin zona", { zone: "" }, "Alojamiento completo en Limón · 5 personas · ₡85\u00a0000 por noche · orientativo"],
  ])("%s", (_, over, text) => {
    expect(describe(owned(over), { base: BASE, now: NOW }).previewText).toBe(text);
  });
});

group("can", () => {
  const STATUSES: ListingStatus[] = ["draft", "review", "changes", "rejected", "payment_due", "active", "inactive"];
  const allowed: Record<ListingAction, ListingStatus[]> = {
    edit: ["draft", "changes"],
    submit: ["draft", "changes"],
    reopen: ["changes", "rejected"],
    discard: ["draft"],
    available: ["active"],
    share: ["active"],
  };
  for (const action of Object.keys(allowed) as ListingAction[]) {
    it.each(STATUSES)(`${action} en %s`, (status) => {
      expect(can({ status, reviewedAt: null }, action)).toBe(allowed[action].includes(status));
    });
  }
  it("un borrador que ya fue revisado no se descarta (conserva su CT-####)", () => {
    expect(can({ status: "draft", reviewedAt: "2026-10-20T10:00:00Z" }, "discard")).toBe(false);
    expect(can({ status: "draft", reviewedAt: "2026-10-20T10:00:00Z" }, "edit")).toBe(true);
  });
});

group("capacidad: ficha y resumen de «Revisar y enviar»", () => {
  const house = { kind: "completo" as const, capacity: 5, bedrooms: 2, bathrooms: 2, bathroomShared: null };
  const room = { kind: "habitacion" as const, capacity: 2, bedrooms: 1, bathrooms: 1, bathroomShared: true };
  it("un alojamiento completo cuenta personas, habitaciones y baños", () => {
    expect(capacityLine(house)).toBe("5 personas · 2 dormitorios · 2 baños");
    expect(capacityLine({ ...house, capacity: 1, bedrooms: 1, bathrooms: 1 })).toBe("1 persona · 1 dormitorio · 1 baño");
    expect(capacitySummary(house)).toBe("5 pers. · 2 hab. · 2 baños");
    expect(capacitySummary({ ...house, bathrooms: 1 })).toBe("5 pers. · 2 hab. · 1 baño");
  });
  it("una Habitación dice el tipo de baño en vez del número (sin elegir, «1 baño»)", () => {
    expect(capacityLine(room)).toBe("2 personas · 1 dormitorio · baño compartido");
    expect(capacityLine({ ...room, bathroomShared: false })).toBe("2 personas · 1 dormitorio · baño privado");
    expect(capacityLine({ ...room, bathroomShared: null })).toBe("2 personas · 1 dormitorio · 1 baño");
    // Un dato viejo (más baños o habitaciones) no cambia lo que se lee: una Habitación es 1 y 1.
    expect(capacityLine({ ...room, bedrooms: 3, bathrooms: 2, bathroomShared: null })).toBe("2 personas · 1 dormitorio · 1 baño");
    expect(capacitySummary(room)).toBe("2 pers. · baño compartido");
    expect(capacitySummary({ ...room, bathroomShared: false })).toBe("2 pers. · baño privado");
    expect(capacitySummary({ ...room, bathroomShared: null, bathrooms: null })).toBe("2 pers. · 1 baño");
  });
});

group("tipo de alojamiento visible", () => {
  it.each(["completo", "casa", "apartamento"] as const)("%s se muestra como Alojamiento completo", (kind) => {
    expect(accommodationLabel({ kind, bathroomShared: null })).toBe("Alojamiento completo");
  });
  it.each([[true, "Habitación · baño compartido"], [false, "Habitación · baño privado"], [null, "Habitación"]] as const)("Habitación con baño %s", (bathroomShared, label) => {
    expect(accommodationLabel({ kind: "habitacion", bathroomShared })).toBe(label);
  });
});
