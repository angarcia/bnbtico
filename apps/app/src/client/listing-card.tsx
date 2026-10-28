import { Link } from "@tanstack/react-router";
import { NEGOTIABLE_CARD, cardPrice, describe } from "../domain/describe";
import { FEATURE_SHORT, type PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { FavoriteButton } from "../shared/favorite-button";
import { Picture } from "../shared/picture";

/** Tarjeta del catálogo (pantalla 01): foto 168 px con píldora de precio y corazón, nombre y «zona · personas ·
 *  característica». El corazón va fuera del enlace (un botón dentro de un enlace no es válido) y encima de la foto. */
export function ListingCard({ listing: l, monthly = false }: { listing: PublicListing; monthly?: boolean }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const cover = l.photos[0];
  // Con el filtro «Alquiler mensual», el precio al mes o «Precio a negociar»; si no, el de la noche. Siempre con su unidad.
  const price = cardPrice(describe(l, { base: "" }), monthly);
  const firstFeature = l.features[0] ? FEATURE_SHORT[l.features[0]] : null;
  return (
    <div className="listing-cell">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
        <div className="photo">
          {cover ? <Picture photo={cover} alt="" sizes="(min-width: 560px) 260px, 50vw" width={480} height={336} /> : null}
          {!l.available ? (
            <span className="pills-tl">
              <span className="pill pill-sm">No disponible</span>
            </span>
          ) : null}
          {price ? (
            <span className="pill pill-bl">
              {"negotiable" in price ? (
                NEGOTIABLE_CARD
              ) : (
                <>
                  {formatMoney(price.amount, currency, fx.crcPerUsd)} <span>/ {price.unit}</span>
                </>
              )}
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
