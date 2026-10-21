import Link from "next/link";
import type { Currency } from "@/lib/currency";
import type { PublicListing } from "@/lib/listings/repo";
import { FEATURE_SHORT } from "@/lib/listings/schema";
import { formatMoney } from "@/lib/money";

/** Tarjeta del catálogo (pantalla 01): foto 168 px con píldora de precio, nombre y «zona · personas · característica». */
export function ListingCard({ listing: l, currency }: { listing: PublicListing; currency: Currency }) {
  const cover = l.photos[0];
  const nightly = l.acceptsNightly && l.nightlyPriceCrc;
  const price = nightly ? [formatMoney(l.nightlyPriceCrc!, currency), "noche"] : l.monthlyPriceCrc ? [formatMoney(l.monthlyPriceCrc, currency), "mes"] : null;
  const firstFeature = l.features[0] ? FEATURE_SHORT[l.features[0]] : null;
  return (
    <Link href={`/casa/${l.publicId}`} className="listing-card">
      <div className="photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover.url} alt="" /> : null}
        {!nightly && l.acceptsMonthly ? <span className="pill pill-sm" style={{ left: 10, top: 10 }}>Mensual</span> : null}
        {!l.available ? <span className="pill pill-sm" style={{ right: 10, top: 10 }}>No disponible</span> : null}
        {price ? <span className="pill" style={{ left: 10, bottom: 10 }}>{price[0]} <span>/ {price[1]}</span></span> : null}
      </div>
      <h2>{l.title}</h2>
      <span className="small muted">{[l.zone, `${l.capacity} pers.`, firstFeature].filter(Boolean).join(" · ")}</span>
    </Link>
  );
}
