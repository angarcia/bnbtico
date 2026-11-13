// La ficha editable de una casa publicada (spec .scratch/editar-casa, maquetas 08a–08c): se lee como la ficha pública, sin
// calendario, y cada dato es una fila que abre su pantalla (/propietario/casas/$id/editar/$campo). Nombre, tipo,
// ubicación, descripción y las fotos nuevas van al admin al guardarlos, dato a dato (revisión UX 2026-10-29, A5): cada dato pendiente enseña su valor nuevo
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
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useBilling } from "../billing";
import { ConfirmSheet } from "../confirm-sheet";
import { useDesktop } from "../desktop";
import { useDiscardEditField } from "../edit";
import { useEditor } from "../editor-port";
import { activityQuery } from "../owner";
import { ActivateButton, HoldNotice, PayNotice, ShareButtonInline, SubscriptionLink, WhatsAppItem, shareOf } from "../owner-ui";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const InlineHouseEditor = lazy(() => import("./editar").then((m) => ({ default: m.InlineHouseEditor })));
const EditPhotosDialog = lazy(() => import("./editar").then((m) => ({ default: m.EditPhotosDialog })));

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
      return [plural(l.capacity ?? 0, "persona", "personas"), plural(l.bedrooms ?? 0, "dormitorio", "dormitorios"), plural(l.bathrooms ?? 0, "baño", "baños")].join(" · ");
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
const pendingVisibility = "Los clientes ven lo de antes hasta que lo aprobemos.";

/** Una fila: el título del dato con su etiqueta y, debajo, el valor (el pendiente si está en revisión). Un dato pendiente
 *  se puede volver a cambiar (cuenta el último) y lleva debajo su nota, si el admin pidió cambios, y «Descartar». */
function FieldRow({ listing: l, field, userId, onEdit, editActions }: { listing: Listing; field: FormField; userId: string; onEdit?: () => void; editActions?: ReactNode }) {
  const expanded = editActions !== undefined;
  const { admin, field: to } = useEditor();
  const e = l.edit;
  // El admin edita también una casa bloqueada; ve lo publicado y, aparte, lo que el anfitrión tiene en revisión.
  const readOnly = isBlocked(l) && !admin;
  const state = e?.fields[field as ReviewedField];
  // Con una ubicación pendiente, provincia, cantón y distrito los recalcula la base al aprobar: solo la zona nueva.
  const pendingValue = state && field === "ubicacion" && e?.location ? e.location.zone : fieldValue(mergeEdit(l, e), field, l.kind);
  const showBothNames = !!onEdit && field === "nombre" && !!state && !readOnly;
  const value = admin || showBothNames ? fieldValue(mergeEdit(l, null), field, l.kind) : pendingValue;
  // Lo no obligatorio sin decir o mal escrito, en ocre bajo el dato: el mismo aviso que «Revisar y enviar» al crear (ticket
  // 12); no bloquea nada. Sin descripción, el valor («Sin descripción») ya lo dice: va en ocre, sin repetirlo.
  const warning = readOnly ? null : fieldWarning(field, mergeEdit(l, isReviewed(field) && !admin ? e : null));
  const empty = warning === DESCRIPTION_EMPTY_WARNING;
  // Solo el estado de un cambio («En revisión», «Cambios pedidos»). La etiqueta «Revisión» en los datos que se revisan
  // salía aunque no hubiera nada pendiente y parecía un estado (Ana, 2026-11-04): lo dicen la nota de arriba y, al editar,
  // el aviso y «Enviar a revisión».
  const tag = readOnly ? null : state ? (
    <span className={`tag-rev${state.status === "review" ? " is-pending" : " is-changes"}`}>{state.status === "review" ? "En revisión" : "Cambios pedidos"}</span>
  ) : null;
  const content = (
    <>
      <span className="body">
        <span className="field-title">
          {fieldTitle(field, l.kind)}
          {showBothNames ? null : tag}
        </span>
        {(!expanded || state) && <span className={`block strong${field === "descripcion" ? " review-text" : ""}${field === "precio" ? " num" : ""}${empty ? " sun-ink" : ""}`}>{value}</span>}
        {warning && !empty && !expanded ? (
          <span className="block small sun-ink" data-testid={`warn-${field}`}>
            {warning}
          </span>
        ) : null}
        {admin && state ? (
          <span className="block small muted" data-testid={`theirs-${field}`}>
            Pendiente del anfitrión: {pendingValue}
          </span>
        ) : null}
      </span>
      {readOnly ? null : expanded ? editActions : onEdit ? (
        <button type="button" className="btn-link account-profile-toggle" aria-label={`Editar: ${fieldTitle(field, l.kind)}`} aria-expanded={false} onClick={onEdit}>
          Editar
        </button>
      ) : (
        <span className="chev">
          <I.chevron />
        </span>
      )}
    </>
  );
  // Bloqueada por 3bstays: se lee, no se toca.
  const row = readOnly || onEdit ? (
    <div className="list-item" aria-disabled={readOnly || undefined}>
      {content}
    </div>
  ) : (
    <Link to={to} params={{ id: l.id, campo: field }} className="list-item">
      {content}
    </Link>
  );
  if (!state || admin) return row;
  const reviewNote = state.status === "changes" ? state.reviewNote : null;
  const pending = <PendingFoot listing={l} field={field as ReviewedField} note={reviewNote} userId={userId}
    proposedName={showBothNames ? pendingValue : undefined} showVisibility={!showBothNames} />;
  return (
    <div className="field-pending" data-testid={`pending-${field}`}>
      {row}
      {showBothNames ? (
        <div className="house-pending-name">
          <div className="row house-pending-status">
            {tag}
            {!reviewNote && <span className="xs muted">{pendingVisibility}</span>}
          </div>
          {pending}
        </div>
      ) : pending}
    </div>
  );
}

/** Debajo de un dato pendiente: la nota del admin (si pidió cambios) y «Descartar», que deja la ficha como está. */
function PendingFoot({ listing: l, field, note, userId, showVisibility, proposedName }: { listing: Listing; field: ReviewedField; note: string | null; userId: string; showVisibility: boolean; proposedName?: string }) {
  const discard = useDiscardEditField(userId, l);
  const [asking, setAsking] = useState(false);
  return (
    <div className="pending-foot">
      {proposedName !== undefined ? <span className="strong house-pending-value">{proposedName}</span> : null}
      {note ? <p className="small note-review">Le pedimos cambios: {note}</p> : showVisibility ? <span className="xs muted">{pendingVisibility}</span> : null}
      <button
        type="button"
        className="btn-text"
        aria-label={`Descartar el cambio de ${fieldTitle(field, l.kind).toLowerCase()}`}
        disabled={discard.isPending}
        onClick={() => setAsking(true)}
      >
        Descartar
      </button>
      {asking ? (
        <ConfirmSheet
          title={EDIT_COPY.discardTitle}
          body={EDIT_COPY.discardBody}
          confirmLabel="Descartar"
          confirmClassName="btn btn-outline-bad btn-lg"
          cancelClassName="btn btn-ghost btn-lg"
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            discard.mutate(field);
          }}
        />
      ) : null}
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
    <section className="card stack listing-stats" data-testid="listing-stats" aria-busy={!data || undefined}>
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
function SubscriptionCard({ listing: l, sub, today, inPanel }: { listing: Listing; sub: HouseSubscription; today: string; inPanel: boolean }) {
  const line = subscriptionLine(sub, today);
  if (!line) return null;
  // Bloqueada: la suscripción está parada y no se cobra.
  const stopped = sub.hold === "blocked";
  const promo = !stopped && sub.plan === "promo" && !!sub.promoEndsOn && (today <= sub.promoEndsOn || !sub.hasMethod);
  const content = (
    <>
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
    </>
  );
  return (
    <section className="stack gap-8" data-testid="subscription-card">
      <h2 className="display offer-title">Suscripción</h2>
      <section className="list">
        {inPanel ? (
          <Link to="/propietario/casas/$id" params={{ id: l.id }} search={{ panel: "suscripcion" }} resetScroll={false} className="list-item">
            {content}
          </Link>
        ) : <SubscriptionLink publicId={l.publicId} className="list-item">{content}</SubscriptionLink>}
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

export function EditableFicha({ listing: l, userId, rightPanel }: { listing: Listing; userId: string; rightPanel?: ReactNode }) {
  const desktop = useDesktop();
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const { admin, field } = useEditor();
  // La suscripción y las cifras son de la cuenta de quien mira: en las rutas del admin no son las del anfitrión.
  const billing = useBilling(admin ? "" : userId);
  const hb = billing?.of(l.id);
  const blocked = isBlocked(l) && !admin;
  const onTop = !admin && !blocked && (l.status === "payment_due" || l.status === "inactive");
  const cover = l.photos[0];
  const label = cardLabel(l, l.edit);
  const shareUrl = shareOf(l).url.replace(/^https?:\/\//, "");
  const photoAction = photoPill(l.photos.length, l.edit?.photos.length ?? 0);
  const photosLabel = photoAction.replace(/ · Editar$/, "");
  const photoEditLabel = `Editar fotos: ${photosLabel}`;
  const photoContent = <><I.camera size={20} /><span>{photosLabel}</span></>;
  const actionsOnLeft = desktop && !admin;
  const canEditDetails = actionsOnLeft && !blocked && !rightPanel;
  const editingDetails = canEditDetails && editingField !== null;
  const subscription = !onTop && hb && billing ? <SubscriptionCard listing={l} sub={hb.sub} today={billing.today} inPanel={actionsOnLeft} /> : null;
  const actions = (
    <>
      {can(l, "share") ? (
        <div className="stack gap-8">
          <ShareButtonInline listing={l} className="btn-block" />
          {!actionsOnLeft ? (
            <small className="num primary share-url center" data-testid="share-url">
              {shareUrl}
            </small>
          ) : null}
        </div>
      ) : null}

      <section className="list"><WhatsAppItem listing={l} /></section>
    </>
  );
  return (
    <div className={`${admin ? "editable-ficha-admin" : "editable-ficha"} stack gap-14${editingDetails ? " house-details-editing" : ""}`}>
      <HoldNotice listing={l} />
      {onTop && l.status === "payment_due" ? hb && billing ? <PayNotice hb={hb} today={billing.today} /> : <PaymentDueNote listing={l} /> : null}
      {onTop && l.status === "inactive" ? <StoppedNotice listing={l} /> : null}

      <div className="owner-detail-summary">
        <div className="photo detail-photo">
          {cover ? <img src={variantUrl(cover, 800)} alt="" width={800} height={600} /> : <span className="small">Sin fotos</span>}
          <span className={`state ${label.cls}`}>{label.text}</span>
          {blocked ? (
            <span className="pill photo-pill num">{photoContent}</span>
          ) : actionsOnLeft && !rightPanel ? (
            <button type="button" className="pill photo-pill num" aria-label={photoEditLabel} aria-haspopup="dialog" onClick={() => setPhotosOpen(true)}>
              {photoContent}
            </button>
          ) : (
            <Link to={field} params={{ id: l.id, campo: "fotos" }} className="pill photo-pill num" aria-label={admin ? photoAction : photoEditLabel} title="Editar fotos">
              {admin ? photoAction : photoContent}
            </Link>
          )}
        </div>

        {l.status === "active" && !admin ? <StatsCard listing={l} userId={userId} /> : null}
        {actionsOnLeft && actions}
      </div>

      <div className="owner-detail-fields">
        {rightPanel ? <div className="owner-detail-panel stack">{rightPanel}</div> : <>
        {blocked || actionsOnLeft ? null : (
          <p className="note note-arena">{admin
            ? "Toque un dato para cambiarlo. Lo que guarde se publica al momento, sin revisión."
            : "Toque un dato para editarlo. Su ficha seguirá visible durante la revisión."}</p>
        )}

        <section className="list" data-testid="field-rows">
          {FIELD_ORDER.map((field) => {
            const closeField = () => setEditingField((current) => current === field ? null : current);
            const renderRow = (editActions?: ReactNode) => (
              <FieldRow listing={l} field={field} userId={userId}
                onEdit={canEditDetails ? () => setEditingField(field) : undefined} editActions={editActions} />
            );
            return (
              <div key={field} className={actionsOnLeft ? "house-field" : "house-field-flat"}>
                {editingDetails && editingField === field ? (
                  <Suspense fallback={renderRow(<button type="button" className="btn-link" onClick={closeField}>Cancelar</button>)}>
                    <InlineHouseEditor listing={l} field={field} userId={userId} renderRow={renderRow} onClose={closeField} />
                  </Suspense>
                ) : renderRow()}
              </div>
            );
          })}
        </section>

        {!actionsOnLeft && actions}
        {subscription}
        </>}
      </div>
      {actionsOnLeft && !blocked && !rightPanel && photosOpen && (
        <Suspense fallback={null}>
          <EditPhotosDialog key={l.id} listing={l} userId={userId} onClose={() => setPhotosOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
