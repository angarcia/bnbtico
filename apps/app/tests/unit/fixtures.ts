// Casas de prueba compartidas por las pruebas unitarias del dominio.
import { emptyDraft, type Listing, type Photo } from "../../src/domain/listing";

const photo = (n: number): Photo => ({ id: `p${n}`, path: `l-activa/p${n}`, position: n, url: `https://fotos.test/l-activa/p${n}/800.jpg` });

/** Una casa activa completa: Cahuita, alojamiento completo, 2 personas, 1 habitación, 1 baño, ₡42 000, wifi, 5 fotos. */
export const activeListing: Listing = {
  ...emptyDraft(),
  id: "l-activa",
  publicId: "CT-1042",
  ownerId: "o1",
  status: "active",
  available: true,
  reopenAt: null,
  reviewNote: null,
  reviewedAt: "2026-10-01T10:00:00Z",
  firstPublishedAt: "2026-10-01T10:00:00Z",
  whatsappPhone: "+50687770001",
  createdAt: "2026-09-28T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  kind: "completo",
  province: "Limón",
  canton: "Talamanca",
  district: "Cahuita",
  zone: "Cahuita",
  zoneId: null,
  zoneSource: "district",
  lat: 9.7356,
  lng: -82.8415,
  capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  bathroomShared: null,
  title: "Casa Cahuita",
  description: "Casita de madera a dos cuadras de la playa Negra, con jardín, hamacas y cocina equipada para dos personas.",
  features: ["wifi"],
  parkingPaid: null,
  photoCount: 5,
  nightlyPriceCrc: 42000,
  acceptsMonthly: false,
  monthlyPriceCrc: null,
  photos: [1, 2, 3, 4, 5].map(photo),
  edit: null,
};
