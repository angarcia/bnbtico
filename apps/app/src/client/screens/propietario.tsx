// Zona del propietario (pantallas 09, 10, 16 y 19 del diseño v1): Inicio, Mis casas, detalle de una casa y «enviada».
// El calendario (17) va en su propio trozo (screens/calendario.tsx).
// Se pintan desde la caché (Mis casas persistida con la sesión) y se refrescan por detrás. Las reglas las pone la base;
// `can` decide qué botones se muestran.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { can } from "../../domain/can";
import { relativeDate } from "../../domain/dates";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { STATUS_LABELS, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/offer";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/icons";
import { fadeIn } from "../../shared/picture";
import { useShare } from "../../shared/share-button";
import { accountQuery } from "../account";
import { FlowHeader, RootHeader } from "../chrome";
import { countNew, inquiriesQuery } from "../inquiries";
import { activeCountQuery, ownListingQuery, ownListingsQuery, useDeleteDraft, useReopen, useSetAvailable } from "../owner";
import { setRole } from "../role";
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

/** Entrar en la zona del propietario deja la interfaz en modo propietario (barra de cinco pestañas). */
export function useOwnerMode() {
  useEffect(() => setRole("owner"), []);
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

// ---------- Inicio ----------

export function InicioScreen() {
  useOwnerMode();
  const userId = useUserId();
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const list = listings.data;
  const active = list?.filter((l) => l.status === "active") ?? [];
  const inReview = list?.filter((l) => l.status === "review") ?? [];
  const featured = active[0] ?? inReview[0] ?? list?.find((l) => l.status === "changes") ?? list?.[0];
  const title = !list ? "Inicio" : active.length ? "Su casa, en marcha" : inReview.length ? "Su casa, en revisión" : "Publique su casa";
  const firstName = account.data?.name.trim().split(/\s+/)[0];

  return (
    <>
      <RootHeader title={title} home="/propietario" greeting={firstName ? `Hola, ${firstName}` : undefined} />
      {listings.isError && !list ? <p className="note" role="alert">{message(listings.error)}</p> : null}
      {!list && !listings.isError ? <SkeletonCard /> : null}

      {list && list.length > 0 ? (
        <InquiriesCard userId={userId} />
      ) : null}

      {list && !featured ? (
        <section className="card stack gap-12">
          <h3>Publique su casa en pocos pasos</h3>
          <p className="small muted">Fotos, ubicación aproximada, características y precio. La revisamos a mano y queda visible con su enlace para compartir por WhatsApp.</p>
          <Link to="/propietario/publicar" className="btn btn-primary btn-lg btn-block">
            Publicar casa
          </Link>
        </section>
      ) : null}

      {featured ? <FeaturedCard listing={featured} /> : null}
      {list ? <OfferCard hasActive={active.length > 0} /> : null}

      {list && list.length > 1 ? (
        <Link to="/propietario/casas" className="list-item card">
          <I.house />
          <span className="body">
            Mis casas<small>{list.length} en total</small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
        </Link>
      ) : null}
    </>
  );
}

/** «N consultas nuevas» → Mis consultas. Lee la misma consulta que la pantalla y el contador de la pestaña. */
function InquiriesCard({ userId }: { userId: string }) {
  const { data } = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const fresh = countNew(data);
  const title = !data ? "Consultas" : fresh ? `${fresh} ${fresh === 1 ? "consulta nueva" : "consultas nuevas"}` : "Sin consultas nuevas";
  return (
    <Link to="/propietario/consultas" className="card row gap-14 inquiries-card">
      <span className="round-icon round-icon-sun">
        <I.chat size={22} />
      </span>
      <span className="stack gap-4 grow-col">
        <b className="display inquiries-title" data-testid="inquiries-title">
          {title}
        </b>
        <span className="small muted">Clientes que le escribieron por WhatsApp desde su ficha</span>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}

export function SkeletonCard() {
  return (
    <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando sus casas">
      <span className="sk thumb" />
      <span className="sk sk-line" />
    </section>
  );
}

function FeaturedCard({ listing: l }: { listing: Listing }) {
  const d = describe(l, { base: base() });
  const line =
    l.status === "active" ? `Publicada ${relativeDate(l.reviewedAt ?? l.updatedAt, Date.now())}` : l.status === "review" ? `Enviada ${relativeDate(l.updatedAt, Date.now())} · le avisamos por WhatsApp` : d.situation;
  return (
    <section className="card stack gap-12">
      <div className="row gap-12 align-top">
        <Thumb listing={l} small />
        <div className="stack gap-4 grow-col">
          <StatusBadge listing={l} />
          <Link to="/propietario/casas/$id" params={{ id: l.id }} className="display featured-title">
            {titleOf(l)}
          </Link>
          <span className="small muted">{line}</span>
        </div>
      </div>
      <FeaturedAction listing={l} />
    </section>
  );
}

/** Una sola acción según el estado: compartir, seguir el borrador, ver lo que pedimos… En revisión no hay nada que hacer. */
function FeaturedAction({ listing: l }: { listing: Listing }) {
  if (l.status === "active") return <ShareBlock listing={l} />;
  if (l.status === "review") return null;
  if (l.status === "draft") {
    return (
      <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "1" }} className="btn btn-primary btn-lg">
        Seguir con el borrador
      </Link>
    );
  }
  return (
    <Link to="/propietario/casas/$id" params={{ id: l.id }} className={`btn btn-lg ${l.status === "changes" ? "btn-sun" : "btn-ghost"}`}>
      {l.status === "changes" ? "Ver lo que le pedimos" : "Ver mi casa"}
    </Link>
  );
}

function ShareBlock({ listing: l }: { listing: Listing }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <>
      <div className="share-box stack gap-6">
        <b className="small">Comparta su ficha</b>
        <span className="small">Envíe el enlace por WhatsApp o en sus redes. Quien lo abra puede escribirle directo; solo necesita verificar su WhatsApp.</span>
        <span className="small num primary share-url">{target.url.replace(/^https?:\/\//, "")}</span>
      </div>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={share} data-share-url={target.url}>
        <I.wa size={20} />{" "}
        <span key={copied ? "copied" : "share"} className={swap}>
          {copied ? "Enlace copiado" : "Compartir ficha por WhatsApp"}
        </span>
      </button>
    </>
  );
}

function OfferCard({ hasActive }: { hasActive: boolean }) {
  const count = useQuery(activeCountQuery);
  const offer = count.data === undefined ? undefined : launchOffer(count.data);
  const fee = formatCRC(MONTHLY_FEE_CRC);
  return (
    <section className="card stack gap-10 offer-card">
      <div className="row between baseline">
        <b className="display offer-title">Oferta de lanzamiento</b>
        <span className={`xs num offer-left${offer === undefined ? " is-hidden" : ""}`} data-testid="offer-left">
          {offer ? `Quedan ${offer.remaining} de ${offer.size}` : offer === null ? "Terminada" : "Quedan …"}
        </span>
      </div>
      <span className="small ink">
        {offer === null ? (
          <>La oferta de lanzamiento terminó. {fee} al mes por casa, sin permanencia.</>
        ) : hasActive ? (
          <>Su casa activa tiene la oferta de lanzamiento: meses gratis desde que la aprobamos. Después, {fee} al mes por casa, sin permanencia.</>
        ) : (
          <>
            Las próximas casas publicadas tienen <b>{offer?.months ?? 12} meses gratis</b>. Después, {fee} al mes por casa, sin permanencia. No pedimos tarjeta ahora.
          </>
        )}
      </span>
      {offer !== null ? <progress className="offer-bar" value={offer?.taken ?? 0} max={offer?.size ?? 50} aria-label="Plazas ocupadas en la oferta" /> : null}
      <Link to="/cuenta" className="link small">
        Ver mi suscripción
      </Link>
    </section>
  );
}

// ---------- Mis casas ----------

export function CasasScreen() {
  useOwnerMode();
  const userId = useUserId();
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const list = listings.data;
  const count = (s: Listing["status"]) => list?.filter((l) => l.status === s).length ?? 0;
  return (
    <>
      <RootHeader
        title="Mis casas"
        home="/propietario"
        action={
          <Link to="/propietario/publicar" className="btn btn-primary btn-header">
            <I.plus size={18} /> Nueva
          </Link>
        }
      />
      {listings.isError && !list ? <p className="note" role="alert">{message(listings.error)}</p> : null}
      {list && list.length > 0 ? (
        <div className="grid-3">
          <div className="tile tile-soft">
            <b className="num">{count("active")}</b>
            <span>{count("active") === 1 ? "activa" : "activas"}</span>
          </div>
          <div className="tile tile-sun">
            <b className="num">{count("payment_due")}</b>
            <span>por pagar</span>
          </div>
          <div className="tile tile-review">
            <b className="num">{count("review")}</b>
            <span>en revisión</span>
          </div>
        </div>
      ) : null}
      {!list && !listings.isError ? <SkeletonCard /> : null}
      {list && list.length === 0 ? (
        <section className="card stack">
          <h3>Todavía no publicó ninguna casa</h3>
          <p className="small muted">Fotos, ubicación aproximada, características y precio. La revisamos a mano y queda visible con su enlace.</p>
          <Link to="/propietario/publicar" className="btn btn-primary btn-lg btn-block">
            Publicar casa
          </Link>
        </section>
      ) : null}
      {list && list.length > 0 ? (
        <div className="stack gap-14">
          {list.map((l) => (
            <OwnerCard key={l.id} listing={l} userId={userId} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function OwnerCard({ listing: l, userId }: { listing: Listing; userId: string }) {
  const d = describe(l, { base: base() });
  const navigate = useNavigate();
  const discard = useDeleteDraft(userId);
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
          <span className="xs muted">{d.situation}</span>
        </div>
      </div>
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? <div className="note note-sun small">Nota de bnbtico: {l.reviewNote}</div> : null}
      {can(l, "share") ? (
        <div className="row gap-8">
          <ShareButtonInline listing={l} />
          <Link to="/propietario/calendario" search={{ casa: l.id }} className="btn btn-ghost grow">
            Calendario
          </Link>
        </div>
      ) : null}
      {l.status === "changes" ? (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => void navigate({ to: "/propietario/publicar/$id/$paso", params: { id: l.id, paso: "1" } })}>
          Corregir y reenviar
        </button>
      ) : null}
      {l.status === "draft" ? (
        <div className="row gap-8">
          <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "1" }} className="btn btn-primary grow">
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

function ShareButtonInline({ listing: l }: { listing: Listing }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  return (
    <button type="button" className="btn btn-primary grow" onClick={share} data-share-url={target.url}>
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
  useOwnerMode();
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

function Detail({ listing: l, userId }: { listing: Listing; userId: string }) {
  const navigate = useNavigate();
  const available = useSetAvailable(userId, l);
  const reopen = useReopen(userId, l);
  const discard = useDeleteDraft(userId);
  const price = describe(l, { base: "" }).mainPrice;
  const cover = l.photos[0];
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
        <span className="pill pill-sm pill-br">{l.publicId}</span>
      </div>

      {l.status === "review" ? <div className="note">La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.</div> : null}
      {l.status === "draft" && l.reviewedAt ? <div className="note note-arena">Estuvo publicada. Está editándola: al enviarla volverá a revisión.</div> : null}
      {l.status === "payment_due" ? <div className="note note-sun">{describe(l, { base: "" }).situation}</div> : null}
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? (
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
        {l.status !== "rejected" ? <ListItem to="/propietario/calendario" casa={l.id} icon={<I.calendar />} title="Calendario y precios" detail="Noches ocupadas y precios por fecha" /> : null}
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
            <span className="body" id="available-label">
              Disponible para consultas<small>Si la cierra, la ficha sigue visible pero sin botón de contacto</small>
            </span>
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={l.available}
              aria-labelledby="available-label"
              onClick={() => available.mutate(!l.available)}
            >
              <span />
            </button>
          </div>
        ) : null}
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

function ListItem({ to, casa, icon, title, detail }: { to: "/propietario/calendario"; casa: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <Link to={to} search={{ casa }} className="list-item">
      <span className="muted-icon">{icon}</span>
      <span className="body">
        {title}
        <small>{detail}</small>
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
  useOwnerMode();
  const { id } = sentRoute.useParams();
  const { query } = useOwnListing(id);
  const l = query.data;
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
            <b>Publicada y con la oferta de lanzamiento</b>
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
