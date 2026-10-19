import Link from "next/link";
import { deleteDraftAction } from "@/actions/listings";
import { formatCRC } from "@/lib/money";
import type { Listing } from "@/lib/listings/schema";
import { StatusBadge } from "./status-badge";

/** Tarjeta ligera de Mis casas (prototipo mis-casas.js, móvil): portada, título, estado, precio y la acción que toca. */
export function OwnerCard({ listing: l }: { listing: Listing }) {
  const cover = l.photos[0];
  const place = [l.zone, l.province].filter(Boolean).join(", ");
  return (
    <article className="listing">
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
          <b>{l.title ? <Link href={`/propietario/casas/${l.id}`} style={{ textDecoration: "none" }}>{l.title}</Link> : "Borrador sin título"}</b>
          <StatusBadge status={l.status} available={l.available} />
        </div>
        {place ? <span className="small muted">{place}</span> : null}
        {l.nightlyPriceCrc ? <span className="num small">{formatCRC(l.nightlyPriceCrc)} / noche · orientativo</span> : null}
        {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? (
          <div className="note small">Nota de bnbtico: {l.reviewNote}</div>
        ) : null}
        {l.status === "draft" ? (
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <Link href={`/propietario/publicar/${l.id}/1`} className="btn btn-primary" style={{ flex: 1 }}>Seguir</Link>
            <form action={deleteDraftAction}>
              <input type="hidden" name="id" value={l.id} />
              <button className="btn btn-ghost" type="submit">Descartar</button>
            </form>
          </div>
        ) : null}
        {l.status === "active" ? (
          <Link href={`/casa/${l.publicId}`} className="btn btn-primary" style={{ marginTop: 4 }}>Compartir ficha</Link>
        ) : null}
      </div>
    </article>
  );
}
