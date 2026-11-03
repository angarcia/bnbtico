// La ficha editable de una casa publicada (spec .scratch/editar-casa, maquetas 08a–08c): se lee como la ficha pública, sin
// calendario, y cada dato es una fila que abre su pantalla (/propietario/casas/$id/editar/$campo). Lo marcado con
// «Revisión» va al admin al guardarlo, dato a dato (revisión UX 2026-10-29, A5): cada dato pendiente enseña su valor nuevo
// con «En revisión» o «Cambios pedidos» (y la nota) y su propio «Descartar»; mientras tanto los clientes ven lo aprobado. Trozo
// diferido: se precarga con las pantallas del propietario. Las casas que nunca se publicaron siguen con el detalle de
// propietario.tsx y el asistente.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { can, isBlocked } from "../../domain/can";
import { describe } from "../../domain/describe";
import { EDIT_COPY, FIELD_ORDER, REVIEWED_FIELDS, fieldTitle, fieldWarning, mergeEdit, photoPill, type FormField, type ReviewedField } from "../../domain/edit";
import { variantUrl } from "../../domain/image";
import { FEATURE_LABEL, KIND_LABELS, locationLine, type Listing, type ListingDraft } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { DESCRIPTION_EMPTY_WARNING } from "../../domain/publish-rules";
import { cardLabel } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, subscriptionLine, type HouseSubscription } from "../../domain/subscription";
import { I } from "../../shared/icons";
import { useBilling } from "../billing";
import { useDiscardEditField } from "../edit";
import { activityQuery } from "../owner";
import { ActivateButton, HoldNotice, PayNotice, ShareButtonInline, SubscriptionLink, WhatsAppItem, shareOf } from "./propietario";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** El valor de un dato tal como lo verá el cliente (lo pendiente de la edición encima de lo aprobado). La capacidad sigue el
 *  tipo aprobado (`approvedKind`), como su pantalla: un cambio de tipo en revisión aún no quita habitaciones ni baños. */
function fieldValue(l: ListingDraft, field: FormField, approvedKind: Listing["kind"]): string {
  switch (field) {
    case "nombre":
      return l.title;
    case "tipo":
      if (l.kind !== "habitacion") return l.kind ? KIND_LABELS[l.kind] : "";
      // Sin elegir el baño, solo «Habitación» (y el aviso en ocre debajo).
      return l.bathroomShared === null ? KIND_LABELS.habitacion : `Habitación · baño ${l.bathroomShared ? "compartido" : "privado"}`;
    case "capacidad":
      // Una Habitación solo cuenta personas (es 1 habitación y 1 baño): «2 personas», como su título «Personas». El baño
      // privado o compartido ya sale en la fila Tipo, que es donde se cambia.
      if (approvedKind === "habitacion") return plural(l.capacity ?? 0, "persona", "personas");
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

/** Una fila: el título del dato con su etiqueta y, debajo, el valor (el pendiente si está en revisión). Un dato pendiente
 *  se puede volver a cambiar (cuenta el último) y lleva debajo su nota, si el admin pidió cambios, y «Descartar». */
function FieldRow({ listing: l, field, userId }: { listing: Listing; field: FormField; userId: string }) {
  const e = l.edit;
  const readOnly = isBlocked(l);
  const state = e?.fields[field as ReviewedField];
  // Con una ubicación pendiente, provincia, cantón y distrito los recalcula la base al aprobar: solo la zona nueva.
  const value = state && field === "ubicacion" && e?.location ? e.location.zone : fieldValue(mergeEdit(l, e), field, l.kind);
  // Lo no obligatorio sin decir o mal escrito, en ocre bajo el dato: el mismo aviso que «Revisar y enviar» al crear (ticket
  // 12); no bloquea nada. Sin descripción, el valor («Sin descripción») ya lo dice: va en ocre, sin repetirlo.
  const warning = readOnly ? null : fieldWarning(field, mergeEdit(l, isReviewed(field) ? e : null));
  const empty = warning === DESCRIPTION_EMPTY_WARNING;
  const tag = readOnly ? null : state ? (
    <span className={`tag-rev${state.status === "review" ? " is-pending" : " is-changes"}`}>{state.status === "review" ? "En revisión" : "Cambios pedidos"}</span>
  ) : isReviewed(field) ? (
    <ReviewTag />
  ) : null;
  const content = (
    <>
      <span className="body">
        <span className="field-title">
          {fieldTitle(field, l.kind)}
          {tag}
        </span>
        <span className={`block strong${field === "descripcion" ? " review-text" : ""}${field === "precio" ? " num" : ""}${empty ? " sun-ink" : ""}`}>{value}</span>
        {warning && !empty ? (
          <span className="block small sun-ink" data-testid={`warn-${field}`}>
            {warning}
          </span>
        ) : null}
      </span>
      {readOnly ? null : (
        <span className="chev">
          <I.chevron />
        </span>
      )}
    </>
  );
  // Bloqueada por bnbtico: se lee, no se toca.
  const row = readOnly ? (
    <div className="list-item" aria-disabled="true">
      {content}
    </div>
  ) : (
    <Link to="/propietario/casas/$id/editar/$campo" params={{ id: l.id, campo: field }} className="list-item">
      {content}
    </Link>
  );
  if (!state) return row;
  return (
    <div className="field-pending" data-testid={`pending-${field}`}>
      {row}
      <PendingFoot listing={l} field={field as ReviewedField} note={state.status === "changes" ? state.reviewNote : null} userId={userId} />
    </div>
  );
}

/** Debajo de un dato pendiente: la nota del admin (si pidió cambios) y «Descartar», que deja la ficha como está. */
function PendingFoot({ listing: l, field, note, userId }: { listing: Listing; field: ReviewedField; note: string | null; userId: string }) {
  const discard = useDiscardEditField(userId, l);
  return (
    <div className="pending-foot">
      {note ? <p className="small note-review">Le pedimos cambios: {note}</p> : <span className="xs muted">Los clientes ven lo de antes hasta que lo aprobemos.</span>}
      <button
        type="button"
        className="btn-text"
        aria-label={`Descartar el cambio de ${fieldTitle(field, l.kind).toLowerCase()}`}
        disabled={discard.isPending}
        onClick={() => window.confirm(EDIT_COPY.discardConfirm) && discard.mutate(field)}
      >
        Descartar
      </button>
    </div>
  );
}

/** Aviso de dinero cuando la casa está por pagar y aún no hay fila de cobro. */
function PaymentDueNote({ listing: l }: { listing: Listing }) {
  return <div className="note note-sun">{describe(l, { base: "" }).situation}</div>;
}

/** Las cifras de 30 días de la casa (visitas, toques en WhatsApp y consultas), bajo la portada: salieron de Consultas para
 *  quedarse aquí (revisión UX 2026-10-29, C1, Ana). Si el propietario no ve que su ficha funciona, en el mes 13 no paga. */
function StatsCard({ listing: l, userId }: { listing: Listing; userId: string }) {
  const { data } = useQuery({ ...activityQuery(userId), enabled: !!userId });
  const a = data?.find((x) => x.listingId === l.id);
  const views = a?.views ?? 0;
  const taps = a?.whatsappTaps ?? 0;
  const inquiries = a?.inquiries ?? 0;
  return (
    <section className="card stack gap-8" data-testid="listing-stats" aria-busy={!data || undefined}>
      <span className="small muted">Últimos 30 días</span>
      {data ? (
        <div className="activity-figures">
          <p>
            <b className="num">{views}</b> <span>{views === 1 ? "visita" : "visitas"}</span>
          </p>
          <p>
            <b className="num">{taps}</b> <span>{taps === 1 ? "toque en WhatsApp" : "toques en WhatsApp"}</span>
          </p>
          <p>
            <b className="num">{inquiries}</b> <span>{inquiries === 1 ? "consulta" : "consultas"}</span>
          </p>
        </div>
      ) : (
        <span className="sk sk-line" />
      )}
    </section>
  );
}

/** La suscripción al día, al final (maqueta 08a): el plan, «Al día» y su línea; lleva a «Promoción y suscripción». */
function SubscriptionCard({ listing: l, sub, today }: { listing: Listing; sub: HouseSubscription; today: string }) {
  const line = subscriptionLine(sub, today);
  if (!line) return null;
  // Bloqueada: la suscripción está parada y no se cobra.
  const stopped = sub.hold === "blocked";
  const promo = !stopped && sub.plan === "promo" && !!sub.promoEndsOn && (today <= sub.promoEndsOn || !sub.hasMethod);
  return (
    <section className="stack gap-8" data-testid="subscription-card">
      <h2 className="display offer-title">Suscripción</h2>
      <section className="list">
        <SubscriptionLink publicId={l.publicId} className="list-item">
          <span className="body">
            <span className="row gap-8">
              <b>{promo ? "Oferta de lanzamiento" : "Suscripción mensual"}</b>
              {stopped ? <span className="badge badge-mute badge-tight xs">Parada</span> : <span className="badge badge-ok badge-tight xs">Al día</span>}
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
  const blocked = isBlocked(l);
  const onTop = !blocked && (l.status === "payment_due" || l.status === "inactive");
  const cover = l.photos[0];
  const label = cardLabel(l, l.edit);
  const shareUrl = shareOf(l).url.replace(/^https?:\/\//, "");
  return (
    <>
      <HoldNotice listing={l} />
      {onTop && l.status === "payment_due" ? hb && billing ? <PayNotice hb={hb} today={billing.today} /> : <PaymentDueNote listing={l} /> : null}
      {onTop && l.status === "inactive" ? <StoppedNotice listing={l} /> : null}

      <div className="photo detail-photo">
        {cover ? <img src={variantUrl(cover, 800)} alt="" width={800} height={600} /> : <span className="small">Sin fotos</span>}
        <span className={`state ${label.cls}`}>{label.text}</span>
        {blocked ? (
          <span className="pill photo-pill num">{photoPill(l.photos.length, l.edit?.photos.length ?? 0)}</span>
        ) : (
          <Link to="/propietario/casas/$id/editar/$campo" params={{ id: l.id, campo: "fotos" }} className="pill photo-pill num">
            {photoPill(l.photos.length, l.edit?.photos.length ?? 0)}
          </Link>
        )}
      </div>

      {l.status === "active" ? <StatsCard listing={l} userId={userId} /> : null}

      {blocked ? null : (
        <p className="note note-arena">
          <span>
            Toque un dato para cambiarlo. Lo marcado con <ReviewTag /> lo revisamos antes de publicarlo; mientras tanto, los clientes ven la versión actual.
          </span>
        </p>
      )}

      <section className="list" data-testid="field-rows">
        {FIELD_ORDER.map((field) => (
          <FieldRow key={field} listing={l} field={field} userId={userId} />
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
      {!onTop && hb && billing ? <SubscriptionCard listing={l} sub={hb.sub} today={billing.today} /> : null}
    </>
  );
}
