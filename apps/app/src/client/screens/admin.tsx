// Zona del admin (pantallas 21 y 22 del diseño v1): cola de anuncios y revisión de una casa, más el segundo código que la
// abre. Se descarga al entrar (no está en el JS inicial). Las rutas exigen sesión aal2 (solo UX): quien manda es la base.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { resendWaitSeconds } from "../../domain/account";
import { relativeDate } from "../../domain/dates";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { FEATURE_LABEL, KIND_LABELS, MIN_PHOTOS, STATUS_LABELS, modesLabel, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { formatPhone } from "../../domain/phone";
import { REVIEW_NOTE_MAX, queueBadge, reviewNoteRefusal, type QueueItem, type ReviewDecision } from "../../domain/review";
import { I } from "../../shared/icons";
import { accountQuery } from "../account";
import { adminListingQuery, adminQueueQuery, clearReviewOutcome, sendSecondCode, useReview, useReviewOutcome, verifySecondCode } from "../admin";
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
  const outcome = useReviewOutcome();
  const q = queue.data;

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
        <div className="tile tile-sun">
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
        <p className={outcome.kind === "failed" ? "note note-sun small" : "note small"} role={outcome.kind === "failed" ? "alert" : "status"}>
          {outcome.kind === "failed" ? `No se guardó la decisión sobre «${outcome.title}»: ${outcome.text}` : `«${outcome.title}»: ${outcome.text}`}
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

function ReviewDetail({ item, userId }: { item: QueueItem; userId: string }) {
  const { listing: l, ownerName } = item;
  const d = describe(l, { base: "" });
  const facts = [
    modesLabel(l),
    l.kind ? KIND_LABELS[l.kind] : null,
    l.kind === "habitacion" && l.bathroomShared !== null ? (l.bathroomShared ? "baño compartido" : "baño privado") : null,
    [l.zone, l.canton].filter(Boolean).join(", "),
    l.capacity ? `${l.capacity} personas` : null,
    l.bedrooms !== null ? `${l.bedrooms} hab` : null,
    l.bathrooms ? `${l.bathrooms} ${l.bathrooms === 1 ? "baño" : "baños"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const stay = l.acceptsNightly && l.minNights ? ` · mín. ${l.minNights} ${l.minNights === 1 ? "noche" : "noches"}` : "";
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
        {d.mainPrice ? (
          <span className="num strong">
            {formatCRC(d.mainPrice.amount)}{" "}
            <span className="muted">
              / {d.mainPrice.unit}
              {stay}
            </span>
            {d.secondaryPrice ? <span className="muted"> · mensual {formatCRC(d.secondaryPrice.amount)}</span> : null}
          </span>
        ) : (
          <span className="small muted">Sin precio</span>
        )}
      </div>
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
      <section className="card stack gap-8 review-owner">
        <b className="small muted">Descripción</b>
        <p className="small listing-description">{l.description}</p>
        <div className="row wrap gap-6">
          {l.features.map((f) => (
            <span key={f} className="badge">
              {f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratuito"}` : FEATURE_LABEL[f]}
            </span>
          ))}
          {l.features.length === 0 ? <span className="xs muted">Sin características marcadas</span> : null}
        </div>
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
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const photos = item.listing.photos.length;

  async function decide(decision: ReviewDecision) {
    const refusal = reviewNoteRefusal(decision, note);
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
      <div className="field">
        <label htmlFor="admin-review-note">
          Mensaje para el propietario <span className="label-plain">(obligatorio si pide cambios o rechaza)</span>
        </label>
        <textarea
          id="admin-review-note"
          name="note"
          rows={3}
          maxLength={REVIEW_NOTE_MAX}
          placeholder="Ej.: la foto 4 muestra un número de teléfono; súbala sin él."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {photos < MIN_PHOTOS ? <p className="note note-sun small">Faltan fotos: se requieren al menos {MIN_PHOTOS} para aprobar.</p> : null}
      <div className="sticky-spacer review-spacer" aria-hidden="true" />
      <div className="sticky-actions review-actions">
        <button className="btn btn-primary btn-block" type="submit" disabled={photos < MIN_PHOTOS}>
          <I.check size={18} /> Aprobar y publicar
        </button>
        <div className="row gap-8">
          <button className="btn btn-ghost grow" type="button" onClick={() => void decide("changes")}>
            Pedir cambios
          </button>
          <button className="btn btn-outline-bad grow" type="button" onClick={() => void decide("reject")}>
            Rechazar
          </button>
        </div>
      </div>
    </form>
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
      <FlowHeader title="Segundo código" back="/cuenta" />
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

function SecondCodeForm({ userId, next }: { userId: string; next: string }) {
  const navigate = useNavigate();
  const account = useQuery(accountQuery(userId));
  const [code, setCode] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wait = sentAt ? resendWaitSeconds(sentAt, now) : 0;

  useEffect(() => {
    let alive = true;
    sendSecondCode(userId)
      .then((c) => alive && setSentAt(c.sentAt))
      .catch((e: unknown) => alive && setError(message(e)));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [wait, now]);

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== 6) return setError("El código tiene 6 dígitos.");
    setBusy(true);
    setError(null);
    try {
      await verifySecondCode(code);
      await navigate({ to: next as "/admin", replace: true });
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  async function resend() {
    setNotice(null);
    setError(null);
    try {
      const c = await sendSecondCode(userId, true);
      setSentAt(c.sentAt);
      setNow(Date.now());
      setNotice("Le enviamos otro código por WhatsApp.");
    } catch (err) {
      setError(message(err));
    }
  }

  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;
  return (
    <div className="stack flow">
      <div className="stack gap-8">
        <span className="avatar avatar-ok" aria-hidden="true">
          <I.shield size={26} />
        </span>
        <h2 className="flow-title">Confirme que es usted</h2>
        <p className="muted">
          Para revisar anuncios le pedimos un segundo código. Se lo enviamos por WhatsApp
          {account.data ? (
            <>
              {" "}
              al <b className="ink num">{formatPhone(account.data.phone)}</b>
            </>
          ) : null}
          .
        </p>
      </div>
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
        <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={busy || sentAt === null}>
          {busy ? "Verificando…" : sentAt === null && !error ? "Enviando el código…" : "Verificar y entrar"}
        </button>
      </form>
      <div className="stack small">
        {sentAt !== null && wait > 0 ? (
          <span className="muted">
            ¿No llegó? Puede pedir otro en <b className="ink num">{mmss}</b>.
          </span>
        ) : sentAt !== null || error ? (
          <button type="button" className="btn-link" onClick={resend}>
            Pedir otro código
          </button>
        ) : null}
        {notice ? (
          <p className="small" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
