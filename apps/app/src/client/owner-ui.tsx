import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { HOLD_COPY } from "../domain/admin-actions";
import { describe } from "../domain/describe";
import type { Listing } from "../domain/listing";
import { formatCRC } from "../domain/money";
import { formatPhone } from "../domain/phone";
import { cardDate, payButtonDue, reminderCard, reminderDaysLeft } from "../domain/subscription";
import { waUrl } from "../domain/whatsapp";
import { I } from "../shared/icons";
import { useShare } from "../shared/share-button";
import type { HouseBilling } from "./billing";
import { SUPPORT_NUMBERS } from "./support-numbers";

const base = () => window.location.origin;
export const titleOf = (l: Listing) => l.title || "Borrador sin título";
export const shareOf = (l: Listing) => {
  const d = describe(l, { base: base() });
  return { url: d.shareUrl, title: titleOf(l), text: d.previewText };
};

// ---------- Suscripción (fase 5) ----------

/** «14 oct» si es de este año; si no, «14 oct 2027». */
const dayOf = (date: string, today: string) => (date.slice(0, 4) === today.slice(0, 4) ? cardDate(date).slice(0, -5) : cardDate(date));

/** Enlace a la suscripción: con casa, «Suscripción» de esa sola casa (`?casa=CT-####` y `#pago=CT-####`, que la resalta);
 *  sin ella, «Promoción y suscripción» con todas. */
export function SubscriptionLink({ publicId, className, children }: { publicId?: string; className: string; children: ReactNode }) {
  return publicId ? (
    <Link to="/propietario/suscripcion" search={{ casa: publicId }} hash={`pago=${publicId}`} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/propietario/suscripcion" className={className}>
      {children}
    </Link>
  );
}

export function PayButton({ publicId }: { publicId: string }) {
  return (
    <SubscriptionLink publicId={publicId} className="btn btn-sun btn-block">
      Añadir método de pago
    </SubscriptionLink>
  );
}

/** Reactivar una casa parada: lleva a «Promoción y suscripción» con la casa resaltada. */
export function ActivateButton({ publicId }: { publicId: string }) {
  return (
    <SubscriptionLink publicId={publicId} className="btn btn-sun btn-block">
      Activar suscripción
    </SubscriptionLink>
  );
}

/** Tarjeta ocre: la oferta terminó sin método (pendiente de pago) o termina dentro de 90 días; null si no toca avisar. */
export function PayNotice({ hb, today, title }: { hb: HouseBilling; today: string; title?: string }) {
  if (!payButtonDue(hb.sub, today)) return null;
  const { house, sub } = hb;
  const card =
    sub.status === "payment_due"
      ? {
          title: sub.promoEndsOn ? `Su oferta gratuita terminó el ${dayOf(sub.promoEndsOn, today)}` : "Falta el método de pago",
          body: `La ficha está oculta y el enlace no funciona hasta que añada un método de pago. ${formatCRC(sub.monthlyPriceCrc)} al mes, sin permanencia; puede parar cuando quiera.`,
        }
      : reminderCard(reminderDaysLeft(sub, today) ?? -1);
  if (!card) return null;
  return (
    <section className="card-sun stack gap-10" data-testid="pay-notice">
      {title ? <span className="xs strong">{title}</span> : null}
      <b className="display offer-title">{card.title}</b>
      <span className="small ink">{card.body}</span>
      <PayButton publicId={house.publicId} />
    </section>
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
      <a
        className={`btn btn-block ${card ? "btn-ghost" : "btn-wa"}`}
        href={waUrl(SUPPORT_NUMBERS.owner, `Hola, mi casa ${l.publicId} (${titleOf(l)}) está bloqueada y quisiera hablar con ustedes.`)}
        target="_blank"
        rel="noopener"
      >
        Escribir a 3bstays
      </a>
    ) : null;
  if (card)
    return (
      <>
        <p className="note note-arena small" data-testid="hold-note">
          <span>
            <b>{copy.title}.</b> Motivo: {hold.reason}
          </span>
        </p>
        {write}
      </>
    );
  return (
    <section className="card-arena stack gap-10" data-testid="hold-notice">
      <h2 className="display offer-title">{copy.title}</h2>
      <span className="small ink">{copy.body}</span>
      <span className="small ink">
        <b>Motivo:</b> <span data-testid="hold-reason">{hold.reason}</span>
      </span>
      {write}
    </section>
  );
}

/** Compartir con el acabado verde común aprobado; nombre accesible y lógica de copia conservados. */
export function ShareButtonInline({ listing: l, className = "grow" }: { listing: Listing; className?: string }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <button type="button" className={`btn btn-primary ${className}`} onClick={share} aria-label={copied ? "Enlace copiado" : "Compartir ficha"} data-share-url={target.url}>
      <I.share size={20} />
      <span key={copied ? "copied" : "share"} className={swap}>
        {copied ? "Enlace copiado" : "Compartir"}
      </span>
    </button>
  );
}

/** El WhatsApp de la casa, de solo lectura (se cambia desde Cuenta). */
export function WhatsAppItem({ listing: l }: { listing: Listing }) {
  return (
    <div className="list-item">
      <span className="muted-icon">
        <I.phone />
      </span>
      <span className="body">
        WhatsApp de esta casa<small className="num">{formatPhone(l.whatsappPhone)} · verificado</small>
      </span>
    </div>
  );
}
