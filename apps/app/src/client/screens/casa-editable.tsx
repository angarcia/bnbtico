// La ficha editable de una casa publicada (spec .scratch/editar-casa, maquetas 08a–08c): se lee como la ficha pública, sin
// calendario, y cada dato es una fila que abre su pantalla (/propietario/casas/$id/editar/$campo). Lo marcado con
// «Revisión» pasa por el admin en la edición de la casa; mientras tanto los clientes ven la versión aprobada. Trozo
// diferido: se precarga con las pantallas del propietario. Las casas que nunca se publicaron siguen con el detalle de
// propietario.tsx y el asistente.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { can } from "../../domain/can";
import { describe } from "../../domain/describe";
import { EDIT_COPY, FIELD_ORDER, FIELD_TITLES, REVIEWED_FIELDS, editSummary, editedFields, isEmptyEdit, mergeEdit, photoPill, type FormField } from "../../domain/edit";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { FEATURE_LABEL, KIND_LABELS, locationLine, type Listing, type ListingDraft } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { cardLabel } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, subscriptionLine, type HouseSubscription } from "../../domain/subscription";
import { I } from "../../shared/icons";
import { useBilling } from "../billing";
import { useDiscardEdit, useSubmitEdit } from "../edit";
import { listingStatsQuery } from "../owner";
import { ActivateButton, PayNotice, ShareButtonInline, SubscriptionLink, WhatsAppItem, shareOf } from "./propietario";

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

/** El reloj de la etiqueta «Revisión» (maqueta 08a). */
const Clock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);
const ReviewTag = () => (
  <span className="tag-rev">
    <Clock />
    Revisión
  </span>
);

/** Una fila: el título del dato con su etiqueta y, debajo, el valor (el pendiente si la edición lo cambia). */
function FieldRow({ listing: l, field }: { listing: Listing; field: FormField }) {
  const e = l.edit;
  const pending = !!e && (editedFields(e) as FormField[]).includes(field);
  // Con una ubicación pendiente, provincia, cantón y distrito los recalcula la base al aprobar: solo la zona nueva.
  const value = pending && field === "ubicacion" && e.location ? e.location.zone : fieldValue(mergeEdit(l, e), field);
  const locked = pending && e.status === "review";
  const tag = pending ? <span className={`tag-rev${locked ? " is-pending" : ""}`}>{locked ? "En revisión" : "Sin enviar"}</span> : isReviewed(field) ? <ReviewTag /> : null;
  const body = (
    <span className="body">
      <span className="field-title">
        {FIELD_TITLES[field]}
        {tag}
      </span>
      <span className={`block strong${field === "descripcion" ? " review-text" : ""}${field === "precio" ? " num" : ""}`}>{value}</span>
    </span>
  );
  // En revisión no se vuelve a tocar (maqueta 08c): una fila sin enlace, con el candado.
  if (locked)
    return (
      <div className="list-item is-locked" role="group" aria-label={`${FIELD_TITLES[field]}: en revisión`}>
        {body}
        <span className="chev">
          <I.lock />
        </span>
      </div>
    );
  return (
    <Link to="/propietario/casas/$id/editar/$campo" params={{ id: l.id, campo: field }} className="list-item">
      {body}
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
  // Antes de cada acción se limpia el error de la otra: se ve el de la última.
  const error = submit.error ?? discard.error;
  const busy = submit.isPending || discard.isPending;
  return (
    <section className="card-arena stack gap-10" data-testid="edit-banner">
      <b className="display offer-title">{title}</b>
      {line ? <span className="small ink">{line}</span> : null}
      {e.status !== "review" ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => {
            discard.reset();
            submit.mutate();
          }}
        >
          Enviar a revisión
        </button>
      ) : null}
      <button type="button" className="btn-link" disabled={busy} onClick={() => {
          if (!window.confirm(EDIT_COPY.discardConfirm)) return;
          submit.reset();
          discard.mutate();
        }}>
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

/** Aviso de dinero cuando la casa está por pagar y aún no hay fila de cobro. */
function PaymentDueNote({ listing: l }: { listing: Listing }) {
  return <div className="note note-sun">{describe(l, { base: "" }).situation}</div>;
}

/** Visitas y consultas de 30 días (revisión UX A2): si el propietario no ve que su ficha funciona, en el mes 13 no paga. */
function StatsLine({ listing: l, userId }: { listing: Listing; userId: string }) {
  const { data } = useQuery({ ...listingStatsQuery(userId, l.id), enabled: !!userId });
  if (!data) return <span className="small stats-line" aria-hidden="true">&nbsp;</span>;
  const { views, inquiries } = data;
  return (
    <span className="small strong primary stats-line" data-testid="listing-stats">
      {views === 0 && inquiries === 0
        ? "Comparta su enlace para que lleguen las primeras visitas"
        : `${views} ${views === 1 ? "visita" : "visitas"} · ${inquiries} ${inquiries === 1 ? "consulta" : "consultas"} · últimos 30 días`}
    </span>
  );
}

/** La suscripción al día, al final (maqueta 08a): el plan, «Al día» y su línea; lleva a «Promoción y suscripción». */
function SubscriptionCard({ listing: l, sub, today }: { listing: Listing; sub: HouseSubscription; today: string }) {
  const line = subscriptionLine(sub, today);
  if (!line) return null;
  const promo = sub.plan === "promo" && !!sub.promoEndsOn && (today <= sub.promoEndsOn || !sub.hasMethod);
  return (
    <section className="stack gap-8" data-testid="subscription-card">
      <h2 className="display offer-title">Suscripción</h2>
      <section className="list">
        <SubscriptionLink publicId={l.publicId} className="list-item">
          <span className="body">
            <span className="row gap-8">
              <b>{promo ? "Oferta de lanzamiento" : "Suscripción mensual"}</b>
              <span className="badge badge-ok badge-tight xs">Al día</span>
            </span>
            <small>
              <span data-testid="subscription-row">{line}</span>
              {promo ? `. Después, ${formatCRC(sub.monthlyPriceCrc)} al mes, sin permanencia.` : null}
            </small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
        </SubscriptionLink>
      </section>
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
          Toque un dato para cambiarlo. Lo marcado con <ReviewTag /> lo revisamos antes de publicarlo; mientras tanto, los clientes ven la versión actual.
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
      {l.status === "active" ? <StatsLine listing={l} userId={userId} /> : null}
      {!onTop && hb && billing ? <SubscriptionCard listing={l} sub={hb.sub} today={billing.today} /> : null}
    </>
  );
}
