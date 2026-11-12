import { describe, expect, it } from "vitest";
import { emptyDraft, type Listing } from "../../src/domain/listing";
import { previewListing } from "../../src/domain/preview";

// Revisión UX C4 (punto 5): «Ver cómo queda su ficha» pinta el borrador con la misma ficha que verá el público.
const draft = (patch: Partial<Listing> = {}): Listing => ({
  ...emptyDraft(),
  id: "l1",
  publicId: "CT-1042",
  ownerId: "o",
  status: "draft",
  available: true,
  reopenAt: null,
  reviewNote: null,
  reviewedAt: null,
  firstPublishedAt: null,
  edit: null, adminHold: null,
  whatsappPhone: "+50687770001",
  createdAt: "2026-10-01",
  updatedAt: "2026-10-02",
  photos: [{ id: "p1", path: "l1/a", position: 0, url: "https://x/storage/v1/object/public/listings/l1/a/800.jpg" }],
  kind: "completo",
  acceptsNightly: true,
  acceptsMonthly: false,
  title: "Casa Playa Negra",
  zone: "Playa Negra",
  canton: "Talamanca",
  lat: 9.66,
  lng: -82.75,
  capacity: 4,
  bedrooms: 2,
  bathrooms: 1,
  nightlyPriceCrc: 95000,
  photoCount: 1,
  ...patch,
});

describe("vista previa de la ficha", () => {
  it("lleva lo escrito, las fotos en orden, el nombre del propietario y verificado", () => {
    const p = previewListing(draft(), "Yorleny Prueba");
    expect(p).toMatchObject({ publicId: "CT-1042", title: "Casa Playa Negra", zone: "Playa Negra", capacity: 4, nightlyPriceCrc: 95000, ownerName: "Yorleny Prueba", ownerWhatsappVerified: true, available: true });
    expect(p.photos).toEqual([{ path: "l1/a", url: "https://x/storage/v1/object/public/listings/l1/a/800.jpg", srcSet: null }]);
    expect(p.approx).toEqual({ lat: 9.66, lng: -82.75 });
  });
  it("lo que falta se ve vacío, nunca roto: sin nombre, sin mapa, cero personas", () => {
    const p = previewListing(draft({ title: "", lat: null, lng: null, capacity: null, bedrooms: null, bathrooms: null, kind: null }), "Ana");
    expect(p.title).toBe("Sin nombre todavía");
    expect(p.approx).toBeNull();
    expect([p.capacity, p.bedrooms, p.bathrooms]).toEqual([0, 0, 0]);
    expect(p.kind).toBe("completo");
  });
  it("toda casa se alquila por noches y el mensual sin precio se conserva («a negociar»)", () => {
    expect(previewListing(draft({ acceptsNightly: false }), "Ana").acceptsNightly).toBe(true);
    expect(previewListing(draft({ acceptsMonthly: true, monthlyPriceCrc: null }), "Ana")).toMatchObject({ acceptsMonthly: true, monthlyPriceCrc: null });
  });
});
