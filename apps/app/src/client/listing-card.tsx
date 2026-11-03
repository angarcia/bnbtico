import { Link } from "@tanstack/react-router";
import { cardFacts, cardPrice, type CardPrice } from "../domain/describe";
import type { PublicListing, SearchListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { stayTotalLabel } from "../domain/search";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { FavoriteButton } from "../shared/favorite-button";
import { Picture } from "../shared/picture";

/** El precio de la tarjeta y de la del mapa: «₡45 000 / noche» o, con llegada y salida, «≈ ₡180 000 por 4 noches»; la cifra,
 *  en negrita y en la moneda elegida. Nunca «total a pagar». */
export function CardPriceText({ price }: { price: NonNullable<CardPrice> }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD").crcPerUsd;
  const { amount, unit } = "stayTotalCrc" in price ? stayTotalLabel(price.stayTotalCrc, price.nights, currency, fx) : { amount: formatMoney(price.amount, currency, fx), unit: `/ ${price.unit}` };
  return (
    <span className="card-price num">
      <b>{amount}</b> <span className="muted">{unit}</span>
    </span>
  );
}

/** Tarjeta del catálogo (pantalla 01, una por fila): foto 4:3 con el corazón, nombre, zona, «4 personas · 2 habitaciones»
 *  y el precio (`CardPriceText`: con `nights` > 0, el total orientativo de esas noches). El corazón va fuera del enlace (un
 *  botón dentro de un enlace no es válido) y encima de la foto. `priority`: la primera, que es el LCP. */
export function ListingCard({ listing: l, nights = 0, priority = false }: { listing: PublicListing | SearchListing; nights?: number; priority?: boolean }) {
  const cover = l.photos[0];
  const price = cardPrice(l, nights);
  return (
    <div className="listing-cell">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
        <div className="photo">{cover ? <Picture photo={cover} alt="" sizes="(min-width: 900px) 33vw, 100vw" width={800} height={600} priority={priority} /> : null}</div>
        <div className="listing-card-text">
          <h2>{l.title}</h2>
          <span className="muted">{l.zone}</span>
          <span className="muted">{cardFacts(l)}</span>
          {price ? <CardPriceText price={price} /> : null}
        </div>
      </Link>
      <FavoriteButton publicId={l.publicId} className="heart-card" size={24} />
    </div>
  );
}
