import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AirbnbSummary } from "../../domain/airbnb";
import type { OwnerIcalExport } from "../../domain/ical-export";
import { toast } from "../../shared/toast";
import { airbnbQuery } from "../airbnb";
import { icalExportApi } from "../ical-export";
import { sessionState } from "../session";

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);
const onlineSnapshot = () => onlineManager.isOnline();

/** El token solo vive en este componente, nunca en Query, almacenamiento o telemetría. */
export function IcalExportCard({ id, userId }: { id: string; userId: string }) {
  const client = useQueryClient();
  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot);
  const [data, setData] = useState<OwnerIcalExport | null>(null);
  const [busy, setBusy] = useState<"loading" | "generating" | null>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const [copyProblem, setCopyProblem] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const field = useRef<HTMLTextAreaElement>(null);
  const copying = useRef(false);
  const url = data?.token ? new URL(`/ical/${data.token}.ics`, window.location.origin).href : "";

  function rememberPresence(result: OwnerIcalExport) {
    client.setQueryData<AirbnbSummary>(airbnbQuery(userId, id).queryKey, current => current ? { ...current, exportGenerated: result.generated } : current);
  }

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    setBusy("loading");
    setProblem(null);
    void (async () => {
      try {
        const result = await (await icalExportApi()).overview(id);
        if (cancelled || sessionState().session?.userId !== userId) return;
        setData(result);
        client.setQueryData<AirbnbSummary>(airbnbQuery(userId, id).queryKey, current => current ? { ...current, exportGenerated: result.generated } : current);
      } catch {
        if (!cancelled && sessionState().session?.userId === userId) setProblem("No pudimos consultar el enlace. Intente de nuevo.");
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => { cancelled = true; alive.current = false; };
  }, [client, id, userId, attempt]);

  async function generate() {
    if (busy || !online) return;
    setBusy("generating");
    setProblem(null);
    try {
      const result = await (await icalExportApi()).generate(id);
      if (!alive.current || sessionState().session?.userId !== userId) return;
      setData(result);
      rememberPresence(result);
    } catch {
      if (alive.current && sessionState().session?.userId === userId) setProblem("No pudimos generar el enlace. Intente de nuevo.");
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function copy() {
    if (!url || copying.current) return;
    copying.current = true;
    setCopyProblem(false);
    try {
      await navigator.clipboard.writeText(url);
      if (alive.current && sessionState().session?.userId === userId) toast("Enlace copiado");
    } catch {
      if (alive.current && sessionState().session?.userId === userId) {
        setCopyProblem(true);
        field.current?.focus();
        field.current?.select();
      }
    } finally { copying.current = false; }
  }

  return <section className="card stack gap-16" aria-labelledby="ical-export-title" aria-busy={!!busy}>
    <h2 id="ical-export-title">Exportar hacia Airbnb</h2>
    <p>Lleve a Airbnb las noches que marque como ocupadas en bnbtico.</p>
    {busy === "loading" ? <p role="status">Cargando enlace…</p> : null}
    {!online ? <p className="note small">Sin conexión. Para consultar o generar el enlace, vuelva a conectarse.</p> : null}
    {problem ? <p className="field-error" role="alert">{problem}</p> : null}
    {!data && !busy ? <button type="button" className="btn btn-ghost btn-lg" disabled={!online} onClick={() => setAttempt(n => n + 1)}>Intentar de nuevo</button> : null}
    {data?.suspended ? <p className="note">La exportación está suspendida mientras la casa esté bloqueada o rechazada por bnbtico. Los datos se conservan.</p> : null}
    {data && !data.generated && !data.suspended ? <>
      <p>Todavía no ha generado un enlace de exportación.</p>
      <button type="button" className="btn btn-primary btn-lg" disabled={!!busy || !online} onClick={() => void generate()}>{busy === "generating" ? "Generando enlace…" : "Generar enlace"}</button>
    </> : null}
    {url ? <>
      <div>
        <label htmlFor="ical-export-url">Enlace de bnbtico para Airbnb</label>
        <textarea id="ical-export-url" ref={field} rows={3} readOnly value={url} autoComplete="off" spellCheck={false} aria-describedby="ical-export-help ical-export-copy-error" />
      </div>
      <button type="button" className="btn btn-primary btn-lg" onClick={() => void copy()}>Copiar enlace</button>
      <p id="ical-export-copy-error" className="field-error" role={copyProblem ? "alert" : undefined}>{copyProblem ? "No pudimos copiarlo. Mantenga pulsado el enlace para copiarlo." : null}</p>
      <p id="ical-export-help" className="hint">Añada este enlace como calendario importado en Airbnb. Cualquier persona que lo tenga puede consultar sus noches bloqueadas; no puede modificarlas.</p>
      {data?.nights === 0 ? <p className="small muted">No hay noches bloqueadas manualmente en este período.</p> : null}
      <p className="small">En el calendario del alojamiento en Airbnb, abra Disponibilidad → Conectar calendarios → Conectar otro sitio web. Pegue el enlace y añada el calendario.</p>
      <p className="hint">Airbnb consulta los cambios según su propio ritmo. Copiar el enlace no confirma que Airbnb lo haya añadido ni actualizado.</p>
    </> : null}
  </section>;
}
