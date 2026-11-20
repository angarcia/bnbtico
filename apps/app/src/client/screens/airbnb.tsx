import { randomUuid } from "../../shared/random-uuid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { IcalError, validateAirbnbUrl } from "../../domain/ical";
import { DomainError, toDomainError } from "../../domain/errors";
import type { Listing } from "../../domain/listing";
import { toast } from "../../shared/toast";
import { airbnbApi, airbnbQuery, refreshAirbnbCalendar, updateAirbnbCalendar, useAirbnbManualHint, useCalendarOnline } from "../airbnb";
import { ScreenHeader } from "../chrome";
import { ownListingQuery } from "../owner";
import { Sheet } from "../../shared/overlay";
import { sessionState, useSession } from "../session";
import { IcalExportCard } from "./ical-export-card";
import { ConfirmSheet } from "../confirm-sheet";
import { Field, TextInput } from "../../shared/field";
import { Button, TextButton } from "../../shared/button";
import { LoadError, Notice, Skeleton } from "../../shared/structure";
import { Card, cardClass } from "../../shared/card";

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
      if (current()) toast("Airbnb desconectado");
    } catch {
      if (!current()) return;
      const data = await reconcile().catch(() => null);
      if (!current()) return;
      if (data && !data.connected) {
        setConfirmDisconnect(null); setProblem(null);
        await refreshAirbnbCalendar(client, uid, id, l.publicId);
        if (current()) toast("Airbnb desconectado");
      } else setDisconnectError("No pudimos completar el cambio. Cancele y consulte el estado antes de intentar de nuevo.");
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
      throw new DomainError(data.state === "running" ? "La conexión sigue en curso. Vuelva a consultar el estado en un momento." : "No pudimos completar la conexión. Intente de nuevo.", data.state === "running" ? "conflict" : "validation");
    }
    await refreshAirbnbCalendar(client, uid, id, l.publicId);
    if (!current()) return false;
    if (!popup) setConnecting(null);
    toast(connecting === "replace" ? "Enlace de Airbnb sustituido" : "Airbnb conectado");
    return true;
  }} /> : null;
  if (popup) return connectForm;
  return <>
    <ScreenHeader kind="flow" title="Calendarios de Airbnb" back={{ to: "/propietario/calendario", search: { casa: id, ...(mes ? { mes } : {}) }, historyBack: true }} />
    {l ? <p className="cal-house">{l.title}</p> : null}
    {house.isPending || info.isPending && l ? <Skeleton shape="calendar" label="Cargando conexión de Airbnb" /> : null}
    {house.isError || info.isError ? <LoadError onRetry={() => { if (house.isError) void house.refetch(); if (info.isError) void info.refetch(); }}>{toDomainError(house.error ?? info.error).message}</LoadError> : null}
    {house.data === null ? <Notice tone="error">No encontramos ese anuncio.</Notice> : null}
    {l && summary ? <Card layout="stack" gap={16} aria-labelledby="airbnb-import-title" aria-busy={busy}>
      <h2 id="airbnb-import-title">Importar desde Airbnb</h2>
      <p>Traiga a 3bstays las noches bloqueadas en Airbnb.</p>
      {suspended ? <Notice>La conexión está suspendida mientras la casa esté bloqueada o rechazada por 3bstays. Los datos se conservan.</Notice> : null}
      {summary.lastSuccessAt ? <p className="small muted">Última importación correcta: {time(summary.lastSuccessAt)}</p> : null}
      {summary.connected ? <p>{summary.nights ? `${summary.nights} ${summary.nights === 1 ? "noche bloqueada" : "noches bloqueadas"} por Airbnb` : "No hay noches bloqueadas por Airbnb en este período."}</p> : null}
      {!online ? <Notice small>Sin conexión. Puede consultar el último estado guardado.</Notice> : null}
      {summary.errorCode ? <Notice tone="error">{summary.connected ? <>No se pudo actualizar{summary.lastErrorAt ? ` · ${time(summary.lastErrorAt)}` : ""}. Se conservan las últimas noches importadas. </> : null}{new IcalError(summary.errorCode).message}</Notice> : null}
      {problem ? <p className="field-error" role="alert">{problem}</p> : null}
      {summary.state === "running" ? <p role="status">{summary.connected ? "Actualizando…" : "Conectando…"}</p> : null}
      {!summary.connected && !suspended ? <Button variant="primary" size="lg" disabled={busy || !online} onClick={() => setConnecting("connect")}>Conectar Airbnb</Button> : null}
      {summary.connected ? <>
        <Button variant="primary" size="lg" disabled={busy || !online || suspended || !!limitHint} aria-describedby={limitHint && !busy ? "airbnb-limit" : undefined} onClick={() => void update()}>{operation === "refresh" || summary.state === "running" ? "Actualizando…" : summary.errorCode ? "Intentar de nuevo" : "Actualizar ahora"}</Button>
        {limitHint && !busy && !suspended ? <p id="airbnb-limit" className="small muted center" data-testid="airbnb-limit">{limitHint}</p> : null}
        <Button variant="secondary" size="lg" disabled={busy || !online || suspended || dayFull} onClick={() => setConnecting("replace")}>Sustituir enlace</Button>
        <TextButton tone="quiet" placement="sub-stop" disabled={!!operation || !online} onClick={() => { setDisconnectError(null); setConfirmDisconnect(randomUuid()); }}>Desconectar Airbnb</TextButton>
      </> : null}
    </Card> : null}
    {l && summary ? <IcalExportCard key={`${uid}:${id}`} id={id} userId={uid} /> : null}
    <Notice small>Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia</Notice>
    {confirmDisconnect ? <ConfirmSheet title="¿Desconectar Airbnb?" body="Se retirarán las noches importadas de Airbnb y dejarán de actualizarse. Sus bloqueos manuales y precios se conservan."
      confirmLabel={operation === "disconnect" ? "Desconectando…" : "Desconectar Airbnb"} tone="destructive"
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
  return <Sheet layout={exportCard ? "airbnb" : undefined} title={exportCard ? "Calendarios de Airbnb" : replacing ? "Sustituir enlace" : "Conectar Airbnb"}
    busy={saving} onClose={onClose} dismissible={exportCard ? { backdrop: false } : undefined} confirmDiscard={() => !connected && url.trim() !== ""}>
      {houseName ? <p className="small muted">{houseName}</p> : null}
      <div className={exportCard ? "airbnb-calendar-directions" : "stack gap-14"}>
      <div className={exportCard ? cardClass({ layout: "stack", gap: 14 }) : "stack gap-14"}>
      {exportCard ? <h2>Importar desde Airbnb</h2> : null}
      {connected ? <p role="status">Airbnb conectado.</p> : <>
      <p>En Airbnb, abra el calendario de este alojamiento y copie su enlace de exportación. Péguelo aquí.</p>
      {replacing ? <p className="hint">El enlace actual seguirá conectado hasta que podamos leer el nuevo.</p> : null}
      <form onSubmit={submit} noValidate aria-busy={saving}>
        <Field id="airbnb-connect" label="Enlace de calendario de Airbnb" size="compact" error={problem} hint="Solo importamos noches bloqueadas. No copiamos precios ni datos de huéspedes. Compruebe que el enlace corresponde a esta casa.">
          {(control) => <TextInput {...control} type="url" value={url} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" inputMode="url" maxLength={2048} disabled={saving} onChange={e => { setUrl(e.target.value); setRequestId(randomUuid()); setProblem(null); }} />}
        </Field>
        <Button variant="primary" size="lg" type="submit" disabled={saving || !online || !url.trim()}>{saving ? replacing ? "Sustituyendo…" : "Conectando…" : replacing ? "Sustituir enlace" : "Conectar"}</Button>
        {!exportCard && <Button variant="secondary" size="lg" disabled={saving} onClick={close}>Cancelar</Button>}
      </form>
      </>}
      </div>
      {exportCard}
      </div>
  </Sheet>;
}
