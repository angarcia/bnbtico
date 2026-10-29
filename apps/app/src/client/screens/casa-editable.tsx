// La ficha editable de una casa publicada (spec .scratch/editar-casa, maquetas 08a–08c): se lee como la ficha pública, sin
// calendario, y cada dato es una fila que abre su pantalla (/propietario/casas/$id/editar/$campo). Lo marcado con
// «Revisión» pasa por el admin en la edición de la casa; mientras tanto los clientes ven la versión aprobada. Trozo
// diferido: se precarga con las pantallas del propietario. Las casas que nunca se publicaron siguen con el detalle de
// propietario.tsx y el asistente.
import { Link } from "@tanstack/react-router";
import { can } from "../../domain/can";
import { EDIT_COPY, FIELD_ORDER, FIELD_TITLES, REVIEWED_FIELDS, editSummary, editedFields, isEmptyEdit, mergeEdit, photoPill, type FormField } from "../../domain/edit";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { FEATURE_LABEL, KIND_LABELS, locationLine, type Listing, type ListingDraft } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { cardLabel } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, subscriptionLine } from "../../domain/subscription";
import { I } from "../../shared/icons";
import { useBilling } from "../billing";
import { useDiscardEdit, useSubmitEdit } from "../edit";
import { ActivateButton, PayNotice, PaymentDueNote, ShareButtonInline, StatsLine, SubscriptionRow, WhatsAppItem, shareOf } from "./propietario";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** El valor de un dato tal como lo verá el cliente (lo pendiente de la edición encima de lo aprobado). */
function fieldValue(l: ListingDraft, field: FormField): string {
  switch (field) {
    case "nombre":
      return l.title;
    case "tipo":
      if (l.kind !== "habitacion") return l.kind ? KIND_LABELS[l.kind] : "";
      return `Habitación · baño ${l.bathroomShared ? "compartido" : "privado"}`;
    case "capacidad":
      return [plural(l.capacity ?? 0, "persona", "personas"), plural(l.bedrooms ?? 0, "habitación", "habitaciones"), plural(l.bathrooms ?? 0, "baño", "baños")].join(" · ");
    case "caracteristicas":
      return l.features.length ? l.features.map((f) => FEATURE_LABEL[f]).join(", ") : "Ninguna marcada";
    case "descripcion":
      return l.description.trim() || "Sin descripción";
    case "precio": {
      const night = `${formatCRC(l.nightlyPriceCrc ?? 0)} / noche`;
      if (!l.acceptsMonthly) return night;
      return `${night} · Mensual: ${l.monthlyPriceCrc ? `${formatCRC(l.monthlyPriceCrc)} / mes` : "a negociar"}`;
    }
    case "ubicacion":
      return locationLine(l);
  }
}

const isReviewed = (field: FormField) => REVIEWED_FIELDS.includes(field);

/** Una fila: el título del dato con su etiqueta y, debajo, el valor (el pendiente si la edición lo cambia). */
function FieldRow({ listing: l, field }: { listing: Listing; field: FormField }) {
  const e = l.edit;
  const pending = !!e && (editedFields(e) as FormField[]).includes(field);
  // Con una ubicación pendiente, provincia, cantón y distrito los recalcula la base al aprobar: solo la zona nueva.
  const value = pending && field === "ubicacion" && e.location ? e.location.zone : fieldValue(mergeEdit(l, e), field);
  const tag = pending ? (e.status === "review" ? "En revisión" : "Sin enviar") : isReviewed(field) ? "Revisión" : null;
  return (
    <Link to="/propietario/casas/$id/editar/$campo" params={{ id: l.id, campo: field }} className="list-item">
      <span className="body">
        <span className="field-title">
          {FIELD_TITLES[field]}
          {tag ? <span className="tag-rev">{tag}</span> : null}
        </span>
        <span className={`block strong${field === "descripcion" ? " review-text" : ""}${field === "precio" ? " num" : ""}`}>{value}</span>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}

/** El aviso de la edición (arena, nunca ocre): sin enviar, en revisión o con cambios pedidos. Sin edición, nada. */
function EditBanner({ listing: l, userId }: { listing: Listing; userId: string }) {
  const submit = useSubmitEdit(userId, l);
  const discard = useDiscardEdit(userId, l);
  const e = l.edit;
  if (!e || isEmptyEdit(e)) return null;
  const summary = editSummary(e);
  const title =
    e.status === "open" ? `Cambios sin enviar: ${summary}` : e.status === "review" ? `Edición en revisión: ${summary} · normalmente en menos de 24 horas` : "Le pedimos cambios en la edición";
  const line = e.status === "changes" ? e.reviewNote : "Mientras tanto, los clientes ven la versión aprobada.";
  const error = submit.error ?? discard.error;
  const busy = submit.isPending || discard.isPending;
  return (
    <section className="card-arena stack gap-10" data-testid="edit-banner">
      <b className="display offer-title">{title}</b>
      {line ? <span className="small ink">{line}</span> : null}
      {e.status !== "review" ? (
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => submit.mutate()}>
          Enviar a revisión
        </button>
      ) : null}
      <button type="button" className="btn-link" disabled={busy} onClick={() => window.confirm(EDIT_COPY.discardConfirm) && discard.mutate()}>
        Descartar cambios
      </button>
      {error ? (
        <p className="note" role="alert">
          {toDomainError(error).message}
        </p>
      ) : null}
    </section>
  );
}

/** Suscripción parada: ocre arriba, porque es dinero (la ficha no se ve ni su enlace funciona). */
function StoppedNotice({ listing: l }: { listing: Listing }) {
  return (
    <section className="card-sun stack gap-10" data-testid="stopped-notice">
      <h2 className="display offer-title">Suscripción parada</h2>
      <span className="small ink">{l.title} no aparece en Explorar y el enlace de su ficha no funciona. Actívela para que vuelvan a escribirle.</span>
      <ActivateButton publicId={l.publicId} />
      <span className="small strong center num">{formatCRC(MONTHLY_FEE_CRC)} al mes, sin permanencia</span>
    </section>
  );
}

export function EditableFicha({ listing: l, userId }: { listing: Listing; userId: string }) {
  const billing = useBilling(userId);
  const hb = billing?.of(l.id);
  const onTop = l.status === "payment_due" || l.status === "inactive";
  const subLine = !onTop && hb && billing ? subscriptionLine(hb.sub, billing.today) : null;
  const cover = l.photos[0];
  const label = cardLabel(l, l.edit);
  const shareUrl = shareOf(l).url.replace(/^https?:\/\//, "");
  return (
    <>
      {l.status === "payment_due" ? hb && billing ? <PayNotice hb={hb} today={billing.today} /> : <PaymentDueNote listing={l} /> : null}
      {l.status === "inactive" ? <StoppedNotice listing={l} /> : null}
      <EditBanner listing={l} userId={userId} />

      <div className="photo detail-photo">
        {cover ? <img src={variantUrl(cover, 800)} alt="" width={800} height={340} /> : <span className="small">Sin fotos</span>}
        <span className={`state ${label.cls}`}>{label.text}</span>
        <Link to="/propietario/casas/$id/editar/$campo" params={{ id: l.id, campo: "fotos" }} className="pill photo-pill num">
          {photoPill(l.photos.length, l.edit?.photos.length ?? 0)}
        </Link>
      </div>

      <p className="note note-arena">
        <span>
          Toque un dato para cambiarlo. Lo marcado con <span className="tag-rev">Revisión</span> lo revisamos antes de publicarlo; mientras tanto, los clientes ven la versión actual.
        </span>
      </p>

      <section className="list" data-testid="field-rows">
        {FIELD_ORDER.map((field) => (
          <FieldRow key={field} listing={l} field={field} />
        ))}
      </section>

      {can(l, "share") ? (
        <div className="stack gap-8">
          <ShareButtonInline listing={l} className="btn-block" />
          <small className="num primary share-url center" data-testid="share-url">
            {shareUrl}
          </small>
        </div>
      ) : null}

      <section className="list">
        <WhatsAppItem listing={l} />
      </section>
      {l.status === "active" ? <StatsLine listing={l} /> : null}
      {subLine ? (
        <section className="list">
          <SubscriptionRow publicId={l.publicId} line={subLine} />
        </section>
      ) : null}
    </>
  );
}
