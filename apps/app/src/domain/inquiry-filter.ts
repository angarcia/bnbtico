// Actividad: filtrar las consultas por casa y los chips «Todas · <casa> · <casa>» (decisión G). Solo tipos de los otros
// módulos: este archivo va en el trozo de Actividad y no debe arrastrar la hoja de contacto ni las reglas de las casas.
import type { OwnerInquiry } from "./inquiry";
import type { Listing } from "./listing";

/** Largo máximo de la etiqueta de un chip, con el «…». */
export const CHIP_MAX = 18;

/** Las consultas de una casa (o todas con `null`), en el mismo orden. Se filtra antes de tomar las últimas. */
export function filterInquiries<T extends Pick<OwnerInquiry, "listingId">>(list: readonly T[], listingId: string | null): T[] {
  return listingId === null ? [...list] : list.filter((i) => i.listingId === listingId);
}

export interface InquiryChip {
  id: string;
  /** Lo que se ve en el chip: hasta 18 caracteres con el «…». */
  label: string;
  /** El nombre completo (nombre accesible del chip). */
  name: string;
}

/** Un chip por casa publicada alguna vez, en el orden de sus casas; `null` con menos de dos («Todas» la añade la pantalla). */
export function inquiryChips(listings: readonly Pick<Listing, "id" | "title" | "firstPublishedAt">[]): InquiryChip[] | null {
  const chips = listings
    .filter((l) => l.firstPublishedAt !== null)
    .map((l) => {
      const name = l.title.trim() || "Casa sin título";
      const label = name.length <= CHIP_MAX ? name : `${name.slice(0, CHIP_MAX - 1).replace(/[\s,.;:·-]+$/, "")}…`;
      return { id: l.id, label, name };
    });
  return chips.length < 2 ? null : chips;
}
