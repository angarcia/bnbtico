// Anuncio (Listing): tipos, listas únicas y validación del formulario de publicación.
// Modelo del diseño v1 (docs/diseno-v1.md, punto 11): toda casa se alquila por noches (precio por noche obligatorio);
// «Alquiler mensual» es opcional, con precio al mes opcional (vacío = «Precio a negociar con el dueño»; decisión
// 2026-10-27). Tipo Alojamiento completo / Habitación (con baño privado o compartido), contadores. Dinero en colones
// enteros. Copy en usted.
// El formulario va en pantallas cortas, sin scroll en el móvil (decisión 2026-10-21): cada una guarda su parte del borrador.
// Desde 2026-10-27 son 8 (ubicación por punto): el mapa se unió al paso 2 y su id de URL, el 3, se retiró y lleva al 2; los
// demás ids no cambian (el precio sigue siendo el 8), así los enlaces y los borradores retomados no caen en otra pantalla.
// Módulo de dominio: sin imports de framework.
import { inCostaRica, type LatLng } from "./geo";
import { OTHER_ZONE_MAX, type ZoneSource } from "./zones";
import type { ListingEdit } from "./edit";

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
export const MIN_PHOTOS = 5;

/** «Alquiler mensual»: característica de la ficha y resumen del admin. */
export const MONTHLY_LABEL = "Alquiler mensual";
/** El filtro: chip de Explorar e interruptor de Filtros (revisión de Ana, 2026-10-28). */
export const MONTHLY_FILTER_LABEL = "Solo alquiler mensual";
/** Paso del precio: los mismos mensajes en el dominio, el fake y `submit_listing`. */
export const NIGHTLY_PRICE_ERROR = "Indique el precio por noche en colones.";
export const MONTHLY_PRICE_ERROR = "Indique el precio al mes en colones o déjelo vacío.";
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

const isInt = (v: number | null, min: number) => v !== null && Number.isInteger(v) && v >= min;

/** Limpia dependencias: toda casa se alquila por noches; sin parqueo no hay tipo; sin «Alquiler mensual» no hay precio al
 *  mes; sin habitación no hay dato del baño; solo una zona de la lista lleva `zoneId`. Las columnas antiguas (monthlyMode,
 *  minNights, minMonths) no se tocan. */
export function normalize(d: ListingDraft): ListingDraft {
  const n = { ...d, acceptsNightly: true };
  if (n.zoneSource !== "list") n.zoneId = null;
  if (!n.features.includes("parking")) n.parkingPaid = null;
  if (n.kind !== "habitacion") n.bathroomShared = null;
  if (!n.acceptsMonthly) n.monthlyPriceCrc = null;
  return n;
}

/** Paso 6 (ticket 19): la misma regla en el dominio, el fake y `submit_listing`. Se cuentan caracteres (como char_length). */
export const TITLE_MIN = 5;
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 80;
export const DESCRIPTION_MAX = 2000;
export const TITLE_LENGTH_ERROR = `El nombre de la casa debe tener entre ${TITLE_MIN} y ${TITLE_MAX} caracteres.`;
export const DESCRIPTION_LENGTH_ERROR = `La descripción debe tener entre ${DESCRIPTION_MIN} y ${DESCRIPTION_MAX} caracteres.`;
/** Caracteres (puntos de código) de un texto sin los espacios de los extremos. */
export const charCount = (text: string) => [...text.trim()].length;
const between = (n: number, min: number, max: number) => n >= min && n <= max;

/** Paso 2 (ubicación por punto): los mismos mensajes en el dominio, el fake y `submit_listing`. */
export const LOCATION_MESSAGES = {
  noPin: "Marque en el mapa la ubicación aproximada.",
  notLand: "Ponga el punto sobre tierra, dentro de Costa Rica.",
  noZone: "Elija la zona.",
  farZone: "La zona elegida queda a más de 5 km del punto. Elija otra.",
  notDistrict: "La zona no coincide con el distrito del punto. Elija otra.",
  longZone: `La zona puede tener como mucho ${OTHER_ZONE_MAX} caracteres.`,
} as const;

export function validateStep(step: Step, d: ListingDraft): string | null {
  switch (step) {
    case 1:
      if (!d.kind) return "Elija Alojamiento completo o Habitación.";
      return null;
    case 2:
      if (d.lat === null || d.lng === null) return LOCATION_MESSAGES.noPin;
      if (!inCostaRica(d.lat, d.lng) || !d.canton.trim() || !d.province.trim()) return LOCATION_MESSAGES.notLand;
      if (!d.zone.trim() || d.zoneSource === null) return LOCATION_MESSAGES.noZone;
      if (d.zoneSource === "list" && !d.zoneId) return LOCATION_MESSAGES.noZone;
      if (d.zoneSource === "district" && d.zone.trim() !== d.district.trim()) return LOCATION_MESSAGES.noZone;
      if (d.zoneSource === "other" && charCount(d.zone) > OTHER_ZONE_MAX) return LOCATION_MESSAGES.longZone;
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
      if (!between(charCount(d.title), TITLE_MIN, TITLE_MAX)) return TITLE_LENGTH_ERROR;
      if (!d.description.trim()) return "Escriba una descripción.";
      if (!between(charCount(d.description), DESCRIPTION_MIN, DESCRIPTION_MAX)) return DESCRIPTION_LENGTH_ERROR;
      return null;
    case 7:
      // Con menos de 5 fotos se puede seguir (revisión UX C4): el mínimo se exige al enviar (validateAll y submit_listing).
      if (d.photoCount > MAX_PHOTOS) return `Máximo ${MAX_PHOTOS} fotos.`;
      return null;
    case 8:
      if (!isInt(d.nightlyPriceCrc, 1)) return NIGHTLY_PRICE_ERROR;
      // Precio al mes opcional: vacío es «Precio a negociar con el dueño».
      if (d.acceptsMonthly && d.monthlyPriceCrc !== null && !isInt(d.monthlyPriceCrc, 1)) return MONTHLY_PRICE_ERROR;
      return null;
    case 9:
      return null;
  }
}

/** «Faltan 3 fotos» / «Falta 1 foto» (revisión UX C4). */
export const missingPhotosLabel = (n: number) => (n === 1 ? "Falta 1 foto" : `Faltan ${n} fotos`);

/** Mensaje del mínimo de fotos, que se exige al enviar a revisión (no para pasar del paso 7). */
export const photosMissing = (count: number) => (count < MIN_PHOTOS ? `Agregue al menos ${MIN_PHOTOS} fotos.` : null);

/** Todo lo necesario para enviar a revisión, en el orden de las pantallas (incluido el mínimo de fotos en el paso 7). */
export function validateAll(d: ListingDraft): { step: Step; error: string } | null {
  for (const step of STEPS) {
    const error = validateStep(step, d) ?? (step === 7 ? photosMissing(d.photoCount) : null);
    if (error) return { step, error };
  }
  return null;
}

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

/** Paso donde retomar un borrador (revisión UX A1/A5): el primero con algo pendiente; si no falta nada, el último. */
export function resumeStep(d: ListingDraft): Step {
  return validateAll(d)?.step ?? LAST_STEP;
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
  /** Fecha (`YYYY-MM-DD`) en que vuelve a recibir consultas una casa no disponible; null = sin fecha. */
  reopenAt: string | null;
  ownerName: string;
  ownerWhatsappVerified: boolean;
  createdAt: string;
  updatedAt: string;
  photos: PublicPhoto[];
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

/** Columnas del borrador que se guardan (el número de fotos no es columna: sale de la lista de fotos). */
const DRAFT_COLUMNS = Object.keys(emptyDraft()).filter((k) => k !== "photoCount") as (keyof ListingDraft)[];

const same = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : Object.is(a, b));

export type StepPlan = { error: string } | { changes: Partial<ListingDraft>; next: ListingDraft };

/**
 * Guardar una pantalla del asistente: mezcla el parche sobre el borrador actual (el del servidor), valida esa pantalla y
 * devuelve todas las columnas que cambian, también las que limpia `normalize` (baño sin habitación, tipo de parqueo sin
 * parqueo, precio al mes sin «Alquiler mensual»). El número de fotos es siempre el del borrador.
 */
export function planStep(current: ListingDraft, step: Step, patch: Partial<ListingDraft>): StepPlan {
  const merged: ListingDraft = { ...current, ...patch, photoCount: current.photoCount };
  const error = validateStep(step, merged);
  if (error) return { error };
  const next = normalize(merged);
  const changes: Partial<ListingDraft> = {};
  for (const key of DRAFT_COLUMNS) if (!same(next[key], current[key])) (changes as Record<string, unknown>)[key] = next[key];
  return { changes, next };
}
