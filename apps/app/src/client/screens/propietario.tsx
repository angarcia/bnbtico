// Zona del propietario (pantallas 10, 16 y 19 del diseño v1; 07-mis-casas del v2): Mis casas, detalle de una casa y
// «enviada». Mis casas es siempre la lista, una casa por fila; arriba, como mucho el aviso del pago (navigation.ts noticeFor).
// El calendario (17) va en su propio trozo (screens/calendario.tsx).
// Se pintan desde la caché (Mis casas persistida con la sesión) y se refrescan por detrás. Las reglas las pone la base;
// `can` decide qué botones se muestran.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useState, type ReactNode } from "react";
import { can, isPublished } from "../../domain/can";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { resumeStep, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { cardLabel, casasView, noticeFor, type Notice } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, cardDate, launchOffer, payButtonDue, reminderCard, reminderDaysLeft } from "../../domain/subscription";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/icons";
import { MonthlyLine } from "../../shared/monthly-line";
import { fadeIn } from "../../shared/picture";
import { useShare } from "../../shared/share-button";
import { useBilling, type Billing, type HouseBilling } from "../billing";
import { FlowHeader, RootHeader } from "../chrome";
import { HouseCardTop } from "../house-card";
import { offerTakenQuery, ownListingQuery, ownListingsQuery, useDeleteDraft } from "../owner";
import { useSession } from "../session";

const base = () => window.location.origin;
const message = (e: unknown) => toDomainError(e).message;
export const titleOf = (l: Listing) => l.title || "Borrador sin título";
export const shareOf = (l: Listing) => {
  const d = describe(l, { base: base() });
  return { url: d.shareUrl, title: titleOf(l), text: d.previewText };
};

export function useUserId(): string {
  return useSession().session?.userId ?? "";
}

const confirmed = (text: string) => window.confirm(text);

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

function PayButton({ publicId }: { publicId: string }) {
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

export function SkeletonCard() {
  return (
    <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando sus casas">
      <span className="sk thumb" />
      <span className="sk sk-line" />
    </section>
  );
}

// ---------- Mis casas ----------

/** El único aviso de arriba (domain/navigation.ts noticeFor): el pago, con el nombre de la casa. */
function NoticeCard({ notice, billing }: { notice: Notice | null; billing: Billing | null }) {
  const hb = notice ? billing?.of(notice.listingId) : undefined;
  return hb && billing ? <PayNotice hb={hb} today={billing.today} title={hb.house.title} /> : null;
}

export function CasasScreen() {
  const userId = useUserId();
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const list = listings.data;
  const billing = useBilling(userId);
  const notice = list ? noticeFor(list, billing && { today: billing.today, houses: billing.all.map((x) => ({ listingId: x.house.listingId, sub: x.sub })) }) : null;
  const view = list ? casasView(list.length) : null;
  const count = (s: Listing["status"]) => list?.filter((l) => l.status === s).length ?? 0;
  // Casillas a 0 fuera: no llaman la atención sobre nada (revisión UX N1).
  const tiles = [
    { n: count("active"), label: count("active") === 1 ? "activa" : "activas", cls: "tile-soft" },
    { n: count("payment_due"), label: "por pagar", cls: "tile-sun" },
    { n: count("review"), label: "en revisión", cls: "tile-review" },
  ].filter((t) => t.n > 0);
  return (
    <>
      <RootHeader
        title="Mis casas"
        aside={
          view === "list" ? (
            <Link to="/propietario/publicar" className="btn btn-ghost btn-round" aria-label="Nueva casa">
              <I.plus size={20} />
            </Link>
          ) : undefined
        }
      />
      {listings.isError && !list ? <p className="note" role="alert">{message(listings.error)}</p> : null}
      {!list && !listings.isError ? <SkeletonCard /> : null}
      {view === "list" ? (
        <>
          <NoticeCard notice={notice} billing={billing} />
          {tiles.length ? (
            <div className="grid-3">
              {tiles.map((t) => (
                <div key={t.label} className={`tile ${t.cls}`}>
                  <b className="num">{t.n}</b>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="stack gap-14">
            {list!.map((l, i) => (
              <OwnerCard key={l.id} listing={l} userId={userId} eager={i === 0} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

/** Una casa por fila: foto con su estado, nombre y zona; debajo, como mucho un botón relleno (diseño v2, 07-mis-casas). */
function OwnerCard({ listing: l, userId, eager }: { listing: Listing; userId: string; eager: boolean }) {
  const discard = useDeleteDraft(userId);
  // Sin la consulta de la suscripción (despliegue antes de la migración) no se ofrece pagar: la pantalla no funcionaría.
  const billed = !!useBilling(userId)?.of(l.id);
  return (
    <article className="card house-card">
      {/* Enlace estirado: toda la tarjeta abre el detalle; los botones van por encima (revisión de Ana). */}
      <HouseCardTop listing={l} edit={l.edit} eager={eager} link />
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? <p className="note note-arena small">Nota de bnbtico: {l.reviewNote}</p> : null}
      {can(l, "share") ? (
        <div className="row gap-8">
          <ShareButtonInline listing={l} />
          <Link to="/propietario/calendario" search={{ casa: l.id }} className="btn btn-ghost grow">
            Calendario
          </Link>
        </div>
      ) : null}
      {l.status === "changes" ? (
        <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "1" }} className="btn btn-primary btn-block">
          Corregir y reenviar
        </Link>
      ) : null}
      {l.status === "draft" ? (
        <div className="row gap-8">
          <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: String(resumeStep(l)) }} className="btn btn-ghost grow">
            Seguir publicando
          </Link>
          {can(l, "discard") ? (
            <button
              type="button"
              className="btn btn-link muted"
              disabled={discard.isPending}
              onClick={() => confirmed("¿Descartar este borrador? No se puede deshacer.") && discard.mutate(l.id)}
            >
              Descartar
            </button>
          ) : null}
        </div>
      ) : null}
      {billed && l.status === "payment_due" ? <PayButton publicId={l.publicId} /> : null}
      {billed && l.status === "inactive" ? <ActivateButton publicId={l.publicId} /> : null}
      {discard.isError ? <p className="note" role="alert">{message(discard.error)}</p> : null}
    </article>
  );
}

export function ShareButtonInline({ listing: l, className = "grow" }: { listing: Listing; className?: string }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <button type="button" className={`btn btn-primary ${className}`} onClick={share} data-share-url={target.url}>
      <span key={copied ? "copied" : "share"} className={swap}>
        {copied ? "Enlace copiado" : "Compartir ficha"}
      </span>
    </button>
  );
}

// ---------- Detalle de una casa ----------

// La ficha editable de una casa publicada va en su propio trozo (spec .scratch/editar-casa); las que nunca se publicaron
// siguen con este detalle y el asistente.
const EditableFicha = lazy(() => import("./casa-editable").then((m) => ({ default: m.EditableFicha })));

const detailRoute = getRouteApi("/_flow/_privateFlow/propietario/casas/$id");

export function useOwnListing(id: string) {
  const userId = useUserId();
  const client = useQueryClient();
  const [options] = useState(() => ownListingQuery(userId, id, client));
  return { userId, query: useQuery({ ...options, enabled: !!userId }) };
}

export function NotFoundCard() {
  return (
    <section className="card stack gap-12">
      <h3>No encontramos esta casa</h3>
      <p className="small muted">Puede que la haya descartado o que el enlace no sea suyo.</p>
      <Link to="/propietario/casas" className="btn btn-primary">
        Ir a Mis casas
      </Link>
    </section>
  );
}

export function CasaPropietarioScreen() {
  const { id } = detailRoute.useParams();
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  return (
    <>
      <FlowHeader
        title={l ? titleOf(l) : "Mi casa"}
        back="/propietario/casas"
        action={
          l && can(l, "share") ? (
            <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="link header-action">
              Ver ficha
            </Link>
          ) : undefined
        }
      />
      {l && isPublished(l) ? (
        <Suspense fallback={<SkeletonCard />}>
          <EditableFicha listing={l} userId={userId} />
        </Suspense>
      ) : null}
      {l && !isPublished(l) ? <Detail listing={l} userId={userId} /> : null}
      {l === null ? <NotFoundCard /> : null}
      {l === undefined && query.isError ? <p className="note" role="alert">{message(query.error)}</p> : null}
      {l === undefined && !query.isError ? <SkeletonCard /> : null}
    </>
  );
}

function Detail({ listing: l, userId }: { listing: Listing; userId: string }) {
  const navigate = useNavigate();
  const discard = useDeleteDraft(userId);
  const { mainPrice: price, monthly } = describe(l, { base: "" });
  const cover = l.photos[0];
  const label = cardLabel(l);
  const toWizard = () => navigate({ to: "/propietario/publicar/$id/$paso", params: { id: l.id, paso: "1" } });

  function remove() {
    if (!confirmed("¿Descartar este borrador? No se puede deshacer.")) return;
    discard.mutate(l.id, { onSuccess: () => void navigate({ to: "/propietario/casas", replace: true }) });
  }

  const error = discard.error;
  return (
    <>
      <div className="photo detail-photo">
        {cover ? <img src={variantUrl(cover, 800)} alt="" width={800} height={340} /> : <span className="small">Sin fotos</span>}
        <span className={`state ${label.cls}`}>{label.text}</span>
        {price ? (
          <span className="pill pill-bl">
            {formatCRC(price.amount)} <span>/ {price.unit}</span>
          </span>
        ) : null}
      </div>
      {monthly ? <MonthlyLine monthly={monthly} format={formatCRC} /> : null}

      {l.status === "review" ? <div className="note">La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.</div> : null}
      {l.reviewNote && (l.status === "rejected" || l.status === "changes") ? (
        <section className="card-arena stack gap-10">
          <b className="display offer-title">{l.status === "changes" ? "Le pedimos cambios" : "Anuncio rechazado"}</b>
          <span className="small ink">{l.reviewNote}</span>
          {l.status === "changes" ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => void toWizard()}>
              Corregir y reenviar
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="list">
        <ShareListItem listing={l} />
        {l.status === "draft" ? (
          <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "1" }} className="list-item">
            <span className="muted-icon">
              <I.edit />
            </span>
            <span className="body">
              Seguir con el borrador<small>Fotos, descripción, características y precio</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </Link>
        ) : null}
        <WhatsAppItem listing={l} />
      </section>

      {error ? <p className="note" role="alert">{message(error)}</p> : null}

      {can(l, "discard") ? (
        <button type="button" className="btn btn-outline-bad" onClick={remove} disabled={discard.isPending}>
          Descartar borrador
        </button>
      ) : null}
    </>
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

function ShareListItem({ listing: l }: { listing: Listing }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  const enabled = can(l, "share");
  return (
    <button type="button" className="list-item" onClick={share} disabled={!enabled} aria-disabled={!enabled || undefined} data-share-url={target.url}>
      <span className="muted-icon">
        <I.share />
      </span>
      <span className="body">
        Compartir ficha
        {/* La referencia CT-#### va aquí, dentro del enlace, y no sobre la foto (revisión UX N7). */}
        {enabled && !copied ? <small className="num primary share-url">{target.url.replace(/^https?:\/\//, "")}</small> : null}
        <small key={copied ? "copied" : "share"} className={swap}>{copied ? "Enlace copiado" : enabled ? "Envíe el enlace por WhatsApp o compártalo en sus redes" : "Disponible cuando la casa esté activa"}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </button>
  );
}

// ---------- Enviada ----------

const sentRoute = getRouteApi("/_flow/_privateFlow/propietario/casas/$id/enviada");

export function EnviadaScreen() {
  const { id } = sentRoute.useParams();
  const { query } = useOwnListing(id);
  const l = query.data;
  const taken = useQuery(offerTakenQuery).data;
  const offer = taken === undefined ? undefined : launchOffer(taken);
  if (l === null) return <NotFoundCard />;
  const cover = l?.photos[0];
  return (
    <div className="stack center sent">
      <div className="sent-photo">
        <div className="photo sent-circle">{cover ? <img src={variantUrl(cover, 480)} alt="" width={132} height={132} {...fadeIn} /> : null}</div>
        <span className="sent-check">
          <I.check size={22} />
        </span>
      </div>
      <div className="stack gap-8">
        <h1 className="sent-title">¡Listo! Su casa está en revisión</h1>
        <p className="muted">
          Revisamos {l ? titleOf(l) : "su casa"} a mano, normalmente en menos de 24 horas. Le avisamos por WhatsApp cuando esté publicada.
        </p>
      </div>
      <div className="steps-list">
        <div>
          <span className="n done">1</span>
          <span>
            <b>Enviada</b>
            <span className="block muted">
              Hoy · referencia <span className="num">{l?.publicId ?? "…"}</span>
            </span>
          </span>
        </div>
        <div>
          <span className="n">2</span>
          <span>
            <b>La revisamos</b>
            <span className="block muted">Si falta algo se lo decimos por WhatsApp y lo corrige desde Mis casas</span>
          </span>
        </div>
        <div>
          <span className="n">3</span>
          <span>
            <b>{offer ? `Publicada y gratis ${offer.months} meses` : offer === null ? `Publicada · ${formatCRC(MONTHLY_FEE_CRC)} al mes` : "Publicada y con la oferta de lanzamiento"}</b>
            <span className="block muted">Comparta el enlace y los clientes le escriben por WhatsApp</span>
          </span>
        </div>
      </div>
      <div className="stack gap-10 sent-actions">
        <Link to="/propietario/calendario" search={{ casa: id }} className="btn btn-primary btn-lg">
          Marcar las noches ocupadas
        </Link>
        <Link to="/propietario/casas" className="btn-link sent-link">
          Ir a Mis casas
        </Link>
      </div>
    </div>
  );
}
