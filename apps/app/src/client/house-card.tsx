// Cabeza de la tarjeta de una casa (diseño v2, 07-mis-casas y 10-actividad): foto cuadrada con la etiqueta de estado
// encima, nombre y zona. La usan Mis casas y Actividad; debajo, cada pantalla pone lo suyo (botones o cifras).
import { Link } from "@tanstack/react-router";
import { isLegacyPhotoPath, variantUrl } from "../domain/image";
import type { Listing } from "../domain/listing";
import type { ListingEdit } from "../domain/edit";
import { cardLabel } from "../domain/navigation";
import { I } from "../shared/icons";

export interface HouseCardTopProps {
  listing: Listing;
  edit?: Pick<ListingEdit, "status"> | null;
  /** La primera tarjeta: la foto se pide enseguida («eager»); las demás, al acercarse. */
  eager?: boolean;
  /** Ancho de la foto en la pantalla: «100vw» a toda la fila; Actividad, de dos en dos, «50vw». */
  sizes?: string;
  /** Mis casas: el nombre es un enlace estirado al detalle y toda la tarjeta lo abre. */
  link?: boolean;
}

export function HouseCardTop({ listing: l, edit = null, eager = false, sizes = "100vw", link = false }: HouseCardTopProps) {
  const label = cardLabel(l, edit);
  const cover = l.photos[0];
  const title = l.title || "Borrador sin título";
  return (
    <>
      <div className="photo house-photo">
        {cover ? (
          <img
            src={variantUrl(cover, 800)}
            srcSet={isLegacyPhotoPath(cover.path) ? undefined : `${variantUrl(cover, 480)} 480w, ${variantUrl(cover, 800)} 800w`}
            sizes={isLegacyPhotoPath(cover.path) ? undefined : sizes}
            alt=""
            width={800}
            height={800}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          // Sin fotos (un borrador): un hueco hecho a propósito, no una imagen rota (Ana, 2026-11-04).
          <span className="photo-empty">
            <I.camera size={28} />
            Aún sin fotos
          </span>
        )}
        <span className={`state ${label.cls}`} data-testid="card-label">
          {label.text}
        </span>
      </div>
      <h2 className="house-card-title">
        {link ? (
          <Link to="/propietario/casas/$id" params={{ id: l.id }} className="stretched">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {l.zone ? (
        <span className="small muted" data-testid="card-zone">
          {l.zone}
        </span>
      ) : null}
    </>
  );
}
