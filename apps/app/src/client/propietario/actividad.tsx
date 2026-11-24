// Consultas (antes Actividad; revisión UX 2026-10-29, C1): las últimas consultas, las nuevas primero, que abren WhatsApp con
// el cliente; con varias casas se filtran con el selector compartido (`?casa=<uuid>`). Las cifras de 30
// días de cada casa están en su detalle (casa-editable).
// Trozo diferido. Se pinta desde la caché (persistida con la sesión) y se refresca por detrás.
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toDomainError } from "../../domain/errors";
import { initials, inquirySummary, relativeTime, type OwnerInquiry } from "../../domain/inquiry";
import { filterInquiries, inquiryHouseOptions } from "../../domain/inquiry-filter";
import type { Listing } from "../../domain/listing";
import { I } from "../../shared/ui/icons";
import { ScreenHeader } from "../comun/screen-header";
import { countNew, inquiriesQuery, markInquirySeen, openInquiry } from "./inquiries";
import { HousePicker } from "./house-picker";
import { ownListingsQuery } from "../comun/own-listings-query";
import { useSession } from "../comun/session";
import { Dialog } from "../../shared/ui/overlay";
import { LoadError, Skeleton, StatusTag } from "../../shared/ui/structure";
import { Card } from "../../shared/ui/card";
import * as ACTIVITY_COPY from "./copy/actividad";

const LATEST = 20;
const SEEN_DELAY_MS = 800;
const EMPTY = ACTIVITY_COPY.empty;

const route = getRouteApi("/_tabs/_private/_owner/propietario/actividad");

export function ActividadScreen() {
  const search = route.useSearch();
  const navigate = useNavigate();
  const pickCasa = useCallback((id: string | null) => void navigate({
    to: "/propietario/actividad", search: id ? { casa: id } : {}, replace: true,
  }), [navigate]);
  return (
    <>
      <ScreenHeader kind="root" title={ACTIVITY_COPY.title} />
      <InquiryList casa={search.casa} onPick={pickCasa} />
    </>
  );
}

export function InquiriesDialog({ onClose }: { onClose: () => void }) {
  const [casa, setCasa] = useState<string | null>(null);
  return (
    <Dialog layout="inquiries" title={ACTIVITY_COPY.title} onClose={onClose}>
      <InquiryList casa={casa} onPick={setCasa} inDialog />
    </Dialog>
  );
}

function InquiryList({ casa, onPick, inDialog = false }: {
  casa: string | null | undefined;
  onPick: (id: string | null) => void;
  inDialog?: boolean;
}) {
  const userId = useSession().session?.userId ?? "";
  const seenThisVisit = useRef(new Map<string, string>());
  const rememberSeen = useCallback((i: OwnerInquiry) => {
    if (!i.openedAt) seenThisVisit.current.set(i.id, i.updatedAt);
  }, []);
  // Con `?casa=` se vuelve a leer siempre al abrir: una casa publicada hace un momento aún no está en la caché.
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId, refetchOnMount: casa && !inDialog ? "always" : true });
  const restoring = useIsRestoring();
  const inquiries = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const list = listings.data;
  const error = list ? !inquiries.data && inquiries.error : listings.error;
  const choices = list ? inquiryHouseOptions(list) : null;
  const selected = choices?.find((c) => c.id === casa)?.id ?? null;
  // Una casa desconocida, o una sola casa: «Todas», pero solo con la lista leída de la base tras abrir y sin error (sin red,
  // la casa puede faltar en la copia del teléfono: `casa` se queda y se ven sus consultas).
  const settled = listings.isFetchedAfterMount && listings.isSuccess && !listings.isFetching && !restoring;
  const dropCasa = !!list && !!casa && !selected && settled;
  useEffect(() => {
    if (dropCasa) onPick(null);
  }, [dropCasa, onPick]);
  // Las nuevas primero y, dentro de cada grupo, la más reciente arriba (revisión UX 2026-10-29, C1).
  const filterId = selected ?? (settled ? null : (casa ?? null));
  const entries = inquiries.data ?? [];
  const all = filterInquiries(entries, filterId);
  // Una consulta que acaba de quitar «Nueva» conserva su lugar mientras el anfitrión recorre la lista.
  const first = (i: OwnerInquiry) => !i.openedAt || seenThisVisit.current.get(i.id) === i.updatedAt;
  const latest = [...all.filter(first), ...all.filter((i) => !first(i))].slice(0, LATEST);
  const fresh = countNew(entries);
  const houses = new Map((list ?? []).map((l) => [l.id, l]));
  const waiting = !list || !inquiries.data;

  return (
    <>
      {error ? (
        <LoadError onRetry={() => { if (listings.isError) void listings.refetch(); if (inquiries.isError) void inquiries.refetch(); }}>{toDomainError(error).message}</LoadError>
      ) : waiting ? (
        <Skeleton shape="avatar" label={ACTIVITY_COPY.loading} />
      ) : (
        <section className="stack gap-12">
          <p className="small muted" data-testid="inquiries-new">
            {ACTIVITY_COPY.fresh({ count: fresh })}
          </p>
          {choices ? (
            <HousePicker houses={choices} currentId={filterId} allowAll currentName={inquiries.data?.find((i) => i.listingId === filterId)?.listingTitle}
              onPick={onPick} />
          ) : null}
          {!entries.length ? <p>{EMPTY}</p> : latest.length > 0 ? (
            latest.map((i) => <InquiryCard key={i.id} inquiry={i} userId={userId} house={houses.get(i.listingId)} showHouse={choices !== null && filterId === null} rememberSeen={rememberSeen} inDialog={inDialog} />)
          ) : (
            <p className="small muted">{ACTIVITY_COPY.noneForHouse}</p>
          )}
          {entries.length > 0 && <p className="xs muted inquiries-foot">{ACTIVITY_COPY.foot}</p>}
        </section>
      )}
    </>
  );
}

function InquiryCard({ inquiry: i, userId, house, showHouse, rememberSeen, inDialog }: { inquiry: OwnerInquiry; userId: string; house: Listing | undefined; showHouse: boolean; rememberSeen: (i: OwnerInquiry) => void; inDialog: boolean }) {
  const client = useQueryClient();
  const opening = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const isNew = !i.openedAt;
  const dialogId = useId();
  const nameId = inDialog ? dialogId : `inquiry-${i.id}`;
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
        const modal = document.querySelector("dialog:modal");
        if (el?.closest("[inert]") || (modal && !modal.contains(el))) return waitForView();
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
    <Card as="article" layout="stack" gap={10} placement="inquiry-card" mark={isNew ? "new" : undefined} aria-labelledby={nameId}>
      {showHouse ? <span className="inquiry-house small muted" data-testid="inquiry-house">{house?.title || i.listingTitle || ACTIVITY_COPY.untitled}</span> : null}
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
              {isNew ? <StatusTag label={{ text: ACTIVITY_COPY.isNew, tone: "new" }} /> : null}
              <span className="xs muted">{relativeTime(i.updatedAt, Date.now())}</span>
            </span>
          </div>
          <span className="small muted">{inquirySummary(i)}</span>
          {i.source === "support" ? <StatusTag tight label={{ text: ACTIVITY_COPY.bySupport, tone: "neutral" }} /> : null}
        </div>
      </div>
      <button type="button" className="btn-link inquiry-wa" onClick={open}>
        <I.wa size={18} /> {ACTIVITY_COPY.openWhatsapp}
      </button>
    </Card>
  );
}


