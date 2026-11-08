import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Listing } from "../domain/listing";
import { I } from "../shared/icons";
import { airbnbQuery } from "./airbnb";
import type { ReactNode } from "react";
import { setAvailability, type Selection, type CalendarDay } from "../domain/calendar";
import { MonthLegend } from "../shared/month-grid";

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
  const info = useQuery({ ...airbnbQuery(userId, listing.id), enabled: !!userId });
  const connected = info.data?.connected;
  return <>
    <button type="button" className="cal-action" disabled={disabled} aria-describedby={disabled ? "airbnb-selection-hint" : undefined} onClick={() => void navigate({ to: "/propietario/casas/$id/airbnb", params: { id: listing.id }, search: month ? { mes: month } : {} })}>
      <span className="cal-action-icon"><I.calendar size={20} /></span>
      <span className="body"><b>{connected ? "Calendarios de Airbnb" : "Conectar con Airbnb"}</b>
        {info.data?.state === "error" ? <span className="small muted">No se pudo actualizar</span> : info.data?.lastSuccessAt ? <span className="small muted">Última importación: {new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(info.data.lastSuccessAt))}</span> : null}
      </span><I.chevron />
    </button>
    {disabled ? <p className="hint" id="airbnb-selection-hint">Guarde o cancele los días seleccionados antes de abrir la conexión.</p> : null}
  </>;
}
