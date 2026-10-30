// Consultas (antes Actividad; revisión UX 2026-10-29, C1): las últimas consultas, las nuevas primero, que abren WhatsApp con
// el cliente; cada consulta lleva su casa y, con dos o más casas, chips para filtrarlas (`?casa=<uuid>`). Las cifras de 30
// días de cada casa están en su detalle (casa-editable).
// Trozo diferido. Se pinta desde la caché (persistida con la sesión) y se refresca por detrás.
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { initials, inquirySummary, relativeTime, type OwnerInquiry } from "../../domain/inquiry";
import { filterInquiries, inquiryChips } from "../../domain/inquiry-filter";
import type { Listing } from "../../domain/listing";
import { I } from "../../shared/icons";
import { RootHeader } from "../chrome";
import { inquiriesQuery, openInquiry } from "../inquiries";
import { ownListingsQuery } from "../own-listings-query";
import { useSession } from "../session";

const LATEST = 20;
const EMPTY = "Cuando alguien le escriba por WhatsApp desde la ficha de su casa, aparecerá aquí.";

const route = getRouteApi("/_tabs/_private/_owner/propietario/actividad");

export function ActividadScreen() {
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  const navigate = useNavigate();
  // Con `?casa=` se vuelve a leer siempre al abrir: una casa publicada hace un momento aún no está en la caché.
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId, refetchOnMount: search.casa ? "always" : true });
  const restoring = useIsRestoring();
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const list = listings.data;
  const inquiriesFailed = inquiries.isError && !inquiries.data;
  const chips = list ? inquiryChips(list) : null;
  const selected = chips?.some((c) => c.id === search.casa) ? search.casa! : null;
  // Una casa desconocida, o una sola casa: «Todas», pero solo con la lista leída de la base tras abrir y sin error (sin red,
  // la casa puede faltar en la copia del teléfono: `casa` se queda y se ven sus consultas).
  const settled = listings.isFetchedAfterMount && listings.isSuccess && !listings.isFetching && !restoring;
  const dropCasa = !!list && !!search.casa && !selected && settled;
  useEffect(() => {
    if (dropCasa) void navigate({ to: "/propietario/actividad", search: {}, replace: true });
  }, [dropCasa, navigate]);
  // Las nuevas primero y, dentro de cada grupo, la más reciente arriba (revisión UX 2026-10-29, C1).
  const all = filterInquiries(inquiries.data ?? [], selected ?? (settled ? null : (search.casa ?? null)));
  const latest = [...all.filter((i) => !i.openedAt), ...all.filter((i) => i.openedAt)].slice(0, LATEST);
  const fresh = (inquiries.data ?? []).filter((i) => !i.openedAt).length;
  const houses = new Map((list ?? []).map((l) => [l.id, l]));
  const waiting = !list || (!inquiries.data && !inquiriesFailed);

  return (
    <>
      {/* Revisión UX 2026-10-29 (C1, Ana): la pestaña es «Consultas» y solo tiene consultas; las cifras de cada casa van en
          su detalle. Sin título visible (T2): arriba, cuántas nuevas hay. */}
      <RootHeader title="Consultas" />
      {listings.isError && !list ? (
        <p className="note" role="alert">
          {toDomainError(listings.error).message}
        </p>
      ) : waiting ? (
        <SkeletonActivity />
      ) : inquiriesFailed ? (
        <p className="note" role="alert">
          {toDomainError(inquiries.error).message}
        </p>
      ) : (inquiries.data ?? []).length === 0 ? (
        <p>{EMPTY}</p>
      ) : (
        <section className="stack gap-12">
          <p className="small muted" data-testid="inquiries-new">
            {fresh === 0 ? "Sin consultas nuevas" : fresh === 1 ? "1 consulta nueva" : `${fresh} consultas nuevas`}
          </p>
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
      )}
    </>
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
