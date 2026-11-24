// Zona del propietario (pantallas 10, 16 y 19 del diseño v1; 07-mis-casas del v2): Mis casas, detalle de una casa y
// «enviada». Mis casas es la lista, una casa por fila (con una sola casa, la pestaña «Mi casa» abre su gestión); arriba, como mucho el aviso del pago (navigation.ts noticeFor).
// El calendario (17) va en su propio trozo (screens/calendario.tsx).
// Se pintan desde la caché (Mis casas persistida con la sesión) y se refrescan por detrás. Las reglas las pone la base;
// `can` decide qué botones se muestran.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useOwnListing, useUserId } from "./editor-query";
import { NotFoundCard } from "./editor-status";
import { ActivateButton, HoldNotice, PayButton, PayNotice, ShareButtonInline, WhatsAppItem, shareOf, titleOf } from "./owner-ui";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { can, isPublished } from "../../domain/can";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { type Listing } from "../../domain/listing";
import { missingLine, missingParts, resumeStep } from "../../domain/publish-rules";
import { formatCRC } from "../../domain/money";
import { byPendingAction, cardLabel, casasView, noticeFor, type Notice as PendingNotice } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/subscription";
import { I } from "../../shared/ui/icons";
import { DeleteHouse } from "./delete-house";
import { MonthlyLine } from "../../shared/monthly-line";
import { fadeIn } from "../../shared/picture";
import { useShare } from "../../shared/share-button";
import { billingQuery, useBilling, type Billing } from "./suscripcion/billing";
import { ScreenHeader } from "../comun/screen-header";
import { HouseCardTop } from "./house-card";
import { inquiriesQuery } from "./inquiries";
import { activityQuery, offerTakenQuery, ownListingsQuery, resumableQuery, useDeleteDraft } from "./owner";
import { knownNoDraft } from "../comun/own-listings-query";
import { ConfirmSheet } from "../comun/confirm-sheet";
import { useDesktop } from "../../shared/desktop";
import { Button, TextButton } from "../../shared/ui/button";
import { RouterButtonLink, RouterTextLink } from "../comun/router-buttons";
import { CountBadge, LoadError, Notice, Skeleton, StatusTag } from "../../shared/ui/structure";
import { Card, List, ListRowButton } from "../../shared/ui/card";
import * as OWNER_COPY from "./copy/owner";

const message = (e: unknown) => toDomainError(e).message;

/** «¿Descartar este borrador?» con la hoja de la app (no el diálogo del navegador), desde la tarjeta y desde el detalle:
 *  devuelve la función que la abre y la hoja (o nada). */
function useDiscardSheet(go: () => void): [() => void, ReactNode] {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return [
    () => setOpen(true),
    open ? (
      <ConfirmSheet
        title={OWNER_COPY.discardTitle}
        body={OWNER_COPY.discardBody}
        confirmLabel={OWNER_COPY.discard}
        tone="destructive"
        onClose={close}
        onConfirm={() => {
          close();
          go();
        }}
      />
    ) : null,
  ];
}

// ---------- Mis casas ----------

/** El único aviso de arriba (domain/navigation.ts noticeFor): el pago, con el nombre de la casa. */
function NoticeCard({ notice, billing }: { notice: PendingNotice | null; billing: Billing | null }) {
  const hb = notice ? billing?.of(notice.listingId) : undefined;
  return hb && billing ? <PayNotice hb={hb} today={billing.today} title={hb.house.title} /> : null;
}

/** El asistente de publicar se descarga en reposo al abrir Mis casas: el «+» ya no espera a su JS. */
function usePreloadPublish() {
  useEffect(() => {
    const load = () => void import("./publicar/publicar").catch(() => undefined);
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(load, { timeout: 3000 });
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, []);
}

/** «+», «Nueva casa»: junto a las cifras de Mis casas o, con una sola casa, junto a su título. */
function NewHouseLink({ userId }: { userId: string }) {
  const client = useQueryClient();
  return (
    // Al apoyar el dedo empieza ya la lectura del borrador pendiente que el asistente necesita (siempre de la base), salvo
    // que la lista ya diga que no hay ninguno: entonces el paso 1 sale sin esperarla.
    <Link
      to="/propietario/publicar"
      className="new-house"
      aria-label={OWNER_COPY.newHouse}
      onPointerDown={() => {
        if (userId && !knownNoDraft(client, userId)) void client.prefetchQuery(resumableQuery(userId));
      }}
    >
      <I.plus size={22} />
      {/* El texto que se ve en escritorio (antes con `content:` en el CSS); el nombre accesible sigue siendo «Nueva casa». */}
      <span className="desktop-label">{OWNER_COPY.addHouse}</span>
    </Link>
  );
}

/** Lo que enseña Mis casas: la lista, las consultas nuevas de cada casa (la misma caché privada que Consultas y la pestaña:
 *  sin peticiones por tarjeta ni contadores de WhatsApp), el aviso del pago, la vista (lista o una sola casa) y las cifras. */
function useMyHouses(userId: string) {
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const list = listings.data;
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const freshByHouse = new Map<string, number>();
  for (const inquiry of inquiries.data ?? []) {
    if (!inquiry.openedAt) freshByHouse.set(inquiry.listingId, (freshByHouse.get(inquiry.listingId) ?? 0) + 1);
  }
  const billing = useBilling(userId);
  const notice = list ? noticeFor(list, billing && { today: billing.today, houses: billing.all.map((x) => ({ listingId: x.house.listingId, sub: x.sub })) }) : null;
  const view = list ? casasView(list.length) : null;
  // Una casa pausada o bloqueada por 3bstays no cuenta como activa: no se ve en Explorar.
  const count = (s: Listing["status"]) => list?.filter((l) => l.status === s && !l.adminHold).length ?? 0;
  // Casillas a 0 fuera: no llaman la atención sobre nada (revisión UX N1).
  // El borrador también cuenta y lleva a él (A3).
  const firstDraft = list?.find((l) => l.status === "draft");
  const tiles = [
    { n: count("active"), label: OWNER_COPY.tileActive({ count: count("active") }), cls: "tile-soft" },
    { n: count("payment_due"), label: OWNER_COPY.tileDue, cls: "tile-sun" },
    { n: count("review"), label: OWNER_COPY.tileReview, cls: "tile-review" },
    { n: count("draft"), label: OWNER_COPY.tileDraft({ count: count("draft") }), cls: "tile-draft", to: firstDraft?.id },
  ].filter((t) => t.n > 0);
  return { listings, list, freshByHouse, billing, notice, view, tiles };
}

export function CasasScreen() {
  const userId = useUserId();
  usePreloadPublish();
  const { listings, list, freshByHouse, billing, notice, view, tiles } = useMyHouses(userId);
  // Una sola casa: su gestión en la propia pestaña, con la barra de abajo y sin flecha (no hay lista a la que volver).
  // El aviso del pago de la lista (90/30/7 días) sigue arriba; la pendiente de pago y la parada ya los pone la ficha.
  if (view === "detail") {
    const only = list![0]!;
    const ownNotice = only.status === "payment_due" || only.status === "inactive" ? null : <NoticeCard notice={notice} billing={billing} />;
    return <OwnerHouseDetail id={only.id} newHouse={<NewHouseLink userId={userId} />} notice={ownNotice} />;
  }
  return (
    <>
      <ScreenHeader kind="root" title={OWNER_COPY.title} />
      {listings.isError && !list ? <LoadError onRetry={() => void listings.refetch()}>{message(listings.error)}</LoadError> : null}
      {!list && !listings.isError ? <Skeleton shape="row" label={OWNER_COPY.loading} /> : null}
      {view === "list" ? (
        <>
          <NoticeCard notice={notice} billing={billing} />
          {/* «Nueva casa» junto a las cifras, sin fondo verde: recuadro con la línea fina (revisión UX 2026-10-29, T2). */}
          <div className="tiles-row my-houses-summary">
            {tiles.length ? (
              <div className="grid-3">
                {tiles.map((t) =>
                  t.to ? (
                    <Link key={t.label} to="/propietario/casas/$id" params={{ id: t.to }} className={`tile ${t.cls}`}>
                      <b className="num">{t.n}</b>
                      <span>{t.label}</span>
                    </Link>
                  ) : (
                    <div key={t.label} className={`tile ${t.cls}`}>
                      <b className="num">{t.n}</b>
                      <span>{t.label}</span>
                    </div>
                  ),
                )}
              </div>
            ) : null}
            <NewHouseLink userId={userId} />
          </div>
          <div className="stack house-list">
            {byPendingAction(list!).map((l, i) => (
              <OwnerCard key={l.id} listing={l} userId={userId} eager={i === 0} multiple={list!.length > 1} newInquiries={freshByHouse.get(l.id) ?? 0} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

/** Una casa por fila: foto con su estado, nombre y zona; debajo, como mucho un botón relleno (diseño v2, 07-mis-casas). */
function OwnerCard({ listing: l, userId, eager, multiple, newInquiries }: { listing: Listing; userId: string; eager: boolean; multiple: boolean; newInquiries: number }) {
  const discard = useDeleteDraft(userId);
  const [ask, sheet] = useDiscardSheet(() => discard.mutate(l.id));
  // Sin la consulta de la suscripción (despliegue antes de la migración) no se ofrece pagar: la pantalla no funcionaría.
  const billed = !!useBilling(userId)?.of(l.id);
  const shareable = can(l, "share");
  const tools = multiple && can(l, "available");
  const inquiriesLabel = newInquiries > 0 ? OWNER_COPY.inquiriesFresh({ count: newInquiries }) : OWNER_COPY.inquiries;
  return (
    <Card as="article" placement={shareable || tools ? "house-card-compact" : "house-card"}>
      {/* Enlace estirado: toda la tarjeta abre el detalle; los botones van por encima (revisión de Ana). */}
      <HouseCardTop listing={l} edit={l.edit} eager={eager} link />
      {l.reviewNote && l.status === "changes" ? <Notice tone="solid" small>{OWNER_COPY.reviewNote({ note: l.reviewNote })}</Notice> : null}
      <HoldNotice listing={l} card />
      {shareable || tools ? (
        <div className="house-actions">
          {shareable ? <ShareButtonInline listing={l} placement="house-share" /> : null}
          {tools ? (
            <div className="house-tools">
              <Link to="/propietario/calendario" search={{ casa: l.id }} replace className="house-tool" aria-label={OWNER_COPY.calendar} title={OWNER_COPY.calendar}>
                <I.calendar size={28} />
                <span className="desktop-label">{OWNER_COPY.calendar}</span>
              </Link>
              <Link to="/propietario/actividad" search={{ casa: l.id }} replace className="house-tool" aria-label={inquiriesLabel} title={inquiriesLabel}>
                <I.chat size={28} />
                <CountBadge n={newInquiries} placement="house" data-testid="house-inquiries-count" aria-hidden="true" />
                <span className="desktop-label">{OWNER_COPY.inquiries}</span>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {l.status === "changes" ? (
        <RouterButtonLink to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "1" }} variant="primary" block>
          {OWNER_COPY.fixAndResend}
        </RouterButtonLink>
      ) : null}
      {l.status === "draft" ? (
        <div className="row gap-8">
          <RouterButtonLink to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: String(resumeStep(l)) }} variant="secondary" placement="grow">
            {OWNER_COPY.continuePublishing}
          </RouterButtonLink>
          {can(l, "discard") ? (
            <TextButton tone="quiet" disabled={discard.isPending} onClick={ask}>
              {OWNER_COPY.discard}
            </TextButton>
          ) : null}
        </div>
      ) : null}
      {billed && l.status === "payment_due" && l.adminHold?.kind !== "blocked" ? <PayButton publicId={l.publicId} /> : null}
      {billed && l.status === "inactive" && l.adminHold?.kind !== "blocked" ? <ActivateButton publicId={l.publicId} /> : null}
      {discard.isError ? <Notice tone="error">{message(discard.error)}</Notice> : null}
      {sheet}
    </Card>
  );
}

// ---------- Detalle de una casa ----------

// La ficha editable de una casa publicada va en su propio trozo (spec .scratch/editar-casa); las que nunca se publicaron
// siguen con este detalle y el asistente.
const EditableFicha = lazy(() => import("./casa-editable").then((m) => ({ default: m.EditableFicha })));

const detailRoute = getRouteApi("/_flow/_privateFlow/propietario/casas/$id");
const HouseSubscription = lazy(() => import("./suscripcion/suscripcion").then((m) => ({ default: m.HouseSubscriptionPanel })));

export function CasaPropietarioScreen() {
  const { id } = detailRoute.useParams();
  const { panel } = detailRoute.useSearch();
  const desktop = useDesktop();
  return <OwnerHouseDetail id={id} showSubscription={desktop && panel === "suscripcion"} />;
}

/** Suscripción, actividad y el JS de la ficha editable no dependen de la casa: salen a la vez que ella, no después
 *  (auditoría de viajes 2026-11-05: los avisos y las cifras llegaban ~0,6 s más tarde). */
function usePrefetchHouseExtras(userId: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    void client.prefetchQuery(billingQuery(userId));
    void client.prefetchQuery(activityQuery(userId));
    void import("./casa-editable").catch(() => undefined);
  }, [client, userId]);
}

/** `newHouse`: la gestión va en la pestaña «Mi casa» (una sola casa): cabecera de pestaña con el «+», sin flecha, y
 *  `notice` (el aviso del pago de la lista) debajo. */
export function OwnerHouseDetail({ id, rightPanel, showSubscription, newHouse, notice }: { id: string; rightPanel?: ReactNode; showSubscription?: boolean; newHouse?: ReactNode; notice?: ReactNode }) {
  const { userId, query } = useOwnListing(id);
  const desktop = useDesktop();
  usePrefetchHouseExtras(userId);
  const l = query.data;
  // En escritorio, «Ver ficha» va en la cabecera: flotando tapaba la fila que se edita (revisión 2026-11-13, A1).
  const viewListing = l && can(l, "share") ? (desktop ? (
    <RouterButtonLink to="/casa/$publicId" params={{ publicId: l.publicId }} variant="secondary" icon={<I.eye size={20} />}>
      {OWNER_COPY.viewListing}
    </RouterButtonLink>
  ) : (
    <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="float-btn">
      <I.eye size={20} />
      {OWNER_COPY.viewListing}
    </Link>)
  ) : null;
  return (
    <>
      {newHouse ? (
        <ScreenHeader kind="root" title={l ? titleOf(l) : OWNER_COPY.myHouse} action={<>{desktop ? viewListing : null}{newHouse}</>} />
      ) : (
        <ScreenHeader kind="flow" title={l ? titleOf(l) : OWNER_COPY.myHouse} back={{ to: "/propietario/casas" }} action={viewListing && desktop ? <div className="page-header-actions">{viewListing}</div> : undefined} />
      )}
      {notice}
      {l && isPublished(l) ? (
        <Suspense fallback={<Skeleton shape="row" label={OWNER_COPY.loading} />}>
          <EditableFicha key={l.id} listing={l} userId={userId} rightPanel={showSubscription ? <HouseSubscription listing={l} /> : rightPanel} />
        </Suspense>
      ) : null}
      {l && !isPublished(l) ? <Detail listing={l} userId={userId} /> : null}
      {l === null ? <NotFoundCard /> : null}
      {l === undefined && query.isError ? <LoadError onRetry={() => void query.refetch()}>{message(query.error)}</LoadError> : null}
      {l === undefined && !query.isError ? <Skeleton shape="row" label={OWNER_COPY.loading} /> : null}
      {viewListing && !desktop ? viewListing : null}
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

  const [ask, sheet] = useDiscardSheet(() => discard.mutate(l.id, { onSuccess: () => void navigate({ to: "/propietario/casas", replace: true }) }));

  const error = discard.error;
  return (
    <div className="owner-detail-draft">
      <div className="owner-detail-summary">
        <div className="photo detail-photo">
          {cover ? (
            <img src={variantUrl(cover, 800)} alt="" width={800} height={340} />
          ) : (
            // Sin fotos: el hueco lleva directo al paso de las fotos (Ana, 2026-11-04).
            <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "7" }} className="photo-empty">
              <I.camera size={28} />
              {OWNER_COPY.addPhotos}
            </Link>
          )}
          <StatusTag placement="photo" label={label} />
          {price ? (
            <span className="pill pill-bl">
              {formatCRC(price.amount)} <span>/ {price.unit}</span>
            </span>
          ) : null}
        </div>
        {monthly ? <MonthlyLine monthly={monthly} format={formatCRC} /> : null}
      </div>

      <div className="owner-detail-fields">
        {/* Borrador: «Seguir publicando» como acción principal, con lo que falta (revisión UX 2026-10-29, A4). */}
        {l.status === "draft" ? (
          <div className="stack gap-8">
            <RouterButtonLink to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: String(resumeStep(l)) }} variant="primary" size="lg" block>
              {OWNER_COPY.continuePublishing}
            </RouterButtonLink>
            {missingLine(missingParts(l)) ? (
              <span className="small muted center" data-testid="draft-missing">
                {missingLine(missingParts(l))}
              </span>
            ) : null}
          </div>
        ) : null}
        {l.status === "review" ? <Notice as="div" tone="review">{OWNER_COPY.inReview}</Notice> : null}
        {l.reviewNote && l.status === "changes" ? (
          <Card tone="solid" layout="stack" gap={10}>
            <b className="display offer-title">{OWNER_COPY.changesAsked}</b>
            <span className="small ink">{l.reviewNote}</span>
            <Button variant="primary" block onClick={() => void toWizard()}>
              {OWNER_COPY.fixAndResend}
            </Button>
          </Card>
        ) : null}

        <List>
          {/* «Compartir ficha» solo con la casa activa: desactivado parecía roto (A4). */}
          {can(l, "share") ? <ShareListItem listing={l} /> : null}
          <WhatsAppItem listing={l} />
        </List>

        {error ? <Notice tone="error">{message(error)}</Notice> : null}

        {can(l, "discard") ? (
          <Button variant="danger" onClick={ask} disabled={discard.isPending}>
            {OWNER_COPY.discardDraft}
          </Button>
        ) : <DeleteHouse listing={l} userId={userId} />}
      </div>
      {sheet}
    </div>
  );
}

function ShareListItem({ listing: l }: { listing: Listing }) {
  const target = shareOf(l);
  const { share, copied, swap } = useShare(target);
  const enabled = can(l, "share");
  return (
    <ListRowButton onClick={share} disabled={!enabled} aria-disabled={!enabled || undefined} data-share-url={target.url}>
      <span className="muted-icon">
        <I.share />
      </span>
      <span className="body">
        {OWNER_COPY.share}
        {/* La referencia CT-#### va aquí, dentro del enlace, y no sobre la foto (revisión UX N7). */}
        {enabled && !copied ? <small className="num primary share-url">{target.url.replace(/^https?:\/\//, "")}</small> : null}
        <small key={copied ? "copied" : "share"} className={swap}>{OWNER_COPY.shareState({ copied, enabled })}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </ListRowButton>
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
        <h1 className="sent-title">{OWNER_COPY.sentTitle}</h1>
        <p className="muted">
          {OWNER_COPY.sentText({ title: l ? titleOf(l) : null })}
        </p>
      </div>
      <div className="steps-list">
        <div>
          <span className="n done">1</span>
          <span>
            <b>{OWNER_COPY.sent}</b>
            <span className="block muted">
              {OWNER_COPY.sentRef({ id: <span key="id" className="num">{l?.publicId ?? OWNER_COPY.idLoading}</span> })}
            </span>
          </span>
        </div>
        <div>
          <span className="n">2</span>
          <span>
            <b>{OWNER_COPY.reviewing}</b>
            <span className="block muted">{OWNER_COPY.reviewingNote}</span>
          </span>
        </div>
        <div>
          <span className="n">3</span>
          <span>
            <b>{OWNER_COPY.published({ months: offer ? offer.months : null, fee: offer === null ? formatCRC(MONTHLY_FEE_CRC) : null })}</b>
            <span className="block muted">{OWNER_COPY.publishedNote}</span>
          </span>
        </div>
      </div>
      <div className="stack gap-10 sent-actions">
        <RouterButtonLink to="/propietario/calendario" search={{ casa: id }} variant="primary" size="lg">
          {OWNER_COPY.markNights}
        </RouterButtonLink>
        <RouterTextLink to="/propietario/casas" tone="link" placement="sent-link">
          {OWNER_COPY.toMyHouses}
        </RouterTextLink>
      </div>
    </div>
  );
}
