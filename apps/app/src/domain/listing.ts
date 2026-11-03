// Anuncio (Listing): tipos, listas únicas y validación del formulario de publicación.
// Modelo del diseño v1 (docs/diseno-v1.md, punto 11): toda casa se alquila por noches (precio por noche obligatorio);
// «Alquiler mensual» es opcional, con precio al mes opcional (vacío = «Precio a negociar con el dueño»; decisión
// 2026-10-27). Tipo Alojamiento completo / Habitación (con baño privado o compartido), contadores. Dinero en colones
// enteros. Copy en usted.
// El formulario va en pantallas cortas, sin scroll en el móvil (decisión 2026-10-21): cada una guarda su parte del borrador.
// Desde 2026-10-27 son 8 (ubicación por punto): el mapa se unió al paso 2 y su id de URL, el 3, se retiró y lleva al 2; los
// demás ids no cambian (el precio sigue siendo el 8), así los enlaces y los borradores retomados no caen en otra pantalla.
// Módulo de dominio: sin imports de framework.
import type { LatLng } from "./geo";
import type { ZoneSource } from "./zones";
import type { ListingEdit } from "./edit";
import type { AdminHold } from "./admin-hold";

export type Kind = "completo" | "habitacion" | "casa" | "apartamento"; // casa/apartamento: filas anteriores al diseño v1
export type Feature = "pool" | "pets" | "wifi" | "ac" | "parking" | "ev" | "kids_free" | "beachfront" | "bbq";
export type MonthlyMode = "amount" | "contact";
export type ListingStatus = "draft" | "review" | "changes" | "rejected" | "payment_due" | "active" | "inactive";
/** Ids de pantalla estables; el 3 (mapa) se retiró el 2026-10-27. */
export type Step = 1 | 2 | 4 | 5 | 6 | 7 | 8 | 9;
export const STEPS: readonly Step[] = [1, 2, 4, 5, 6, 7, 8, 9];
export const LAST_STEP: Step = 9;
export const STEP_COUNT = STEPS.length;
/** Ids de URL retirados y la pantalla que los sustituye. */
export const RETIRED_STEPS: Readonly<Record<string, Step>> = { "3": 2 };

/** El parámetro `paso` de la URL: un paso, uno retirado (a dónde llevarlo) o nada (no existe). */
export function stepFromParam(paso: string): { step: Step } | { redirect: Step } | null {
  if (!/^[1-9]$/.test(paso)) return null;
  const retired = RETIRED_STEPS[paso];
  if (retired) return { redirect: retired };
  const n = Number(paso) as Step;
  return STEPS.includes(n) ? { step: n } : null;
}

/** Posición 1…8 de la pantalla, para «Paso n de 8» y la barra de progreso. */
export const stepPosition = (step: Step): number => STEPS.indexOf(step) + 1;
/** La pantalla siguiente o la anterior (saltan el 3); null en los extremos. */
export const nextStep = (step: Step): Step | null => STEPS[STEPS.indexOf(step) + 1] ?? null;
export const previousStep = (step: Step): Step | null => STEPS[STEPS.indexOf(step) - 1] ?? null;

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

export const STEP_NAMES = ["Alojamiento", "Ubicación", "Capacidad", "Características", "Nombre", "Fotos", "Precio", "Enviar"] as const;
/** Fotos que hacen falta para enviar a revisión y para aprobar. */
export const MIN_PHOTOS_TO_APPROVE = 1;

/** «Alquiler mensual»: característica de la ficha y resumen del admin. */
export const MONTHLY_LABEL = "Alquiler mensual";
/** El filtro: chip de Explorar e interruptor de Filtros (revisión de Ana, 2026-10-28). */
export const MONTHLY_FILTER_LABEL = "Solo alquiler mensual";
/** El chip de Explorar ya activo: corto, para que «✓» y el texto quepan en un iPhone SE (revisión UX 2026-10-29, N1). */
export const MONTHLY_FILTER_SHORT = "Mensual";
export const MAX_PHOTOS = 15;
/** A published house keeps at least this many approved photos (removing the last is refused). */
export const MIN_PHOTOS_PUBLISHED = 1;

export const STATUS_LABELS: Record<ListingStatus, { label: string; badge: string }> = {
  draft: { label: "Borrador", badge: "badge-mute" },
  review: { label: "En revisión", badge: "badge-review" },
  changes: { label: "Cambios pedidos", badge: "badge-review" },
  rejected: { label: "Rechazada", badge: "badge-bad" },
  payment_due: { label: "Pendiente de pago", badge: "badge-sun" },
  active: { label: "Activa", badge: "badge-ok" },
  inactive: { label: "Inactiva", badge: "badge-mute" },
};

export interface ListingDraft {
  kind: Kind | null;
  /** Siempre true: toda casa se alquila por noches (check en la base). */
  acceptsNightly: boolean;
  acceptsMonthly: boolean;
  /** Provincia, cantón y distrito: los da el pin (place_at); submit_listing los recalcula. */
  province: string;
  canton: string;
  district: string;
  /** Nombre de la zona elegida: de la lista (`zoneId`), el distrito del pin, u «Otra…» (propuesta por el dueño). */
  zone: string;
  zoneId: string | null;
  zoneSource: ZoneSource | null;
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
  /** Carpeta `<casa>/<uuid>` con las tres variantes, o el único archivo `<casa>/<uuid>.jpg` de una foto anterior. */
  path: string;
  position: number;
  /** La variante de 800 (o el archivo de una foto anterior); otras con `variantUrl`. */
  url: string;
}

export interface Listing extends ListingDraft {
  id: string;
  publicId: string;
  ownerId: string;
  status: ListingStatus;
  available: boolean;
  /** Fecha de reapertura automática (`YYYY-MM-DD`) de una casa cerrada a consultas; null = sin fecha o abierta. */
  reopenAt: string | null;
  reviewNote: string | null;
  /** Momento de la última decisión del admin; un borrador con fecha fue una casa publicada o revisada (no se descarta). */
  reviewedAt: string | null;
  /** Primera aprobación del admin (revisión UX A5): la casa estuvo publicada alguna vez, aunque ahora se esté editando. */
  firstPublishedAt: string | null;
  whatsappPhone: string;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
  /** La edición pendiente de una casa publicada (una como mucho); null = sin edición. */
  edit: ListingEdit | null;
  /** Pausada o bloqueada por el admin (con su motivo); null = sin retención. Va aparte de `status`. */
  adminHold: AdminHold | null;
}

export const emptyDraft = (): ListingDraft => ({
  kind: null,
  acceptsNightly: true,
  acceptsMonthly: false,
  province: DEFAULT_PROVINCE,
  canton: "",
  district: "",
  zone: "",
  zoneId: null,
  zoneSource: null,
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

const isBlank = (v: unknown) => v === null || v === "" || v === false || v === 0 || (Array.isArray(v) && v.length === 0);

/** Borrador recién creado, sin nada rellenado (la provincia viene puesta): arriba del paso 1, qué tener a mano (C4). */
export function isFreshDraft(d: ListingDraft): boolean {
  return (Object.keys(emptyDraft()) as (keyof ListingDraft)[]).every((k) => k === "province" || k === "acceptsNightly" || isBlank(d[k]));
}

/** «95000», «95.000», «95 000», «₡95 000» → 95000. Vacío → null. Decimales u otra cosa → NaN. */
export function parseColones(input: string): number | null {
  const raw = input.replace(/[₡\s  ]/g, "");
  if (raw === "") return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
  return Number.NaN;
}

/** Limpia dependencias: toda casa se alquila por noches; sin parqueo no hay tipo; sin «Alquiler mensual» no hay precio al
 *  mes; sin habitación no hay dato del baño y una Habitación son siempre 1 habitación; solo una zona de la lista lleva `zoneId`. Las columnas antiguas (monthlyMode,
 *  minNights, minMonths) no se tocan. */
export function normalize(d: ListingDraft): ListingDraft {
  const n = { ...d, acceptsNightly: true };
  if (n.zoneSource !== "list") n.zoneId = null;
  if (!n.features.includes("parking")) n.parkingPaid = null;
  if (n.kind !== "habitacion") n.bathroomShared = null;
  if (n.kind === "habitacion") n.bedrooms = 1; // una Habitación es una habitación: el asistente no lo pregunta
  if (!n.acceptsMonthly) n.monthlyPriceCrc = null;
  return n;
}

/** Paso 6 (ticket 19): la misma regla en el dominio, el fake y `submit_listing`. Se cuentan caracteres (como char_length). */
export const TITLE_MIN = 5;
export const TITLE_MAX = 32;
export const DESCRIPTION_MIN = 80;
export const DESCRIPTION_MAX = 2000;
/** Las pantallas en tres etapas (revisión UX C4): la cabecera y el aviso «Seguir publicando» hablan de la etapa, no del paso. */
export const WIZARD_STAGES: readonly { name: string; steps: readonly Step[] }[] = [
  { name: "Su casa", steps: [1, 2, 4, 5] },
  { name: "Fotos y texto", steps: [6, 7] },
  { name: "Precio", steps: [8, 9] },
];

export function wizardStage(step: Step): { name: string; index: number; position: number; size: number; first: Step } {
  const index = WIZARD_STAGES.findIndex((s) => s.steps.includes(step));
  const stage = WIZARD_STAGES[index]!;
  return { name: stage.name, index, position: stage.steps.indexOf(step) + 1, size: stage.steps.length, first: stage.steps[0]! };
}

/** «Cocles · Cahuita, Talamanca, Limón»: la zona y, tras el punto medio, distrito, cantón y provincia (la zona no se repite
 *  si es el distrito; lo vacío no deja huecos). */
export function locationLine(l: { zone: string; district: string; canton: string; province: string }): string {
  const zone = l.zone.trim();
  const district = l.district.trim();
  const where = [district, l.canton.trim(), l.province.trim()].filter(Boolean).join(", ");
  if (!zone || zone === district) return where || zone;
  return where ? `${zone} · ${where}` : zone;
}

/** Zona propuesta por el dueño con «Otra…» (el admin la revisa con una marca). */
export const isProposedZone = (l: { zoneSource: ZoneSource | null }) => l.zoneSource === "other";

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
  /** Fecha (`YYYY-MM-DD`) en que vuelve a recibir consultas una casa no disponible; null = sin fecha. */
  reopenAt: string | null;
  ownerName: string;
  ownerWhatsappVerified: boolean;
  createdAt: string;
  updatedAt: string;
  photos: PublicPhoto[];
  /** Total orientativo de las noches buscadas (llegada–salida), en colones: solo lo trae `search_listings` y solo con fechas;
   *  null si alguna noche no tiene precio. Regla única: `stayEstimate` (domain/stay-price.ts). */
  stayTotalCrc?: number | null;
}

export interface PublicPhoto {
  path: string;
  /** Variante de 800 px (o la foto anterior): hero y Open Graph. */
  url: string;
  srcSet: string | null;
}

export interface SitemapEntry {
  publicId: string;
  updatedAt: string;
}

/** Estado del enlace público: se muestra, «ya no está activo», o no existe (404). */
export type LinkState = "active" | "blocked" | null;

