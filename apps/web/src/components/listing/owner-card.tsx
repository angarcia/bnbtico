import Link from "next/link";
import { deleteDraftAction, startEditAction } from "@/actions/listings";
import { ConfirmForm } from "@/components/confirm-form";
import { relativeDate } from "@/components/ui";
import { formatCRC } from "@/lib/money";
import type { Listing } from "@/lib/listings/schema";
import { ShareButton } from "./share-button";
import { StatusBadge } from "./status-badge";

/** Tarjeta de Mis casas (pantalla 10): miniatura, estado, nombre, precio, línea de situación y los botones de ese estado. */
export function OwnerCard({ listing: l, shareBase }: { listing: Listing; shareBase: string }) {
  const cover = l.photos[0];
  const price = l.acceptsNightly && l.nightlyPriceCrc ? [formatCRC(l.nightlyPriceCrc), "noche"] : l.acceptsMonthly && l.monthlyPriceCrc ? [formatCRC(l.monthlyPriceCrc), "mes"] : null;
  const situation =
    l.status === "active"
      ? "Gratis 12 meses · oferta de lanzamiento"
      : l.status === "review"
        ? `Enviada ${relativeDate(l.updatedAt)}. Le avisamos por WhatsApp.`
        : l.status === "changes"
          ? "Le pedimos cambios. Corríjalos y reenvíe."
          : l.status === "rejected"
            ? "Rechazada. Si quiere, publique una nueva."
            : l.reviewedAt
              ? "Estuvo publicada: al enviarla volverá a revisión."
              : "Borrador sin enviar.";
  return (
    <article className="card stack" style={{ padding: 12, gap: 12 }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="thumb" />
        ) : (
          <span className="thumb" />
        )}
        <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
          <StatusBadge status={l.status} available={l.available} />
          <h2 style={{ fontSize: 19, fontWeight: 700 }}>
            <Link href={`/propietario/casas/${l.id}`} style={{ color: "inherit", textDecoration: "none" }}>{l.title || "Borrador sin título"}</Link>
          </h2>
          {price ? <span className="num" style={{ fontWeight: 600 }}>{price[0]} <span className="muted" style={{ fontWeight: 400 }}>/ {price[1]}</span></span> : null}
          <span className="xs muted">{situation}</span>
        </div>
      </div>
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? <div className="note note-sun small">Nota de bnbtico: {l.reviewNote}</div> : null}
      {l.status === "active" ? (
        <div className="row" style={{ gap: 8 }}>
          <ShareButton url={`${shareBase}/casa/${l.publicId}`} title={l.title} text={l.title} className="btn btn-primary btn-block" />
          <Link href="/propietario/calendario" className="btn btn-ghost" style={{ flex: 1 }}>Calendario</Link>
        </div>
      ) : null}
      {l.status === "changes" ? (
        <form action={startEditAction}>
          <input type="hidden" name="id" value={l.id} />
          <button className="btn btn-ghost btn-block" type="submit">Corregir y reenviar</button>
        </form>
      ) : null}
      {l.status === "draft" ? (
        <div className="row" style={{ gap: 8 }}>
          <Link href={`/propietario/publicar/${l.id}/1`} className="btn btn-primary" style={{ flex: 1 }}>Seguir</Link>
          {l.reviewedAt ? null : (
            <ConfirmForm action={deleteDraftAction} message="¿Descartar este borrador? No se puede deshacer." className="row">
              <input type="hidden" name="id" value={l.id} />
              <button className="btn btn-ghost" type="submit">Descartar</button>
            </ConfirmForm>
          )}
        </div>
      ) : null}
    </article>
  );
}
