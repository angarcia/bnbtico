import { favoritesStore, useIsFavorite } from "./favorites-store";
import { I } from "./icons";

/** Corazón de favoritos: cambia al momento (teléfono primero) y nunca navega aunque esté sobre una tarjeta. */
export function FavoriteButton({ publicId, className, size = 22 }: { publicId: string; className: string; size?: number }) {
  const on = useIsFavorite(publicId);
  return (
    <button
      type="button"
      className={`heart ${className}`}
      aria-pressed={on}
      aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
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
