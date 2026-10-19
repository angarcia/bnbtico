import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDraftAction, setAvailableAction, startEditAction } from "@/actions/listings";
import { ConfirmForm } from "@/components/confirm-form";
import { ShareButton } from "@/components/listing/share-button";
import { StatusBadge } from "@/components/listing/status-badge";
import { ScreenTitle } from "@/components/shell";
import { getOwnListing } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";
import { previewText, publicUrl, shareBase } from "@/lib/listings/share";
import { formatCRC } from "@/lib/money";

export const metadata = { title: "Mi casa" };

const STATUS_TEXT: Record<string, string> = {
  draft: "Todavía no la enviaste a revisión.",
  review: "La estamos revisando. Te avisamos cuando esté lista.",
  changes: "Revisá la nota de bnbtico, corregí y reenviá.",
  active: "Visible en bnbtico. Compartí el enlace con tus clientes.",
  rejected: "Este anuncio fue rechazado. Si querés, publicá uno nuevo.",
  payment_due: "Fuera del catálogo hasta regularizar la suscripción.",
  inactive: "Paraste la suscripción. La casa no se muestra.",
};

/** Detalle de gestión de una casa (prototipo mis-casas.js, móvil): estado, compartir, disponibilidad, editar. */
export default async function CasaPropietario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwnerSession(`/propietario/casas/${id}`);
  const l = await getOwnListing(db, id);
  if (!l) notFound();
  const h = await headers();
  const origin = h.get("host") ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}` : null;
  const url = publicUrl(l.publicId, shareBase({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_STAGE: process.env.NEXT_PUBLIC_STAGE }, origin));
  const active = l.status === "active";
  const cover = l.photos[0];
  return (
    <>
      <ScreenTitle title={l.title || "Borrador sin título"} back="/propietario/casas" />
      <div className="photo" style={{ borderRadius: 12 }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" />
        ) : (
          <span className="small">Sin fotos</span>
        )}
      </div>

      <section className="card stack">
        <div className="row between">
          <b className="num">{l.nightlyPriceCrc ? `${formatCRC(l.nightlyPriceCrc)} / noche` : "Sin precio"}</b>
          <StatusBadge status={l.status} available={l.available} />
        </div>
        <p className="small muted">{l.status === "draft" && l.reviewedAt ? "Estuvo publicada. Estás editándola: al enviarla volverá a revisión." : STATUS_TEXT[l.status]}</p>
        {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? <div className="note small">Nota de bnbtico: {l.reviewNote}</div> : null}
        <span className="xs muted num">{l.publicId}</span>
      </section>

      <section className="card stack">
        <b>Ficha</b>
        <ShareButton url={url} title={l.title} text={l.kind && l.nightlyPriceCrc ? previewText({ kind: l.kind, zone: l.zone, province: l.province, capacity: l.capacity ?? 1, nightlyPriceCrc: l.nightlyPriceCrc }) : l.title} disabled={!active} />
        <p className="xs muted">{active ? "Enviá el enlace por WhatsApp o compartilo en tus redes." : "Podrás compartir la ficha cuando la casa esté activa."}</p>
      </section>

      <section className="card stack">
        <b>Gestión</b>
        {active ? (
          <form action={setAvailableAction} className="stack">
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="available" value={l.available ? "0" : "1"} />
            <button className="btn btn-ghost" type="submit">{l.available ? "Marcar no disponible" : "Marcar disponible"}</button>
            <p className="xs muted">No disponible cierra consultas nuevas sin ocultar la ficha.</p>
          </form>
        ) : null}
        {active ? (
          <ConfirmForm action={startEditAction} message="Tu casa dejará de verse mientras la revisamos. ¿Querés editarla?" className="stack">
            <input type="hidden" name="id" value={l.id} />
            <button className="btn btn-ghost" type="submit">Editar</button>
            <p className="xs muted">Tu casa dejará de verse mientras la revisamos.</p>
          </ConfirmForm>
        ) : null}
        {l.status === "changes" ? (
          <form action={startEditAction}>
            <input type="hidden" name="id" value={l.id} />
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>Corregir y reenviar</button>
          </form>
        ) : null}
        {l.status === "draft" ? (
          <>
            <Link href={`/propietario/publicar/${l.id}/1`} className="btn btn-primary">Seguir</Link>
            {l.reviewedAt ? null : (
              <ConfirmForm action={deleteDraftAction} message="¿Descartar este borrador? No se puede deshacer.">
                <input type="hidden" name="id" value={l.id} />
                <button className="btn btn-ghost" type="submit" style={{ width: "100%" }}>Descartar borrador</button>
              </ConfirmForm>
            )}
          </>
        ) : null}
        {l.status === "review" ? <p className="small muted">Mientras la revisamos no se puede editar.</p> : null}
      </section>
    </>
  );
}
