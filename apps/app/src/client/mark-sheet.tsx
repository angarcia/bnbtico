// Hoja «Marcar una reserva» (ticket 04 de la ronda del 2 nov): se abre desde la fila de arriba del Calendario. El
// calendario de rango de «¿Cuándo?» (el mismo de la búsqueda y la hoja de contacto) para elegir llegada y salida, el
// resumen de las noches y «Marcar como ocupado», que deja ocupadas las noches de la llegada a la víspera de la salida.
// Trozo diferido propio (se pide al tocar la fila o en reposo en el Calendario; el calendario de rango, range-calendar-*,
// es otro trozo, compartido). Diálogo modal como «Pausar la casa» (`Sheet`): Escape, el fondo, Atrás en el teléfono o
// «Cancelar» la cierran; con una llegada elegida, Escape, el fondo y Atrás preguntan antes «¿Descartar los cambios?» (D10).
import { useEffect, useId, useState, type FormEvent } from "react";
import { selectionLabel, type CalendarDay } from "../domain/calendar";
import { reservationDays, reservationLabel } from "../domain/reservation";
import { RANGE_BUSY_MESSAGE, type RangeState } from "../domain/range";
import { toDomainError } from "../domain/errors";
import { RangeCalendar } from "../shared/range-calendar";
import { Sheet } from "../shared/ui/overlay";
import { Button } from "../shared/ui/button";
import { Notice } from "../shared/ui/structure";

const EMPTY_DAYS: readonly CalendarDay[] = [];

/** `onConfirm`: las noches a marcar y el aviso que lo dice («4 noches marcadas como ocupadas · 7–10 nov»). */
export function MarkSheet({ today, onConfirm, onClose, calendarDays = EMPTY_DAYS, prepare }: {
  today: string; onConfirm: (days: string[], label: string) => void; onClose: () => void;
  calendarDays?: readonly CalendarDay[];
  prepare?: (signal: AbortSignal) => Promise<{ warning: string | null }>;
}) {
  const hintId = useId();
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

  return (
    <Sheet title="Marcar una reserva" closeButton={false} describedBy={hintId} onClose={onClose} confirmDiscard={() => range.arrival !== null}>
        <span className="hint" id={hintId}>
          Marque de una vez las noches de una reserva larga como ocupadas. Elija la llegada y la salida. La noche de la salida queda libre.
        </span>
        <form onSubmit={onSubmit} noValidate>
          {status === "loading" ? <p className="hint" role="status">Comprobando disponibilidad…</p> : null}
          {message ? <Notice tone="error">{message}</Notice> : null}
          {status === "warning" ? <Button variant="secondary" onClick={() => { setStatus("ready"); setProblem(null); }}>Continuar con el último calendario</Button> : null}
          {status === "warning" || status === "error" ? <Button variant="secondary" onClick={() => setAttempt(n => n + 1)}>Intentar de nuevo</Button> : null}
          {ready ? <div className="contact-calendar mark-calendar">
            <div className="range-scroll">
              <RangeCalendar today={today} value={range} busy={busy} onChange={value => { setRange(value); setProblem(null); }} onReject={() => setProblem(RANGE_BUSY_MESSAGE)} />
            </div>
          </div> : null}
          <p className={`stay-line${days.length > 0 ? "" : " is-pending"}`} data-testid="mark-summary" aria-live="polite">
            {days.length > 0 ? selectionLabel(days) : range.arrival ? "Ahora elija la salida" : "Elija la llegada"}
          </p>
          <Button variant="primary" size="lg" type="submit" disabled={!ready || days.length === 0 || occupied}>
            Marcar como ocupado
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </form>
    </Sheet>
  );
}
