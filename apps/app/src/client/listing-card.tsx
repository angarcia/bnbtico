import { Link } from "@tanstack/react-router";
import { describe } from "../domain/describe";
import { FEATURE_SHORT, type PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { useCurrency } from "../shared/currency";
import { Picture } from "../shared/picture";

/** Tarjeta del catálogo (pantalla 01): foto 168 px con píldora de precio, nombre y «zona · personas · característica». */
export function ListingCard({ listing: l }: { listing: PublicListing }) {
  const currency = useCurrency();
  const cover = l.photos[0];
  const price = describe(l, { base: "" }).mainPrice;
  const firstFeature = l.features[0] ? FEATURE_SHORT[l.features[0]] : null;
  return (
    <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="listing-card">
      <div className="photo">
        {cover ? <Picture photo={cover} alt="" sizes="(min-width: 560px) 260px, 50vw" width={480} height={336} /> : null}
        {price?.unit === "mes" ? <span className="pill pill-sm pill-tl">Mensual</span> : null}
        {!l.available ? <span className="pill pill-sm pill-tr">No disponible</span> : null}
        {price ? (
          <span className="pill pill-bl">
            {formatMoney(price.amount, currency)} <span>/ {price.unit}</span>
          </span>
        ) : null}
      </div>
      <h2>{l.title}</h2>
      <span className="small muted">{[l.zone, `${l.capacity} pers.`, firstFeature].filter(Boolean).join(" · ")}</span>
    </Link>
  );
}
