import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { relativeDate } from "../../domain/dates";
import { describe } from "../../domain/describe";
import { editSummary } from "../../domain/edit-summary";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { type Listing } from "../../domain/listing";
import { statusLabel, type StatusLabel } from "../../domain/status-label";
import { formatCRC } from "../../domain/money";
import { queueBadge, type QueueItem } from "../../domain/review";
import { I } from "../../shared/ui/icons";
import { adminEditsQuery, adminQueueQuery, clearReviewOutcome, useEditsWithPending, useQueueWithPending, useReviewOutcome } from "./admin-queries";
import { ScreenHeader } from "../comun/screen-header";
import { AdminBadge, NotAdmin, NoticeLink, message, titleOf, useIsAdmin, useUserId } from "./admin-shared";
import { EmptyState, LoadError, Notice, Skeleton, StatusTag } from "../../shared/ui/structure";
import { RouterCardLink } from "../comun/router-rows";

function priceText(l: Listing): string | null {
  const p = describe(l, { base: "" }).mainPrice;
  return p ? formatCRC(p.amount) : null;
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
        <ScreenHeader kind="root" title="Anuncios" home="/explorar" />
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
      <ScreenHeader kind="root" title="Anuncios" home="/admin" action={<AdminBadge />} />
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
        <Notice tone={outcome.kind === "failed" ? "error" : "info"} small announce={outcome.kind !== "failed"}>
          {outcome.kind === "failed" ? `No se guardó la decisión sobre «${outcome.title}»: ${outcome.text}` : `«${outcome.title}»: ${outcome.text}`}
        </Notice>
      ) : null}
      {outcome?.notice ? <NoticeLink href={outcome.notice.href} name={outcome.notice.name} /> : null}
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
        <LoadError onRetry={() => void editsQuery.refetch()}>
          {message(editsQuery.error)}
        </LoadError>
      ) : null}
      {queue.isError && !q ? (
        <LoadError onRetry={() => void queue.refetch()}>
          {message(queue.error)}
        </LoadError>
      ) : null}
      {!q && !queue.isError ? (
        <Skeleton shape="row" label="Cargando la cola" />
      ) : null}
      {q && shown.length === 0 ? (
        <EmptyState text={<p className="muted">{tab === "review" ? "No hay anuncios pendientes." : "Nada por aquí."}</p>} />
      ) : null}
      {shown.length > 0 ? (
        <div className="stack gap-12">
          {shown.map((item) => (
            <QueueCard key={item.listing.id} item={item} />
          ))}
        </div>
      ) : null}
      <p className="xs muted queue-foot">Las más antiguas primero. El anfitrión ve la decisión en Mis casas; avísele por WhatsApp con el botón.</p>
    </>
  );
}

function QueueCard({ item: { listing: l, ownerName } }: { item: QueueItem }) {
  const cover = l.photos[0];
  const when = l.status === "review" ? l.updatedAt : (l.reviewedAt ?? l.updatedAt);
  const badge: StatusLabel = l.status === "review" ? { text: queueBadge(l), tone: l.reviewedAt ? "ok" : "review" } : statusLabel(l.status);
  const facts = [l.zone, l.capacity ? `${l.capacity} personas` : null, `${l.photos.length} fotos`, priceText(l)].filter(Boolean).join(" · ");
  return (
    <RouterCardLink to="/admin/anuncios/$id" params={{ id: l.id }} layout="row" gap={12} placement="queue-card">
      {cover ? <img src={variantUrl(cover, 480)} alt="" className="thumb" width={92} height={92} loading="lazy" decoding="async" /> : <span className="thumb" />}
      <span className="stack gap-4 grow-col">
        <span className="row between gap-8">
          <span className="xs muted num">
            {l.publicId} · {relativeDate(when, Date.now())}
          </span>
          <StatusTag label={badge} tight />
        </span>
        <b className="display queue-title">{titleOf(l)}</b>
        <span className="small muted">{ownerName} · WhatsApp verificado</span>
        <span className="small muted">{facts}</span>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </RouterCardLink>
  );
}

/** Una edición en revisión: la casa aprobada y lo que cambia. */
function EditQueueCard({ item: { listing: l, ownerName } }: { item: QueueItem }) {
  const cover = l.photos[0];
  const e = l.edit!;
  return (
    <RouterCardLink to="/admin/ediciones/$id" params={{ id: l.id }} layout="row" gap={12} placement="queue-card">
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
    </RouterCardLink>
  );
}
