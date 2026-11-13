import { randomUuid } from "../../shared/random-uuid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IcalError, validateAirbnbUrl } from "../../domain/ical";
import { DomainError, toDomainError } from "../../domain/errors";
import { I } from "../../shared/icons";
import { toast } from "../../shared/toast";
import { airbnbApi, airbnbQuery, refreshAirbnbCalendar, updateAirbnbCalendar, useCalendarOnline } from "../airbnb";
import { FlowHeader } from "../chrome";
import { ownListingQuery } from "../owner";
import { usePrivateSheet } from "../private-sheet";
import { sessionState, useSession } from "../session";
import { IcalExportCard } from "./ical-export-card";
import { ConfirmSheet } from "../confirm-sheet";

const route = getRouteApi("/_flow/_privateFlow/propietario/casas/$id/airbnb");
const time = (iso: string) => new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(iso));

export function AirbnbScreen() {
  const { id } = route.useParams();
  const { mes } = route.useSearch();
  const uid = useSession().session?.userId ?? "";
  return <AirbnbManagementScreen key={`${uid}:${id}`} id={id} uid={uid} mes={mes} />;
}

function AirbnbManagementScreen({ id, uid, mes }: { id: string; uid: string; mes?: string }) {
  const client = useQueryClient();
  const online = useCalendarOnline();
  const house = useQuery({ ...ownListingQuery(uid, id, client), enabled: !!uid });
  const info = useQuery({ ...airbnbQuery(uid, id), enabled: !!uid && !!house.data });
  const [connecting, setConnecting] = useState<"connect" | "replace" | null>(null);
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
  const l = house.data;
  const suspended = summary?.state === "suspended" || l?.adminHold?.kind === "blocked" || l?.status === "rejected";
  const busy = summary?.state === "running" || !!operation;
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
  return <>
    <FlowHeader title="Calendarios de Airbnb" back="/propietario/calendario" search={{ casa: id, ...(mes ? { mes } : {}) }} historyBack />
    {l ? <p className="cal-house">{l.title}</p> : null}
    {house.isPending || info.isPending && l ? <section className="card skeleton cal-skeleton" aria-busy="true" aria-label="Cargando conexión de Airbnb" /> : null}
    {house.isError || info.isError ? <p className="note" role="alert">{toDomainError(house.error ?? info.error).message}</p> : null}
    {house.data === null ? <p className="note" role="alert">No encontramos ese anuncio.</p> : null}
    {l && summary ? <section className="card stack gap-16" aria-labelledby="airbnb-import-title" aria-busy={busy}>
      <h2 id="airbnb-import-title">Importar desde Airbnb</h2>
      <p>Traiga a 3bstays las noches bloqueadas en Airbnb.</p>
      {suspended ? <p className="note">La conexión está suspendida mientras la casa esté bloqueada o rechazada por 3bstays. Los datos se conservan.</p> : null}
      {summary.lastSuccessAt ? <p className="small muted">Última importación correcta: {time(summary.lastSuccessAt)}</p> : null}
      {summary.connected ? <p>{summary.nights ? `${summary.nights} ${summary.nights === 1 ? "noche bloqueada" : "noches bloqueadas"} por Airbnb` : "No hay noches bloqueadas por Airbnb en este período."}</p> : null}
      {!online ? <p className="note small">Sin conexión. Puede consultar el último estado guardado.</p> : null}
      {summary.errorCode ? <p className="note" role="alert">{summary.connected ? <>No se pudo actualizar{summary.lastErrorAt ? ` · ${time(summary.lastErrorAt)}` : ""}. Se conservan las últimas noches importadas. </> : null}{new IcalError(summary.errorCode).message}</p> : null}
      {problem ? <p className="field-error" role="alert">{problem}</p> : null}
      {summary.state === "running" ? <p role="status">{summary.connected ? "Actualizando…" : "Conectando…"}</p> : null}
      {!summary.connected && !suspended ? <button className="btn btn-primary btn-lg" type="button" disabled={busy || !online} onClick={() => setConnecting("connect")}>Conectar Airbnb</button> : null}
      {summary.connected ? <>
        <button className="btn btn-primary btn-lg" type="button" disabled={busy || !online || suspended} onClick={() => void update()}>{operation === "refresh" || summary.state === "running" ? "Actualizando…" : summary.errorCode ? "Intentar de nuevo" : "Actualizar ahora"}</button>
        <button className="btn btn-ghost btn-lg" type="button" disabled={busy || !online || suspended} onClick={() => setConnecting("replace")}>Sustituir enlace</button>
        <button className="btn-text sub-stop" type="button" disabled={!!operation || !online} onClick={() => { setDisconnectError(null); setConfirmDisconnect(randomUuid()); }}>Desconectar Airbnb</button>
      </> : null}
    </section> : null}
    {l && summary ? <IcalExportCard key={`${uid}:${id}`} id={id} userId={uid} /> : null}
    <p className="note small">Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia</p>
    {confirmDisconnect ? <ConfirmSheet title="¿Desconectar Airbnb?" body="Se retirarán las noches importadas de Airbnb y dejarán de actualizarse. Sus bloqueos manuales y precios se conservan."
      confirmLabel={operation === "disconnect" ? "Desconectando…" : "Desconectar Airbnb"} confirmClassName="btn btn-danger btn-lg" cancelClassName="btn btn-ghost btn-lg"
      pending={operation === "disconnect"} error={disconnectError} onClose={() => setConfirmDisconnect(null)} onConfirm={() => void disconnect()} /> : null}
    {connecting && l ? <ConnectSheet replacing={connecting === "replace"} onClose={() => setConnecting(null)} onConnect={async (url, requestId) => {
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
      setConnecting(null);
      toast(connecting === "replace" ? "Enlace de Airbnb sustituido" : "Airbnb conectado");
      return true;
    }} /> : null}
  </>;
}

function ConnectSheet({ replacing, onClose, onConnect }: { replacing: boolean; onClose(): void; onConnect(url: string, requestId: string): Promise<boolean> }) {
  const { sheet, onKeyDown } = usePrivateSheet({ onClose, focusable: 'button:not([disabled]), input:not([disabled])', returnFocus: opener => opener?.focus() });
  const [url, setUrl] = useState("");
  const [requestId, setRequestId] = useState(() => randomUuid());
  const [saving, setSaving] = useState(false);
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
  return createPortal(<>
    <div className="sheet-backdrop" onClick={onClose} />
    <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby="airbnb-connect-title" tabIndex={-1} onKeyDown={onKeyDown}>
      <span className="grabber" aria-hidden="true" />
      <div className="row between"><h2 id="airbnb-connect-title">{replacing ? "Sustituir enlace" : "Conectar Airbnb"}</h2><button className="icon-btn" type="button" aria-label="Cerrar" onClick={onClose}><I.x /></button></div>
      <p>En Airbnb, abra el calendario de este alojamiento y copie su enlace de exportación. Péguelo aquí.</p>
      {replacing ? <p className="hint">El enlace actual seguirá conectado hasta que podamos leer el nuevo.</p> : null}
      <form onSubmit={submit} noValidate aria-busy={saving}>
        <label>Enlace de calendario de Airbnb<input type="url" value={url} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" inputMode="url" maxLength={2048} disabled={saving} aria-invalid={!!problem} aria-describedby="airbnb-connect-hint airbnb-connect-error" onChange={e => { setUrl(e.target.value); setRequestId(randomUuid()); setProblem(null); }} /></label>
        <p className="hint" id="airbnb-connect-hint">Solo importamos noches bloqueadas. No copiamos precios ni datos de huéspedes. Compruebe que el enlace corresponde a esta casa.</p>
        <p id="airbnb-connect-error" className="field-error" role={problem ? "alert" : undefined}>{problem}</p>
        <button className="btn btn-primary btn-lg" type="submit" disabled={saving || !online || !url.trim()}>{saving ? replacing ? "Sustituyendo…" : "Conectando…" : replacing ? "Sustituir enlace" : "Conectar"}</button>
        <button className="btn btn-ghost btn-lg" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </section>
  </>, document.body);
}
