import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/admin/review-form";
import { ApproxMap } from "@/components/listing/approx-map";
import { Gallery } from "@/components/listing/gallery";
import { StatusBadge } from "@/components/listing/status-badge";
import { ScreenTitle } from "@/components/shell";
import { getForAdmin } from "@/lib/listings/repo";
import { FEATURES, KIND_LABELS, MIN_PHOTOS } from "@/lib/listings/schema";
import { requireAdmin } from "@/lib/listings/session";
import { formatCRC } from "@/lib/money";

export const metadata = { title: "Revisar anuncio" };

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="stack" style={{ gap: 2, minWidth: 0 }}>
    <dt className="small muted">{label}</dt>
    <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value ?? "No informado"}</dd>
  </div>
);
const yesNo = (v: boolean) => (v ? "Sí" : "No");
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, margin: 0 };

/** Revisión completa de un anuncio (prototipo admin-review.js), sin nada de identidad. */
export default async function RevisarCasa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const item = await getForAdmin(db, id);
  if (!item) notFound();
  const { listing: l, ownerName } = item;
  return (
    <>
      <ScreenTitle title="Revisar anuncio" back="/admin" />
      <section className="card stack">
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
          <StatusBadge status={l.status} />
          <span className="xs muted num">{l.publicId}</span>
        </div>
        <h1 style={{ fontSize: 24, overflowWrap: "anywhere" }}>{l.title}</h1>
        <p className="small">Publicado por {ownerName}</p>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 18 }}>Fotos ({l.photos.length})</h2>
        <p className="small muted">Tocá una foto para ampliarla.</p>
        <Gallery photos={l.photos} title={l.title} />
        {l.photos.length < MIN_PHOTOS ? <p className="note">Faltan fotos: se requieren al menos {MIN_PHOTOS} para aprobar.</p> : null}
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 18 }}>Descripción</h2>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{l.description}</p>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 18 }}>Ubicación y alojamiento</h2>
        <dl style={grid}>
          <Row label="Provincia" value={l.province} />
          <Row label="Cantón" value={l.canton} />
          <Row label="Zona aproximada" value={l.zone} />
          <Row label="Tipo" value={l.kind ? KIND_LABELS[l.kind] : null} />
          <Row label="Máximo de personas" value={l.capacity} />
          <Row label="Habitaciones" value={l.bedrooms} />
          <Row label="Baños" value={l.bathrooms} />
        </dl>
        {l.lat !== null && l.lng !== null ? <ApproxMap lat={l.lat} lng={l.lng} /> : <p className="note">Sin ubicación en el mapa.</p>}
        <p className="xs muted">Sin dirección exacta.</p>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 18 }}>Características</h2>
        <dl style={grid}>
          {FEATURES.map(([key, label]) => (
            <Row key={key} label={label} value={key === "parking" && l.features.includes("parking") ? (l.parkingPaid === null ? "Sí · tarifa sin indicar" : l.parkingPaid ? "De pago" : "Gratuito") : yesNo(l.features.includes(key))} />
          ))}
        </dl>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 18 }}>Precios y condiciones</h2>
        <dl style={grid}>
          <Row label="Precio por noche" value={l.nightlyPriceCrc ? `${formatCRC(l.nightlyPriceCrc)} · orientativo` : null} />
          <Row label="Mínimo de noches" value={l.minNights} />
          <Row label="Acepta alquiler mensual" value={yesNo(l.acceptsMonthly === true)} />
          {l.acceptsMonthly ? (
            <>
              <Row label="Precio mensual" value={l.monthlyMode === "contact" ? "Consultar con el propietario" : l.monthlyPriceCrc ? `${formatCRC(l.monthlyPriceCrc)} · orientativo` : null} />
              <Row label="Mínimo de meses" value={l.minMonths} />
            </>
          ) : null}
        </dl>
        <p className="xs muted">Sin reservas ni pagos entre partes en bnbtico.</p>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 18 }}>Revisión y decisión</h2>
        <p className="small muted">Comprobá que fotos y descripción correspondan al anuncio y no incluyan teléfonos, enlaces ni publicidad de agencias.</p>
        <ReviewForm listingId={l.id} status={l.status} note={l.reviewNote} photoCount={l.photos.length} />
        <Link href="/admin" className="btn btn-ghost">Volver a anuncios</Link>
      </section>
    </>
  );
}
