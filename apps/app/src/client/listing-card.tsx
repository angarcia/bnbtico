import { Link } from "@tanstack/react-router";
import { describe } from "../domain/describe";
import { FEATURE_SHORT, type PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { FavoriteButton } from "../shared/favorite-button";
import { Picture } from "../shared/picture";

/** Tarjeta del catálogo (pantalla 01): foto 168 px con píldora de precio y corazón, nombre y «zona · personas ·
 *  característica». El corazón va fuera del enlace (un botón dentro de un enlace no es válido) y encima de la foto. */
export function ListingCard({ listing: l }: { listing: PublicListing }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const cover = l.photos[0];
  const price = describe(l, { base: "" }).mainPrice;
  const firstFeature = l.features[0] ? FEATURE_SHORT[l.features[0]] : null;
  return (
    <div className="listing-cell">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
        <div className="photo">
          {cover ? <Picture photo={cover} alt="" sizes="(min-width: 560px) 260px, 50vw" width={480} height={336} /> : null}
          {price?.unit === "mes" || !l.available ? (
            <span className="pills-tl">
              {price?.unit === "mes" ? <span className="pill pill-sm">Mensual</span> : null}
              {!l.available ? <span className="pill pill-sm">No disponible</span> : null}
            </span>
          ) : null}
          {price ? (
            <span className="pill pill-bl">
              {formatMoney(price.amount, currency, fx.crcPerUsd)} <span>/ {price.unit}</span>
            </span>
          ) : null}
        </div>
        <h2>{l.title}</h2>
        <span className="small muted">{[l.zone, `${l.capacity} pers.`, firstFeature].filter(Boolean).join(" · ")}</span>
      </Link>
      <FavoriteButton publicId={l.publicId} className="heart-card" size={24} />
    </div>
  );
}
