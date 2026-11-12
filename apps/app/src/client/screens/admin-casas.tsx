import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { HOLD_COPY, HOLD_REASON_MAX, deleteConfirmMatches, holdReasonRefusal } from "../../domain/admin-actions";
import { CHIP_LABELS, HOUSE_CHIPS, adminHouseLine, countHouses, filterHouses, houseBadge, type AdminHouse, type HouseChip } from "../../domain/admin-houses";
import { PUBLISHED_STATUSES } from "../../domain/can";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { I } from "../../shared/icons";
import { toast } from "../../shared/toast";
import { firstName, ownerNoticeUrl } from "../../domain/owner-notice";
import { adminHousesQuery, HOUSE_ACTION_DONE, useHouseAction } from "../admin";
import { RootHeader } from "../chrome";
import { usePrivateSheet } from "../private-sheet";
import { AdminBadge, NotAdmin, NoticeLink, message, useIsAdmin, useUserId } from "./admin-shared";

// ---------- 23 · Casas ----------
const casasRoute = getRouteApi("/_tabs/_admin/admin/casas");

export function CasasAdminScreen() {
  const { ver } = casasRoute.useSearch();
  const chip: HouseChip = HOUSE_CHIPS.find((c) => c === ver) ?? "todas";
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const houses = useQuery({ ...adminHousesQuery(userId), enabled: !!userId && isAdmin !== false });
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (isAdmin === false) {
    return (
      <>
        <RootHeader title="Casas" home="/explorar" />
        <NotAdmin />
      </>
    );
  }
  if (houses.error && toDomainError(houses.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: "/admin/casas" }} replace />;

  const data = houses.data;
  const counts = data ? countHouses(data.houses) : null;
  const shown = data ? filterHouses(data.houses, chip, query) : [];
  return (
    <>
      <RootHeader title="Casas" home="/admin" action={<AdminBadge />} />
      <label className="search-field">
        <I.search size={18} />
        <input
          type="search"
          name="q"
          aria-label="Buscar casas"
          placeholder="Nombre, CT-#### o anfitrión"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </label>
      <nav className="chiprow" aria-label="Filtrar casas">
        {HOUSE_CHIPS.map((c) => (
          <Link key={c} to="/admin/casas" search={c === "todas" ? {} : { ver: c }} className="chip chip-sm" activeOptions={{ exact: true, includeSearch: true }}>
            {counts ? `${CHIP_LABELS[c]} · ${counts[c]}` : CHIP_LABELS[c]}
          </Link>
        ))}
      </nav>
      {houses.isError && !data ? (
        <p className="note" role="alert">
          {message(houses.error)}
        </p>
      ) : null}
      {!data && !houses.isError ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando las casas">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {data && shown.length === 0 ? (
        <section className="card">
          <p className="muted">{query.trim() ? "Ninguna casa coincide con la búsqueda." : chip === "todas" ? "Todavía no hay casas aprobadas." : "Nada por aquí."}</p>
        </section>
      ) : null}
      {data && shown.length > 0 ? (
        <section className="list" aria-label="Casas">
          {shown.map((h) => (
            <HouseRow key={h.listingId} house={h} today={data.today} onOpen={() => setOpenId(h.listingId)} />
          ))}
        </section>
      ) : null}
      <p className="xs muted queue-foot">Toque una casa para ver sus datos, editarla, pausarla, bloquearla o eliminarla.</p>
      <Link to="/admin/borradores" className="btn btn-ghost btn-block">
        Borradores sin enviar
      </Link>
      {/* La hoja sigue a la lista: al terminar una acción la casa cambia (o desaparece, y la hoja se cierra). */}
      {data && openId && data.houses.some((h) => h.listingId === openId) ? (
        <HouseSheet house={data.houses.find((h) => h.listingId === openId)!} today={data.today} userId={userId} onClose={() => setOpenId(null)} />
      ) : null}
    </>
  );
}

function HouseRow({ house: h, today, onOpen }: { house: AdminHouse; today: string; onOpen(): void }) {
  const badge = houseBadge(h);
  return (
    <button type="button" className="list-item house-row" aria-haspopup="dialog" onClick={onOpen}>
      {h.cover ? <img src={variantUrl(h.cover, 480)} alt="" className="thumb house-thumb" width={56} height={56} loading="lazy" decoding="async" /> : <span className="thumb house-thumb" />}
      <span className="body stack house-body">
        <b className="house-title">{h.title || "Sin nombre"}</b>
        <small className="num">{[h.publicId, h.ownerName, h.zone].filter(Boolean).join(" · ")}</small>
        <small className="num">{adminHouseLine(h.subscription, today)}</small>
      </span>
      <span className={`badge badge-tight ${badge.badge}`}>{badge.label}</span>
    </button>
  );
}

// ---------- Detalle de una casa: pausar, bloquear y eliminar (spec .scratch/admin-casas-acciones) ----------
type SheetMode = "detail" | "pause" | "block" | "delete";

/** Lo que cada acción hace, dicho al admin antes de confirmarla. */
const MODE_COPY: Record<Exclude<SheetMode, "detail">, { title: string; body: string; label: string; confirm: string; field: string }> = {
  pause: {
    title: "Pausar casa",
    body: "Sale de Explorar y su enlace deja de funcionar. El anfitrión la sigue viendo y editando, con el motivo; usted la reanuda cuando todo esté en orden. La suscripción no cambia.",
    label: "Motivo (lo verá el anfitrión)",
    confirm: "Pausar casa",
    field: "pause-reason",
  },
  block: {
    title: "Bloquear casa",
    body: "Igual para el público. El anfitrión verá el motivo y «Escribir a 3bstays», no podrá editarla ni reactivarla y su suscripción se para: sin cobro ni avisos mientras esté bloqueada.",
    label: "Motivo (lo verá el anfitrión)",
    confirm: "Bloquear casa",
    field: "block-reason",
  },
  delete: {
    title: "Eliminar casa",
    body: "Desaparece para todos, también para el anfitrión y de los favoritos de los clientes. Los datos, fotos y consultas quedan guardados, ocultos. No hay «deshacer» en la app.",
    label: "Motivo (queda en el registro)",
    confirm: "Eliminar casa",
    field: "delete-reason",
  },
};

/** Hoja con los datos de la casa y las acciones según su estado. Portal a <body>, #root inerte y foco atrapado, como ConfirmSheet. */
function HouseSheet({ house: h, today, userId, onClose }: { house: AdminHouse; today: string; userId: string; onClose(): void }) {
  const [mode, setMode] = useState<SheetMode>("detail");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { sheet, onKeyDown } = usePrivateSheet({
    onClose,
    focusable: "button:not(:disabled), a[href], textarea, input",
    trapEmpty: true,
    returnFocus(opener) {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    },
  });
  const act = useHouseAction(userId);
  const badge = houseBadge(h);
  const published = PUBLISHED_STATUSES.includes(h.status);
  const visible = h.status === "active" && !h.hold;

  function go(next: SheetMode) {
    setMode(next);
    setReason("");
    setConfirm("");
    setError(null);
    act.reset();
  }

  function run(a: Parameters<typeof act.mutate>[0]) {
    setError(null);
    act.mutate(a, {
      onSuccess: () => {
        toast(HOUSE_ACTION_DONE[a.kind]);
        // Pausar y bloquear dejan la hoja abierta: ahí está el botón para avisar al propietario por WhatsApp.
        if (a.kind === "pause" || a.kind === "block") go("detail");
        else onClose();
      },
      onError: (e) => setError(message(e)),
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "detail") return;
    const refusal = holdReasonRefusal(reason);
    if (refusal) return setError(refusal);
    const base = { id: h.listingId, publicId: h.publicId, reason: reason.trim() };
    run(mode === "delete" ? { kind: "delete", ...base, confirm } : { kind: mode, ...base });
  }

  const pending = act.isPending;
  const copy = mode === "detail" ? null : MODE_COPY[mode];
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={h.title || "Casa"} tabIndex={-1} onKeyDown={onKeyDown} data-testid="house-sheet">
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <div>
            <h2>{h.title || "Sin nombre"}</h2>
            <span className="small muted num">{[h.publicId, h.ownerName, h.zone].filter(Boolean).join(" · ")}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <I.x size={20} />
          </button>
        </div>

        {!copy ? (
          <>
            <div className="row gap-8">
              <span className={`badge badge-tight ${badge.badge}`}>{badge.label}</span>
              <span className="small num">{adminHouseLine(h.subscription, today)}</span>
            </div>
            {h.hold ? (
              <p className="note note-arena small stack gap-4" data-testid="hold-note">
                <b>{HOLD_COPY[h.hold.kind].title}</b>
                <span>{h.hold.reason}</span>
              </p>
            ) : null}
            {h.hold ? (
              <NoticeLink
                name={firstName(h.ownerName)}
                href={ownerNoticeUrl(h.ownerPhone, { kind: h.hold.kind, ownerName: h.ownerName, title: h.title, publicId: h.publicId, origin: window.location.origin, note: h.hold.reason })}
              />
            ) : null}
            <section className="list">
              {visible ? (
                <Link to="/casa/$publicId" params={{ publicId: h.publicId }} className="list-item" onClick={onClose}>
                  <span className="body">Ver ficha pública</span>
                  <span className="chev">
                    <I.chevron />
                  </span>
                </Link>
              ) : null}
              <Link to="/admin/anuncios/$id" params={{ id: h.listingId }} className="list-item" onClick={onClose}>
                <span className="body">Ver datos del anuncio</span>
                <span className="chev">
                  <I.chevron />
                </span>
              </Link>
              {/* Editar (ticket 10 de la ronda de Ana): al momento, sin revisión, con las pantallas del anfitrión. */}
              <Link to="/admin/casas/$id" params={{ id: h.listingId }} className="list-item" onClick={onClose}>
                <span className="body">Editar casa</span>
                <span className="chev">
                  <I.chevron />
                </span>
              </Link>
              <Link to="/admin/casas/$id/calendario" params={{ id: h.listingId }} className="list-item" onClick={onClose}>
                <span className="body">Editar calendario</span>
                <span className="chev">
                  <I.chevron />
                </span>
              </Link>
            </section>
            {error ? (
              <p className="note" role="alert">
                {error}
              </p>
            ) : null}
            {published ? (
              <div className="stack gap-8">
                {h.hold?.kind === "paused" ? (
                  <button type="button" className="btn btn-primary btn-block" disabled={pending} onClick={() => run({ kind: "resume", id: h.listingId, publicId: h.publicId })}>
                    Reanudar
                  </button>
                ) : null}
                {h.hold?.kind === "blocked" ? (
                  <button type="button" className="btn btn-primary btn-block" disabled={pending} onClick={() => run({ kind: "unblock", id: h.listingId, publicId: h.publicId })}>
                    Desbloquear
                  </button>
                ) : null}
                {!h.hold ? (
                  <button type="button" className="btn btn-soft btn-block" onClick={() => go("pause")}>
                    Pausar
                  </button>
                ) : null}
                {h.hold?.kind !== "blocked" ? (
                  <button type="button" className="btn btn-soft btn-block" onClick={() => go("block")}>
                    Bloquear
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="small muted">Solo se pausa o se bloquea una casa publicada.</p>
            )}
            <button type="button" className="btn btn-danger-outline btn-block" onClick={() => go("delete")}>
              Eliminar casa
            </button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3>{copy.title}</h3>
            <p className="small muted">{copy.body}</p>
            <label htmlFor={copy.field}>
              {copy.label}
              <textarea
                id={copy.field}
                name="reason"
                rows={3}
                maxLength={HOLD_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                aria-invalid={error && !reason.trim() ? true : undefined}
              />
            </label>
            {mode === "delete" ? (
              <label htmlFor="delete-confirm">
                Para confirmar, escriba <b className="num">{h.publicId}</b>
                <input id="delete-confirm" name="confirm" autoComplete="off" autoCapitalize="characters" value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} />
              </label>
            ) : null}
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className={mode === "delete" ? "btn btn-danger btn-block" : "btn btn-primary btn-block"} disabled={pending || (mode === "delete" && !deleteConfirmMatches(h.publicId, confirm))}>
              {copy.confirm}
            </button>
            <button type="button" className="btn btn-ghost btn-block" disabled={pending} onClick={() => go("detail")}>
              Cancelar
            </button>
          </form>
        )}
      </section>
    </>,
    document.body,
  );
}
