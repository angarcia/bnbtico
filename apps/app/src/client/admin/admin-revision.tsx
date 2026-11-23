import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { MIN_PHOTOS_TO_APPROVE, isProposedZone, type Listing } from "../../domain/listing";
import { statusLabel } from "../../domain/status-label";
import { decidedNoticeKind, firstName, ownerNoticeUrl, type OwnerNoticeInput } from "../../domain/owner-notice";
import { NO_PHOTOS_NOTE, REVIEW_NOTE_MAX, reviewNoteRefusal, type QueueItem, type ReviewDecision } from "../../domain/review";
import { I } from "../../shared/ui/icons";
import { adminListingQuery, useReview } from "./admin-queries";
import { ScreenHeader } from "../comun/screen-header";
import { Checklist, FeatureBadges, OwnerCard, PriceLine, factsLine } from "./admin-review-details";
import { NotAdmin, NoticeLink, message, titleOf, useIsAdmin, useUserId } from "./admin-shared";
import { Field, StickyActions, TextArea } from "../../shared/ui/field";
import { Button } from "../../shared/ui/button";
import { EmptyState, LoadError, Notice, Skeleton, StatusTag } from "../../shared/ui/structure";
import { Card } from "../../shared/ui/card";

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
        <ScreenHeader kind="flow" title="Revisar anuncio" back={{ to: "/explorar" }} />
        <NotAdmin />
      </>
    );
  }
  if (item.error && toDomainError(item.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: `/admin/anuncios/${id}` }} replace />;
  const data = item.data;
  return (
    <>
      <ScreenHeader kind="flow" title="Revisar anuncio" back={{ to: "/admin" }} action={
          data?.listing.status === "active" ? (
            <Link to="/casa/$publicId" params={{ publicId: data.listing.publicId }} className="link header-action">
              Ver como cliente
            </Link>
          ) : data ? (
            <Link to="/admin/casas/$id" params={{ id }} className="link header-action">
              Editar
            </Link>
          ) : undefined
        } />
      {item.isError && !data ? (
        <LoadError onRetry={() => void item.refetch()}>
          {message(item.error)}
        </LoadError>
      ) : null}
      {data === null ? (
        <EmptyState text={<p className="muted">No encontramos ese anuncio.</p>} />
      ) : null}
      {data === undefined && !item.isError ? (
        <Skeleton shape="line" label="Cargando el anuncio" />
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
        {isProposedZone(l) ? <StatusTag label={{ text: "Zona propuesta por el anfitrión", tone: "off" }} /> : null}
        <PriceLine l={l} />
      </div>
      <OwnerCard l={l} ownerName={ownerName} />
      {l.status !== "review" && decidedNoticeKind(l.status) ? (
        <NoticeLink
          name={firstName(ownerName)}
          href={ownerNoticeUrl(l.whatsappPhone, noticeInput(l, ownerName, decidedNoticeKind(l.status)!))}
        />
      ) : null}
      <Card layout="stack" gap={8} placement="review-owner">
        <b className="small muted">Descripción</b>
        {l.description.trim() ? <p className="small listing-description">{l.description}</p> : <p className="small muted">Sin descripción</p>}
        <FeatureBadges l={l} />
      </Card>
      {l.status === "review" ? (
        <ReviewForm item={item} userId={userId} />
      ) : (
        <Notice as="div" layout="stack" announce>
          <b>{statusLabel(l.status).text}</b>
          <span className="listing-description">{l.reviewNote || "Sin nota adicional."}</span>
        </Notice>
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
      <Checklist />
      <NoteField note={note} onChange={setNote} hint="(obligatorio si pide cambios)" error={error} />
      {noPhotos ? <Notice tone="solid" small>Sin fotos: solo puede pedir cambios.</Notice> : null}
      <StickyActions spacer="review" layout="column">
        <Button variant="primary" size="lg" block type="submit" icon={<I.check size={18} />} disabled={noPhotos || review.isPending}>
          Aprobar y publicar
        </Button>
        {/* Sin «Rechazar» (historia 27): un anuncio que no debe publicarse se elimina desde Admin → Casas. */}
        <Button variant="secondary" size="lg" block disabled={review.isPending} onClick={() => void decide("changes")}>
          Pedir cambios
        </Button>
      </StickyActions>
    </form>
  );
}

function NoteField({ note, onChange, hint, error }: { note: string; onChange: (v: string) => void; hint: string; error: string | null }) {
  return (
    <>
      <Field id="admin-review-note" label={<>Mensaje para el anfitrión <span className="label-plain">{hint}</span></>} error={error}>
        {(control) => (
          <TextArea
            {...control}
            name="note"
            rows={3}
            maxLength={REVIEW_NOTE_MAX}
            placeholder="Ej.: la foto 4 muestra un número de teléfono; súbala sin él."
            value={note}
            onChange={(e) => onChange(e.currentTarget.value)}
          />
        )}
      </Field>
    </>
  );
}
