import Link from "next/link";
import type { Currency } from "@/lib/currency";
import type { PublicListing } from "@/lib/listings/repo";
import { formatMoney } from "@/lib/money";

/** Tarjeta del catálogo: portada, título, zona, capacidad y precio por noche en la moneda elegida. */
export function ListingCard({ listing: l, currency }: { listing: PublicListing; currency: Currency }) {
  const cover = l.photos[0];
  return (
    <Link href={`/casa/${l.publicId}`} className="listing" style={{ textDecoration: "none", display: "block" }}>
      <div className="photo">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" />
        ) : (
          <span className="small">Sin fotos</span>
        )}
      </div>
      <div className="body">
        <div className="row between" style={{ alignItems: "flex-start", gap: 8 }}>
          <b>{l.title}</b>
          {!l.available ? <span className="badge badge-mute">No disponible</span> : null}
        </div>
        <span className="small muted">{l.zone}, {l.province}</span>
        <span className="small muted">{l.capacity} personas · {l.bedrooms} {l.bedrooms === 1 ? "habitación" : "habitaciones"}</span>
        <span className="num"><b>{formatMoney(l.nightlyPriceCrc, currency)}</b> <span className="small muted">/ noche · orientativo</span></span>
      </div>
    </Link>
  );
}
