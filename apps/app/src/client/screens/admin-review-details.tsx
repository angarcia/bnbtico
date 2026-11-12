import { describe, isNegotiable } from "../../domain/describe";
import { FEATURE_LABEL, KIND_LABELS, MONTHLY_LABEL, locationLine, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { formatPhone } from "../../domain/phone";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export const bathText = (l: Pick<Listing, "kind" | "bathroomShared">) =>
  l.kind === "habitacion" && l.bathroomShared !== null ? (l.bathroomShared ? "baño compartido" : "baño privado") : null;

/** «Alojamiento completo · Cahuita · Talamanca, Limón · 2 personas · 1 hab · 1 baño»; sin el tipo o la zona si cambian. */
export function factsLine(l: Listing, skip: { kind?: boolean; location?: boolean } = {}): string {
  return [
    l.acceptsMonthly ? MONTHLY_LABEL : null,
    !skip.kind && l.kind ? KIND_LABELS[l.kind] : null,
    skip.kind ? null : bathText(l),
    skip.location ? null : locationLine(l),
    l.capacity ? `${l.capacity} personas` : null,
    l.bedrooms !== null ? `${l.bedrooms} hab` : null,
    l.bathrooms ? `${l.bathrooms} ${l.bathrooms === 1 ? "baño" : "baños"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PriceLine({ l }: { l: Listing }) {
  const d = describe(l, { base: "" });
  return d.mainPrice ? (
    <span className="num strong">
      {formatCRC(d.mainPrice.amount)}{" "}
      <span className="muted">
        / {d.mainPrice.unit}
      </span>
      {d.monthly ? <span className="muted"> · {isNegotiable(d.monthly) ? "mensual a negociar" : `mensual ${formatCRC(d.monthly.amount)}`}</span> : null}
    </span>
  ) : (
    <span className="small muted">Sin precio</span>
  );
}

export function FeatureBadges({ l }: { l: Listing }) {
  return (
    <div className="row wrap gap-6">
      {l.features.map((f) => (
        <span key={f} className="badge">
          {f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratuito"}` : FEATURE_LABEL[f]}
        </span>
      ))}
      {l.features.length === 0 ? <span className="xs muted">Sin características marcadas</span> : null}
    </div>
  );
}

export function OwnerCard({ l, ownerName }: { l: Listing; ownerName: string }) {
  return (
    <section className="card row gap-12 review-owner">
      <span className="avatar avatar-sm" aria-hidden="true">
        {initials(ownerName)}
      </span>
      <span className="stack gap-0 grow-col">
        <b className="small">{ownerName}</b>
        <span className="xs primary strong">
          WhatsApp verificado · <span className="num">{formatPhone(l.whatsappPhone)}</span>
        </span>
      </span>
    </section>
  );
}

export function Checklist() {
  return (
    <section className="card-soft stack gap-8">
      <b className="small">Antes de decidir</b>
      <label className="check">
        <input type="checkbox" name="check-photos" /> Las fotos son de la casa y sin teléfonos ni logos
      </label>
      <label className="check">
        <input type="checkbox" name="check-text" /> La descripción no tiene enlaces ni publicidad
      </label>
      <label className="check">
        <input type="checkbox" name="check-price" /> Zona y precio coherentes
      </label>
    </section>
  );
}
