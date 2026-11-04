import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { cardFacts, cardPrice, type CardPrice } from "../domain/describe";
import type { PublicListing, PublicPhoto, SearchListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { stayTotalLabel } from "../domain/search";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { FavoriteButton } from "../shared/favorite-button";
import { Picture } from "../shared/picture";
import { stripStep } from "./card-strip";
import { PhotoDots } from "../shared/photo-dots";
import { CardWhatsApp } from "./card-whatsapp";

const SIZES = "(min-width: 900px) 33vw, 100vw";

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

/** Fotos de la tarjeta (ticket 09 de la ronda del 2 nov): en la misma caja de la foto, una tira horizontal con `scroll-snap`
 *  (CSS) y los puntitos (`PhotoDots`, los mismos de la ficha). Al montar solo existe la primera; las demás son cajas del mismo tamaño y se montan
 *  al deslizar esa tarjeta (la que asoma y la siguiente): diez casas no piden cincuenta fotos. La tira va dentro del enlace:
 *  tocar abre la ficha y deslizar no navega. Con una sola foto, la foto sola. */
function CardPhotos({ photos, priority }: { photos: PublicPhoto[]; priority: boolean }) {
  const strip = useRef<HTMLDivElement>(null);
  const [{ index, reach }, setStep] = useState({ index: 0, reach: 0 });
  const cover = <Picture photo={photos[0]!} alt="" sizes={SIZES} width={800} height={600} priority={priority} />;
  if (photos.length === 1) return cover;
  const onScroll = () => {
    const el = strip.current;
    const next = el && stripStep({ scrollLeft: el.scrollLeft, width: el.clientWidth, count: photos.length, reach });
    if (next && (next.index !== index || next.reach !== reach)) setStep(next);
  };
  return (
    <>
      {/* Sin parada de tabulador propia (el enlace ya la tiene): con el teclado, las fotos están en la ficha. */}
      <div className="card-strip" ref={strip} onScroll={onScroll} tabIndex={-1}>
        {photos.map((p, i) =>
          i === 0 ? <span key={p.path} className="card-slide">{cover}</span> : <span key={p.path} className="card-slide">{i <= reach ? <Picture photo={p} alt="" sizes={SIZES} width={800} height={600} /> : null}</span>,
        )}
      </div>
      {/* Puntitos en lugar del «1 / N» (2026-11-03), como en la ficha. */}
      <PhotoDots index={index} count={photos.length} />
    </>
  );
}

/** Tarjeta del catálogo (pantalla 01, una por fila): foto 4:3, 3:2 y de borde a borde en el teléfono (deslizable si hay más) con el corazón, nombre, zona, «4 personas
 *  · 2 habitaciones» y el precio (`CardPriceText`: con `nights` > 0, el total orientativo de esas noches); a la derecha del
 *  texto, el botón de WhatsApp. El corazón y el botón van fuera del enlace (un botón dentro de un enlace no es válido).
 *  `priority`: la primera, que es el LCP. */
export function ListingCard({ listing: l, nights = 0, priority = false }: { listing: PublicListing | SearchListing; nights?: number; priority?: boolean }) {
  const price = cardPrice(l, nights);
  return (
    <div className="listing-cell">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
        <div className="photo">{l.photos.length ? <CardPhotos photos={l.photos} priority={priority} /> : null}</div>
        <div className="listing-card-text">
          <h2>{l.title}</h2>
          <span className="muted">{l.zone}</span>
          <span className="muted">{cardFacts(l)}</span>
          {price ? <CardPriceText price={price} /> : null}
        </div>
      </Link>
      <FavoriteButton publicId={l.publicId} className="heart-card" size={24} />
      {l.available ? <CardWhatsApp listing={l} /> : null}
    </div>
  );
}
