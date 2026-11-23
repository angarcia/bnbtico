import { describe, isNegotiable } from "../../domain/describe";
import { FEATURE_LABEL, KIND_LABELS, MONTHLY_LABEL, locationLine, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { formatPhone } from "../../domain/phone";
import { Checkbox } from "../../shared/ui/field";
import { StatusTag } from "../../shared/ui/structure";
import { Card } from "../../shared/ui/card";
import * as ADMIN_COPY from "./copy/admin";

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
      {d.monthly ? <span className="muted"> · {ADMIN_COPY.monthly({ amount: isNegotiable(d.monthly) ? null : formatCRC(d.monthly.amount) })}</span> : null}
    </span>
  ) : (
    <span className="small muted">{ADMIN_COPY.noPrice}</span>
  );
}

export function FeatureBadges({ l }: { l: Listing }) {
  return (
    <div className="row wrap gap-6">
      {l.features.map((f) => (
        <StatusTag key={f} label={{ text: f === "parking" && l.parkingPaid !== null ? ADMIN_COPY.parking({ paid: l.parkingPaid }) : FEATURE_LABEL[f], tone: "neutral" }} />
      ))}
      {l.features.length === 0 ? <span className="xs muted">{ADMIN_COPY.noFeatures}</span> : null}
    </div>
  );
}

export function OwnerCard({ l, ownerName }: { l: Listing; ownerName: string }) {
  return (
    <Card layout="row" gap={12} placement="review-owner">
      <span className="avatar avatar-sm" aria-hidden="true">
        {initials(ownerName)}
      </span>
      <span className="stack gap-0 grow-col">
        <b className="small">{ownerName}</b>
        <span className="xs primary strong">
          {ADMIN_COPY.verifiedPhone({ phone: <span key="phone" className="num">{formatPhone(l.whatsappPhone)}</span> })}
        </span>
      </span>
    </Card>
  );
}

export function Checklist() {
  return (
    <Card tone="soft" layout="stack" gap={8}>
      <b className="small">{ADMIN_COPY.checklist}</b>
      <Checkbox name="check-photos">{ADMIN_COPY.checkPhotos}</Checkbox>
      <Checkbox name="check-text">{ADMIN_COPY.checkText}</Checkbox>
      <Checkbox name="check-price">{ADMIN_COPY.checkPrice}</Checkbox>
    </Card>
  );
}
