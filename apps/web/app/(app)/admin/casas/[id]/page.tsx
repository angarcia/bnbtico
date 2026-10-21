import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/admin/review-form";
import { ApproxMap } from "@/components/listing/approx-map";
import { FlowHeader } from "@/components/shell";
import { Initials } from "@/components/ui";
import { getForAdmin } from "@/lib/listings/repo";
import { FEATURE_LABEL, KIND_LABELS, modesLabel } from "@/lib/listings/schema";
import { requireAdmin } from "@/lib/listings/session";
import { formatCRC } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Revisar anuncio" };

/** Pantalla 22: fotos, datos, propietario, descripción y características; decisión abajo. Sin nada de identidad. */
export default async function RevisarCasa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const item = await getForAdmin(db, id);
  if (!item) notFound();
  const { listing: l, ownerName } = item;
  const price = l.acceptsNightly && l.nightlyPriceCrc ? `${formatCRC(l.nightlyPriceCrc)} / noche` : l.monthlyPriceCrc ? `${formatCRC(l.monthlyPriceCrc)} / mes` : "Sin precio";
  return (
    <>
      <FlowHeader title="Revisar anuncio" back="/admin" />
      <div className="photo-strip">
        {l.photos.map((p, i) => (
          <div key={p.id} className="photo" style={{ width: i === 0 ? 200 : 110 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Foto ${i + 1}`} />
            {i === 0 ? <span className="pill pill-sm" style={{ left: 10, bottom: 10 }}>{l.photos.length} fotos</span> : null}
          </div>
        ))}
        {l.photos.length === 0 ? <div className="photo" style={{ width: 200 }}><span className="small">Sin fotos</span></div> : null}
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row between">
          <h2>{l.title || "Sin nombre"}</h2>
          <span className="xs muted num">{l.publicId}</span>
        </div>
        <span className="small muted">
          {[modesLabel(l), l.kind ? KIND_LABELS[l.kind] : null, l.kind === "habitacion" && l.bathroomShared !== null ? (l.bathroomShared ? "baño compartido" : "baño privado") : null, `${l.zone}, ${l.canton}`, l.capacity ? `${l.capacity} personas` : null, l.bedrooms !== null ? `${l.bedrooms} hab` : null, l.bathrooms ? `${l.bathrooms} ${l.bathrooms === 1 ? "baño" : "baños"}` : null].filter(Boolean).join(" · ")}
        </span>
        <span className="num" style={{ fontWeight: 700 }}>{price}{l.acceptsNightly && l.acceptsMonthly && l.monthlyPriceCrc ? <span className="muted" style={{ fontWeight: 400 }}> · mensual {formatCRC(l.monthlyPriceCrc)}</span> : null}</span>
      </div>
      <section className="card row" style={{ gap: 12, padding: "12px 14px", borderRadius: 20 }}>
        <Initials name={ownerName} small />
        <div className="stack" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <b className="small">{ownerName}</b>
          <span className="xs primary" style={{ fontWeight: 600 }}>WhatsApp verificado · <span className="num">{formatPhone(l.whatsappPhone)}</span></span>
        </div>
      </section>
      <section className="card stack" style={{ gap: 8, padding: "12px 14px", borderRadius: 20 }}>
        <b className="small muted">Descripción</b>
        <p className="small" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{l.description}</p>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
          {l.features.map((f) => (
            <span key={f} className="badge">{f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratuito"}` : FEATURE_LABEL[f]}</span>
          ))}
          {l.features.length === 0 ? <span className="xs muted">Sin características marcadas</span> : null}
        </div>
      </section>
      {l.lat !== null && l.lng !== null ? <ApproxMap lat={l.lat} lng={l.lng} /> : <p className="note note-sun small">Sin ubicación en el mapa.</p>}
      <ReviewForm listingId={l.id} status={l.status} note={l.reviewNote} photoCount={l.photos.length} />
    </>
  );
}
