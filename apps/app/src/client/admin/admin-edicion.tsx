import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ListingEdit } from "../../domain/edit";
import { editSummary, type ReviewedField } from "../../domain/edit-summary";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { KIND_LABELS, type Listing } from "../../domain/listing";
import { REVIEW_NOTE_MAX, editNoteRefusal, type EditDecision, type QueueItem } from "../../domain/review";
import { I } from "../../shared/ui/icons";
import { adminEditQuery, lastInReview, useReviewEdit, type EditTarget } from "./admin-queries";
import { ScreenHeader } from "../comun/screen-header";
import { Checklist, FeatureBadges, OwnerCard, PriceLine, bathText, factsLine } from "./admin-review-details";
import { NotAdmin, message, titleOf, useIsAdmin, useUserId } from "./admin-shared";
import { Field, TextArea } from "../../shared/ui/field";
import { Button } from "../../shared/ui/button";
import { EmptyState, LoadError, Notice, Skeleton } from "../../shared/ui/structure";
import { Card, cardClass } from "../../shared/ui/card";
import * as ADMIN_COPY from "./copy/admin";

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
        <ScreenHeader kind="flow" title={ADMIN_COPY.editTitle} back={{ to: "/explorar" }} />
        <NotAdmin />
      </>
    );
  }
  if (item.error && toDomainError(item.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: `/admin/ediciones/${id}` }} replace />;
  const data = item.data;
  const edit = data?.listing.edit;
  return (
    <>
      <ScreenHeader kind="flow" title={ADMIN_COPY.editTitle} back={{ to: "/admin" }} />
      {item.isError && !data ? (
        <LoadError onRetry={() => void item.refetch()}>
          {message(item.error)}
        </LoadError>
      ) : null}
      {data === null ? (
        <EmptyState text={<p className="muted">{ADMIN_COPY.editNotFound}</p>} />
      ) : null}
      {data === undefined && !item.isError ? (
        <Skeleton shape="line" label={ADMIN_COPY.loadingEdit} />
      ) : null}
      {data && edit ? (
        <>
          <div className="stack gap-4">
            <div className="row between gap-8">
              <h2>{titleOf(data.listing)}</h2>
              <span className="xs muted num">{data.listing.publicId}</span>
            </div>
            <span className="small muted">{ADMIN_COPY.editSummary({ summary: editSummary(edit) })}</span>
          </div>
          {/* Revisión dato a dato (revisión UX 2026-10-29, A5): cada bloque lleva su decisión. */}
          {edit.status === "review" ? <Checklist /> : null}
          <EditDiff item={data} userId={userId} />
          {edit.status === "changes" ? (
            <Notice announce>
              {ADMIN_COPY.waitingOwner}
            </Notice>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function DiffBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card layout="stack" gap={8} aria-label={title}>
      <b className="small muted">{title}</b>
      {children}
    </Card>
  );
}

function SideBySide({ before, after }: { before: string; after: string }) {
  return (
    <div className="diff-cols">
      <p className="diff-col diff-before">
        <b className="xs muted">{ADMIN_COPY.before}</b> <span>{before}</span>
      </p>
      <p className="diff-col">
        <b className="xs primary">{ADMIN_COPY.now}</b> <span>{after}</span>
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
        <DiffBlock title={ADMIN_COPY.name}>
          <SideBySide before={titleOf(l)} after={e.title ?? ""} />
          <Decide item={item} target={{ field: "nombre" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {has("tipo") ? (
        <DiffBlock title={ADMIN_COPY.kind}>
          <SideBySide before={kindText(l)} after={kindText(after)} />
          <Decide item={item} target={{ field: "tipo" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {has("ubicacion") && e.location ? (
        <DiffBlock title={ADMIN_COPY.location}>
          <TwoPointsMap
            before={l.lat === null || l.lng === null ? null : { lat: l.lat, lng: l.lng, label: l.zone }}
            beforeZone={l.zone}
            after={{ lat: e.location.lat, lng: e.location.lng, label: e.location.zone }}
          />
          <Decide item={item} target={{ field: "ubicacion" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {has("descripcion") ? (
        <DiffBlock title={ADMIN_COPY.description}>
          <p className="small listing-description">{e.description || ADMIN_COPY.noDescriptionDot}</p>
          <details className="diff-old">
            <summary className="link small">{ADMIN_COPY.before}</summary>
            <p className="small muted listing-description">{l.description || ADMIN_COPY.noDescriptionDot}</p>
          </details>
          <Decide item={item} target={{ field: "descripcion" }} userId={userId} />
        </DiffBlock>
      ) : null}
      {e.photos.length ? (
        <DiffBlock title={ADMIN_COPY.newPhotos}>
          <div className="stack gap-12">
            {e.photos.map((p, i) => (
              <section key={p.id} className="row gap-12 diff-photo" aria-label={ADMIN_COPY.newPhoto({ n: i + 1 })}>
                <img src={variantUrl(p, 480)} alt={ADMIN_COPY.newPhoto({ n: i + 1 })} width={110} height={110} loading="lazy" decoding="async" />
                <Decide item={item} target={{ photoId: p.id }} userId={userId} />
              </section>
            ))}
          </div>
        </DiffBlock>
      ) : null}
      <Card as="details" layout="stack" gap={8} placement="diff-fold">
        <summary className="small strong">{ADMIN_COPY.unchanged}</summary>
        {has("nombre") ? null : <b>{titleOf(l)}</b>}
        <span className="small muted">{factsLine(l, { kind: has("tipo"), location: has("ubicacion") })}</span>
        <PriceLine l={l} />
        {has("descripcion") ? null : <p className="small listing-description">{l.description}</p>}
        <FeatureBadges l={l} />
        <span className="small muted">{ADMIN_COPY.approvedPhotos({ count: l.photos.length })}</span>
        <OwnerCard l={l} ownerName={ownerName} />
      </Card>
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
    import("./edit-map-leaflet").then(
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
    <div className={`map-box map-box-listing ${cardClass({ tone: "solid" })} small`} role="img" aria-label={label}>
      {ADMIN_COPY.mapFallback({ before: beforeZone, after: after.label })}
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
  const noteId = useId();
  const [error, setError] = useState<string | null>(null);
  const e = item.listing.edit;
  const state = "field" in target ? e?.fields[target.field] : e?.photos.find((p) => p.id === target.photoId);
  if (!state) return null;
  if (state.status === "changes")
    return (
      <Notice tone="review" small inline announce>
        {ADMIN_COPY.changesAsked({ note: state.reviewNote ?? "" })}
      </Notice>
    );
  function decide(decision: EditDecision) {
    const refusal = editNoteRefusal(decision, note);
    if (refusal) return setError(refusal);
    setError(null);
    const input = { item, target, decision, note };
    // Lo último en revisión de la casa: de vuelta a la cola, como con la decisión de una casa nueva (allí se ve el resultado).
    // Primero a la cola y después la decisión: el detalle no se vuelve a pintar a medias con el cambio optimista.
    if (lastInReview(input)) void navigate({ to: "/admin" }).then(() => review.mutate(input));
    else review.mutate(input, { onError: (err) => setError(toDomainError(err).message) });
  }
  return (
    <div className="stack gap-8 decide">
      <Field id={noteId} label={ADMIN_COPY.decideNote} labelHidden size="compact" error={error}>
        {(control) => (
          <TextArea
            {...control}
            name="note"
            rows={2}
            maxLength={REVIEW_NOTE_MAX}
            placeholder={ADMIN_COPY.decidePlaceholder}
            value={note}
            onChange={(ev) => setNote(ev.currentTarget.value)}
          />
        )}
      </Field>
      <div className="row gap-8">
        <Button variant="primary" icon={<I.check size={16} />} disabled={review.isPending} onClick={() => decide("approve")}>
          {ADMIN_COPY.approve}
        </Button>
        <Button variant="secondary" disabled={review.isPending} onClick={() => decide("changes")}>
          {ADMIN_COPY.askChanges}
        </Button>
      </div>
    </div>
  );
}
