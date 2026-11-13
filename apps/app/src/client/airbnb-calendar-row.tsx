import { randomUuid } from "../shared/random-uuid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Listing } from "../domain/listing";
import { I } from "../shared/icons";
import { airbnbQuery, updateAirbnbCalendar, useCalendarOnline } from "./airbnb";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sessionState } from "./session";
import { setAvailability, type Selection, type CalendarDay } from "../domain/calendar";
import { MonthLegend } from "../shared/month-grid";

// Lucide refresh-cw (ISC; shared/icons-lucide.LICENSE). Solo este módulo necesita el icono.
function RefreshIcon() {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M21 12A9 9 0 0 1 5.6 18.4L3 16M3 21v-5h5" /></svg>;
}

export function countCalendarOrigins(days: ReadonlyMap<string, CalendarDay>, selected: readonly string[]) {
  let importedCount = 0;
  let manualCount = 0;
  for (const date of selected) {
    const day = days.get(date);
    if (day?.imported) importedCount++;
    if ((day?.manualAvailable ?? day?.available) === false) manualCount++;
  }
  return { importedCount, manualCount };
}

export function AirbnbLegend({ days }: { days: readonly CalendarDay[] | undefined }) {
  return <MonthLegend extra={days?.some(day => day.imported) ? <span><I.link size={16} />Bloqueado por Airbnb</span> : null} />;
}

/** Se carga al editar noches importadas; solo modifica la capa manual. */
export function AirbnbAvailability({ sel, importedCount, manualCount, onChange, children }: {
  sel: Selection; importedCount: number; manualCount: number; onChange: (selection: Selection) => void; children: ReactNode;
}) {
  return <>
    <p className="small muted">{importedCount === sel.days.length && manualCount === sel.days.length ? "Bloqueo manual y Airbnb" : importedCount === sel.days.length && manualCount === 0 ? "Ocupado por Airbnb · sin bloqueo manual" : `${manualCount} con bloqueo manual · ${importedCount} con bloqueo de Airbnb`}</p>
    <div className="stack gap-8">
      <div className="seg" role="group" aria-label="Disponibilidad manual">
        <button type="button" aria-pressed={sel.available === true} onClick={() => onChange(setAvailability(sel, true))}>{manualCount ? "Quitar bloqueo manual" : "Sin bloqueo manual"}</button>
        <button type="button" aria-pressed={sel.available === false} onClick={() => onChange(setAvailability(sel, false))}>Ocupado</button>
      </div>
      {children}
    </div>
    <p className="hint" role="status">{importedCount === 1 ? "Esta noche sigue ocupada" : `${importedCount} noches siguen ocupadas`} por Airbnb. Para liberarla{importedCount === 1 ? "" : "s"}, cambie el calendario en Airbnb y actualice la importación. Sus precios se conservan.</p>
  </>;
}

/** La consulta y el estado de la integración se cargan aparte del calendario manual. */
export function AirbnbRow({ listing, userId, month, disabled }: { listing: Listing; userId: string; month: string | undefined; disabled: boolean }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const online = useCalendarOnline();
  const info = useQuery({ ...airbnbQuery(userId, listing.id), enabled: !!userId });
  const connected = info.data?.connected;
  const [updating, setUpdating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  const request = useRef(randomUuid());
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const current = () => active.current && sessionState().session?.userId === userId;
  const running = updating || info.data?.state === "running";
  const suspended = info.data?.state === "suspended" || listing.adminHold?.kind === "blocked" || listing.status === "rejected";
  async function update() {
    if (inFlight.current || running || disabled || !online || suspended || !info.data?.connected) return;
    inFlight.current = true; setUpdating(true); setProblem(null);
    try {
      await updateAirbnbCalendar(client, userId, listing.id, listing.publicId, request, current, setProblem);
    } finally { inFlight.current = false; if (current()) setUpdating(false); }
  }
  return <div className={connected ? "cal-airbnb" : "card cal-airbnb"}>
    <div className="cal-airbnb-line">
    {info.data?.connected ? <button type="button" className="cal-airbnb-update" aria-label={running ? "Actualizando importación de Airbnb" : info.data.state === "error" ? "Reintentar importación de Airbnb" : "Actualizar importación de Airbnb"} aria-busy={running || undefined} disabled={disabled || !online || running || suspended} onClick={() => void update()}><RefreshIcon /></button> : null}
    <button type="button" className="cal-action" disabled={disabled} aria-describedby={disabled ? "airbnb-selection-hint" : undefined} onClick={() => void navigate({ to: "/propietario/casas/$id/airbnb", params: { id: listing.id }, search: month ? { mes: month } : {} })}>
      {!info.data?.connected ? <span className="cal-action-icon"><I.calendar size={20} /></span> : null}
      <span className="body"><b>{connected ? "Sincronización con Airbnb" : "Conectar con Airbnb"}</b>
        {running ? <span className="small muted" role="status">Actualizando…</span> : !online && info.data?.connected ? <span className="small muted">Sin conexión</span> : info.data?.state === "error" ? <span className="small muted">No se pudo actualizar</span> : null}
        {info.data?.lastSuccessAt ? <span className="small muted">Última importación: {new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(info.data.lastSuccessAt))}</span> : info.data?.exportGenerated ? <span className="small muted">Enlace de exportación disponible</span> : null}
      </span><I.chevron />
    </button>
    </div>
    {problem ? <p className="note" role="alert">{problem}</p> : null}
    {disabled ? <p className="hint" id="airbnb-selection-hint">Guarde o cancele los días seleccionados antes de abrir la conexión.</p> : null}
  </div>;
}
