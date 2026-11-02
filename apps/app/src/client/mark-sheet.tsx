// Hoja «Marcar una reserva» (ticket 04 de la ronda del 2 nov; antes «Cerrar la casa»): se abre desde la fila de arriba del
// Calendario. El calendario de rango de «¿Cuándo?» (el mismo de la hoja de contacto) para elegir llegada y salida, y
// «Marcar como ocupado» deja ocupadas las noches de la llegada a la víspera de la salida. Trozo diferido propio (con el
// calendario de rango, range-calendar-*, que comparte con la búsqueda y la hoja de contacto). Diálogo modal como la hoja
// de contacto: la página queda `inert`, el foco no sale de la hoja y Escape, el fondo o «Cancelar» la cierran.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { reservationDays, selectionLabel } from "../domain/calendar";
import type { RangeState } from "../domain/range";
import { RangeCalendar } from "../shared/range-calendar";

const FOCUSABLE = "button:not([disabled]), input:not([disabled])";

export function MarkSheet({ today, onConfirm, onClose }: { today: string; onConfirm: (days: string[]) => void; onClose: () => void }) {
  const sheet = useRef<HTMLElement>(null);
  const [range, setRange] = useState<RangeState>({ arrival: null, departure: null });
  const days = reservationDays(range.arrival, range.departure);

  useEffect(() => {
    const root = document.getElementById("root");
    document.documentElement.classList.add("sheet-open");
    if (root) root.inert = true;
    sheet.current?.focus();
    return () => {
      document.documentElement.classList.remove("sheet-open");
      if (root) root.inert = false;
    };
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (days.length > 0) onConfirm(days);
  }

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} data-testid="sheet-backdrop" />
      <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby="mark-title" tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <h2 id="mark-title">Marcar una reserva</h2>
        <form onSubmit={onSubmit} noValidate>
          <span className="hint" id="mark-hint">
            Elija la llegada y la salida. La noche de la salida queda libre.
          </span>
          <div className="contact-calendar">
            <div className="range-scroll">
              <RangeCalendar today={today} mode="range" value={range} onChange={(r) => setRange(r)} />
            </div>
          </div>
          <p className="small muted" data-testid="mark-summary" aria-live="polite">
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
