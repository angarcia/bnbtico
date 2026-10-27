// Vista previa de la ficha desde el asistente (revisión UX C4, punto 5): el borrador del propietario con la forma de la
// ficha pública, para pintarlo con la misma `ListingPage`. Sin red: todo sale de lo que ya tiene la pantalla.
import type { Listing, PublicListing } from "./listing";

export function previewListing(l: Listing, ownerName: string): PublicListing {
  return {
    id: l.id,
    publicId: l.publicId,
    kind: l.kind ?? "completo",
    title: l.title.trim() || "Sin nombre todavía",
    description: l.description,
    province: l.province,
    canton: l.canton,
    zone: l.zone,
    // El punto exacto: es su casa y solo la ve él (el público recibe el punto desplazado).
    approx: l.lat !== null && l.lng !== null ? { lat: l.lat, lng: l.lng } : null,
    capacity: l.capacity ?? 0,
    bedrooms: l.bedrooms ?? 0,
    bathrooms: l.bathrooms ?? 0,
    bathroomShared: l.bathroomShared,
    features: l.features,
    parkingPaid: l.parkingPaid,
    acceptsNightly: l.acceptsNightly,
    nightlyPriceCrc: l.nightlyPriceCrc,
    minNights: l.minNights,
    acceptsMonthly: l.acceptsMonthly === true,
    monthlyMode: l.monthlyMode,
    monthlyPriceCrc: l.monthlyPriceCrc,
    minMonths: l.minMonths,
    available: true,
    reopenAt: null,
    ownerName,
    ownerWhatsappVerified: true,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    photos: [...l.photos].sort((a, b) => a.position - b.position).map((p) => ({ path: p.path, url: p.url, srcSet: null })),
  };
}
