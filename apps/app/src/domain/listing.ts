// Anuncio (Listing): tipos, listas únicas y validación del formulario de publicación.
// Modelo del diseño v1 (docs/diseno-v1.md, punto 11): modalidad Vacacional y/o Mensual, tipo Alojamiento completo /
// Habitación (con baño privado o compartido), contadores, un precio por modalidad. Dinero en colones enteros. Copy en usted.
// El formulario va en 9 pantallas cortas, sin scroll en el móvil (decisión 2026-10-21): cada una guarda su parte del borrador.
// Módulo de dominio: sin imports de framework.
import { esCanton } from "./cantones";
import { inCostaRica, type LatLng } from "./geo";

export type Kind = "completo" | "habitacion" | "casa" | "apartamento"; // casa/apartamento: filas anteriores al diseño v1
export type Feature = "pool" | "pets" | "wifi" | "ac" | "parking" | "ev" | "kids_free" | "beachfront" | "bbq";
export type MonthlyMode = "amount" | "contact";
export type ListingStatus = "draft" | "review" | "changes" | "rejected" | "payment_due" | "active" | "inactive";
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const LAST_STEP: Step = 9;

/** Una sola lista, igual al publicar, al filtrar y en la ficha. */
export const FEATURES: readonly [Feature, string][] = [
  ["pool", "Piscina"],
  ["pets", "Mascotas"],
  ["wifi", "Wifi"],
  ["ac", "Aire acondicionado"],
  ["parking", "Parqueo"],
  ["ev", "Cargador eléctrico"],
  ["kids_free", "Niños pequeños gratis"],
  ["beachfront", "Frente al mar"],
  ["bbq", "Rancho/BBQ"],
];
export const FEATURE_LABEL: Record<Feature, string> = Object.fromEntries(FEATURES) as Record<Feature, string>;
/** Etiqueta corta para la rejilla de la ficha y la línea de la tarjeta. */
export const FEATURE_SHORT: Record<Feature, string> = { ...FEATURE_LABEL, ac: "Aire acond.", kids_free: "Niños gratis", ev: "Cargador eléctrico" };

export const PROVINCES: readonly string[] = ["Guanacaste", "Puntarenas", "Limón", "Alajuela", "San José", "Heredia", "Cartago"];
export const DEFAULT_PROVINCE = "Limón";

/** Tipos que ofrece el formulario. */
export const KINDS: readonly Kind[] = ["completo", "habitacion"];
export const KIND_LABELS: Record<Kind, string> = { completo: "Alojamiento completo", habitacion: "Habitación", casa: "Casa", apartamento: "Apartamento" };
export const KIND_HINTS: Record<"completo" | "habitacion", string> = {
  completo: "Toda la casa, apartamento o cabina para el cliente.",
  habitacion: "Un cuarto en una casa donde vive más gente.",
};

export const STEP_NAMES = ["Alojamiento", "Ubicación", "Mapa", "Capacidad", "Características", "Nombre", "Fotos", "Precio", "Enviar"] as const;
export const MIN_PHOTOS = 5;
export const MAX_PHOTOS = 15;

export const STATUS_LABELS: Record<ListingStatus, { label: string; badge: string }> = {
  draft: { label: "Borrador", badge: "badge-mute" },
  review: { label: "En revisión", badge: "badge-review" },
  changes: { label: "Cambios pedidos", badge: "badge-sun" },
  rejected: { label: "Rechazada", badge: "badge-bad" },
  payment_due: { label: "Pendiente de pago", badge: "badge-sun" },
  active: { label: "Activa", badge: "badge-ok" },
  inactive: { label: "Inactiva", badge: "badge-mute" },
};

export interface ListingDraft {
  kind: Kind | null;
  acceptsNightly: boolean;
  acceptsMonthly: boolean | null;
  province: string;
  canton: string;
  zone: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  bathroomShared: boolean | null;
  title: string;
  description: string;
  features: Feature[];
  parkingPaid: boolean | null;
  photoCount: number;
  nightlyPriceCrc: number | null;
  minNights: number | null;
  monthlyMode: MonthlyMode | null;
  monthlyPriceCrc: number | null;
  minMonths: number | null;
}

export interface Photo {
  id: string;
  path: string;
  position: number;
  url: string;
}

export interface Listing extends ListingDraft {
  id: string;
  publicId: string;
  ownerId: string;
  status: ListingStatus;
  available: boolean;
  reviewNote: string | null;
  /** Momento de la última decisión del admin; un borrador con fecha fue una casa publicada o revisada (no se descarta). */
  reviewedAt: string | null;
  whatsappPhone: string;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
}

export const emptyDraft = (): ListingDraft => ({
  kind: null,
  acceptsNightly: false,
  acceptsMonthly: false,
  province: DEFAULT_PROVINCE,
  canton: "",
  zone: "",
  lat: null,
  lng: null,
  capacity: null,
  bedrooms: null,
  bathrooms: null,
  bathroomShared: null,
  title: "",
  description: "",
  features: [],
  parkingPaid: null,
  photoCount: 0,
  nightlyPriceCrc: null,
  minNights: null,
  monthlyMode: null,
  monthlyPriceCrc: null,
  minMonths: null,
});

/** «95000», «95.000», «95 000», «₡95 000» → 95000. Vacío → null. Decimales u otra cosa → NaN. */
export function parseColones(input: string): number | null {
  const raw = input.replace(/[₡\s  ]/g, "");
  if (raw === "") return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
  return Number.NaN;
}

const isInt = (v: number | null, min: number) => v !== null && Number.isInteger(v) && v >= min;

/** Limpia dependencias: sin parqueo no hay tipo; sin mensual no hay precio mensual; sin vacacional no hay precio por noche;
 *  sin habitación no hay dato del baño. */
export function normalize(d: ListingDraft): ListingDraft {
  const n = { ...d };
  if (!n.features.includes("parking")) n.parkingPaid = null;
  if (n.kind !== "habitacion") n.bathroomShared = null;
  if (!n.acceptsNightly) n.nightlyPriceCrc = null;
  if (n.acceptsMonthly !== true) {
    n.monthlyMode = null;
    n.monthlyPriceCrc = null;
    n.minMonths = null;
  } else {
    n.monthlyMode = "amount";
  }
  return n;
}

export function validateStep(step: Step, d: ListingDraft): string | null {
  switch (step) {
    case 1:
      if (!d.kind) return "Elija Alojamiento completo o Habitación.";
      if (!d.acceptsNightly && !d.acceptsMonthly) return "Marque Vacacional, Mensual o las dos.";
      return null;
    case 2:
      if (!PROVINCES.includes(d.province)) return "Elija la provincia.";
      if (!d.canton.trim()) return "Elija el cantón.";
      if (!esCanton(d.province, d.canton)) return "Elija un cantón de la provincia.";
      if (!d.zone.trim()) return "Indique la zona, playa o barrio.";
      return null;
    case 3:
      if (d.lat === null || d.lng === null) return "Marque en el mapa la ubicación aproximada.";
      if (!inCostaRica(d.lat, d.lng)) return "Marque un punto dentro de Costa Rica.";
      return null;
    case 4:
      if (!isInt(d.capacity, 1)) return "Indique cuántas personas pueden alojarse (mínimo 1).";
      if (!isInt(d.bedrooms, d.kind === "completo" || d.kind === "apartamento" ? 0 : 1)) return "Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.";
      if (!isInt(d.bathrooms, 1)) return "Indique el número de baños (mínimo 1).";
      if (d.kind === "habitacion" && d.bathroomShared === null) return "Indique si el baño es privado o compartido.";
      return null;
    case 5:
      if (d.features.includes("parking") && d.parkingPaid === null) return "Indique si el parqueo es gratuito o de pago.";
      return null;
    case 6:
      if (!d.title.trim()) return "Póngale un nombre a la casa.";
      if (!d.description.trim()) return "Escriba una descripción.";
      return null;
    case 7:
      if (d.photoCount < MIN_PHOTOS) return `Agregue al menos ${MIN_PHOTOS} fotos.`;
      if (d.photoCount > MAX_PHOTOS) return `Máximo ${MAX_PHOTOS} fotos.`;
      return null;
    case 8:
      if (d.acceptsNightly && !isInt(d.nightlyPriceCrc, 1)) return "Indique el precio por noche en colones.";
      if (d.acceptsMonthly && !isInt(d.monthlyPriceCrc, 1)) return "Indique el precio por mes en colones.";
      return null;
    case 9:
      return null;
  }
}

export function validateAll(d: ListingDraft): { step: Step; error: string } | null {
  for (const step of STEPS) {
    const error = validateStep(step, d);
    if (error) return { step, error };
  }
  return null;
}

/** Cómo alquila, para etiquetas y píldoras: «Vacacional», «Mensual» o «Vacacional · Mensual». */
export function modesLabel(d: { acceptsNightly: boolean; acceptsMonthly: boolean | null }): string {
  return [d.acceptsNightly ? "Vacacional" : null, d.acceptsMonthly ? "Mensual" : null].filter(Boolean).join(" · ");
}

/** Casa tal como la ve el público (vista listings_public): sin WhatsApp y con el punto desplazado 150–499 m. */
export interface PublicListing {
  id: string;
  publicId: string;
  kind: Kind;
  title: string;
  description: string;
  province: string;
  canton: string;
  zone: string;
  approx: LatLng | null;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  bathroomShared: boolean | null;
  features: Feature[];
  parkingPaid: boolean | null;
  acceptsNightly: boolean;
  nightlyPriceCrc: number | null;
  minNights: number | null;
  acceptsMonthly: boolean;
  monthlyMode: MonthlyMode | null;
  monthlyPriceCrc: number | null;
  minMonths: number | null;
  available: boolean;
  ownerName: string;
  ownerWhatsappVerified: boolean;
  createdAt: string;
  updatedAt: string;
  photos: PublicPhoto[];
}

export interface PublicPhoto {
  path: string;
  url: string;
}

/** Estado del enlace público: se muestra, «ya no está activo», o no existe (404). */
export type LinkState = "active" | "blocked" | null;
