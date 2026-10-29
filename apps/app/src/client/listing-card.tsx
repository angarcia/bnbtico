import { Link } from "@tanstack/react-router";
import { NEGOTIABLE_CARD, cardFacts, cardPrice, describe } from "../domain/describe";
import type { PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { FavoriteButton } from "../shared/favorite-button";
import { Picture } from "../shared/picture";

/** Tarjeta del catálogo (pantalla 01, una por fila): foto 4:3 con el corazón, nombre, zona, «4 personas · 2 habitaciones»
 *  y el precio de la noche (con el mensual, el del mes o «Precio a negociar»). El corazón va fuera del enlace (un botón
 *  dentro de un enlace no es válido) y encima de la foto. `priority`: la primera, que es el LCP. */
export function ListingCard({ listing: l, monthly = false, priority = false }: { listing: PublicListing; monthly?: boolean; priority?: boolean }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const cover = l.photos[0];
  const price = cardPrice(describe(l, { base: "" }), monthly);
  return (
    <div className="listing-cell">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
        <div className="photo">{cover ? <Picture photo={cover} alt="" sizes="(min-width: 900px) 33vw, 100vw" width={800} height={600} priority={priority} /> : null}</div>
        <div className="listing-card-text">
          <h2>{l.title}</h2>
          <span className="muted">{l.zone}</span>
          <span className="muted">{cardFacts(l)}</span>
          {price ? (
            <span className="card-price num">
              {"negotiable" in price ? (
                NEGOTIABLE_CARD
              ) : (
                <>
                  <b>{formatMoney(price.amount, currency, fx.crcPerUsd)}</b> <span className="muted">/ {price.unit}</span>
                </>
              )}
            </span>
          ) : null}
        </div>
      </Link>
      <FavoriteButton publicId={l.publicId} className="heart-card" size={24} />
    </div>
  );
}
