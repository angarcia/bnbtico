// Zona del propietario (pantallas 10, 16 y 19 del diseño v1; 07-mis-casas del v2): Mis casas, detalle de una casa y
// «enviada». Mis casas es siempre la lista, una casa por fila; arriba, como mucho el aviso del pago (navigation.ts noticeFor).
// El calendario (17) va en su propio trozo (screens/calendario.tsx).
// Se pintan desde la caché (Mis casas persistida con la sesión) y se refrescan por detrás. Las reglas las pone la base;
// `can` decide qué botones se muestran.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useOwnListing, useUserId } from "../editor-query";
import { NotFoundCard, SkeletonCard } from "../editor-status";
import { ActivateButton, HoldNotice, PayButton, PayNotice, ShareButtonInline, WhatsAppItem, shareOf, titleOf } from "../owner-ui";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { can, isPublished } from "../../domain/can";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { type Listing } from "../../domain/listing";
import { missingLine, missingParts, resumeStep } from "../../domain/publish-rules";
import { formatCRC } from "../../domain/money";
import { byPendingAction, cardLabel, casasView, noticeFor, type Notice } from "../../domain/navigation";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/subscription";
import { I } from "../../shared/icons";
import { MonthlyLine } from "../../shared/monthly-line";
import { fadeIn } from "../../shared/picture";
import { useShare } from "../../shared/share-button";
import { billingQuery, useBilling, type Billing } from "../billing";
import { FlowHeader, RootHeader } from "../chrome";
import { HouseCardTop } from "../house-card";
import { inquiriesQuery } from "../inquiries";
import { activityQuery, offerTakenQuery, ownListingsQuery, resumableQuery, useDeleteDraft } from "../owner";
import { ConfirmSheet } from "../confirm-sheet";

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
        title="¿Descartar este borrador?"
        body="No se puede deshacer."
        confirmLabel="Descartar"
        confirmClassName="btn btn-outline-bad btn-lg"
        cancelClassName="btn btn-ghost btn-lg"
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
function NoticeCard({ notice, billing }: { notice: Notice | null; billing: Billing | null }) {
  const hb = notice ? billing?.of(notice.listingId) : undefined;
  return hb && billing ? <PayNotice hb={hb} today={billing.today} title={hb.house.title} /> : null;
}

/** El asistente de publicar se descarga en reposo al abrir Mis casas: el «+» ya no espera a su JS. */
function usePreloadPublish() {
  useEffect(() => {
    const load = () => void import("./publicar").catch(() => undefined);
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(load, { timeout: 3000 });
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, []);
}

export function CasasScreen() {
  const userId = useUserId();
  const client = useQueryClient();
  usePreloadPublish();
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const list = listings.data;
  // La misma caché privada que Consultas y la pestaña: sin peticiones por tarjeta ni contadores de WhatsApp.
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const freshByHouse = new Map<string, number>();
  for (const inquiry of inquiries.data ?? []) {
    if (!inquiry.openedAt) freshByHouse.set(inquiry.listingId, (freshByHouse.get(inquiry.listingId) ?? 0) + 1);
  }
  const billing = useBilling(userId);
  const notice = list ? noticeFor(list, billing && { today: billing.today, houses: billing.all.map((x) => ({ listingId: x.house.listingId, sub: x.sub })) }) : null;
  const view = list ? casasView(list.length) : null;
  // Una casa pausada o bloqueada por bnbtico no cuenta como activa: no se ve en Explorar.
  const count = (s: Listing["status"]) => list?.filter((l) => l.status === s && !l.adminHold).length ?? 0;
  // Casillas a 0 fuera: no llaman la atención sobre nada (revisión UX N1).
  // El borrador también cuenta y lleva a él (A3).
  const firstDraft = list?.find((l) => l.status === "draft");
  const tiles = [
    { n: count("active"), label: count("active") === 1 ? "activa" : "activas", cls: "tile-soft" },
    { n: count("payment_due"), label: "por pagar", cls: "tile-sun" },
    { n: count("review"), label: "en revisión", cls: "tile-review" },
    { n: count("draft"), label: count("draft") === 1 ? "borrador" : "borradores", cls: "tile-draft", to: firstDraft?.id },
  ].filter((t) => t.n > 0);
  return (
    <>
      <RootHeader title="Mis casas" />
      {listings.isError && !list ? <p className="note" role="alert">{message(listings.error)}</p> : null}
      {!list && !listings.isError ? <SkeletonCard /> : null}
      {view === "list" ? (
        <>
          <NoticeCard notice={notice} billing={billing} />
          {/* «Nueva casa» junto a las cifras, sin fondo verde: recuadro con la línea fina (revisión UX 2026-10-29, T2). */}
          <div className="tiles-row">
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
            {/* Al apoyar el dedo empieza ya la lectura del borrador pendiente que el asistente necesita (siempre de la base). */}
            <Link
              to="/propietario/publicar"
              className="new-house"
              aria-label="Nueva casa"
              onPointerDown={() => {
                if (userId) void client.prefetchQuery(resumableQuery(userId));
              }}
            >
              <I.plus size={22} />
            </Link>
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
  const inquiriesLabel = newInquiries > 0 ? `Consultas, ${newInquiries} ${newInquiries === 1 ? "nueva" : "nuevas"}` : "Consultas";
  return (
    <article className="card house-card">
      {/* Enlace estirado: toda la tarjeta abre el detalle; los botones van por encima (revisión de Ana). */}
      <HouseCardTop listing={l} edit={l.edit} eager={eager} link />
      {l.reviewNote && (l.status === "changes" || l.status === "rejected") ? <p className="note note-arena small">Nota de bnbtico: {l.reviewNote}</p> : null}
      <HoldNotice listing={l} card />
      {shareable || tools ? (
        <div className="house-actions">
          {shareable ? <ShareButtonInline listing={l} className="house-share" /> : null}
          {tools ? (
            <div className="house-tools">
              <Link to="/propietario/calendario" search={{ casa: l.id }} replace className="house-tool" aria-label="Calendario" title="Calendario">
                <I.calendar size={22} />
              </Link>
              <Link to="/propietario/actividad" search={{ casa: l.id }} replace className="house-tool" aria-label={inquiriesLabel} title={inquiriesLabel}>
                <I.chat size={22} />
                {newInquiries > 0 ? <span className="house-inquiries-count num" data-testid="house-inquiries-count" aria-hidden="true">{newInquiries}</span> : null}
              </Link>
            </div>
          ) : null}
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
              onClick={ask}
            >
              Descartar
            </button>
          ) : null}
        </div>
      ) : null}
      {billed && l.status === "payment_due" && l.adminHold?.kind !== "blocked" ? <PayButton publicId={l.publicId} /> : null}
      {billed && l.status === "inactive" && l.adminHold?.kind !== "blocked" ? <ActivateButton publicId={l.publicId} /> : null}
      {discard.isError ? <p className="note" role="alert">{message(discard.error)}</p> : null}
      {sheet}
    </article>
  );
}

// ---------- Detalle de una casa ----------

// La ficha editable de una casa publicada va en su propio trozo (spec .scratch/editar-casa); las que nunca se publicaron
// siguen con este detalle y el asistente.
const EditableFicha = lazy(() => import("./casa-editable").then((m) => ({ default: m.EditableFicha })));

const detailRoute = getRouteApi("/_flow/_privateFlow/propietario/casas/$id");

export function CasaPropietarioScreen() {
  const { id } = detailRoute.useParams();
  const { userId, query } = useOwnListing(id);
  // Suscripción, actividad y el JS de la ficha editable no dependen de la casa: salen a la vez que ella, no después
  // (auditoría de viajes 2026-11-05: los avisos y las cifras llegaban ~0,6 s más tarde).
  const client = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    void client.prefetchQuery(billingQuery(userId));
    void client.prefetchQuery(activityQuery(userId));
    void import("./casa-editable").catch(() => undefined);
  }, [client, userId]);
  const l = query.data;
  return (
    <>
      <FlowHeader
        title={l ? titleOf(l) : "Mi casa"}
        back="/propietario/casas"
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
      {l && can(l, "share") ? (
        <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="float-btn">
          <I.eye size={20} />
          Ver ficha
        </Link>
      ) : null}
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
    <>
      <div className="photo detail-photo">
        {cover ? (
          <img src={variantUrl(cover, 800)} alt="" width={800} height={340} />
        ) : (
          // Sin fotos: el hueco lleva directo al paso de las fotos (Ana, 2026-11-04).
          <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: "7" }} className="photo-empty">
            <I.camera size={28} />
            Añadir fotos
          </Link>
        )}
        <span className={`state ${label.cls}`}>{label.text}</span>
        {price ? (
          <span className="pill pill-bl">
            {formatCRC(price.amount)} <span>/ {price.unit}</span>
          </span>
        ) : null}
      </div>
      {monthly ? <MonthlyLine monthly={monthly} format={formatCRC} /> : null}

      {/* Borrador: «Seguir publicando» como acción principal, con lo que falta (revisión UX 2026-10-29, A4). */}
      {l.status === "draft" ? (
        <div className="stack gap-8">
          <Link to="/propietario/publicar/$id/$paso" params={{ id: l.id, paso: String(resumeStep(l)) }} className="btn btn-primary btn-lg btn-block">
            Seguir publicando
          </Link>
          {missingLine(missingParts(l)) ? (
            <span className="small muted center" data-testid="draft-missing">
              {missingLine(missingParts(l))}
            </span>
          ) : null}
        </div>
      ) : null}
      {l.status === "review" ? <div className="note note-review">La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.</div> : null}
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
        {/* «Compartir ficha» solo con la casa activa: desactivado parecía roto (A4). */}
        {can(l, "share") ? <ShareListItem listing={l} /> : null}
        <WhatsAppItem listing={l} />
      </section>

      {error ? <p className="note" role="alert">{message(error)}</p> : null}

      {can(l, "discard") ? (
        <button type="button" className="btn btn-outline-bad" onClick={ask} disabled={discard.isPending}>
          Descartar borrador
        </button>
      ) : null}
      {sheet}
    </>
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
