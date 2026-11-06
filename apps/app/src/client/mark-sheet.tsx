// Hoja «Marcar una reserva» (ticket 04 de la ronda del 2 nov): se abre desde la fila de arriba del Calendario. El
// calendario de rango de «¿Cuándo?» (el mismo de la búsqueda y la hoja de contacto) para elegir llegada y salida, el
// resumen de las noches y «Marcar como ocupado», que deja ocupadas las noches de la llegada a la víspera de la salida.
// Trozo diferido propio (se pide al tocar la fila o en reposo en el Calendario; el calendario de rango, range-calendar-*,
// es otro trozo, compartido). Diálogo modal como «Pausar la casa»: la página queda `inert`, el foco no sale de la hoja y
// Escape, el fondo o «Cancelar» la cierran (el foco vuelve a la fila desde quien la abre).
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { selectionLabel } from "../domain/calendar";
import { reservationDays, reservationLabel } from "../domain/reservation";
import type { RangeState } from "../domain/range";
import { RangeCalendar } from "../shared/range-calendar";
import { usePrivateSheet } from "./private-sheet";

const FOCUSABLE = "button:not([disabled])";

/** `onConfirm`: las noches a marcar y el aviso que lo dice («4 noches marcadas como ocupadas · 7–10 nov»). */
export function MarkSheet({ today, onConfirm, onClose }: { today: string; onConfirm: (days: string[], label: string) => void; onClose: () => void }) {
  const { sheet, onKeyDown } = usePrivateSheet({ onClose, focusable: FOCUSABLE });
  const [range, setRange] = useState<RangeState>({ arrival: null, departure: null });
  const days = reservationDays(range.arrival, range.departure);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (days.length > 0) onConfirm(days, reservationLabel(days));
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
          <div className="contact-calendar mark-calendar">
            <div className="range-scroll">
              <RangeCalendar today={today} value={range} onChange={setRange} />
            </div>
          </div>
          <p className={`stay-line${days.length > 0 ? "" : " is-pending"}`} data-testid="mark-summary" aria-live="polite">
            {days.length > 0 ? selectionLabel(days) : range.arrival ? "Ahora elija la salida" : "Elija la llegada"}
          </p>
          <button type="submit" className="btn btn-primary btn-lg" disabled={days.length === 0}>
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
