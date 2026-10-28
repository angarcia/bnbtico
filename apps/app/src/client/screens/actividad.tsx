// Actividad (navegación simple): visitas, toques en WhatsApp y consultas de 30 días por casa, y las últimas consultas, que
// abren WhatsApp con el cliente. Trozo diferido. Se pinta desde la caché (persistida con la sesión) y se refresca por detrás.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { ListingActivity } from "../../domain/api";
import { describe } from "../../domain/describe";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { initials, inquirySummary, relativeTime, type OwnerInquiry } from "../../domain/inquiry";
import type { Listing } from "../../domain/listing";
import { activityEmpty, casasView } from "../../domain/navigation";
import { I } from "../../shared/icons";
import { RootHeader } from "../chrome";
import { inquiriesQuery, openInquiry } from "../inquiries";
import { activityQuery } from "../owner";
import { ownListingsQuery } from "../own-listings-query";
import { useSession } from "../session";

const LATEST = 20;
const EMPTY = "Cuando su casa esté activa verá aquí cuántas personas la visitan y le escriben";
const titleOf = (l: Listing) => l.title || "Borrador sin título";
const FIGURES_FAILED = "No pudimos cargar las cifras. Intente de nuevo.";
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Las cifras van aparte de la lista y de las consultas: si no llegan, las consultas (el camino al cliente) siguen. */
type FiguresState = "ready" | "loading" | "failed";

export function ActividadScreen() {
  const userId = useSession().session?.userId ?? "";
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const activity = useQuery({ ...activityQuery(userId), enabled: !!userId });
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const list = listings.data;
  const byId = new Map((activity.data ?? []).map((a) => [a.listingId, a]));
  const figures: FiguresState = activity.data ? "ready" : activity.isError ? "failed" : "loading";
  const inquiriesFailed = inquiries.isError && !inquiries.data;
  const anyActive = !!list?.some((l) => l.status === "active");
  const latest = inquiries.data?.slice(0, LATEST) ?? [];
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
          {casasView(list.length) === "list" ? (
            <div className="stack gap-12">
              {list.map((l) => (
                <ActivityCard key={l.id} listing={l} activity={byId.get(l.id)} figures={figures} />
              ))}
            </div>
          ) : list[0] ? (
            <SingleActivity listing={list[0]} activity={byId.get(list[0].id)} figures={figures} />
          ) : null}
          {inquiriesFailed ? (
            <p className="note" role="alert">
              {toDomainError(inquiries.error).message}
            </p>
          ) : latest.length > 0 ? (
            <section className="stack gap-12">
              <h2 className="activity-h2">Últimas consultas</h2>
              {latest.map((i) => (
                <InquiryCard key={i.id} inquiry={i} userId={userId} />
              ))}
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

const statusOf = (l: Listing) => describe(l, { base: "" }).statusLabel;

function SingleActivity({ listing: l, activity, figures }: { listing: Listing; activity: ListingActivity | undefined; figures: FiguresState }) {
  if (l.status === "active") return <FiguresSlot activity={activity} figures={figures} large />;
  return (
    <section className="stack gap-8">
      <span className="small muted">{statusOf(l)}</span>
      <p>{EMPTY}</p>
    </section>
  );
}

function ActivityCard({ listing: l, activity, figures }: { listing: Listing; activity: ListingActivity | undefined; figures: FiguresState }) {
  const cover = l.photos[0];
  return (
    <article className="card activity-card">
      <div className="row gap-12">
        {cover ? <img src={variantUrl(cover, 480)} alt="" className="thumb thumb-sm" width={84} height={84} loading="lazy" decoding="async" /> : <span className="thumb thumb-sm" />}
        <div className="stack gap-4 grow-col">
          <h2 className="activity-title">{titleOf(l)}</h2>
          <span className="xs muted num">{l.publicId}</span>
          {l.status === "active" ? null : <span className="small muted">{statusOf(l)}</span>}
        </div>
      </div>
      {l.status === "active" ? <FiguresSlot activity={activity} figures={figures} /> : null}
    </article>
  );
}

function InquiryCard({ inquiry: i, userId }: { inquiry: OwnerInquiry; userId: string }) {
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
