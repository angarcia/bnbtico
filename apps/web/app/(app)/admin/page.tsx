import Link from "next/link";
import { StatusBadge } from "@/components/listing/status-badge";
import { ScreenTitle } from "@/components/shell";
import { queue } from "@/lib/listings/repo";
import { requireAdmin } from "@/lib/listings/session";

export const metadata = { title: "Revisión de anuncios" };

const when = (iso: string) => new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Cola del admin: pendientes primero, luego las decididas en los últimos 30 días. Solo con `is_admin`. */
export default async function Admin() {
  const { db } = await requireAdmin();
  const items = await queue(db);
  const pending = items.filter((i) => i.listing.status === "review").length;
  return (
    <>
      <ScreenTitle title="Revisión de anuncios" right={<span className="badge badge-warn num">{pending} pendientes</span>} />
      <p className="small muted">Revisá fotos, descripción y datos del anuncio. Las decisiones se guardan y el propietario las ve en Mis casas.</p>
      {items.length === 0 ? (
        <section className="card"><p>No hay anuncios pendientes.</p></section>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {items.map(({ listing: l, ownerName }) => (
            <article key={l.id} className="card stack" style={{ opacity: l.status === "review" ? 1 : 0.7 }}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div>
                  <b>{l.title || "Sin título"}</b>
                  <div className="xs muted">{ownerName} · {l.status === "review" ? "Enviado" : "Decidido"} {when(l.status === "review" ? l.updatedAt : l.updatedAt)}</div>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <div className="small muted">{l.zone}, {l.province} · {l.publicId}</div>
              <Link href={`/admin/casas/${l.id}`} className="btn btn-ghost">{l.status === "review" ? "Revisar" : "Ver decisión"}</Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
