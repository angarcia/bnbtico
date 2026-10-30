// Reglas de validación de las casas: los mensajes y las funciones que usan el asistente de publicar, la edición de una casa
// publicada y los adaptadores de datos. Aparte de listing.ts porque solo las leen pantallas diferidas, no Explorar ni el
// resto del trozo inicial de la zona privada (límite de tamaño en CI). Los mismos mensajes que en SQL (`submit_listing`).
// Módulo de dominio: sin imports de framework.
import { inCostaRica } from "./geo";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  MAX_PHOTOS,
  TITLE_MAX,
  TITLE_MIN,
  type ListingDraft,
  type Step,
} from "./listing";
import { OTHER_ZONE_MAX } from "./zones";

/** Paso del precio: los mismos mensajes en el dominio, el fake y `submit_listing`. */
export const NIGHTLY_PRICE_ERROR = "Indique el precio por noche en colones.";
export const MONTHLY_PRICE_ERROR = "Indique el precio al mes en colones o déjelo vacío.";

export const isInt = (v: number | null, min: number) => v !== null && Number.isInteger(v) && v >= min;

export const TITLE_LENGTH_ERROR = `El nombre de la casa debe tener entre ${TITLE_MIN} y ${TITLE_MAX} caracteres.`;
export const TITLE_EMPTY_ERROR = "Póngale un nombre a la casa.";
export const DESCRIPTION_LENGTH_ERROR = `La descripción debe tener entre ${DESCRIPTION_MIN} y ${DESCRIPTION_MAX} caracteres o quedar vacía.`;
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

export const titleError = (d: ListingDraft): string | null => {
  if (!d.title.trim()) return TITLE_EMPTY_ERROR;
  return between(charCount(d.title), TITLE_MIN, TITLE_MAX) ? null : TITLE_LENGTH_ERROR;
};
// Descripción opcional: vacía pasa; si se escribe, de 80 a 2000.
export const descriptionError = (d: ListingDraft): string | null =>
  d.description.trim() && !between(charCount(d.description), DESCRIPTION_MIN, DESCRIPTION_MAX) ? DESCRIPTION_LENGTH_ERROR : null;
export const nightlyError = (d: ListingDraft): string | null => (isInt(d.nightlyPriceCrc, 1) ? null : NIGHTLY_PRICE_ERROR);
// Precio al mes opcional: vacío es «Precio a negociar con el dueño».
export const monthlyError = (d: ListingDraft): string | null => (d.acceptsMonthly && d.monthlyPriceCrc !== null && !isInt(d.monthlyPriceCrc, 1) ? MONTHLY_PRICE_ERROR : null);

/** Validación de una pantalla: la que usa la edición de una casa publicada (domain/edit.ts). El asistente de publicar solo
 *  exige lo de `requiredProblems`; lo demás de estas reglas sale como aviso (`warnings`). */
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
      return titleError(d) ?? descriptionError(d);
    case 7:
      // Las fotos no son obligatorias para enviar (publicar v2): para aprobar hace falta una, lo exige el admin.
      if (d.photoCount > MAX_PHOTOS) return `Máximo ${MAX_PHOTOS} fotos.`;
      return null;
    case 8:
      return nightlyError(d) ?? monthlyError(d);
    case 9:
      return null;
  }
}
