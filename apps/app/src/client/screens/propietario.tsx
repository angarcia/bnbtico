// Zona del propietario (pantallas 10, 16 y 19 del diseño v1): Mis casas, detalle de una casa y «enviada». Con una sola
// casa, Mis casas es su detalle; con dos o más, la lista. Arriba, como mucho un aviso (domain/navigation.ts noticeFor).
// El calendario (17) va en su propio trozo (screens/calendario.tsx).
// Se pintan desde la caché (Mis casas persistida con la sesión) y se refrescan por detrás. Las reglas las pone la base;
// `can` decide qué botones se muestran.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { occupiedNightsLabel } from "../../domain/calendar";
import { can } from "../../domain/can";
import { longDate } from "../../domain/dates";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { costaRicaToday } from "../../domain/inquiry";
import { variantUrl } from "../../domain/image";
import { MIN_PHOTOS, STATUS_LABELS, missingPhotosLabel, resumeStep, wizardStage, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { casasView, noticeFor, type Notice } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, cardDate, launchOffer, payButtonDue, reminderCard, reminderDaysLeft, subscriptionLine } from "../../domain/subscription";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/icons";
import { fadeIn } from "../../shared/picture";
import { useShare } from "../../shared/share-button";
import { useBilling, type Billing, type HouseBilling } from "../billing";
import { calendarQuery } from "../calendar-days";
import { CloseSheet } from "../close-sheet";
import { FlowHeader, RootHeader } from "../chrome";
import { offerTakenQuery, listingStatsQuery, ownListingQuery, ownListingsQuery, useDeleteDraft, useReopen, useSetAvailable } from "../owner";
import { useSession } from "../session";

const base = () => window.location.origin;
const message = (e: unknown) => toDomainError(e).message;
const titleOf = (l: Listing) => l.title || "Borrador sin título";
const shareOf = (l: Listing) => {
  const d = describe(l, { base: base() });
  return { url: d.shareUrl, title: titleOf(l), text: d.previewText };
};

export function useUserId(): string {
  return useSession().session?.userId ?? "";
}

function StatusBadge({ listing: l }: { listing: Listing }) {
  const label = describe(l, { base: "" }).statusLabel;
  const badge = l.status === "active" && !l.available ? "badge-mute" : STATUS_LABELS[l.status].badge;
  return <span className={`badge ${badge}`}>{label}</span>;
}

function Thumb({ listing: l, small }: { listing: Listing; small?: boolean }) {
  const cover = l.photos[0];
  const cls = small ? "thumb thumb-sm" : "thumb";
  const size = small ? 84 : 92;
  return cover ? <img src={variantUrl(cover, 480)} alt="" className={cls} width={size} height={size} loading="lazy" decoding="async" /> : <span className={cls} />;
}

function Price({ listing: l }: { listing: Listing }) {
  const p = describe(l, { base: "" }).mainPrice;
  return p ? (
    <span className="num price-line">
      {formatCRC(p.amount)} <span className="muted">/ {p.unit}</span>
    </span>
  ) : null;
}

const confirmed = (text: string) => window.confirm(text);

// ---------- Suscripción (fase 5) ----------

/** «14 oct» si es de este año; si no, «14 oct 2027». */
const dayOf = (date: string, today: string) => (date.slice(0, 4) === today.slice(0, 4) ? cardDate(date).slice(0, -5) : cardDate(date));

/** Enlace a «Promoción y suscripción» (`/propietario/suscripcion`, con `#pago=CT-####` para resaltar una casa). */
function SubscriptionLink({ publicId, className, children }: { publicId?: string; className: string; children: ReactNode }) {
  return (
    <Link to="/propietario/suscripcion" hash={publicId ? `pago=${publicId}` : undefined} className={className}>
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

/** Tarjeta ocre: la oferta terminó sin método (pendiente de pago) o termina dentro de 90 días; null si no toca avisar. */
function PayNotice({ hb, today, title }: { hb: HouseBilling; today: string; title?: string }) {
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

/** El borrador (o la casa con cambios) que falta por publicar, con un único botón relleno hacia el paso donde se quedó. */
function ResumeCard({ listing: l }: { listing: Listing }) {
  const step = resumeStep(l);
  const stage = wizardStage(step);
  const missing = MIN_PHOTOS - l.photoCount;
  const where = step === 7 && missing > 0 ? `${stage.name} · ${missingPhotosLabel(missing).toLowerCase()}` : step === 9 ? "Todo listo · solo falta enviarla" : `${stage.name} · ${stage.position} de ${stage.size}`;
  const changes = l.status === "changes";
  return (
    <section className="card stack gap-12 resume-card" data-testid="resume-card">
      <div className="row gap-12 align-top">
        <Thumb listing={l} small />
        <div className="stack gap-4 grow-col">
          <StatusBadge listing={l} />
          <b className="display featured-title">{l.title.trim() || "Sin nombre todavía"}</b>
          <span className="small muted">{changes ? "Le pedimos cambios antes de publicarla" : where}</span>
        </div>
      </div>
      {changes && l.reviewNote ? <p className="note note-sun small">{l.reviewNote}</p> : null}
      <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: String(changes ? 1 : step) }} className="btn btn-primary btn-lg btn-block">
        {changes ? "Corregir y reenviar" : "Seguir publicando"}
      </Link>
    </section>
  );
}

/** Visitas y consultas de 30 días (revisión UX A2): si el propietario no ve que su ficha funciona, en el mes 13 no paga. */
function StatsLine({ listing: l }: { listing: Listing }) {
  const userId = useUserId();
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

// ---------- Mis casas ----------

/** El único aviso de arriba (domain/navigation.ts noticeFor): el pago con el nombre de la casa o seguir publicando. */
function NoticeCard({ notice, list, billing }: { notice: Notice | null; list: Listing[]; billing: Billing | null }) {
  if (notice?.kind === "payment") {
    const hb = billing?.of(notice.listingId);
    return hb && billing ? <PayNotice hb={hb} today={billing.today} title={hb.house.title} /> : null;
  }
  const l = notice ? list.find((x) => x.id === notice.listingId) : undefined;
  return l ? <ResumeCard listing={l} /> : null;
}

export function CasasScreen() {
  const userId = useUserId();
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const list = listings.data;
  const billing = useBilling(userId);
  const notice = list ? noticeFor(list, billing && { today: billing.today, houses: billing.all.map((x) => ({ listingId: x.house.listingId, sub: x.sub })) }) : null;
  const view = list ? casasView(list.length) : null;
  const single = view === "single" ? list![0]! : undefined;
  if (single) {
    return (
      <>
        <RootHeader
          title={titleOf(single)}
          action={
            can(single, "share") ? (
              <Link to="/casa/$publicId" params={{ publicId: single.publicId }} className="link header-action">
                Ver ficha
              </Link>
            ) : undefined
          }
        />
        <NoticeCard notice={notice} list={list!} billing={billing} />
        <Detail listing={single} userId={userId} shown={notice} />
        <Link to="/propietario/publicar" className="btn btn-ghost btn-block">
          Añadir otra casa
        </Link>
      </>
    );
  }
  const count = (s: Listing["status"]) => list?.filter((l) => l.status === s).length ?? 0;
  // Casillas a 0 fuera: no llaman la atención sobre nada (revisión UX N1).
  const tiles = [
    { n: count("active"), label: count("active") === 1 ? "activa" : "activas", cls: "tile-soft" },
    { n: count("payment_due"), label: "por pagar", cls: "tile-sun" },
    { n: count("review"), label: "en revisión", cls: "tile-review" },
  ].filter((t) => t.n > 0);
  // Un solo botón relleno (revisión UX N1/A1): el del aviso «Seguir publicando» si lo hay; si no, lo que falta por
  // publicar y, si no, compartir.
  const primaryId = notice?.kind === "resume" ? undefined : (list?.find((l) => l.status === "draft" || l.status === "changes") ?? list?.find((l) => can(l, "share")))?.id;
  return (
    <>
      <RootHeader
        title="Mis casas"
        action={
          view === "list" ? (
            <Link to="/propietario/publicar" className="btn btn-ghost btn-header">
              <I.plus size={18} /> Nueva
            </Link>
          ) : undefined
        }
      />
      {listings.isError && !list ? <p className="note" role="alert">{message(listings.error)}</p> : null}
      {!list && !listings.isError ? <SkeletonCard /> : null}
      {view === "list" ? (
        <>
          <NoticeCard notice={notice} list={list!} billing={billing} />
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
            {list!.map((l) => (
              <OwnerCard key={l.id} listing={l} userId={userId} primary={l.id === primaryId} billing={billing} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function OwnerCard({ listing: l, userId, primary, billing }: { listing: Listing; userId: string; primary: boolean; billing: Billing | null }) {
  const d = describe(l, { base: base() });
  const navigate = useNavigate();
  const discard = useDeleteDraft(userId);
  const hb = billing?.of(l.id);
  // Activa: la línea de la suscripción («Gratis hasta el 14 oct 2027»); las demás, la situación de la casa.
  const line = (hb && billing && l.status === "active" ? subscriptionLine(hb.sub, billing.today) : null) ?? d.situation;
  const pay = !!hb && !!billing && payButtonDue(hb.sub, billing.today);
  return (
    <article className="card stack gap-12 owner-card">
      <div className="row gap-12 align-top">
        <Thumb listing={l} />
        <div className="stack gap-4 grow-col">
          <StatusBadge listing={l} />
          <h2 className="owner-card-title">
            <Link to="/propietario/casas/$id" params={{ id: l.id }}>
              {titleOf(l)}
            </Link>
          </h2>
          <Price listing={l} />
          <span className="xs muted" data-testid="card-line">{line}</span>
        </div>
      </div>
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? <div className="note note-sun small">Nota de bnbtico: {l.reviewNote}</div> : null}
      {can(l, "share") ? (
        <div className="row gap-8">
          <ShareButtonInline listing={l} primary={primary} />
          <Link to="/propietario/calendario" search={{ casa: l.id }} className="btn btn-ghost grow">
            Calendario
          </Link>
        </div>
      ) : null}
      {pay ? <PayButton publicId={l.publicId} /> : null}
      {hb && l.status === "inactive" ? (
        <SubscriptionLink publicId={l.publicId} className="btn btn-ghost btn-block">
          Reactivar
        </SubscriptionLink>
      ) : null}
      {l.status === "changes" ? (
        <button type="button" className={`btn ${primary ? "btn-primary" : "btn-ghost"} btn-block`} onClick={() => void navigate({ to: "/propietario/publicar/$id/$paso", params: { id: l.id, paso: "1" } })}>
          Corregir y reenviar
        </button>
      ) : null}
      {l.status === "draft" ? (
        <div className="row gap-8">
          <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: String(resumeStep(l)) }} className={`btn ${primary ? "btn-primary" : "btn-ghost"} grow`}>
            Seguir
          </Link>
          {can(l, "discard") ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={discard.isPending}
              onClick={() => confirmed("¿Descartar este borrador? No se puede deshacer.") && discard.mutate(l.id)}
            >
              Descartar
            </button>
          ) : null}
        </div>
      ) : null}
      {discard.isError ? <p className="note" role="alert">{message(discard.error)}</p> : null}
    </article>
  );
}

function ShareButtonInline({ listing: l, primary }: { listing: Listing; primary: boolean }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <button type="button" className={`btn ${primary ? "btn-primary" : "btn-ghost"} grow`} onClick={share} data-share-url={target.url}>
      <span key={copied ? "copied" : "share"} className={swap}>
        {copied ? "Enlace copiado" : "Compartir ficha"}
      </span>
    </button>
  );
}

// ---------- Detalle de una casa ----------

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
      {l ? <Detail listing={l} userId={userId} /> : null}
      {l === null ? <NotFoundCard /> : null}
      {l === undefined && query.isError ? <p className="note" role="alert">{message(query.error)}</p> : null}
      {l === undefined && !query.isError ? <SkeletonCard /> : null}
    </>
  );
}

/** `shown`: el aviso que Mis casas ya pinta arriba (vista de una casa); el detalle no lo repite. */
function Detail({ listing: l, userId, shown }: { listing: Listing; userId: string; shown?: Notice | null }) {
  const navigate = useNavigate();
  const above = shown?.listingId === l.id ? shown.kind : undefined;
  const billing = useBilling(userId);
  const hb = billing?.of(l.id);
  const subLine = hb && billing ? subscriptionLine(hb.sub, billing.today) : null;
  const available = useSetAvailable(userId, l);
  const reopen = useReopen(userId, l);
  const discard = useDeleteDraft(userId);
  const price = describe(l, { base: "" }).mainPrice;
  const cover = l.photos[0];
  const [closing, setClosing] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  // El foco vuelve al interruptor cuando la hoja ya se desmontó y la página dejó de estar inerte.
  useEffect(() => {
    if (closing || !returnFocus.current) return;
    returnFocus.current = false;
    toggle.current?.focus();
  }, [closing]);
  const endClosing = () => {
    returnFocus.current = true;
    setClosing(false);
  };
  const toWizard = () => navigate({ to: "/propietario/publicar/$id/$paso", params: { id: l.id, paso: "1" } });

  function edit() {
    if (!confirmed("Su casa dejará de verse mientras la revisamos. ¿Quiere editarla?")) return;
    reopen.mutate(undefined, { onSuccess: () => void toWizard() });
  }

  function remove() {
    if (!confirmed("¿Descartar este borrador? No se puede deshacer.")) return;
    discard.mutate(l.id, { onSuccess: () => void navigate({ to: "/propietario/casas", replace: true }) });
  }

  const error = available.error ?? reopen.error ?? discard.error;
  return (
    <>
      <div className="photo detail-photo">
        {cover ? <img src={variantUrl(cover, 800)} alt="" width={800} height={340} /> : <span className="small">Sin fotos</span>}
        <span className="pill-tl detail-badge">
          <StatusBadge listing={l} />
        </span>
        {price ? (
          <span className="pill pill-bl">
            {formatCRC(price.amount)} <span>/ {price.unit}</span>
          </span>
        ) : null}
      </div>
      {l.status === "active" ? <StatsLine listing={l} /> : null}

      {l.status === "review" ? <div className="note">La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.</div> : null}
      {l.status === "draft" && l.reviewedAt ? <div className="note note-arena">Estuvo publicada. Está editándola: al enviarla volverá a revisión.</div> : null}
      {hb && billing ? (above === "payment" ? null : <PayNotice hb={hb} today={billing.today} />) : l.status === "payment_due" ? <div className="note note-sun">{describe(l, { base: "" }).situation}</div> : null}
      {l.reviewNote && (l.status === "rejected" || (l.status === "changes" && above !== "resume")) ? (
        <section className="card-sun stack gap-10">
          <b className="display offer-title">{l.status === "changes" ? "Le pedimos cambios" : "Anuncio rechazado"}</b>
          <span className="small ink">{l.reviewNote}</span>
          {l.status === "changes" ? (
            <button type="button" className="btn btn-sun btn-block" onClick={() => void toWizard()}>
              Corregir y reenviar
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="list">
        <ShareListItem listing={l} />
        {l.status !== "rejected" ? <CalendarRow listing={l} userId={userId} /> : null}
        {hb && subLine ? (
          <SubscriptionLink publicId={l.publicId} className="list-item">
            <span className="muted-icon">
              <I.shield />
            </span>
            <span className="body">
              Suscripción<small data-testid="subscription-row">{subLine}</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </SubscriptionLink>
        ) : null}
        {l.status === "active" ? (
          <button type="button" className="list-item" onClick={edit} disabled={reopen.isPending}>
            <span className="muted-icon">
              <I.edit />
            </span>
            <span className="body">
              Editar la ficha<small>Fotos, descripción, características y precio · vuelve a revisión</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </button>
        ) : null}
        {l.status === "draft" && above !== "resume" ? (
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
        <div className="list-item">
          <span className="muted-icon">
            <I.phone />
          </span>
          <span className="body">
            WhatsApp de esta casa<small className="num">{formatPhone(l.whatsappPhone)} · verificado</small>
          </span>
        </div>
        {can(l, "available") ? (
          <div className="list-item">
            <span className="muted-icon">
              <I.chat />
            </span>
            <span className="body">
              <span id="available-label">Anuncio visible</span>
              <small>
                {l.available
                  ? "Si lo apaga, la casa no aparece en Explorar y su ficha dice que no está disponible por ahora. Su calendario no cambia."
                  : l.reopenAt
                    ? `Pausado hasta el ${longDate(l.reopenAt)}: no aparece en Explorar`
                    : "Pausado: no aparece en Explorar hasta que lo encienda"}
              </small>
            </span>
            <button
              ref={toggle}
              type="button"
              role="switch"
              className="switch"
              aria-checked={l.available}
              aria-labelledby="available-label"
              onClick={() => (l.available ? setClosing(true) : available.mutate({ available: true }))}
            >
              <span />
            </button>
          </div>
        ) : null}
      </section>

      {error ? <p className="note" role="alert">{message(error)}</p> : null}
      {closing ? (
        <CloseSheet
          onClose={endClosing}
          onConfirm={(reopenAt) => {
            endClosing();
            available.mutate({ available: false, reopenAt });
          }}
        />
      ) : null}

      {can(l, "discard") ? (
        <button type="button" className="btn btn-outline-bad" onClick={remove} disabled={discard.isPending}>
          Descartar borrador
        </button>
      ) : null}
    </>
  );
}

/** «Calendario y precios» con las noches ocupadas de este mes, de la misma consulta que la pantalla del calendario. */
function CalendarRow({ listing: l, userId }: { listing: Listing; userId: string }) {
  const days = useQuery({ ...calendarQuery(userId, l.id), enabled: !!userId }).data;
  const month = costaRicaToday(Date.now()).slice(0, 7);
  return (
    <Link to="/propietario/calendario" search={{ casa: l.id }} className="list-item">
      <span className="muted-icon">
        <I.calendar />
      </span>
      <span className="body">
        Calendario y precios
        <small>{days ? occupiedNightsLabel(days, month) : "Noches ocupadas y precios por fecha"}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
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
        <small key={copied ? "copied" : "share"} className={swap}>{copied ? "Enlace copiado" : enabled ? "Envíe el enlace por WhatsApp o compártalo en sus redes" : l.status === "payment_due" || l.status === "inactive" ? "Disponible cuando la casa vuelva a estar activa" : "Disponible cuando la casa esté activa"}</small>
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
