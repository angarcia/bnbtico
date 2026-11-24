import { randomUuid } from "../../../shared/random-uuid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { IcalError, validateAirbnbUrl } from "../../../domain/ical";
import { DomainError, toDomainError } from "../../../domain/errors";
import type { Listing } from "../../../domain/listing";
import { toast } from "../../../shared/toast";
import { airbnbApi, airbnbQuery, refreshAirbnbCalendar, updateAirbnbCalendar, useAirbnbManualHint, useCalendarOnline } from "./airbnb-queries";
import { ScreenHeader } from "../../comun/screen-header";
import { ownListingQuery } from "../owner";
import { Sheet } from "../../../shared/ui/overlay";
import { sessionState, useSession } from "../../comun/session";
import { IcalExportCard } from "./ical-export-card";
import { ConfirmSheet } from "../../comun/confirm-sheet";
import { Field, TextInput } from "../../../shared/ui/field";
import { Button, TextButton } from "../../../shared/ui/button";
import { LoadError, Notice, Skeleton } from "../../../shared/ui/structure";
import { Card, cardClass } from "../../../shared/ui/card";
import * as AIRBNB_COPY from "./copy/airbnb";

const route = getRouteApi("/_flow/_privateFlow/propietario/casas/$id/airbnb");
const time = (iso: string) => new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(iso));

export function AirbnbScreen() {
  const { id } = route.useParams();
  const { mes } = route.useSearch();
  const uid = useSession().session?.userId ?? "";
  return <AirbnbManagementScreen key={`${uid}:${id}`} id={id} uid={uid} mes={mes} />;
}

export function AirbnbConnectPopup({ listing, userId, onClose }: { listing: Listing; userId: string; onClose(): void }) {
  return <AirbnbManagementScreen id={listing.id} uid={userId} popup={{ listing, onClose }} />;
}

function AirbnbManagementScreen({ id, uid, mes, popup }: { id: string; uid: string; mes?: string; popup?: { listing: Listing; onClose(): void } }) {
  const client = useQueryClient();
  const online = useCalendarOnline();
  const house = useQuery({ ...ownListingQuery(uid, id, client), enabled: !!uid && !popup });
  const l = popup?.listing ?? house.data;
  const info = useQuery({ ...airbnbQuery(uid, id), enabled: !!uid && !!l });
  const [connecting, setConnecting] = useState<"connect" | "replace" | null>(popup ? "connect" : null);
  const [operation, setOperation] = useState<"refresh" | "disconnect" | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const refreshRequest = useRef(randomUuid());
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const current = () => active.current && sessionState().session?.userId === uid;
  const summary = info.data;
  const suspended = summary?.state === "suspended" || l?.adminHold?.kind === "blocked" || l?.status === "rejected";
  const busy = summary?.state === "running" || !!operation;
  // Límite manual (2026-11-17): «Actualizar ahora» espera 15 minutos desde la última lectura y hay 10 al día por casa.
  const limitHint = useAirbnbManualHint(summary);
  const dayFull = summary?.manualLeftToday === 0;
  async function reconcile() {
    const data = await (await airbnbApi()).overview(id);
    if (current()) client.setQueryData(airbnbQuery(uid, id).queryKey, data);
    return data;
  }
  async function update() {
    if (inFlight.current || busy || !online || !l) return;
    inFlight.current = true;
    setOperation("refresh"); setProblem(null);
    try {
      await updateAirbnbCalendar(client, uid, id, l.publicId, refreshRequest, current, setProblem);
    } finally { inFlight.current = false; if (current()) setOperation(null); }
  }
  async function disconnect() {
    if (inFlight.current || !confirmDisconnect || !online || !l) return;
    inFlight.current = true; setOperation("disconnect"); setDisconnectError(null);
    try {
      await (await airbnbApi()).disconnect(id, confirmDisconnect);
      const data = await reconcile();
      if (data.connected) throw new Error("La conexión cambió.");
      if (!current()) return;
      setConfirmDisconnect(null); setProblem(null);
      await refreshAirbnbCalendar(client, uid, id, l.publicId);
      if (current()) toast(AIRBNB_COPY.disconnected);
    } catch {
      if (!current()) return;
      const data = await reconcile().catch(() => null);
      if (!current()) return;
      if (data && !data.connected) {
        setConfirmDisconnect(null); setProblem(null);
        await refreshAirbnbCalendar(client, uid, id, l.publicId);
        if (current()) toast(AIRBNB_COPY.disconnected);
      } else setDisconnectError(AIRBNB_COPY.disconnectFailed);
    } finally { inFlight.current = false; if (current()) setOperation(null); }
  }
  const connectForm = connecting && l ? <ConnectSheet houseName={popup?.listing.title}
    exportCard={popup ? <IcalExportCard id={id} userId={uid} inlineConfirmation /> : undefined}
    connected={!!popup && !!summary?.connected}
    replacing={connecting === "replace"} onClose={popup?.onClose ?? (() => setConnecting(null))} onConnect={async (url, requestId) => {
    const api = await airbnbApi();
    const data = await (connecting === "replace" ? api.replace(id, url, requestId) : api.connect(id, url, requestId)).catch(async error => {
      if (current()) await reconcile().catch(() => {});
      throw error;
    });
    if (!current()) return false;
    client.setQueryData(airbnbQuery(uid, id).queryKey, data);
    if (!data.connected || data.state === "running") {
      await client.invalidateQueries({ queryKey: airbnbQuery(uid, id).queryKey });
      throw new DomainError(data.state === "running" ? AIRBNB_COPY.connectRunning : AIRBNB_COPY.connectFailed, data.state === "running" ? "conflict" : "validation");
    }
    await refreshAirbnbCalendar(client, uid, id, l.publicId);
    if (!current()) return false;
    if (!popup) setConnecting(null);
    toast(connecting === "replace" ? AIRBNB_COPY.replaced : AIRBNB_COPY.connectedToast);
    return true;
  }} /> : null;
  if (popup) return connectForm;
  return <>
    <ScreenHeader kind="flow" title={AIRBNB_COPY.title} back={{ to: "/propietario/calendario", search: { casa: id, ...(mes ? { mes } : {}) }, historyBack: true }} />
    {l ? <p className="cal-house">{l.title}</p> : null}
    {house.isPending || info.isPending && l ? <Skeleton shape="calendar" label={AIRBNB_COPY.loading} /> : null}
    {house.isError || info.isError ? <LoadError onRetry={() => { if (house.isError) void house.refetch(); if (info.isError) void info.refetch(); }}>{toDomainError(house.error ?? info.error).message}</LoadError> : null}
    {house.data === null ? <Notice tone="error">{AIRBNB_COPY.notFound}</Notice> : null}
    {l && summary ? <Card layout="stack" gap={16} aria-labelledby="airbnb-import-title" aria-busy={busy}>
      <h2 id="airbnb-import-title">{AIRBNB_COPY.importTitle}</h2>
      <p>{AIRBNB_COPY.importText}</p>
      {suspended ? <Notice>{AIRBNB_COPY.suspended}</Notice> : null}
      {summary.lastSuccessAt ? <p className="small muted">{AIRBNB_COPY.lastSuccess({ at: time(summary.lastSuccessAt) })}</p> : null}
      {summary.connected ? <p>{AIRBNB_COPY.nights({ count: summary.nights })}</p> : null}
      {!online ? <Notice small>{AIRBNB_COPY.offline}</Notice> : null}
      {summary.errorCode ? <Notice tone="error">{summary.connected ? <>{AIRBNB_COPY.updateFailed({ at: summary.lastErrorAt ? time(summary.lastErrorAt) : null })}</> : null}{new IcalError(summary.errorCode).message}</Notice> : null}
      {problem ? <p className="field-error" role="alert">{problem}</p> : null}
      {summary.state === "running" ? <p role="status">{AIRBNB_COPY.running({ connected: summary.connected })}</p> : null}
      {!summary.connected && !suspended ? <Button variant="primary" size="lg" disabled={busy || !online} onClick={() => setConnecting("connect")}>{AIRBNB_COPY.connect}</Button> : null}
      {summary.connected ? <>
        <Button variant="primary" size="lg" disabled={busy || !online || suspended || !!limitHint} aria-describedby={limitHint && !busy ? "airbnb-limit" : undefined} onClick={() => void update()}>{AIRBNB_COPY.update({ running: operation === "refresh" || summary.state === "running", failed: !!summary.errorCode })}</Button>
        {limitHint && !busy && !suspended ? <p id="airbnb-limit" className="small muted center" data-testid="airbnb-limit">{limitHint}</p> : null}
        <Button variant="secondary" size="lg" disabled={busy || !online || suspended || dayFull} onClick={() => setConnecting("replace")}>{AIRBNB_COPY.replace}</Button>
        <TextButton tone="quiet" placement="sub-stop" disabled={!!operation || !online} onClick={() => { setDisconnectError(null); setConfirmDisconnect(randomUuid()); }}>{AIRBNB_COPY.disconnect}</TextButton>
      </> : null}
    </Card> : null}
    {l && summary ? <IcalExportCard key={`${uid}:${id}`} id={id} userId={uid} /> : null}
    <Notice small>{AIRBNB_COPY.syncNote}</Notice>
    {confirmDisconnect ? <ConfirmSheet title={AIRBNB_COPY.disconnectTitle} body={AIRBNB_COPY.disconnectText}
      confirmLabel={AIRBNB_COPY.disconnecting({ pending: operation === "disconnect" })} tone="destructive"
      pending={operation === "disconnect"} error={disconnectError} onClose={() => setConfirmDisconnect(null)} onConfirm={() => void disconnect()} /> : null}
    {connectForm}
  </>;
}

function ConnectSheet({ houseName, exportCard, connected = false, replacing, onClose, onConnect }: { houseName?: string; exportCard?: ReactNode; connected?: boolean; replacing: boolean; onClose(): void; onConnect(url: string, requestId: string): Promise<boolean> }) {
  const [url, setUrl] = useState("");
  const [requestId, setRequestId] = useState(() => randomUuid());
  const [saving, setSaving] = useState(false);
  const close = () => { if (!saving) onClose(); };
  const [problem, setProblem] = useState<string | null>(null);
  const online = useCalendarOnline();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !online) return;
    let normalized: string;
    try { normalized = validateAirbnbUrl(url.trim()); } catch { setProblem(new IcalError("url").message); return; }
    setSaving(true);
    setProblem(null);
    try { await onConnect(normalized, requestId); }
    catch (error) {
      const problem = toDomainError(error);
      setProblem(problem.message);
      // Reintento de un fallo confirmado = intento nuevo; una respuesta de red desconocida reutiliza el mismo ID.
      if (problem.kind === "validation") setRequestId(randomUuid());
    }
    finally { setSaving(false); }
  }
  // En escritorio, desde la fila del Calendario, es la ventana ancha «Calendarios de Airbnb» (nunca se cierra con el fondo).
  return <Sheet layout={exportCard ? "airbnb" : undefined} title={AIRBNB_COPY.sheetTitle({ exportCard: !!exportCard, replacing: !!replacing })}
    busy={saving} onClose={onClose} dismissible={exportCard ? { backdrop: false } : undefined} confirmDiscard={() => !connected && url.trim() !== ""}>
      {houseName ? <p className="small muted">{houseName}</p> : null}
      <div className={exportCard ? "airbnb-calendar-directions" : "stack gap-14"}>
      <div className={exportCard ? cardClass({ layout: "stack", gap: 14 }) : "stack gap-14"}>
      {exportCard ? <h2>{AIRBNB_COPY.importTitle}</h2> : null}
      {connected ? <p role="status">{AIRBNB_COPY.connected}</p> : <>
      <p>{AIRBNB_COPY.howTo}</p>
      {replacing ? <p className="hint">{AIRBNB_COPY.keepsCurrent}</p> : null}
      <form onSubmit={submit} noValidate aria-busy={saving}>
        <Field id="airbnb-connect" label={AIRBNB_COPY.linkLabel} size="compact" error={problem} hint={AIRBNB_COPY.linkHint}>
          {(control) => <TextInput {...control} type="url" value={url} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" inputMode="url" maxLength={2048} disabled={saving} onChange={e => { setUrl(e.target.value); setRequestId(randomUuid()); setProblem(null); }} />}
        </Field>
        <Button variant="primary" size="lg" type="submit" disabled={saving || !online || !url.trim()}>{AIRBNB_COPY.submit({ saving, replacing: !!replacing })}</Button>
        {!exportCard && <Button variant="secondary" size="lg" disabled={saving} onClick={close}>{AIRBNB_COPY.cancel}</Button>}
      </form>
      </>}
      </div>
      {exportCard}
      </div>
  </Sheet>;
}
