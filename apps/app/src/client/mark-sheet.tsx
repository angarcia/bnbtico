// Hoja «Marcar una reserva» (ticket 04 de la ronda del 2 nov): se abre desde la fila de arriba del Calendario. El
// calendario de rango de «¿Cuándo?» (el mismo de la búsqueda y la hoja de contacto) para elegir llegada y salida, el
// resumen de las noches y «Marcar como ocupado», que deja ocupadas las noches de la llegada a la víspera de la salida.
// Trozo diferido propio (se pide al tocar la fila o en reposo en el Calendario; el calendario de rango, range-calendar-*,
// es otro trozo, compartido). Diálogo modal como «Pausar la casa»: la página queda `inert`, el foco no sale de la hoja y
// Escape, el fondo o «Cancelar» la cierran (el foco vuelve a la fila desde quien la abre).
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { selectionLabel, type CalendarDay } from "../domain/calendar";
import { reservationDays, reservationLabel } from "../domain/reservation";
import { RANGE_BUSY_MESSAGE, type RangeState } from "../domain/range";
import { toDomainError } from "../domain/errors";
import { RangeCalendar } from "../shared/range-calendar";
import { usePrivateSheet } from "./private-sheet";

const FOCUSABLE = "button:not([disabled])";
const EMPTY_DAYS: readonly CalendarDay[] = [];

/** `onConfirm`: las noches a marcar y el aviso que lo dice («4 noches marcadas como ocupadas · 7–10 nov»). */
export function MarkSheet({ today, onConfirm, onClose, calendarDays = EMPTY_DAYS, prepare }: {
  today: string; onConfirm: (days: string[], label: string) => void; onClose: () => void;
  calendarDays?: readonly CalendarDay[];
  prepare?: (signal: AbortSignal) => Promise<{ warning: string | null }>;
}) {
  const { sheet, onKeyDown } = usePrivateSheet({ onClose, focusable: FOCUSABLE });
  const [range, setRange] = useState<RangeState>({ arrival: null, departure: null });
  const days = reservationDays(range.arrival, range.departure);
  const [status, setStatus] = useState<"loading" | "warning" | "error" | "ready">(prepare ? "loading" : "ready");
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = (day: string) => calendarDays.some(d => d.day === day && !d.available);
  const occupied = days.some(busy);
  const message = occupied ? "Las fechas cambiaron. Elija un intervalo sin noches ocupadas." : problem;
  const ready = status === "ready";
  useEffect(() => {
    if (!prepare) return;
    const controller = new AbortController();
    setStatus("loading"); setProblem(null);
    void prepare(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setProblem(result.warning); setStatus(result.warning ? "warning" : "ready");
    }).catch(error => {
      if (!controller.signal.aborted) { setProblem(toDomainError(error).message); setStatus("error"); }
    });
    return () => controller.abort();
  }, [prepare, attempt]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ready && days.length > 0 && !occupied) onConfirm(days, reservationLabel(days));
  }

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} data-testid="sheet-backdrop" />
      <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby="mark-title" aria-describedby="mark-hint" tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <h2 id="mark-title">Marcar una reserva</h2>
        <span className="hint" id="mark-hint">
          Marque de una vez las noches de una reserva larga como ocupadas. Elija la llegada y la salida. La noche de la salida queda libre.
        </span>
        <form onSubmit={onSubmit} noValidate>
          {status === "loading" ? <p className="hint" role="status">Comprobando disponibilidad…</p> : null}
          {message ? <p className="note" role="alert">{message}</p> : null}
          {status === "warning" ? <button type="button" className="btn btn-secondary" onClick={() => { setStatus("ready"); setProblem(null); }}>Continuar con el último calendario</button> : null}
          {status === "warning" || status === "error" ? <button type="button" className="btn btn-ghost" onClick={() => setAttempt(n => n + 1)}>Intentar de nuevo</button> : null}
          {ready ? <div className="contact-calendar mark-calendar">
            <div className="range-scroll">
              <RangeCalendar today={today} value={range} busy={busy} onChange={value => { setRange(value); setProblem(null); }} onReject={() => setProblem(RANGE_BUSY_MESSAGE)} />
            </div>
          </div> : null}
          <p className={`stay-line${days.length > 0 ? "" : " is-pending"}`} data-testid="mark-summary" aria-live="polite">
            {days.length > 0 ? selectionLabel(days) : range.arrival ? "Ahora elija la salida" : "Elija la llegada"}
          </p>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!ready || days.length === 0 || occupied}>
            Marcar como ocupado
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={onClose}>
            Cancelar
          </button>
        </form>
      </section>
    </>,
    document.body,
  );
}
