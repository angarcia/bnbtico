import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IcalError, validateAirbnbUrl } from "../../domain/ical";
import { DomainError, toDomainError } from "../../domain/errors";
import { I } from "../../shared/icons";
import { toast } from "../../shared/toast";
import { airbnbApi, airbnbQuery, refreshAirbnbCalendar } from "../airbnb";
import { FlowHeader } from "../chrome";
import { ownListingQuery } from "../owner";
import { usePrivateSheet } from "../private-sheet";
import { sessionState, useSession } from "../session";

const route = getRouteApi("/_flow/_privateFlow/propietario/casas/$id/airbnb");
const time = (iso: string) => new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(iso));

export function AirbnbScreen() {
  const { id } = route.useParams();
  const { mes } = route.useSearch();
  const uid = useSession().session?.userId ?? "";
  const client = useQueryClient();
  const house = useQuery({ ...ownListingQuery(uid, id, client), enabled: !!uid });
  const info = useQuery({ ...airbnbQuery(uid, id), enabled: !!uid && !!house.data });
  const [connecting, setConnecting] = useState(false);
  const summary = info.data;
  const l = house.data;
  const suspended = summary?.state === "suspended" || l?.adminHold?.kind === "blocked" || l?.status === "rejected";
  return <>
    <FlowHeader title="Calendarios de Airbnb" back="/propietario/calendario" search={{ casa: id, ...(mes ? { mes } : {}) }} historyBack />
    {l ? <p className="cal-house">{l.title}</p> : null}
    {house.isPending || info.isPending && l ? <section className="card skeleton cal-skeleton" aria-busy="true" aria-label="Cargando conexión de Airbnb" /> : null}
    {house.isError || info.isError ? <p className="note" role="alert">{toDomainError(house.error ?? info.error).message}</p> : null}
    {house.data === null ? <p className="note" role="alert">No encontramos ese anuncio.</p> : null}
    {l && summary ? <section className="card stack gap-16" aria-labelledby="airbnb-import-title">
      <h2 id="airbnb-import-title">Importar desde Airbnb</h2>
      <p>Traiga a bnbtico las noches bloqueadas en Airbnb.</p>
      {suspended ? <p className="note">La conexión está suspendida mientras la casa esté bloqueada o rechazada por bnbtico. Los datos se conservan.</p> : null}
      {summary.lastSuccessAt ? <p className="small muted">Última importación correcta: {time(summary.lastSuccessAt)}</p> : null}
      {summary.connected ? <p>{summary.nights ? `${summary.nights} ${summary.nights === 1 ? "noche bloqueada" : "noches bloqueadas"} por Airbnb` : "No hay noches bloqueadas por Airbnb en este período."}</p> : null}
      {summary.errorCode ? <p className="note" role="alert">{new IcalError(summary.errorCode).message}</p> : null}
      {summary.state === "running" ? <p role="status">Conectando…</p> : null}
      {!summary.connected && !suspended ? <button className="btn btn-primary btn-lg" type="button" disabled={summary.state === "running"} onClick={() => setConnecting(true)}>Conectar Airbnb</button> : null}
    </section> : null}
    <p className="note small">Las noches importadas corresponden a la última lectura correcta. Confirme la disponibilidad antes de acordar una estancia.</p>
    {connecting && l ? <ConnectSheet onClose={() => setConnecting(false)} onConnect={async (url, requestId) => {
      const data = await (await airbnbApi()).connect(id, url, requestId).catch(error => {
        if (sessionState().session?.userId === uid) void client.invalidateQueries({ queryKey: airbnbQuery(uid, id).queryKey });
        throw error;
      });
      if (sessionState().session?.userId !== uid) return false;
      client.setQueryData(airbnbQuery(uid, id).queryKey, data);
      if (!data.connected || data.state === "running") {
        await client.invalidateQueries({ queryKey: airbnbQuery(uid, id).queryKey });
        throw new DomainError(data.state === "running" ? "La conexión sigue en curso. Vuelva a consultar el estado en un momento." : "No pudimos completar la conexión. Intente de nuevo.", data.state === "running" ? "conflict" : "validation");
      }
      await refreshAirbnbCalendar(client, uid, id, l.publicId);
      setConnecting(false);
      toast("Airbnb conectado");
      return true;
    }} /> : null}
  </>;
}

function ConnectSheet({ onClose, onConnect }: { onClose(): void; onConnect(url: string, requestId: string): Promise<boolean> }) {
  const { sheet, onKeyDown } = usePrivateSheet({ onClose, focusable: 'button:not([disabled]), input:not([disabled])', returnFocus: opener => opener?.focus() });
  const [url, setUrl] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    let normalized: string;
    try { normalized = validateAirbnbUrl(url.trim()); } catch { setProblem(new IcalError("url").message); return; }
    setSaving(true);
    setProblem(null);
    try { await onConnect(normalized, requestId); }
    catch (error) {
      const problem = toDomainError(error);
      setProblem(problem.message);
      // Reintento de un fallo confirmado = intento nuevo; una respuesta de red desconocida reutiliza el mismo ID.
      if (problem.kind === "validation") setRequestId(crypto.randomUUID());
    }
    finally { setSaving(false); }
  }
  return createPortal(<>
    <div className="sheet-backdrop" onClick={onClose} />
    <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby="airbnb-connect-title" tabIndex={-1} onKeyDown={onKeyDown}>
      <span className="grabber" aria-hidden="true" />
      <div className="row between"><h2 id="airbnb-connect-title">Conectar Airbnb</h2><button className="icon-btn" type="button" aria-label="Cerrar" onClick={onClose}><I.x /></button></div>
      <p>En Airbnb, abra el calendario de este alojamiento y copie su enlace de exportación. Péguelo aquí.</p>
      <form onSubmit={submit} noValidate aria-busy={saving}>
        <label>Enlace de calendario de Airbnb<input type="url" value={url} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" inputMode="url" maxLength={2048} disabled={saving} aria-invalid={!!problem} aria-describedby="airbnb-connect-hint airbnb-connect-error" onChange={e => { setUrl(e.target.value); setRequestId(crypto.randomUUID()); setProblem(null); }} /></label>
        <p className="hint" id="airbnb-connect-hint">Solo importamos noches bloqueadas. No copiamos precios ni datos de huéspedes. Compruebe que el enlace corresponde a esta casa.</p>
        <p id="airbnb-connect-error" className="field-error" role={problem ? "alert" : undefined}>{problem}</p>
        <button className="btn btn-primary btn-lg" type="submit" disabled={saving || !url.trim()}>{saving ? "Conectando…" : "Conectar"}</button>
        <button className="btn btn-ghost btn-lg" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </section>
  </>, document.body);
}
