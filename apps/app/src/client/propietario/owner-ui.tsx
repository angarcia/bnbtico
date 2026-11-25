import type { ReactNode } from "react";
import { HOLD_COPY } from "../../domain/admin-actions";
import { describe } from "../../domain/describe";
import type { Listing } from "../../domain/listing";
import { formatPhone } from "../../domain/phone";
import { cardDate, payButtonDue, paymentDueCard, reminderCard, reminderDaysLeft } from "../../domain/subscription";
import { waUrl } from "../../domain/whatsapp";
import { I } from "../../shared/ui/icons";
import { useShare } from "../../shared/share-button";
import type { HouseBilling } from "./suscripcion/billing";
import { SUPPORT_NUMBERS } from "../comun/support-numbers";
import { Button, ButtonLink, IconButton, WaIcon } from "../../shared/ui/button";
import { RouterButtonLink } from "../comun/router-buttons";
import { RouterListRow } from "../comun/router-rows";
import { Notice } from "../../shared/ui/structure";
import { Card, ListRow } from "../../shared/ui/card";
import * as OWNER_COPY from "./copy/owner";

const base = () => window.location.origin;
export const titleOf = (l: Listing) => l.title || OWNER_COPY.untitled;
export const shareOf = (l: Listing) => {
  const d = describe(l, { base: base() });
  return { url: d.shareUrl, title: titleOf(l), text: d.previewText };
};

// ---------- Suscripción (fase 5) ----------

/** «14 oct» si es de este año; si no, «14 oct 2027». */
const dayOf = (date: string, today: string) => (date.slice(0, 4) === today.slice(0, 4) ? cardDate(date).slice(0, -5) : cardDate(date));

/** Enlace a la suscripción: con casa, «Suscripción» de esa sola casa (`?casa=CT-####` y `#pago=CT-####`, que la resalta);
 *  sin ella, «Promoción y suscripción» con todas. */
export function SubscriptionLink({ publicId, children }: { publicId?: string; children: ReactNode }) {
  return publicId ? (
    <RouterListRow to="/propietario/suscripcion" search={{ casa: publicId }} hash={`pago=${publicId}`}>
      {children}
    </RouterListRow>
  ) : (
    <RouterListRow to="/propietario/suscripcion">{children}</RouterListRow>
  );
}

export function PayButton({ publicId }: { publicId: string }) {
  return (
    <RouterButtonLink to="/propietario/suscripcion" search={{ casa: publicId }} hash={`pago=${publicId}`} variant="pay" block>
      {OWNER_COPY.addMethod}
    </RouterButtonLink>
  );
}

/** Reactivar una casa parada: lleva a «Promoción y suscripción» con la casa resaltada. */
export function ActivateButton({ publicId }: { publicId: string }) {
  return (
    <RouterButtonLink to="/propietario/suscripcion" search={{ casa: publicId }} hash={`pago=${publicId}`} variant="pay" block>
      {OWNER_COPY.activate}
    </RouterButtonLink>
  );
}

/** Tarjeta ocre: la oferta terminó sin método (pendiente de pago) o termina dentro de 90 días; null si no toca avisar. */
export function PayNotice({ hb, today, title }: { hb: HouseBilling; today: string; title?: string }) {
  if (!payButtonDue(hb.sub, today)) return null;
  const { house, sub } = hb;
  const card =
    sub.status === "payment_due"
      ? paymentDueCard(sub.promoEndsOn ? dayOf(sub.promoEndsOn, today) : null, sub.monthlyPriceCrc)
      : reminderCard(reminderDaysLeft(sub, today) ?? -1);
  if (!card) return null;
  return (
    <Card tone="sun" layout="stack" gap={10} data-testid="pay-notice">
      {title ? <span className="xs strong">{title}</span> : null}
      <b className="display offer-title">{card.title}</b>
      <span className="small ink">{card.body}</span>
      <PayButton publicId={house.publicId} />
    </Card>
  );
}

// ---------- Avisos y piezas de Mis casas ----------

/** Casa pausada o bloqueada por 3bstays (spec .scratch/admin-casas-acciones): el motivo que escribió el admin y, bloqueada,
 *  «Escribir a 3bstays» (WhatsApp de propietarios). La etiqueta ya va sobre la foto. `card`: la versión corta de Mis casas. */
export function HoldNotice({ listing: l, card = false }: { listing: Listing; card?: boolean }) {
  const hold = l.adminHold;
  if (!hold) return null;
  const copy = HOLD_COPY[hold.kind];
  const write =
    hold.kind === "blocked" ? (
      // Con 3bstays, no con el anfitrión: secundario con el icono de WhatsApp (D4), también en la tarjeta corta.
      <ButtonLink
        variant="secondary"
        block
        icon={<WaIcon />}
        href={waUrl(SUPPORT_NUMBERS.owner, OWNER_COPY.blockedMessage({ id: l.publicId, title: titleOf(l) }))}
        target="_blank"
        rel="noopener"
      >
        {OWNER_COPY.write3bstays}
      </ButtonLink>
    ) : null;
  if (card)
    return (
      <>
        <Notice tone="solid" small data-testid="hold-note">
          <span>
            {OWNER_COPY.holdNote({ title: <b key="title">{OWNER_COPY.holdTitle({ title: copy.title })}</b>, reason: hold.reason })}
          </span>
        </Notice>
        {write}
      </>
    );
  return (
    <Card tone="solid" layout="stack" gap={10} data-testid="hold-notice">
      <h2 className="display offer-title">{copy.title}</h2>
      <span className="small ink">{copy.body}</span>
      <span className="small ink">
        <b>{OWNER_COPY.reasonLabel}</b> <span data-testid="hold-reason">{hold.reason}</span>
      </span>
      {write}
    </Card>
  );
}

/** Compartir con el acabado verde común aprobado; nombre accesible y lógica de copia conservados. */
export function ShareButtonInline({ listing: l, block = false }: { listing: Listing; block?: boolean }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <Button variant="primary" block={block} placement={block ? undefined : "grow"} icon={<I.share size={20} />} onClick={share} aria-label={OWNER_COPY.shareLabel({ copied })} data-share-url={target.url}>
      <span key={copied ? "copied" : "share"} className={swap}>
        {OWNER_COPY.shareButton({ copied })}
      </span>
    </Button>
  );
}

/** Compartir como icono sobre la foto de la casa, arriba a la derecha (Mis casas #95, Mi casa #92): el mismo flujo que la
 *  ficha pública (hoja del sistema o, sin ella, copiar el enlace; cancelar no hace nada). */
export function SharePhotoButton({ listing: l }: { listing: Listing }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <IconButton label={OWNER_COPY.sharePhoto({ copied })} tone="overlay" placement="photo-share" onClick={share} data-share-url={target.url}>
      <span key={copied ? "copied" : "share"} className={swap}>
        {copied ? <I.check size={22} /> : <I.share size={22} />}
      </span>
    </IconButton>
  );
}

/** El WhatsApp de la casa, de solo lectura (se cambia desde Cuenta). */
export function WhatsAppItem({ listing: l }: { listing: Listing }) {
  return (
    <ListRow>
      <span className="muted-icon">
        <I.phone />
      </span>
      <span className="body">
        {OWNER_COPY.housePhone}<small className="num">{OWNER_COPY.housePhoneLine({ phone: formatPhone(l.whatsappPhone) })}</small>
      </span>
    </ListRow>
  );
}
