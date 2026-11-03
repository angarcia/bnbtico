import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { cardFacts, cardPrice, describe } from "../domain/describe";
import type { PublicListing, PublicPhoto } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { stayTotalLabel } from "../domain/search";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { FavoriteButton } from "../shared/favorite-button";
import { Picture } from "../shared/picture";
import { CardWhatsApp } from "./card-whatsapp";

/** Fotos de la tarjeta (ticket 09 de la ronda del 2 nov): tira horizontal con `scroll-snap` (CSS) y contador «1 / N». Solo la
 *  primera foto existe al montar; las demás son cajas del mismo tamaño y se montan al deslizar (la siguiente a la que se ve y
 *  la que viene después), así una lista de diez casas no pide cincuenta fotos. `priority`: la primera de la primera tarjeta. */
function CardPhotos({ photos, priority }: { photos: PublicPhoto[]; priority: boolean }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [reach, setReach] = useState(0);
  const last = photos.length - 1;
  const onScroll = () => {
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    const at = el.scrollLeft / el.clientWidth;
    setReach((r) => Math.min(last, Math.max(r, Math.ceil(at) + 1)));
    setIndex(Math.min(last, Math.round(at)));
  };
  return (
    <>
      <div className="card-strip" ref={strip} onScroll={last > 0 ? onScroll : undefined}>
        {photos.map((p, i) =>
          i > reach ? <div key={p.path} className="slot" /> : <Picture key={p.path} photo={p} alt="" sizes="(min-width: 900px) 33vw, 100vw" width={800} height={640} priority={priority && i === 0} />,
        )}
      </div>
      {last > 0 ? (
        <span className="pill pill-sm hero-counter" aria-hidden="true">
          {`${index + 1} / ${photos.length}`}
        </span>
      ) : null}
    </>
  );
}

/** Tarjeta del catálogo (pantalla 01, una por fila): fotos 5:4 a todo el ancho con el corazón, nombre, zona, «4 personas · 2 habitaciones»
 *  el precio de la noche (con llegada y salida, el total orientativo de esas noches: «≈ ₡180 000 por 4 noches»). El corazón va fuera del enlace (un botón
 *  dentro de un enlace no es válido) y encima de la foto. `priority`: la primera, que es el LCP. */
export function ListingCard({ listing: l, nights = 0, priority = false }: { listing: PublicListing; nights?: number; priority?: boolean }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const price = cardPrice(l, describe(l, { base: "" }).mainPrice, nights);
  return (
    <div className="listing-cell">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
        <div className="photo">{l.photos.length ? <CardPhotos photos={l.photos} priority={priority} /> : null}</div>
        <div className="listing-card-text">
          <h2>{l.title}</h2>
          <span className="muted">{l.zone}</span>
          <span className="muted">{cardFacts(l)}</span>
          {price ? (
            <span className="card-price num">
              {"stayTotalCrc" in price ? (
                <b>{stayTotalLabel(price.stayTotalCrc, price.nights, currency, fx.crcPerUsd)}</b>
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
      {l.available ? <CardWhatsApp listing={l} /> : null}
    </div>
  );
}
