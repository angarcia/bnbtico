import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { HOLD_COPY, HOLD_REASON_MAX, deleteConfirmMatches, holdReasonRefusal } from "../../domain/admin-actions";
import { CHIP_LABELS, HOUSE_CHIPS, adminHouseLine, countHouses, filterHouses, houseLabel, type AdminHouse, type HouseChip } from "../../domain/admin-houses";
import { PUBLISHED_STATUSES } from "../../domain/can";
import { toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { I } from "../../shared/ui/icons";
import { toast } from "../../shared/toast";
import { firstName, ownerNoticeUrl } from "../../domain/owner-notice";
import { adminHousesQuery, HOUSE_ACTION_DONE, useHouseAction } from "./admin-queries";
import { ScreenHeader } from "../comun/screen-header";
import { Sheet } from "../../shared/ui/overlay";
import { AdminBadge, NotAdmin, NoticeLink, message, useIsAdmin, useUserId } from "./admin-shared";
import { Field, SearchInput, TextArea, TextInput } from "../../shared/ui/field";
import { Button } from "../../shared/ui/button";
import { RouterButtonLink } from "../comun/router-buttons";
import { RouterListRow } from "../comun/router-rows";
import { EmptyState, LoadError, Notice, Skeleton, StatusTag } from "../../shared/ui/structure";
import { List, ListRowButton } from "../../shared/ui/card";
import * as ADMIN_COPY from "./copy/admin";

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
        <ScreenHeader kind="root" title={ADMIN_COPY.housesTitle} home="/explorar" />
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
      <ScreenHeader kind="root" title={ADMIN_COPY.housesTitle} home="/admin" action={<AdminBadge />} />
      <SearchInput
        variant="field"
        type="search"
        name="q"
        aria-label={ADMIN_COPY.searchHouses}
        placeholder={ADMIN_COPY.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <nav className="chiprow" aria-label={ADMIN_COPY.filterHouses}>
        {HOUSE_CHIPS.map((c) => (
          <Link key={c} to="/admin/casas" search={c === "todas" ? {} : { ver: c }} className="chip chip-sm" activeOptions={{ exact: true, includeSearch: true }}>
            {counts ? `${CHIP_LABELS[c]} · ${counts[c]}` : CHIP_LABELS[c]}
          </Link>
        ))}
      </nav>
      {houses.isError && !data ? (
        <LoadError onRetry={() => void houses.refetch()}>
          {message(houses.error)}
        </LoadError>
      ) : null}
      {!data && !houses.isError ? (
        <Skeleton shape="line" label={ADMIN_COPY.loadingHouses} />
      ) : null}
      {data && shown.length === 0 ? (
        <EmptyState text={<p className="muted">{query.trim() ? ADMIN_COPY.noMatch : chip === "todas" ? ADMIN_COPY.noApproved : ADMIN_COPY.nothingHere}</p>} />
      ) : null}
      {data && shown.length > 0 ? (
        <List aria-label={ADMIN_COPY.housesList}>
          {shown.map((h) => (
            <HouseRow key={h.listingId} house={h} today={data.today} onOpen={() => setOpenId(h.listingId)} />
          ))}
        </List>
      ) : null}
      <p className="xs muted queue-foot">{ADMIN_COPY.housesFoot}</p>
      <RouterButtonLink to="/admin/borradores" variant="secondary" block>
        {ADMIN_COPY.drafts}
      </RouterButtonLink>
      {/* La hoja sigue a la lista: al terminar una acción la casa cambia (o desaparece, y la hoja se cierra). */}
      {data && openId && data.houses.some((h) => h.listingId === openId) ? (
        <HouseSheet house={data.houses.find((h) => h.listingId === openId)!} today={data.today} userId={userId} onClose={() => setOpenId(null)} />
      ) : null}
    </>
  );
}

function HouseRow({ house: h, today, onOpen }: { house: AdminHouse; today: string; onOpen(): void }) {
  const badge = houseLabel(h);
  return (
    <ListRowButton placement="house-row" aria-haspopup="dialog" onClick={onOpen}>
      {h.cover ? <img src={variantUrl(h.cover, 480)} alt="" className="thumb house-thumb" width={56} height={56} loading="lazy" decoding="async" /> : <span className="thumb house-thumb" />}
      <span className="body stack house-body">
        <b className="house-title">{h.title || ADMIN_COPY.noName}</b>
        <small className="num">{[h.publicId, h.ownerName, h.zone].filter(Boolean).join(" · ")}</small>
        <small className="num">{adminHouseLine(h.subscription, today)}</small>
      </span>
      <StatusTag label={badge} tight />
    </ListRowButton>
  );
}

// ---------- Detalle de una casa: pausar, bloquear y eliminar (spec .scratch/admin-casas-acciones) ----------
type SheetMode = "detail" | "pause" | "block" | "delete";

/** Lo que cada acción hace, dicho al admin antes de confirmarla. */
const MODE_COPY: Record<Exclude<SheetMode, "detail">, { title: string; body: string; label: string; confirm: string; field: string }> = {
  pause: {
    title: ADMIN_COPY.pauseTitle,
    body: ADMIN_COPY.pauseBody,
    label: ADMIN_COPY.reasonForHost,
    confirm: ADMIN_COPY.pauseTitle,
    field: "pause-reason",
  },
  block: {
    title: ADMIN_COPY.blockTitle,
    body: ADMIN_COPY.blockBody,
    label: ADMIN_COPY.reasonForHost,
    confirm: ADMIN_COPY.blockTitle,
    field: "block-reason",
  },
  delete: {
    title: ADMIN_COPY.deleteTitle,
    body: ADMIN_COPY.deleteBody,
    label: ADMIN_COPY.reasonForLog,
    confirm: ADMIN_COPY.deleteTitle,
    field: "delete-reason",
  },
};

/** Hoja con los datos de la casa y las acciones según su estado. Portal a <body>, #root inerte y foco atrapado, como ConfirmSheet. */
function HouseSheet({ house: h, today, userId, onClose }: { house: AdminHouse; today: string; userId: string; onClose(): void }) {
  const [mode, setMode] = useState<SheetMode>("detail");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonError = error && !reason.trim() ? error : null;
  const act = useHouseAction(userId);
  const badge = houseLabel(h);
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
  // Mientras una acción se guarda no se cierra; con un motivo o la confirmación escritos, pregunta antes (D10).
  return (
    <Sheet title={h.title || ADMIN_COPY.noName} subtitle={<span className="num">{[h.publicId, h.ownerName, h.zone].filter(Boolean).join(" · ")}</span>}
      busy={pending} onClose={onClose} confirmDiscard={() => mode !== "detail" && (reason.trim() !== "" || confirm.trim() !== "")}>

        {!copy ? (
          <>
            <div className="row gap-8">
              <StatusTag label={badge} tight />
              <span className="small num">{adminHouseLine(h.subscription, today)}</span>
            </div>
            {h.hold ? (
              <Notice tone="solid" small layout="stack" data-testid="hold-note">
                <b>{HOLD_COPY[h.hold.kind].title}</b>
                <span>{h.hold.reason}</span>
              </Notice>
            ) : null}
            {h.hold ? (
              <NoticeLink
                name={firstName(h.ownerName)}
                href={ownerNoticeUrl(h.ownerPhone, { kind: h.hold.kind, ownerName: h.ownerName, title: h.title, publicId: h.publicId, origin: window.location.origin, note: h.hold.reason })}
              />
            ) : null}
            <List>
              {visible ? (
                <RouterListRow to="/casa/$publicId" params={{ publicId: h.publicId }} onClick={onClose}>
                  <span className="body">{ADMIN_COPY.publicPage}</span>
                  <span className="chev">
                    <I.chevron />
                  </span>
                </RouterListRow>
              ) : null}
              <RouterListRow to="/admin/anuncios/$id" params={{ id: h.listingId }} onClick={onClose}>
                <span className="body">{ADMIN_COPY.listingData}</span>
                <span className="chev">
                  <I.chevron />
                </span>
              </RouterListRow>
              {/* Editar (ticket 10 de la ronda de Ana): al momento, sin revisión, con las pantallas del anfitrión. */}
              <RouterListRow to="/admin/casas/$id" params={{ id: h.listingId }} onClick={onClose}>
                <span className="body">{ADMIN_COPY.editHouse}</span>
                <span className="chev">
                  <I.chevron />
                </span>
              </RouterListRow>
              <RouterListRow to="/admin/casas/$id/calendario" params={{ id: h.listingId }} onClick={onClose}>
                <span className="body">{ADMIN_COPY.editCalendar}</span>
                <span className="chev">
                  <I.chevron />
                </span>
              </RouterListRow>
            </List>
            {error ? (
              <Notice tone="error">
                {error}
              </Notice>
            ) : null}
            {published ? (
              <div className="stack gap-8">
                {h.hold?.kind === "paused" ? (
                  <Button variant="primary" block disabled={pending} onClick={() => run({ kind: "resume", id: h.listingId, publicId: h.publicId })}>
                    {ADMIN_COPY.resume}
                  </Button>
                ) : null}
                {h.hold?.kind === "blocked" ? (
                  <Button variant="primary" block disabled={pending} onClick={() => run({ kind: "unblock", id: h.listingId, publicId: h.publicId })}>
                    {ADMIN_COPY.unblock}
                  </Button>
                ) : null}
                {!h.hold ? (
                  <Button variant="primary" block onClick={() => go("pause")}>
                    {ADMIN_COPY.pause}
                  </Button>
                ) : null}
                {h.hold?.kind !== "blocked" ? (
                  <Button variant="primary" block onClick={() => go("block")}>
                    {ADMIN_COPY.block}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="small muted">{ADMIN_COPY.onlyPublished}</p>
            )}
            <Button variant="danger" block onClick={() => go("delete")}>
              {ADMIN_COPY.deleteHouse}
            </Button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3>{copy.title}</h3>
            <p className="small muted">{copy.body}</p>
            {/* Sin motivo, el error va bajo el motivo; los demás (la red, la base), al final. */}
            <Field id={copy.field} label={copy.label} size="compact" error={reasonError}>
              {(control) => <TextArea {...control} name="reason" rows={3} maxLength={HOLD_REASON_MAX} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />}
            </Field>
            {mode === "delete" ? (
              <Field id="delete-confirm" label={<>{ADMIN_COPY.deleteConfirm({ id: <b key="id" className="num">{h.publicId}</b> })}</>} size="compact">
                {(control) => <TextInput {...control} name="confirm" autoComplete="off" autoCapitalize="characters" value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} />}
              </Field>
            ) : null}
            {error && !reasonError ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <Button variant={mode === "delete" ? "danger" : "primary"} block type="submit" disabled={pending || (mode === "delete" && !deleteConfirmMatches(h.publicId, confirm))}>
              {copy.confirm}
            </Button>
            <Button variant="secondary" block disabled={pending} onClick={() => go("detail")}>
              {ADMIN_COPY.cancel}
            </Button>
          </form>
        )}
    </Sheet>
  );
}
