// Hoja «Pausar la casa» (antes «Cerrar la casa», ticket 04 de la ronda del 2 nov; el comportamiento no cambia): se abre
// desde la fila «Pausar la casa» del Calendario, con fecha de vuelta opcional (set_listing_available). Trozo diferido propio (se pide al tocar la fila o en reposo en el Calendario). Diálogo
// modal (`Sheet`, shared/overlay.tsx): Escape, el fondo, Atrás en el teléfono o «Cancelar» la cierran; con una fecha
// elegida, Escape, el fondo y Atrás preguntan antes «¿Descartar los cambios?» (D10).
import { useState, type FormEvent } from "react";
import { addDays, CALENDAR_WINDOW_DAYS, validateReopenDate } from "../domain/calendar";
import { costaRicaToday } from "../domain/inquiry";
import { Sheet } from "../shared/overlay";
import { Button } from "../shared/button";

export function CloseSheet({ onConfirm, onClose }: { onConfirm: (reopenAt: string | null) => void; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const today = costaRicaToday(Date.now());

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const refused = validateReopenDate(date || null, today);
    if (refused) return setProblem(refused);
    onConfirm(date || null);
  }

  return (
    <Sheet title="Pausar la casa" closeButton={false} onClose={onClose} confirmDiscard={() => date !== ""}>
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
          <Button variant="primary" size="lg" type="submit">
            Pausar la casa
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </form>
    </Sheet>
  );
}
