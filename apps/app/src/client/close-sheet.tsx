// Hoja «Pausar la casa» (antes «Cerrar la casa», ticket 04 de la ronda del 2 nov; el comportamiento no cambia): se abre
// desde la fila «Pausar la casa» del Calendario, con fecha de vuelta opcional (set_listing_available). Trozo diferido propio (se pide al tocar la fila o en reposo en el Calendario). Diálogo
// modal como la hoja de contacto: la página queda `inert`, el foco no sale de la hoja y Escape, el fondo o «Cancelar» la
// cierran (el foco vuelve a la fila desde quien la abre).
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { addDays, CALENDAR_WINDOW_DAYS, validateReopenDate } from "../domain/calendar";
import { costaRicaToday } from "../domain/inquiry";
import { usePrivateSheet } from "./private-sheet";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

export function CloseSheet({ onConfirm, onClose }: { onConfirm: (reopenAt: string | null) => void; onClose: () => void }) {
  const { sheet, onKeyDown } = usePrivateSheet({ onClose, focusable: FOCUSABLE });
  const [date, setDate] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const today = costaRicaToday(Date.now());

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const refused = validateReopenDate(date || null, today);
    if (refused) return setProblem(refused);
    onConfirm(date || null);
  }

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} data-testid="sheet-backdrop" />
      <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby="close-title" tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <h2 id="close-title">Pausar la casa</h2>
        <form onSubmit={onSubmit} noValidate>
          <label>
            Volver a publicarla el (opcional)
            <input
              type="date"
              name="reopen"
              min={addDays(today, 1)}
              max={addDays(today, CALENDAR_WINDOW_DAYS)}
              value={date}
              aria-invalid={problem ? true : undefined}
              aria-describedby="close-hint"
              onChange={(e) => {
                setDate(e.target.value);
                setProblem(null);
              }}
            />
          </label>
          <span className="hint" id="close-hint">
            No aparecerá en Explorar ni recibirá consultas. Sus noches y precios se conservan. Sin fecha, sigue pausada hasta que usted la vuelva a publicar.
          </span>
          {problem ? (
            <p className="note" role="alert">
              {problem}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-lg">
            Pausar la casa
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
