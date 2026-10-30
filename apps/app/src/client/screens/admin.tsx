// Zona del admin (pantallas 21, 22 y 23 del diseño v1): cola de anuncios, revisión de una casa y lista de casas, más el segundo código que la
// abre. Se descarga al entrar (no está en el JS inicial). Las rutas exigen sesión aal2 (solo UX): quien manda es la base.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CHIP_LABELS, HOUSE_BADGES, HOUSE_CHIPS, adminHouseLine, countHouses, filterHouses, type AdminHouse, type HouseChip } from "../../domain/admin-houses";
import { relativeDate } from "../../domain/dates";
import type { MfaFactor } from "../../domain/api";
import { describe, isNegotiable } from "../../domain/describe";
import type { ListingEdit } from "../../domain/edit";
import { editSummary, type ReviewedField } from "../../domain/edit-summary";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { FEATURE_LABEL, KIND_LABELS, MIN_PHOTOS_TO_APPROVE, MONTHLY_LABEL, STATUS_LABELS, isProposedZone, locationLine, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { formatPhone } from "../../domain/phone";
import { NO_PHOTOS_NOTE, REVIEW_NOTE_MAX, editNoteRefusal, queueBadge, reviewNoteRefusal, type EditDecision, type QueueItem, type ReviewDecision } from "../../domain/review";
import { I } from "../../shared/icons";
import { accountQuery } from "../account";
import {
  adminEditQuery,
  adminEditsQuery,
  adminHousesQuery,
  adminListingQuery,
  adminQueueQuery,
  clearReviewOutcome,
  loadSecondFactor,
  useEditsWithPending,
  useQueueWithPending,
  useReview,
  lastInReview,
  useReviewEdit,
  useReviewOutcome,
  verifySecondCode,
  type EditTarget,
} from "../admin";
import { FlowHeader, RootHeader } from "../chrome";
import { useSession } from "../session";

const message = (e: unknown) => toDomainError(e).message;
const titleOf = (l: Listing) => l.title || "Sin nombre";

function useUserId(): string {
  return useSession().session?.userId ?? "";
}

export const AdminBadge = () => <span className="badge badge-admin">Admin</span>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function priceText(l: Listing): string | null {
  const p = describe(l, { base: "" }).mainPrice;
  return p ? formatCRC(p.amount) : null;
}

/** Solo el equipo de bnbtico: un usuario sin is_admin no ve la zona aunque tenga el segundo factor. */
function useIsAdmin(): boolean | null {
  const userId = useUserId();
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  return account.data ? account.data.isAdmin : account.data === null ? false : null;
}

function NotAdmin() {
  return (
    <section className="card stack">
      <h3>Esta sección es solo para el equipo de bnbtico</h3>
      <p className="small muted">Si busca una casa, vuelva a Explorar.</p>
      <Link to="/explorar" className="btn btn-ghost btn-lg">
        Ir a Explorar
      </Link>
    </section>
  );
}

// ---------- 21 · Anuncios ----------
type QueueTab = "review" | "changes" | "rejected";

const anunciosRoute = getRouteApi("/_tabs/_admin/admin");

export function AnunciosScreen() {
  const { ver } = anunciosRoute.useSearch();
  const tab: QueueTab = ver ?? "review";
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const queue = useQuery({ ...adminQueueQuery(userId), enabled: !!userId && isAdmin !== false });
  const editsQuery = useQuery({ ...adminEditsQuery(userId), enabled: !!userId && isAdmin !== false });
  const outcome = useReviewOutcome();
  const q = useQueueWithPending(userId, queue.data);
  const edits = useEditsWithPending(userId, editsQuery.data);

  useEffect(() => () => clearReviewOutcome(), []);

  if (isAdmin === false) {
    return (
      <>
        <RootHeader title="Anuncios" home="/explorar" />
        <NotAdmin />
      </>
    );
  }
  if (queue.error && toDomainError(queue.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: "/admin" }} replace />;

  const shown: QueueItem[] = q ? q[tab] : [];
  const tabs: { key: QueueTab; label: string }[] = [
    { key: "review", label: q?.review.length ? `Por revisar · ${q.review.length}` : "Por revisar" },
    { key: "changes", label: "Cambios pedidos" },
    { key: "rejected", label: "Rechazados" },
  ];
  return (
    <>
      <RootHeader title="Anuncios" home="/admin" action={<AdminBadge />} />
      <div className="grid-3">
        <div className="tile tile-review">
          <b className="num ink">{q?.review.length ?? "–"}</b>
          <span>por revisar</span>
        </div>
        <div className="tile tile-review">
          <b className="num ink">{q?.changes.length ?? "–"}</b>
          <span>con cambios</span>
        </div>
        <div className="tile tile-soft">
          <b className="num">{q?.active ?? "–"}</b>
          <span>activas</span>
        </div>
      </div>
      <nav className="chiprow" aria-label="Filtrar anuncios">
        {tabs.map((t) => (
          <Link
            key={t.key}
            to="/admin"
            search={t.key === "review" ? {} : { ver: t.key }}
            className="chip chip-sm"
            activeOptions={{ exact: true, includeSearch: true }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {outcome ? (
        <p className={outcome.kind === "failed" ? "note note-arena small" : "note small"} role={outcome.kind === "failed" ? "alert" : "status"}>
          {outcome.kind === "failed" ? `No se guardó la decisión sobre «${outcome.title}»: ${outcome.text}` : `«${outcome.title}»: ${outcome.text}`}
        </p>
      ) : null}
      {edits?.length ? (
        <section className="stack gap-12" aria-labelledby="ediciones-por-revisar">
          <h2 id="ediciones-por-revisar" className="small strong">
            Ediciones por revisar
          </h2>
          {edits.map((item) => (
            <EditQueueCard key={item.listing.id} item={item} />
          ))}
        </section>
      ) : null}
      {editsQuery.isError && !edits && toDomainError(editsQuery.error).kind !== "forbidden" ? (
        <p className="note" role="alert">
          {message(editsQuery.error)}
        </p>
      ) : null}
      {queue.isError && !q ? (
        <p className="note" role="alert">
          {message(queue.error)}
        </p>
      ) : null}
      {!q && !queue.isError ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando la cola">
          <span className="sk thumb" />
          <span className="sk sk-line" />
        </section>
      ) : null}
      {q && shown.length === 0 ? (
        <section className="card">
          <p className="muted">{tab === "review" ? "No hay anuncios pendientes." : "Nada por aquí."}</p>
        </section>
      ) : null}
      {shown.length > 0 ? (
        <div className="stack gap-12">
          {shown.map((item) => (
            <QueueCard key={item.listing.id} item={item} />
          ))}
        </div>
      ) : null}
      <p className="xs muted queue-foot">Las más antiguas primero. El propietario recibe la decisión por WhatsApp y la ve en Mis casas.</p>
    </>
  );
}

function QueueCard({ item: { listing: l, ownerName } }: { item: QueueItem }) {
  const cover = l.photos[0];
  const when = l.status === "review" ? l.updatedAt : (l.reviewedAt ?? l.updatedAt);
  const badge = l.status === "review" ? queueBadge(l) : STATUS_LABELS[l.status].label;
  const badgeClass = l.status === "review" ? (l.reviewedAt ? "badge-ok" : "badge-review") : STATUS_LABELS[l.status].badge;
  const facts = [l.zone, l.capacity ? `${l.capacity} personas` : null, `${l.photos.length} fotos`, priceText(l)].filter(Boolean).join(" · ");
  return (
    <Link to="/admin/anuncios/$id" params={{ id: l.id }} className="card row gap-12 queue-card">
      {cover ? <img src={variantUrl(cover, 480)} alt="" className="thumb" width={92} height={92} loading="lazy" decoding="async" /> : <span className="thumb" />}
      <span className="stack gap-4 grow-col">
        <span className="row between gap-8">
          <span className="xs muted num">
            {l.publicId} · {relativeDate(when, Date.now())}
          </span>
          <span className={`badge badge-tight ${badgeClass}`}>{badge}</span>
        </span>
        <b className="display queue-title">{titleOf(l)}</b>
        <span className="small muted">{ownerName} · WhatsApp verificado</span>
        <span className="small muted">{facts}</span>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}

/** Una edición en revisión: la casa aprobada y lo que cambia. */
function EditQueueCard({ item: { listing: l, ownerName } }: { item: QueueItem }) {
  const cover = l.photos[0];
  const e = l.edit!;
  return (
    <Link to="/admin/ediciones/$id" params={{ id: l.id }} className="card row gap-12 queue-card">
      {cover ? <img src={variantUrl(cover, 480)} alt="" className="thumb" width={92} height={92} loading="lazy" decoding="async" /> : <span className="thumb" />}
      <span className="stack gap-4 grow-col">
        <span className="xs muted num">
          {l.publicId}
          {e.submittedAt ? ` · ${relativeDate(e.submittedAt, Date.now())}` : ""}
        </span>
        <b className="display queue-title">{titleOf(l)}</b>
        <span className="small muted">{ownerName}</span>
        <span className="small">Edición: {editSummary(e)}</span>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}

// ---------- 23 · Casas ----------
const casasRoute = getRouteApi("/_tabs/_admin/admin/casas");

export function CasasAdminScreen() {
  const { ver } = casasRoute.useSearch();
  const chip: HouseChip = ver ?? "todas";
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const houses = useQuery({ ...adminHousesQuery(userId), enabled: !!userId && isAdmin !== false });
  const [query, setQuery] = useState("");

  if (isAdmin === false) {
    return (
      <>
        <RootHeader title="Casas" home="/explorar" />
        <NotAdmin />
      </>
    );
  }
  if (houses.error && toDomainError(houses.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: "/admin/casas" }} replace />;

  const data = houses.data;
  const counts = data ? countHouses(data.houses) : null;
  const shown = data ? filterHouses(data.houses, chip, query) : [];
  return (
    <>
      <RootHeader title="Casas" home="/admin" action={<AdminBadge />} />
      <label className="search-field">
        <I.search size={18} />
        <input
          type="search"
          name="q"
          aria-label="Buscar casas"
          placeholder="Nombre, CT-#### o propietario"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </label>
      <nav className="chiprow" aria-label="Filtrar casas">
        {HOUSE_CHIPS.map((c) => (
          <Link key={c} to="/admin/casas" search={c === "todas" ? {} : { ver: c }} className="chip chip-sm" activeOptions={{ exact: true, includeSearch: true }}>
            {counts ? `${CHIP_LABELS[c]} · ${counts[c]}` : CHIP_LABELS[c]}
          </Link>
        ))}
      </nav>
      {houses.isError && !data ? (
        <p className="note" role="alert">
          {message(houses.error)}
        </p>
      ) : null}
      {!data && !houses.isError ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando las casas">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {data && shown.length === 0 ? (
        <section className="card">
          <p className="muted">{query.trim() ? "Ninguna casa coincide con la búsqueda." : chip === "todas" ? "Todavía no hay casas aprobadas." : "Nada por aquí."}</p>
        </section>
      ) : null}
      {data && shown.length > 0 ? (
        <section className="list" aria-label="Casas">
          {shown.map((h) => (
            <HouseRow key={h.listingId} house={h} today={data.today} />
          ))}
        </section>
      ) : null}
      <p className="xs muted queue-foot">Toque una casa activa para ver su ficha; las demás abren su revisión.</p>
    </>
  );
}

function HouseRow({ house: h, today }: { house: AdminHouse; today: string }) {
  const badge = HOUSE_BADGES[h.status];
  const body = (
    <>
      {h.cover ? <img src={variantUrl(h.cover, 480)} alt="" className="thumb house-thumb" width={56} height={56} loading="lazy" decoding="async" /> : <span className="thumb house-thumb" />}
      <span className="body stack house-body">
        <b className="house-title">{h.title || "Sin nombre"}</b>
        <small className="num">{[h.publicId, h.ownerName, h.zone].filter(Boolean).join(" · ")}</small>
        <small className="num">{adminHouseLine(h.subscription, today)}</small>
      </span>
      <span className={`badge badge-tight ${badge.badge}`}>{badge.label}</span>
    </>
  );
  return h.status === "active" ? (
    <Link to="/casa/$publicId" params={{ publicId: h.publicId }} className="list-item house-row">
      {body}
    </Link>
  ) : (
    <Link to="/admin/anuncios/$id" params={{ id: h.listingId }} className="list-item house-row">
      {body}
    </Link>
  );
}

// ---------- 22 · Revisar anuncio ----------
const revisarRoute = getRouteApi("/_flow/_adminFlow/admin/anuncios/$id");

export function RevisarScreen() {
  const { id } = revisarRoute.useParams();
  const userId = useUserId();
  const client = useQueryClient();
  const isAdmin = useIsAdmin();
  const item = useQuery({ ...adminListingQuery(userId, id, client), enabled: !!userId && isAdmin !== false });

  if (isAdmin === false) {
    return (
      <>
        <FlowHeader title="Revisar anuncio" back="/explorar" />
        <NotAdmin />
      </>
    );
  }
  if (item.error && toDomainError(item.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: `/admin/anuncios/${id}` }} replace />;
  const data = item.data;
  return (
    <>
      <FlowHeader
        title="Revisar anuncio"
        back="/admin"
        action={
          data?.listing.status === "active" ? (
            <Link to="/casa/$publicId" params={{ publicId: data.listing.publicId }} className="link header-action">
              Ver como cliente
            </Link>
          ) : undefined
        }
      />
      {item.isError && !data ? (
        <p className="note" role="alert">
          {message(item.error)}
        </p>
      ) : null}
      {data === null ? (
        <section className="card">
          <p className="muted">No encontramos ese anuncio.</p>
        </section>
      ) : null}
      {data === undefined && !item.isError ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando el anuncio">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {data ? <ReviewDetail item={data} userId={userId} /> : null}
    </>
  );
}

const bathText = (l: Pick<Listing, "kind" | "bathroomShared">) =>
  l.kind === "habitacion" && l.bathroomShared !== null ? (l.bathroomShared ? "baño compartido" : "baño privado") : null;

/** «Alojamiento completo · Cahuita · Talamanca, Limón · 2 personas · 1 hab · 1 baño»; sin el tipo o la zona si cambian. */
function factsLine(l: Listing, skip: { kind?: boolean; location?: boolean } = {}): string {
  return [
    l.acceptsMonthly ? MONTHLY_LABEL : null,
    !skip.kind && l.kind ? KIND_LABELS[l.kind] : null,
    skip.kind ? null : bathText(l),
    skip.location ? null : locationLine(l),
    l.capacity ? `${l.capacity} personas` : null,
    l.bedrooms !== null ? `${l.bedrooms} hab` : null,
    l.bathrooms ? `${l.bathrooms} ${l.bathrooms === 1 ? "baño" : "baños"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PriceLine({ l }: { l: Listing }) {
  const d = describe(l, { base: "" });
  return d.mainPrice ? (
    <span className="num strong">
      {formatCRC(d.mainPrice.amount)}{" "}
      <span className="muted">
        / {d.mainPrice.unit}
      </span>
      {d.monthly ? <span className="muted"> · {isNegotiable(d.monthly) ? "mensual a negociar" : `mensual ${formatCRC(d.monthly.amount)}`}</span> : null}
    </span>
  ) : (
    <span className="small muted">Sin precio</span>
  );
}

function FeatureBadges({ l }: { l: Listing }) {
  return (
    <div className="row wrap gap-6">
      {l.features.map((f) => (
        <span key={f} className="badge">
          {f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratuito"}` : FEATURE_LABEL[f]}
        </span>
      ))}
      {l.features.length === 0 ? <span className="xs muted">Sin características marcadas</span> : null}
    </div>
  );
}

function OwnerCard({ l, ownerName }: { l: Listing; ownerName: string }) {
  return (
    <section className="card row gap-12 review-owner">
      <span className="avatar avatar-sm" aria-hidden="true">
        {initials(ownerName)}
      </span>
      <span className="stack gap-0 grow-col">
        <b className="small">{ownerName}</b>
        <span className="xs primary strong">
          WhatsApp verificado · <span className="num">{formatPhone(l.whatsappPhone)}</span>
        </span>
      </span>
    </section>
  );
}

function ReviewDetail({ item, userId }: { item: QueueItem; userId: string }) {
  const { listing: l, ownerName } = item;
  const facts = factsLine(l);
  return (
    <>
      <div className="photo-strip" aria-label={`${l.photos.length} fotos`}>
        {l.photos.map((p, i) => (
          <div key={p.id} className={`photo ${i === 0 ? "review-photo" : "review-photo-sm"}`}>
            <img src={variantUrl(p, 480)} alt={`Foto ${i + 1}`} loading={i < 3 ? "eager" : "lazy"} decoding="async" />
            {i === 0 ? <span className="pill pill-sm pill-br">{l.photos.length} fotos</span> : null}
          </div>
        ))}
        {l.photos.length === 0 ? (
          <div className="photo review-photo">
            <span className="small">Sin fotos</span>
          </div>
        ) : null}
      </div>
      <div className="stack gap-4">
        <div className="row between gap-8">
          <h2>{titleOf(l)}</h2>
          <span className="xs muted num">{l.publicId}</span>
        </div>
        <span className="small muted">{facts}</span>
        {isProposedZone(l) ? <span className="badge badge-mute">Zona propuesta por el dueño</span> : null}
        <PriceLine l={l} />
      </div>
      <OwnerCard l={l} ownerName={ownerName} />
      <section className="card stack gap-8 review-owner">
        <b className="small muted">Descripción</b>
        {l.description.trim() ? <p className="small listing-description">{l.description}</p> : <p className="small muted">Sin descripción</p>}
        <FeatureBadges l={l} />
      </section>
      {l.status === "review" ? (
        <ReviewForm item={item} userId={userId} />
      ) : (
        <div className="note stack gap-4" role="status">
          <b>{STATUS_LABELS[l.status].label}</b>
          <span className="listing-description">{l.reviewNote || "Sin nota adicional."}</span>
        </div>
      )}
    </>
  );
}

function ReviewForm({ item, userId }: { item: QueueItem; userId: string }) {
  const navigate = useNavigate();
  const review = useReview(userId);
  const noPhotos = item.listing.photos.length < MIN_PHOTOS_TO_APPROVE;
  const [note, setNote] = useState(noPhotos ? NO_PHOTOS_NOTE : "");
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: ReviewDecision) {
    // La nota de las fotos va con «Pedir cambios»: para rechazar, el admin escribe su propio motivo.
    const refusal = reviewNoteRefusal(decision, decision === "reject" && note.trim() === NO_PHOTOS_NOTE ? "" : note);
    if (refusal) return setError(refusal);
    setError(null);
    review.mutate({ item, decision, note });
    await navigate({ to: "/admin" });
  }
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void decide("approve");
  };

  return (
    <form className="stack gap-14" onSubmit={onSubmit} noValidate>
      <Checklist />
      <NoteField note={note} onChange={setNote} hint="(obligatorio si pide cambios o rechaza)" error={error} />
      {noPhotos ? <p className="note note-arena small">Sin fotos: solo puede pedir cambios.</p> : null}
      <div className="sticky-spacer review-spacer" aria-hidden="true" />
      <div className="sticky-actions review-actions">
        <button className="btn btn-primary btn-block" type="submit" disabled={noPhotos || review.isPending}>
          <I.check size={18} /> Aprobar y publicar
        </button>
        <div className="row gap-8">
          <button className="btn btn-ghost grow" type="button" disabled={review.isPending} onClick={() => void decide("changes")}>
            Pedir cambios
          </button>
          <button className="btn btn-outline-bad grow" type="button" disabled={review.isPending} onClick={() => void decide("reject")}>
            Rechazar
          </button>
        </div>
      </div>
    </form>
  );
}

function Checklist() {
  return (
    <section className="card-soft stack gap-8">
      <b className="small">Antes de decidir</b>
      <label className="check">
        <input type="checkbox" name="check-photos" /> Las fotos son de la casa y sin teléfonos ni logos
      </label>
      <label className="check">
        <input type="checkbox" name="check-text" /> La descripción no tiene enlaces ni publicidad
      </label>
      <label className="check">
        <input type="checkbox" name="check-price" /> Zona y precio coherentes
      </label>
    </section>
  );
}

function NoteField({ note, onChange, hint, error }: { note: string; onChange: (v: string) => void; hint: string; error: string | null }) {
  return (
    <>
      <div className="field">
        <label htmlFor="admin-review-note">
          Mensaje para el propietario <span className="label-plain">{hint}</span>
        </label>
        <textarea
          id="admin-review-note"
          name="note"
          rows={3}
          maxLength={REVIEW_NOTE_MAX}
          placeholder="Ej.: la foto 4 muestra un número de teléfono; súbala sin él."
          value={note}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

// ---------- Revisar edición (spec .scratch/editar-casa §4) ----------
const revisarEdicionRoute = getRouteApi("/_flow/_adminFlow/admin/ediciones/$id");

export function RevisarEdicionScreen() {
  const { id } = revisarEdicionRoute.useParams();
  const userId = useUserId();
  const client = useQueryClient();
  const isAdmin = useIsAdmin();
  const item = useQuery({ ...adminEditQuery(userId, id, client), enabled: !!userId && isAdmin !== false });

  if (isAdmin === false) {
    return (
      <>
        <FlowHeader title="Revisar edición" back="/explorar" />
        <NotAdmin />
      </>
    );
  }
  if (item.error && toDomainError(item.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: `/admin/ediciones/${id}` }} replace />;
  const data = item.data;
  const edit = data?.listing.edit;
  return (
    <>
      <FlowHeader title="Revisar edición" back="/admin" />
      {item.isError && !data ? (
        <p className="note" role="alert">
          {message(item.error)}
        </p>
      ) : null}
      {data === null ? (
        <section className="card">
          <p className="muted">No encontramos esa edición.</p>
        </section>
      ) : null}
      {data === undefined && !item.isError ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando la edición">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {data && edit ? (
        <>
          <div className="stack gap-4">
            <div className="row between gap-8">
              <h2>{titleOf(data.listing)}</h2>
              <span className="xs muted num">{data.listing.publicId}</span>
            </div>
            <span className="small muted">Edición: {editSummary(edit)}</span>
          </div>
          {/* Revisión dato a dato (revisión UX 2026-10-29, A5): cada bloque lleva su decisión. */}
          {edit.status === "review" ? <Checklist /> : null}
          <EditDiff item={data} userId={userId} />
          {edit.status === "changes" ? (
            <p className="note" role="status">
              Lo pendiente tiene cambios pedidos: espera al propietario.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function DiffBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card stack gap-8" aria-label={title}>
      <b className="small muted">{title}</b>
      {children}
    </section>
  );
}

function SideBySide({ before, after }: { before: string; after: string }) {
  return (
    <div className="diff-cols">
      <p className="diff-col diff-before">
        <b className="xs muted">Antes</b> <span>{before}</span>
      </p>
      <p className="diff-col">
        <b className="xs primary">Ahora</b> <span>{after}</span>
      </p>
    </div>
  );
}

const kindText = (l: Pick<Listing, "kind" | "bathroomShared">) => [l.kind ? KIND_LABELS[l.kind] : "Sin tipo", bathText(l)].filter(Boolean).join(" · ");

/** Lo que cambia la edición, dato por dato («Antes» / «Ahora») y con su decisión, y lo demás plegado. */
function EditDiff({ item, userId }: { item: QueueItem; userId: string }) {
  const { listing: l, ownerName } = item;
  const e: ListingEdit = l.edit!;
  const fields = Object.keys(e.fields) as ReviewedField[];
  // Lo nuevo encima de lo aprobado (como mergeEdit, sin traer las reglas del formulario a la zona del admin).
  const kind = e.kind ?? l.kind;
  const after = { kind, bathroomShared: kind === "habitacion" ? (e.bathroomShared ?? l.bathroomShared) : null };
  const has = (f: (typeof fields)[number]) => fields.includes(f);
  return (
    <>
      {has("nombre") ? (
        <DiffBlock title="Nombre">
          <SideBySide before={titleOf(l)} after={e.title ?? ""} />
          <Decide item={item} target={{ field: "nombre" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {has("tipo") ? (
        <DiffBlock title="Tipo">
          <SideBySide before={kindText(l)} after={kindText(after)} />
          <Decide item={item} target={{ field: "tipo" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {has("ubicacion") && e.location ? (
        <DiffBlock title="Ubicación">
          <TwoPointsMap
            before={l.lat === null || l.lng === null ? null : { lat: l.lat, lng: l.lng, label: l.zone }}
            beforeZone={l.zone}
            after={{ lat: e.location.lat, lng: e.location.lng, label: e.location.zone }}
          />
          <Decide item={item} target={{ field: "ubicacion" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {has("descripcion") ? (
        <DiffBlock title="Descripción">
          <p className="small listing-description">{e.description || "Sin descripción."}</p>
          <details className="diff-old">
            <summary className="link small">Antes</summary>
            <p className="small muted listing-description">{l.description || "Sin descripción."}</p>
          </details>
          <Decide item={item} target={{ field: "descripcion" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {e.photos.length ? (
        <DiffBlock title="Fotos nuevas">
          <div className="stack gap-12">
            {e.photos.map((p, i) => (
              <section key={p.id} className="row gap-12 diff-photo" aria-label={`Foto nueva ${i + 1}`}>
                <img src={variantUrl(p, 480)} alt={`Foto nueva ${i + 1}`} width={110} height={110} loading="lazy" decoding="async" />
                <Decide item={item} target={{ photoId: p.id }} userId={userId} />
              </section>
            ))}
          </div>
        </DiffBlock>
      ) : null}
      <details className="card stack gap-8 diff-fold">
        <summary className="small strong">Lo que no cambia</summary>
        {has("nombre") ? null : <b>{titleOf(l)}</b>}
        <span className="small muted">{factsLine(l, { kind: has("tipo"), location: has("ubicacion") })}</span>
        <PriceLine l={l} />
        {has("descripcion") ? null : <p className="small listing-description">{l.description}</p>}
        <FeatureBadges l={l} />
        <span className="small muted">{l.photos.length === 1 ? "1 foto aprobada" : `${l.photos.length} fotos aprobadas`}</span>
        <OwnerCard l={l} ownerName={ownerName} />
      </details>
    </>
  );
}

type MapPoint = { lat: number; lng: number; label: string };

/** Caja de tamaño fijo; Leaflet llega bajo demanda. Sin red, la caja arena con las dos zonas. */
function TwoPointsMap({ before, beforeZone, after }: { before: MapPoint | null; beforeZone: string; after: MapPoint }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;
    if (!before) return;
    import("../edit-map-leaflet").then(
      ({ drawTwoPoints }) => {
        if (!cancelled && box.current) dispose = drawTwoPoints(box.current, before, after);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [before?.lat, before?.lng, before?.label, after.lat, after.lng, after.label]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = `Mapa con la ubicación de antes (${beforeZone}) y la de ahora (${after.label})`;
  return failed || !before ? (
    <div className="map-box map-box-listing card-arena small" role="img" aria-label={label}>
      Antes: {beforeZone || "sin ubicación"} · Ahora: {after.label}
    </div>
  ) : (
    <div ref={box} className="map-box map-box-listing" role="img" aria-label={label} data-testid="edit-map" />
  );
}

/** La decisión de un dato o una foto: en revisión, la nota y «Aprobar» / «Pedir cambios»; con cambios pedidos, su nota. */
function Decide({ item, target, userId }: { item: QueueItem; target: EditTarget; userId: string }) {
  const navigate = useNavigate();
  const review = useReviewEdit(userId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const e = item.listing.edit;
  const state = "field" in target ? e?.fields[target.field] : e?.photos.find((p) => p.id === target.photoId);
  if (!state) return null;
  if (state.status === "changes")
    return (
      <p className="small note-review" role="status">
        Cambios pedidos: {state.reviewNote || "sin nota adicional."}
      </p>
    );
  function decide(decision: EditDecision) {
    const refusal = editNoteRefusal(decision, note);
    if (refusal) return setError(refusal);
    setError(null);
    const input = { item, target, decision, note };
    // Lo último en revisión de la casa: de vuelta a la cola, como con la decisión de una casa nueva (allí se ve el resultado).
    if (lastInReview(input)) {
      review.mutate(input);
      void navigate({ to: "/admin" });
    } else review.mutate(input, { onError: (err) => setError(toDomainError(err).message) });
  }
  return (
    <div className="stack gap-8 decide">
      <textarea
        aria-label="Mensaje para el propietario (obligatorio si pide cambios)"
        name="note"
        rows={2}
        maxLength={REVIEW_NOTE_MAX}
        placeholder="Mensaje para el propietario si pide cambios"
        value={note}
        onChange={(ev) => setNote(ev.currentTarget.value)}
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row gap-8">
        <button type="button" className="btn btn-primary btn-sm" disabled={review.isPending} onClick={() => decide("approve")}>
          <I.check size={16} /> Aprobar
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={review.isPending} onClick={() => decide("changes")}>
          Pedir cambios
        </button>
      </div>
    </div>
  );
}

// ---------- Segundo código ----------
const codigoRoute = getRouteApi("/_flow/_privateFlow/admin/codigo");

export function SegundoCodigoScreen() {
  const { next } = codigoRoute.useSearch();
  const { session } = useSession();
  const isAdmin = useIsAdmin();
  const target = next ?? "/admin";
  if (session?.aal === "aal2") return <Navigate to={target as "/admin"} replace />;
  return (
    <>
      <FlowHeader title="Segundo código" back="/cuenta" historyBack />
      {isAdmin === false ? <NotAdmin /> : null}
      {isAdmin === null ? (
        <section className="card skeleton account-skeleton" aria-busy="true" aria-label="Cargando su cuenta">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {isAdmin && session ? <SecondCodeForm userId={session.userId} next={target} /> : null}
    </>
  );
}

/** La clave en grupos de 4, para copiarla a mano en la app si no se puede escanear el QR. */
const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

function SecondCodeForm({ userId, next }: { userId: string; next: string }) {
  const navigate = useNavigate();
  const [factor, setFactor] = useState<MfaFactor | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSecondFactor(userId)
      .then((f) => alive && setFactor(f))
      .catch((e: unknown) => alive && setError(message(e)));
    return () => {
      alive = false;
    };
  }, [userId]);

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== 6) return setError("El código tiene 6 dígitos.");
    setBusy(true);
    setError(null);
    try {
      await verifySecondCode(userId, code);
      await navigate({ to: next as "/admin", replace: true });
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  const enrol = factor && !factor.verified ? factor : null;
  return (
    <div className="stack flow">
      <div className="stack gap-8">
        <span className="avatar avatar-ok" aria-hidden="true">
          <I.shield size={26} />
        </span>
        <h2 className="flow-title">{enrol ? "Vincule su app de autenticación" : "Confirme que es usted"}</h2>
        {enrol ? (
          <p className="muted">
            Para revisar anuncios le pedimos un segundo código. Escanee este código QR con su app de autenticación (Google Authenticator, 1Password u otra) y
            escriba abajo el código de 6 dígitos que le muestre.
          </p>
        ) : (
          <p className="muted">Abra su app de autenticación y escriba el código de 6 dígitos de bnbtico.</p>
        )}
      </div>
      {enrol ? (
        <div className="totp-enrol stack gap-8">
          <img className="totp-qr" src={enrol.qrCode} alt="Código QR para su app de autenticación" width={184} height={184} />
          <p className="small muted">¿No puede escanearlo? Escriba esta clave en la app:</p>
          <code className="totp-secret num" aria-label="Clave para la app de autenticación">
            {groupSecret(enrol.secret)}
          </code>
        </div>
      ) : null}
      <form onSubmit={verify} className="stack gap-18" noValidate>
        <div className="field code-field">
          <label htmlFor="admin-code">Código de 6 dígitos</label>
          <div className="code-boxes" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < code.length ? "filled" : i === code.length ? "active" : ""}>
                {code[i] ?? ""}
              </span>
            ))}
          </div>
          <input
            id="admin-code"
            className="code-input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={busy || factor === null}>
          {busy ? "Verificando…" : factor === null && !error ? "Preparando…" : "Verificar y entrar"}
        </button>
      </form>
    </div>
  );
}
