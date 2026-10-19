// Anuncio (Listing): tipos, listas únicas y validación del formulario de publicación.
// Portado del prototipo (publication.js, formulario-simple.js, caracteristicas.js, moneda.js, copy-mensual.js).
// Dinero en colones enteros. Sin uso de baños, sin selector de moneda, «mensual» en vez de «largo plazo».

export type Kind = "casa" | "apartamento" | "habitacion";
export type Feature = "pool" | "pets" | "wifi" | "ac" | "parking" | "ev" | "kids_free" | "beachfront" | "bbq";
export type MonthlyMode = "amount" | "contact";
export type ListingStatus = "draft" | "review" | "changes" | "rejected" | "payment_due" | "active" | "inactive";
export type Step = 1 | 2 | 3 | 4 | 5;

/** Una sola lista, igual al publicar, al filtrar y en la ficha. */
export const FEATURES: readonly [Feature, string][] = [
  ["pool", "Piscina"],
  ["pets", "Mascotas"],
  ["wifi", "Wifi"],
  ["ac", "Aire acondicionado"],
  ["parking", "Parqueo"],
  ["ev", "⚡ Cargador eléctrico"],
  ["kids_free", "Niños pequeños gratis"],
  ["beachfront", "Frente al mar"],
  ["bbq", "Rancho / BBQ"],
];
export const FEATURE_LABEL: Record<Feature, string> = Object.fromEntries(FEATURES) as Record<Feature, string>;

export const PROVINCES: readonly string[] = ["Guanacaste", "Puntarenas", "Limón", "Alajuela", "San José", "Heredia", "Cartago"];
export const DEFAULT_PROVINCE = "Limón";

export const KINDS: readonly Kind[] = ["casa", "apartamento", "habitacion"];
export const KIND_LABELS: Record<Kind, string> = { casa: "Casa", apartamento: "Apartamento", habitacion: "Habitación" };

export const STEP_NAMES = ["Alojamiento", "Ubicación", "Detalles", "Fotos", "Precio"] as const;
export const MIN_PHOTOS = 5;
export const MAX_PHOTOS = 15;

export const STATUS_LABELS: Record<ListingStatus, { label: string; badge: string }> = {
  draft: { label: "Borrador", badge: "badge-mute" },
  review: { label: "Pendiente de revisión", badge: "badge-warn" },
  changes: { label: "Cambios solicitados", badge: "badge-warn" },
  rejected: { label: "Rechazada", badge: "badge-bad" },
  payment_due: { label: "Pendiente de pago", badge: "badge-warn" },
  active: { label: "Activa", badge: "badge-ok" },
  inactive: { label: "Inactiva", badge: "badge-mute" },
};

export interface ListingDraft {
  kind: Kind | null;
  acceptsMonthly: boolean | null;
  province: string;
  canton: string;
  zone: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
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
  whatsappPhone: string;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
}

export const emptyDraft = (): ListingDraft => ({
  kind: null,
  acceptsMonthly: null,
  province: DEFAULT_PROVINCE,
  canton: "",
  zone: "",
  lat: null,
  lng: null,
  capacity: null,
  bedrooms: null,
  bathrooms: null,
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

/**
 * Colones escritos a mano: «95000», «95.000», «95 000», «₡95 000» → 95000.
 * Vacío → null. Decimales (coma o punto que no sea separador de miles) o cualquier otra cosa → NaN.
 */
export function parseColones(input: string): number | null {
  const raw = input.replace(/[₡\s  ]/g, "");
  if (raw === "") return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
  return Number.NaN;
}

/** Entero escrito a mano: vacío → null; no entero → NaN. */
function parseInteger(input: string): number | null {
  const raw = input.trim();
  if (raw === "") return null;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

function parseDecimal(input: string): number | null {
  const raw = input.trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const isInt = (v: number | null, min: number) => v !== null && Number.isInteger(v) && v >= min;

export function parseStepForm(step: Step, fd: FormData): Partial<ListingDraft> {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  switch (step) {
    case 1: {
      const kind = str("kind");
      const monthly = str("acceptsMonthly");
      return { kind: (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : null, acceptsMonthly: monthly === "yes" ? true : monthly === "no" ? false : null };
    }
    case 2:
      return { province: str("province"), canton: str("canton"), zone: str("zone"), lat: parseDecimal(str("lat")), lng: parseDecimal(str("lng")) };
    case 3: {
      const features = fd.getAll("features").map(String).filter((f): f is Feature => f in FEATURE_LABEL);
      const parking = str("parkingPaid");
      return {
        capacity: parseInteger(str("capacity")),
        bedrooms: parseInteger(str("bedrooms")),
        bathrooms: parseInteger(str("bathrooms")),
        title: str("title").slice(0, 100),
        description: str("description").slice(0, 3000),
        features,
        parkingPaid: parking === "paid" ? true : parking === "free" ? false : null,
      };
    }
    case 4:
      return { photoCount: parseInteger(str("photoCount")) ?? 0 };
    case 5: {
      const mode = str("monthlyMode");
      return {
        nightlyPriceCrc: parseColones(str("nightlyPriceCrc")),
        minNights: parseInteger(str("minNights")),
        monthlyMode: mode === "amount" || mode === "contact" ? mode : null,
        monthlyPriceCrc: parseColones(str("monthlyPriceCrc")),
        minMonths: parseInteger(str("minMonths")),
      };
    }
  }
}

/** Limpia dependencias: sin parqueo no hay tipo de parqueo; sin mensual no hay datos mensuales; «consultar» no lleva importe. */
export function normalize(d: ListingDraft): ListingDraft {
  const n = { ...d };
  if (!n.features.includes("parking")) n.parkingPaid = null;
  if (n.acceptsMonthly !== true) {
    n.monthlyMode = null;
    n.monthlyPriceCrc = null;
    n.minMonths = null;
  } else if (n.monthlyMode === "contact") {
    n.monthlyPriceCrc = null;
  }
  return n;
}

export function validateStep(step: Step, d: ListingDraft): string | null {
  switch (step) {
    case 1:
      if (!d.kind) return "Elegí Casa, Apartamento o Habitación.";
      if (d.acceptsMonthly === null) return "Respondé si aceptás alquiler mensual.";
      return null;
    case 2:
      if (!PROVINCES.includes(d.province) || !d.canton.trim() || !d.zone.trim()) return "Completá provincia, cantón y zona aproximada.";
      if (d.lat === null || d.lng === null) return "Marcá en el mapa la ubicación aproximada.";
      return null;
    case 3:
      if (!isInt(d.capacity, 1)) return "Indicá cuántas personas pueden alojarse (mínimo 1).";
      if (!isInt(d.bedrooms, d.kind === "apartamento" ? 0 : 1)) return "Indicá las habitaciones ofrecidas; solo un apartamento tipo estudio puede tener 0.";
      if (!isInt(d.bathrooms, 1)) return "Indicá el número de baños disponibles (mínimo 1).";
      if (!d.title.trim() || !d.description.trim()) return "Completá el título y la descripción.";
      if (d.features.includes("parking") && d.parkingPaid === null) return "Indicá si el parqueo es gratuito o de pago.";
      return null;
    case 4:
      if (d.photoCount < MIN_PHOTOS) return `Agregá al menos ${MIN_PHOTOS} fotos.`;
      if (d.photoCount > MAX_PHOTOS) return `Máximo ${MAX_PHOTOS} fotos.`;
      return null;
    case 5:
      if (!isInt(d.nightlyPriceCrc, 1)) return "Indicá un precio por noche en colones, mayor que cero y sin decimales.";
      if (!isInt(d.minNights, 1)) return "Indicá la estancia mínima en noches.";
      if (d.acceptsMonthly) {
        if (!d.monthlyMode) return "Elegí indicar un precio mensual o Consultar con el propietario.";
        if (d.monthlyMode === "amount" && !isInt(d.monthlyPriceCrc, 1)) return "Indicá un precio mensual válido.";
        if (d.minMonths !== null && !isInt(d.minMonths, 1)) return "La estancia mínima en meses debe ser un número entero mayor que cero.";
      }
      return null;
  }
}

export function validateAll(d: ListingDraft): { step: Step; error: string } | null {
  for (const step of [1, 2, 3, 4, 5] as const) {
    const error = validateStep(step, d);
    if (error) return { step, error };
  }
  return null;
}
