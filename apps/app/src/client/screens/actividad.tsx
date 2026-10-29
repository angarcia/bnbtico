// Actividad (navegación simple): visitas, toques en WhatsApp y consultas de 30 días por casa, y las últimas consultas, que
// abren WhatsApp con el cliente; cada consulta lleva su casa y, con dos o más casas, chips para filtrarlas (`?casa=<uuid>`).
// Trozo diferido. Se pinta desde la caché (persistida con la sesión) y se refresca por detrás.
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import type { ListingActivity } from "../../domain/api";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { initials, inquirySummary, relativeTime, type OwnerInquiry } from "../../domain/inquiry";
import { filterInquiries, inquiryChips } from "../../domain/inquiry-filter";
import type { Listing } from "../../domain/listing";
import { activityEmpty } from "../../domain/navigation";
import { I } from "../../shared/icons";
import { RootHeader } from "../chrome";
import { HouseCardTop } from "../house-card";
import { inquiriesQuery, openInquiry } from "../inquiries";
import { activityQuery } from "../owner";
import { ownListingsQuery } from "../own-listings-query";
import { useSession } from "../session";

const LATEST = 20;
const EMPTY = "Cuando su casa esté activa verá aquí cuántas personas la visitan y le escriben";
const FIGURES_FAILED = "No pudimos cargar las cifras. Intente de nuevo.";
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Las cifras van aparte de la lista y de las consultas: si no llegan, las consultas (el camino al cliente) siguen. */
type FiguresState = "ready" | "loading" | "failed";

const route = getRouteApi("/_tabs/_private/_owner/propietario/actividad");

export function ActividadScreen() {
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  const navigate = useNavigate();
  // Con `?casa=` se vuelve a leer siempre al abrir: una casa publicada hace un momento aún no está en la caché.
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId, refetchOnMount: search.casa ? "always" : true });
  const restoring = useIsRestoring();
  const activity = useQuery({ ...activityQuery(userId), enabled: !!userId });
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const list = listings.data;
  const byId = new Map((activity.data ?? []).map((a) => [a.listingId, a]));
  const figures: FiguresState = activity.data ? "ready" : activity.isError ? "failed" : "loading";
  const inquiriesFailed = inquiries.isError && !inquiries.data;
  const anyActive = !!list?.some((l) => l.status === "active");
  const chips = list ? inquiryChips(list) : null;
  const selected = chips?.some((c) => c.id === search.casa) ? search.casa! : null;
  // Una casa desconocida, o una sola casa: «Todas», pero solo con la lista leída de la base tras abrir y sin error (sin red,
  // la casa puede faltar en la copia del teléfono: `casa` se queda y se ven sus consultas). Las cifras no se filtran nunca.
  const settled = listings.isFetchedAfterMount && listings.isSuccess && !listings.isFetching && !restoring;
  const dropCasa = !!list && !!search.casa && !selected && settled;
  useEffect(() => {
    if (dropCasa) void navigate({ to: "/propietario/actividad", search: {}, replace: true });
  }, [dropCasa, navigate]);
  // Primero la casa, luego las últimas: una casa tranquila no se queda sin sus consultas.
  const latest = filterInquiries(inquiries.data ?? [], selected ?? (settled ? null : (search.casa ?? null))).slice(0, LATEST);
  const houses = new Map((list ?? []).map((l) => [l.id, l]));
  // Sin casa activa, hasta saber si hay consultas no se sabe si toca el mensaje de «vacío».
  const waiting = !list || (!anyActive && !inquiries.data && !inquiriesFailed);

  return (
    <>
      <RootHeader title="Actividad" aside={<span className="small muted">Últimos 30 días</span>} />
      {listings.isError && !list ? (
        <p className="note" role="alert">
          {toDomainError(listings.error).message}
        </p>
      ) : waiting ? (
        <SkeletonActivity />
      ) : inquiries.data && activityEmpty(list, inquiries.data.length) ? (
        <p>{EMPTY}</p>
      ) : (
        <>
          {figures === "failed" && anyActive ? (
            <p className="note" role="alert">
              {FIGURES_FAILED}
            </p>
          ) : null}
          {list.length > 1 ? (
            <div className="grid-2 activity-grid">
              {list.map((l, i) => (
                <ActivityCard key={l.id} listing={l} activity={byId.get(l.id)} figures={figures} wide={false} eager={i === 0} />
              ))}
            </div>
          ) : list[0] ? (
            <ActivityCard listing={list[0]} activity={byId.get(list[0].id)} figures={figures} wide eager />
          ) : null}
          {inquiriesFailed ? (
            <p className="note" role="alert">
              {toDomainError(inquiries.error).message}
            </p>
          ) : inquiries.data && inquiries.data.length > 0 ? (
            <section className="stack gap-12">
              <h2 className="activity-h2">Últimas consultas</h2>
              {chips ? (
                <div className="chiprow" role="group" aria-label="Filtrar por casa">
                  <Link to="/propietario/actividad" search={{}} replace className="chip chip-sm" activeOptions={{ exact: true, includeSearch: true }}>
                    Todas
                  </Link>
                  {chips.map((c) => (
                    <Link
                      key={c.id}
                      to="/propietario/actividad"
                      search={{ casa: c.id }}
                      replace
                      className="chip chip-sm"
                      activeOptions={{ exact: true, includeSearch: true }}
                      aria-label={c.name}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              {latest.length > 0 ? (
                latest.map((i) => <InquiryCard key={i.id} inquiry={i} userId={userId} house={houses.get(i.listingId)} />)
              ) : (
                <p className="small muted">Todavía no hay consultas de esta casa.</p>
              )}
              <p className="xs muted inquiries-foot">Es un registro de quién le escribió; la conversación completa está en su WhatsApp.</p>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

/** Las cifras de una casa activa: mientras llegan, su hueco; si fallaron, nada (el aviso va arriba, una sola vez). */
function FiguresSlot({ activity, figures, large }: { activity: ListingActivity | undefined; figures: FiguresState; large?: boolean }) {
  if (figures === "ready") return <Figures activity={activity} large={large} />;
  if (figures === "loading") return <span className="sk sk-line" aria-busy="true" aria-label="Cargando las cifras" />;
  return null;
}

function Figures({ activity: a, large }: { activity: ListingActivity | undefined; large?: boolean }) {
  const views = a?.views ?? 0;
  const taps = a?.whatsappTaps ?? 0;
  const inquiries = a?.inquiries ?? 0;
  return (
    <div className={`activity-figures${large ? " lg" : ""}`} data-testid="activity-figures">
      <p>
        <b className="num">{views}</b> <span>{plural(views, "visita", "visitas")}</span>
      </p>
      <p>
        <b className="num">{taps}</b> <span>{plural(taps, "toque en WhatsApp", "toques en WhatsApp")}</span>
      </p>
      <p>
        <b className="num">{inquiries}</b> <span>{plural(inquiries, "consulta", "consultas")}</span>
      </p>
    </div>
  );
}

function ActivityCard({
  listing: l,
  activity,
  figures,
  wide,
  eager,
}: {
  listing: Listing;
  activity: ListingActivity | undefined;
  figures: FiguresState;
  wide: boolean;
  eager: boolean;
}) {
  return (
    <article className="card house-card activity-card">
      <HouseCardTop listing={l} sizes={wide ? "100vw" : "50vw"} eager={eager} />
      {l.status === "active" ? <FiguresSlot activity={activity} figures={figures} large={wide} /> : wide ? <p>{EMPTY}</p> : null}
    </article>
  );
}

function InquiryCard({ inquiry: i, userId, house }: { inquiry: OwnerInquiry; userId: string; house: Listing | undefined }) {
  const cover = house?.photos[0];
  const client = useQueryClient();
  const opening = useRef(false);
  const isNew = !i.openedAt;
  const nameId = `inquiry-${i.id}`;
  function open() {
    if (opening.current) return;
    opening.current = true;
    void openInquiry(client, userId, i).finally(() => (opening.current = false));
  }
  return (
    <article className={`card stack gap-10 inquiry-card${isNew ? " is-new" : ""}`} aria-labelledby={nameId}>
      <span className="inquiry-house" data-testid="inquiry-house">
        {cover ? (
          <img src={variantUrl(cover, 480)} alt="" width={24} height={24} className="inquiry-house-photo" loading="lazy" decoding="async" />
        ) : (
          <span className="inquiry-house-photo" aria-hidden="true" />
        )}
        <span className="inquiry-house-name small strong">{house?.title || i.listingTitle || "Casa sin título"}</span>
      </span>
      <div className="row gap-12 align-top">
        <span className={`avatar inquiry-avatar${isNew ? "" : " is-read"}`} aria-hidden="true">
          {initials(i.clientName)}
        </span>
        <div className="stack inquiry-body grow-col">
          <div className="row between baseline gap-8">
            <h3 id={nameId} className="inquiry-name">
              {i.clientName}
            </h3>
            <span className="row baseline gap-6 nowrap">
              {isNew ? <span className="badge badge-new">Nueva</span> : null}
              <span className="xs muted">{relativeTime(i.updatedAt, Date.now())}</span>
            </span>
          </div>
          <span className="small muted">{inquirySummary(i)}</span>
          {i.source === "bnbtico" ? <span className="badge badge-tight">Creada por bnbtico</span> : null}
          <p className="inquiry-message">“{i.message}”</p>
        </div>
      </div>
      <button type="button" className="btn btn-wa inquiry-wa" onClick={open}>
        <I.wa size={18} /> Abrir WhatsApp
      </button>
    </article>
  );
}

function SkeletonActivity() {
  return (
    <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando su actividad">
      <span className="sk inquiry-avatar" />
      <span className="sk sk-line" />
    </section>
  );
}
