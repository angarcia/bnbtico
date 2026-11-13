// Consultas (antes Actividad; revisión UX 2026-10-29, C1): las últimas consultas, las nuevas primero, que abren WhatsApp con
// el cliente; con varias casas se filtran con el selector compartido (`?casa=<uuid>`). Las cifras de 30
// días de cada casa están en su detalle (casa-editable).
// Trozo diferido. Se pinta desde la caché (persistida con la sesión) y se refresca por detrás.
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { toDomainError } from "../../domain/errors";
import { initials, inquirySummary, relativeTime, type OwnerInquiry } from "../../domain/inquiry";
import { filterInquiries, inquiryHouseOptions } from "../../domain/inquiry-filter";
import type { Listing } from "../../domain/listing";
import { I } from "../../shared/icons";
import { RootHeader } from "../chrome";
import { inquiriesQuery, markInquirySeen, openInquiry } from "../inquiries";
import { HousePicker } from "../house-picker";
import { ownListingsQuery } from "../own-listings-query";
import { useSession } from "../session";

const LATEST = 20;
const SEEN_DELAY_MS = 800;
const EMPTY = "Cuando alguien le escriba por WhatsApp desde la ficha de su casa, aparecerá aquí.";

const route = getRouteApi("/_tabs/_private/_owner/propietario/actividad");

export function ActividadScreen() {
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  const navigate = useNavigate();
  const seenThisVisit = useRef(new Map<string, string>());
  const rememberSeen = useCallback((i: OwnerInquiry) => {
    if (!i.openedAt) seenThisVisit.current.set(i.id, i.updatedAt);
  }, []);
  // Con `?casa=` se vuelve a leer siempre al abrir: una casa publicada hace un momento aún no está en la caché.
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId, refetchOnMount: search.casa ? "always" : true });
  const restoring = useIsRestoring();
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const list = listings.data;
  const inquiriesFailed = inquiries.isError && !inquiries.data;
  const choices = list ? inquiryHouseOptions(list) : null;
  const selected = choices?.some((c) => c.id === search.casa) ? search.casa! : null;
  // Una casa desconocida, o una sola casa: «Todas», pero solo con la lista leída de la base tras abrir y sin error (sin red,
  // la casa puede faltar en la copia del teléfono: `casa` se queda y se ven sus consultas).
  const settled = listings.isFetchedAfterMount && listings.isSuccess && !listings.isFetching && !restoring;
  const dropCasa = !!list && !!search.casa && !selected && settled;
  useEffect(() => {
    if (dropCasa) void navigate({ to: "/propietario/actividad", search: {}, replace: true });
  }, [dropCasa, navigate]);
  // Las nuevas primero y, dentro de cada grupo, la más reciente arriba (revisión UX 2026-10-29, C1).
  const filterId = selected ?? (settled ? null : (search.casa ?? null));
  const all = filterInquiries(inquiries.data ?? [], filterId);
  // Una consulta que acaba de quitar «Nueva» conserva su lugar mientras el anfitrión recorre la lista.
  const first = (i: OwnerInquiry) => !i.openedAt || seenThisVisit.current.get(i.id) === i.updatedAt;
  const latest = [...all.filter(first), ...all.filter((i) => !first(i))].slice(0, LATEST);
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
      ) : (
        <section className="stack gap-12">
          <p className="small muted" data-testid="inquiries-new">
            {fresh === 0 ? "Sin consultas nuevas" : fresh === 1 ? "1 consulta nueva" : `${fresh} consultas nuevas`}
          </p>
          {choices ? (
            <HousePicker houses={choices} currentId={filterId} allowAll currentName={inquiries.data?.find((i) => i.listingId === filterId)?.listingTitle}
              onPick={(id) => void navigate({ to: "/propietario/actividad", search: id ? { casa: id } : {}, replace: true })} />
          ) : null}
          {(inquiries.data ?? []).length === 0 ? <p>{EMPTY}</p> : latest.length > 0 ? (
            latest.map((i) => <InquiryCard key={i.id} inquiry={i} userId={userId} house={houses.get(i.listingId)} showHouse={choices !== null && filterId === null} rememberSeen={rememberSeen} />)
          ) : (
            <p className="small muted">Todavía no hay consultas de esta casa.</p>
          )}
          {(inquiries.data ?? []).length > 0 ? <p className="xs muted inquiries-foot">La conversación está en su WhatsApp.</p> : null}
        </section>
      )}
    </>
  );
}

function InquiryCard({ inquiry: i, userId, house, showHouse, rememberSeen }: { inquiry: OwnerInquiry; userId: string; house: Listing | undefined; showHouse: boolean; rememberSeen: (i: OwnerInquiry) => void }) {
  const client = useQueryClient();
  const opening = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const isNew = !i.openedAt;
  const nameId = `inquiry-${i.id}`;
  useEffect(() => {
    const el = heading.current;
    if (!el || i.openedAt || typeof IntersectionObserver === "undefined") return;
    // Basta con ver el nombre completo. No cuenta el área de la barra fija.
    const bottom = document.querySelector(".tabbar")?.getBoundingClientRect().height ?? 0;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function waitForView() {
      clearTimeout(timer);
      if (!visible || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        if (el?.closest("[inert]")) return waitForView();
        visible = false;
        observer.disconnect();
        rememberSeen(i);
        void markInquirySeen(client, userId, i);
      }, SEEN_DELAY_MS);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting && entry.intersectionRatio >= 0.99;
      waitForView();
    }, { rootMargin: `0px 0px -${bottom}px 0px`, threshold: 0.99 });
    observer.observe(el);
    document.addEventListener("visibilitychange", waitForView);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", waitForView);
    };
  }, [client, i, rememberSeen, userId]);
  function open() {
    if (opening.current) return;
    opening.current = true;
    rememberSeen(i);
    void openInquiry(client, userId, i).finally(() => (opening.current = false));
  }
  return (
    <article className={`card stack gap-10 inquiry-card${isNew ? " is-new" : ""}`} aria-labelledby={nameId}>
      {showHouse ? <span className="inquiry-house small muted" data-testid="inquiry-house">{house?.title || i.listingTitle || "Casa sin título"}</span> : null}
      <div className="row gap-12 align-top">
        <span className={`avatar inquiry-avatar${isNew ? "" : " is-read"}`} aria-hidden="true">
          {initials(i.clientName)}
        </span>
        <div className="stack inquiry-body grow-col">
          <div className="row between baseline gap-8 inquiry-head">
            <h3 ref={heading} id={nameId} className="inquiry-name">
              {i.clientName}
            </h3>
            <span className="row baseline gap-6 nowrap">
              {isNew ? <span className="badge badge-new">Nueva</span> : null}
              <span className="xs muted">{relativeTime(i.updatedAt, Date.now())}</span>
            </span>
          </div>
          <span className="small muted">{inquirySummary(i)}</span>
          {i.source === "support" ? <span className="badge badge-tight">Creada por 3bstays</span> : null}
        </div>
      </div>
      <button type="button" className="btn-link inquiry-wa" onClick={open}>
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
