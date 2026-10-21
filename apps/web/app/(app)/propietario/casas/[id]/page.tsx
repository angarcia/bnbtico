import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDraftAction, setAvailableAction, startEditAction } from "@/actions/listings";
import { ConfirmForm } from "@/components/confirm-form";
import { I } from "@/components/icons";
import { ShareButton } from "@/components/listing/share-button";
import { StatusBadge } from "@/components/listing/status-badge";
import { FlowHeader } from "@/components/shell";
import { ListItem } from "@/components/ui";
import { getOwnListing } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";
import { previewText, publicUrl } from "@/lib/listings/share";
import { requestShareBase } from "@/lib/listings/share-server";
import { formatCRC } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Mi casa" };

/** Detalle de mi casa (pantalla 19): foto con estado, aviso si toca, y la lista de gestión. */
export default async function CasaPropietario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwnerSession(`/propietario/casas/${id}`);
  const l = await getOwnListing(db, id);
  if (!l) notFound();
  const base = await requestShareBase();
  const url = publicUrl(l.publicId, base);
  const active = l.status === "active";
  const cover = l.photos[0];
  const price = l.acceptsNightly && l.nightlyPriceCrc ? [formatCRC(l.nightlyPriceCrc), "noche"] : l.acceptsMonthly && l.monthlyPriceCrc ? [formatCRC(l.monthlyPriceCrc), "mes"] : null;
  return (
    <>
      <FlowHeader title={l.title || "Borrador sin título"} back="/propietario/casas" right={active ? <Link href={`/casa/${l.publicId}`} className="link">Ver ficha</Link> : undefined} />

      <div className="photo" style={{ height: 170, borderRadius: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover.url} alt="" /> : <span className="small">Sin fotos</span>}
        <span style={{ position: "absolute", left: 12, top: 12 }}><StatusBadge status={l.status} available={l.available} /></span>
        {price ? <span className="pill" style={{ left: 12, bottom: 12 }}>{price[0]} <span>/ {price[1]}</span></span> : null}
        <span className="pill pill-sm" style={{ right: 12, bottom: 12 }}>{l.publicId}</span>
      </div>

      {l.status === "review" ? <div className="note">La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.</div> : null}
      {l.status === "draft" && l.reviewedAt ? <div className="note note-arena">Estuvo publicada. Está editándola: al enviarla volverá a revisión.</div> : null}
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? (
        <section className="card-sun stack">
          <b className="display" style={{ fontSize: 16 }}>{l.status === "changes" ? "Le pedimos cambios" : "Anuncio rechazado"}</b>
          <span className="small ink">{l.reviewNote}</span>
          {l.status === "changes" ? (
            <form action={startEditAction}>
              <input type="hidden" name="id" value={l.id} />
              <button className="btn btn-sun btn-block" type="submit">Corregir y reenviar</button>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="list">
        <ShareButton url={url} title={l.title} text={l.acceptsNightly && l.nightlyPriceCrc && l.kind ? previewText({ kind: l.kind, zone: l.zone, province: l.province, capacity: l.capacity ?? 1, nightlyPriceCrc: l.nightlyPriceCrc }) : l.title} disabled={!active} asListItem={{ detail: active ? "Envíe el enlace por WhatsApp o compártalo en sus redes" : "Disponible cuando la casa esté activa" }} />
        <ListItem href="/propietario/calendario" icon={<I.calendar />} title="Calendario y precios" detail="Noches ocupadas y precios por fecha · llega en la fase 4" />
        {active ? (
          <ConfirmForm action={startEditAction} message="Su casa dejará de verse mientras la revisamos. ¿Quiere editarla?" className="stack" >
            <input type="hidden" name="id" value={l.id} />
            <button type="submit" className="list-item">
              <span style={{ color: "var(--muted)", display: "inline-flex" }}><I.edit /></span>
              <span className="body">Editar la ficha<small>Fotos, descripción, características y precio · vuelve a revisión</small></span>
              <span className="chev"><I.chevron /></span>
            </button>
          </ConfirmForm>
        ) : l.status === "draft" ? (
          <ListItem href={`/propietario/publicar/${l.id}/1`} icon={<I.edit />} title="Seguir con el borrador" detail="Fotos, descripción, características y precio" />
        ) : null}
        <ListItem icon={<I.phone />} title="WhatsApp de esta casa" detail={<span className="num">{formatPhone(l.whatsappPhone)} · verificado</span>} />
        {active ? (
          <form action={setAvailableAction} className="list-item" style={{ display: "flex" }}>
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="available" value={l.available ? "0" : "1"} />
            <span style={{ color: "var(--muted)", display: "inline-flex" }}><I.help /></span>
            <span className="body">Disponible para consultas<small>Si la cierra, la ficha sigue visible pero sin botón de contacto</small></span>
            <button type="submit" role="switch" aria-checked={l.available} aria-label={l.available ? "Marcar no disponible" : "Marcar disponible"} className="switch"><span /></button>
          </form>
        ) : null}
      </section>

      {l.status === "draft" && !l.reviewedAt ? (
        <ConfirmForm action={deleteDraftAction} message="¿Descartar este borrador? No se puede deshacer." className="stack">
          <input type="hidden" name="id" value={l.id} />
          <button className="btn btn-outline-bad" type="submit">Descartar borrador</button>
        </ConfirmForm>
      ) : null}
    </>
  );
}
