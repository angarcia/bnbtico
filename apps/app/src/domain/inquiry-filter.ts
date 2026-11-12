// Consultas: filtrar por casa y ofrecer sus nombres completos en el selector. Solo tipos de los otros
// módulos: este archivo va en el trozo de Actividad y no debe arrastrar la hoja de contacto ni las reglas de las casas.
import type { OwnerInquiry } from "./inquiry";
import type { Listing } from "./listing";

/** Las consultas de una casa (o todas con `null`), en el mismo orden. Se filtra antes de tomar las últimas. */
export function filterInquiries<T extends Pick<OwnerInquiry, "listingId">>(list: readonly T[], listingId: string | null): T[] {
  return listingId === null ? [...list] : list.filter((i) => i.listingId === listingId);
}

export interface InquiryHouseOption {
  id: string;
  /** Nombre completo, sin recortarlo para la hoja. */
  name: string;
}

/** Una opción por casa publicada alguna vez; `null` con menos de dos. «Todas las casas» la añade el selector. */
export function inquiryHouseOptions(listings: readonly Pick<Listing, "id" | "title" | "firstPublishedAt">[]): InquiryHouseOption[] | null {
  const options = listings
    .filter((l) => l.firstPublishedAt !== null)
    .map((l) => {
      const name = l.title.trim() || "Casa sin título";
      return { id: l.id, name };
    });
  return options.length < 2 ? null : options;
}
