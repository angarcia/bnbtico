import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { MIN_PHOTOS_TO_APPROVE, STATUS_LABELS, isProposedZone, type Listing } from "../../domain/listing";
import { decidedNoticeKind, firstName, ownerNoticeUrl, type OwnerNoticeInput } from "../../domain/owner-notice";
import { NO_PHOTOS_NOTE, REVIEW_NOTE_MAX, reviewNoteRefusal, type QueueItem, type ReviewDecision } from "../../domain/review";
import { I } from "../../shared/icons";
import { adminListingQuery, useReview } from "../admin";
import { FlowHeader } from "../chrome";
import { Checklist, FeatureBadges, OwnerCard, PriceLine, factsLine } from "./admin-review-details";
import { NotAdmin, NoticeLink, message, titleOf, useIsAdmin, useUserId } from "./admin-shared";

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
          ) : data ? (
            <Link to="/admin/casas/$id" params={{ id }} className="link header-action">
              Editar
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

const noticeInput = (l: Listing, ownerName: string, kind: OwnerNoticeInput["kind"]): OwnerNoticeInput => ({
  kind,
  ownerName,
  title: l.title,
  publicId: l.publicId,
  origin: window.location.origin,
  note: l.reviewNote ?? "",
});

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
        {isProposedZone(l) ? <span className="badge badge-mute">Zona propuesta por el anfitrión</span> : null}
        <PriceLine l={l} />
      </div>
      <OwnerCard l={l} ownerName={ownerName} />
      {l.status !== "review" && decidedNoticeKind(l.status) ? (
        <NoticeLink
          name={firstName(ownerName)}
          href={ownerNoticeUrl(l.whatsappPhone, noticeInput(l, ownerName, decidedNoticeKind(l.status)!))}
        />
      ) : null}
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

function NoteField({ note, onChange, hint, error }: { note: string; onChange: (v: string) => void; hint: string; error: string | null }) {
  return (
    <>
      <div className="field">
        <label htmlFor="admin-review-note">
          Mensaje para el anfitrión <span className="label-plain">{hint}</span>
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
