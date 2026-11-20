// Qué campo del formulario de una casa ha fallado (historia 07, paso 4): el error se pinta debajo de ese campo y lo marca
// (`aria-invalid`). Sale del mensaje, que es el mismo en el navegador, el fake y la base (`submit_listing`,
// `update_listing_live`): así también los errores que devuelve el servidor van a su campo. Los que no son de un campo
// (la ubicación, las fotos, la red) siguen en el aviso general del formulario.
// Módulo de dominio: sin imports de framework.
import {
  BATHROOM_SHARED_ERROR,
  BATHROOMS_ERROR,
  BEDROOMS_ERROR,
  CAPACITY_ERROR,
  DESCRIPTION_LENGTH_ERROR,
  KIND_ERROR,
  MONTHLY_PRICE_ERROR,
  NIGHTLY_PRICE_ERROR,
  PARKING_ERROR,
  TITLE_EMPTY_ERROR,
  TITLE_LENGTH_ERROR,
} from "./listing-rules";

/** El `name` del campo en el formulario. */
export type ListingFieldName = "kind" | "capacity" | "bedrooms" | "bathrooms" | "bathroomShared" | "parkingPaid" | "title" | "description" | "nightlyPriceCrc" | "monthlyPriceCrc";

const BY_MESSAGE: Readonly<Record<string, ListingFieldName>> = {
  [KIND_ERROR]: "kind",
  [CAPACITY_ERROR]: "capacity",
  [BEDROOMS_ERROR]: "bedrooms",
  [BATHROOMS_ERROR]: "bathrooms",
  [BATHROOM_SHARED_ERROR]: "bathroomShared",
  [PARKING_ERROR]: "parkingPaid",
  [TITLE_EMPTY_ERROR]: "title",
  [TITLE_LENGTH_ERROR]: "title",
  [DESCRIPTION_LENGTH_ERROR]: "description",
  [NIGHTLY_PRICE_ERROR]: "nightlyPriceCrc",
  [MONTHLY_PRICE_ERROR]: "monthlyPriceCrc",
};

export interface FieldProblem {
  field: ListingFieldName;
  message: string;
}

/** El campo de ese mensaje, o null si no es de un campo. */
export function listingFieldError(message: string | null): FieldProblem | null {
  const field = message ? BY_MESSAGE[message] : undefined;
  return field && message ? { field, message } : null;
}
