import { favoritesStore, useIsFavorite } from "./favorites-store";
import { I } from "./ui/icons";
import * as LISTING_PARTS_COPY from "./copy/listing-parts";

/** Corazón de favoritos: cambia al momento (teléfono primero) y nunca navega aunque esté sobre una tarjeta. */
export function FavoriteButton({ publicId, className, size = 22 }: { publicId: string; className: string; size?: number }) {
  const on = useIsFavorite(publicId);
  return (
    <button
      type="button"
      className={`heart ${className}`}
      aria-pressed={on}
      aria-label={LISTING_PARTS_COPY.favorite({ saved: on })}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        favoritesStore.toggle(publicId);
      }}
    >
      <I.heart size={size} />
    </button>
  );
}
