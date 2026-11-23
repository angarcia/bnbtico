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
import { FLAGS } from "../../shared/flags";
import { EDIT_COPY, FIELD_ORDER, REVIEWED_FIELDS, fieldTitle, fieldWarning, mergeEdit, photoPill, type FormField, type ReviewedField } from "../../domain/edit";
import { variantUrl } from "../../domain/image";
import { FEATURE_LABEL, KIND_LABELS, locationLine, type Listing, type ListingDraft } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { DESCRIPTION_EMPTY_WARNING } from "../../domain/publish-rules";
import { cardLabel } from "../../domain/navigation";
import { editStatusLabel } from "../../domain/status-label";
import { MONTHLY_FEE_CRC, subscriptionLine, type HouseSubscription } from "../../domain/subscription";
import { I } from "../../shared/ui/icons";
import { DeleteHouse } from "./delete-house";
import { useState, type ReactNode } from "react";
import { useBilling } from "./suscripcion/billing";
import { ConfirmSheet } from "../comun/confirm-sheet";
import { useDesktop } from "../../shared/desktop";
import { useDiscardEditField } from "./edit";
import { useEditor } from "./editor-port";
import { activityQuery } from "./owner";
import { ActivateButton, HoldNotice, PayNotice, ShareButtonInline, SubscriptionLink, WhatsAppItem, shareOf } from "./owner-ui";
import { TextButton } from "../../shared/ui/button";
import { RouterTextLink } from "../comun/router-buttons";
import { Notice, StatusTag } from "../../shared/ui/structure";
import { Card, List, ListRow } from "../../shared/ui/card";
import { RouterListRow } from "../comun/router-rows";
import * as EDITABLE_COPY from "./copy/casa-editable";

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
const pendingVisibility = EDITABLE_COPY.pendingVisibility;

/** Una fila: el título del dato con su etiqueta y, debajo, el valor (el pendiente si está en revisión). Un dato pendiente
 *  se puede volver a cambiar (cuenta el último) y lleva debajo su nota, si el admin pidió cambios, y «Descartar».
 *  `editLink`: en el escritorio del anfitrión, la fila no es un enlace; lleva «Editar», que abre su ventana en la misma
 *  ruta del dato (historia 06), sin subir la página. */
function FieldRow({ listing: l, field, userId, editLink }: { listing: Listing; field: FormField; userId: string; editLink: boolean }) {
  const { admin, field: to } = useEditor();
  const e = l.edit;
  // El admin edita también una casa bloqueada; ve lo publicado y, aparte, lo que el anfitrión tiene en revisión.
  const readOnly = isBlocked(l) && !admin;
  const state = e?.fields[field as ReviewedField];
  // Con una ubicación pendiente, provincia, cantón y distrito los recalcula la base al aprobar: solo la zona nueva.
  const pendingValue = state && field === "ubicacion" && e?.location ? e.location.zone : fieldValue(mergeEdit(l, e), field, l.kind);
  const showBothNames = editLink && field === "nombre" && !!state && !readOnly;
  const value = admin || showBothNames ? fieldValue(mergeEdit(l, null), field, l.kind) : pendingValue;
  // Lo no obligatorio sin decir o mal escrito, en ocre bajo el dato: el mismo aviso que «Revisar y enviar» al crear (ticket
  // 12); no bloquea nada. Sin descripción, el valor («Sin descripción») ya lo dice: va en ocre, sin repetirlo.
  const warning = readOnly ? null : fieldWarning(field, mergeEdit(l, isReviewed(field) && !admin ? e : null));
  const empty = warning === DESCRIPTION_EMPTY_WARNING;
  // Solo el estado de un cambio («En revisión», «Cambios pedidos»). La etiqueta «Revisión» en los datos que se revisan
  // salía aunque no hubiera nada pendiente y parecía un estado (Ana, 2026-11-04): lo dicen la nota de arriba y, al editar,
  // el aviso y «Enviar a revisión».
  const tag = readOnly ? null : state ? (
    <StatusTag placement="field" label={editStatusLabel(state.status, "field")} />
  ) : null;
  const content = (
    <>
      <span className="body">
        <span className="field-title">
          {fieldTitle(field, l.kind)}
          {showBothNames ? null : tag}
        </span>
        <span className={`block strong${field === "descripcion" ? " review-text" : ""}${field === "precio" ? " num" : ""}${empty ? " sun-ink" : ""}`}>{value}</span>
        {warning && !empty ? (
          <span className="block small sun-ink" data-testid={`warn-${field}`}>
            {warning}
          </span>
        ) : null}
        {admin && state ? (
          <span className="block small muted" data-testid={`theirs-${field}`}>
            {EDITABLE_COPY.pendingOwner({ value: pendingValue })}
          </span>
        ) : null}
      </span>
      {readOnly ? null : editLink ? (
        <RouterTextLink to={to} params={{ id: l.id, campo: field }} resetScroll={false} tone="link" placement="account-profile-toggle"
          aria-label={EDITABLE_COPY.editField({ field: fieldTitle(field, l.kind) })} aria-haspopup="dialog" data-edit-field={field}>
          {EDITABLE_COPY.edit}
        </RouterTextLink>
      ) : (
        <span className="chev">
          <I.chevron />
        </span>
      )}
    </>
  );
  // Bloqueada por 3bstays: se lee, no se toca.
  const row = readOnly || editLink ? (
    <ListRow aria-disabled={readOnly || undefined}>
      {content}
    </ListRow>
  ) : (
    <RouterListRow to={to} params={{ id: l.id, campo: field }}>
      {content}
    </RouterListRow>
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
      {note ? <Notice tone="review" small inline>{EDITABLE_COPY.changesAsked({ note })}</Notice> : showVisibility ? <span className="xs muted">{pendingVisibility}</span> : null}
      <TextButton
        tone="quiet"
        aria-label={EDITABLE_COPY.discardChange({ field: fieldTitle(field, l.kind).toLowerCase() })}
        disabled={discard.isPending}
        onClick={() => setAsking(true)}
      >
        {EDITABLE_COPY.discard}
      </TextButton>
      {asking ? (
        <ConfirmSheet
          title={EDIT_COPY.discardTitle}
          body={EDIT_COPY.discardBody}
          confirmLabel={EDITABLE_COPY.discard}
          tone="destructive"
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
  return <Notice as="div" tone="sun">{describe(l, { base: "" }).situation}</Notice>;
}

/** Las cifras de 30 días de la casa (visitas y consultas), bajo la portada: salieron de Consultas para quedarse aquí
 *  (revisión UX 2026-10-29, C1, Ana). Si el propietario no ve que su ficha funciona, en el mes 13 no paga. Una sola cifra de
 *  contacto, las consultas registradas (2026-11-20): los toques en WhatsApp solo contaban la hoja abierta. */
function StatsCard({ listing: l, userId }: { listing: Listing; userId: string }) {
  const { data } = useQuery({ ...activityQuery(userId), enabled: !!userId });
  const a = data?.find((x) => x.listingId === l.id);
  const views = a?.views ?? 0;
  const inquiries = a?.inquiries ?? 0;
  return (
    <Card layout="stack" placement="listing-stats" data-testid="listing-stats" aria-busy={!data || undefined}>
      <span className="small muted">{EDITABLE_COPY.last30}</span>
      {data ? (
        <div className="activity-figures">
          <p>
            <b className="num">{views}</b> <span>{EDITABLE_COPY.visits({ count: views })}</span>
          </p>
          <p>
            <b className="num">{inquiries}</b> <span>{EDITABLE_COPY.inquiries({ count: inquiries })}</span>
          </p>
        </div>
      ) : (
        <span className="sk sk-line" />
      )}
    </Card>
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
              <b>{EDITABLE_COPY.plan({ promo: !!promo })}</b>
              <StatusTag tight small label={stopped ? { text: EDITABLE_COPY.stopped, tone: "off" } : { text: EDITABLE_COPY.upToDate, tone: "ok" }} />
            </span>
            <small>
              <span data-testid="subscription-row">{line}</span>
              {promo ? EDITABLE_COPY.afterPromo({ fee: formatCRC(sub.monthlyPriceCrc) }) : null}
            </small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
    </>
  );
  return (
    <section className="stack gap-8" data-testid="subscription-card">
      <h2 className="display offer-title">{EDITABLE_COPY.subscription}</h2>
      <List>
        {inPanel ? (
          <RouterListRow to="/propietario/casas/$id" params={{ id: l.id }} search={{ panel: "suscripcion" }} resetScroll={false}>
            {content}
          </RouterListRow>
        ) : <SubscriptionLink publicId={l.publicId}>{content}</SubscriptionLink>}
      </List>
    </section>
  );
}

/** Suscripción parada: ocre arriba, porque es dinero (la ficha no se ve ni su enlace funciona). */
function StoppedNotice({ listing: l }: { listing: Listing }) {
  return (
    <Card tone="sun" layout="stack" gap={10} data-testid="stopped-notice">
      <h2 className="display offer-title">{EDITABLE_COPY.stoppedTitle}</h2>
      <span className="small ink">{EDITABLE_COPY.stoppedText({ title: l.title })}</span>
      <ActivateButton publicId={l.publicId} />
      <span className="small strong center num">{EDITABLE_COPY.fee({ fee: formatCRC(MONTHLY_FEE_CRC) })}</span>
    </Card>
  );
}

export function EditableFicha({ listing: l, userId, rightPanel }: { listing: Listing; userId: string; rightPanel?: ReactNode }) {
  const desktop = useDesktop();
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
  const photoEditLabel = EDITABLE_COPY.editPhotosLabel({ photos: photosLabel });
  const photoContent = <><I.camera size={20} /><span>{photosLabel}</span></>;
  const actionsOnLeft = desktop && !admin;
  // En el escritorio del anfitrión, «Editar» abre la ventana del dato sobre este detalle (historia 06).
  const editLinks = actionsOnLeft && !blocked;
  const subscription = !onTop && hb && billing ? <SubscriptionCard listing={l} sub={hb.sub} today={billing.today} inPanel={actionsOnLeft} /> : null;
  const actions = (
    <>
      {can(l, "share") ? (
        <div className="stack gap-8">
          <ShareButtonInline listing={l} block />
          {!actionsOnLeft ? (
            <small className="num primary share-url center" data-testid="share-url">
              {shareUrl}
            </small>
          ) : null}
        </div>
      ) : null}

      <List><WhatsAppItem listing={l} /></List>
    </>
  );
  return (
    <div className={`${admin ? "editable-ficha-admin" : "editable-ficha"} stack gap-14`}>
      <HoldNotice listing={l} />
      {onTop && l.status === "payment_due" ? hb && billing ? <PayNotice hb={hb} today={billing.today} /> : <PaymentDueNote listing={l} /> : null}
      {onTop && l.status === "inactive" ? <StoppedNotice listing={l} /> : null}

      <div className="owner-detail-summary">
        <div className="photo detail-photo">
          {cover ? <img src={variantUrl(cover, 800)} alt="" width={800} height={600} /> : <span className="small">{EDITABLE_COPY.noPhotos}</span>}
          <StatusTag placement="photo" label={label} />
          {blocked ? (
            <span className="pill photo-pill num">{photoContent}</span>
          ) : (
            <Link to={field} params={{ id: l.id, campo: "fotos" }} resetScroll={editLinks ? false : undefined} className="pill photo-pill num"
              aria-label={admin ? photoAction : photoEditLabel} aria-haspopup={editLinks ? "dialog" : undefined} data-edit-field="fotos" title={EDITABLE_COPY.editPhotos}>
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
          <Notice tone="solid">{EDITABLE_COPY.hint({ admin: !!admin })}</Notice>
        )}

        <List data-testid="field-rows">
          {/* Habitaciones apagadas (feature flag, #62): sin la fila «Tipo», que solo podría decir «Alojamiento completo». */}
          {FIELD_ORDER.filter((field) => FLAGS.rooms || field !== "tipo").map((field) => (
            <div key={field} className={actionsOnLeft ? "house-field" : "house-field-flat"}>
              <FieldRow listing={l} field={field} userId={userId} editLink={editLinks} />
            </div>
          ))}
        </List>

        {!actionsOnLeft && actions}
        {subscription}
        {admin ? null : <DeleteHouse listing={l} userId={userId} />}
        </>}
      </div>
    </div>
  );
}
