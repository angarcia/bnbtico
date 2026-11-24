// Las acciones de arriba del Calendario del anfitrión (ticket 04 de la ronda del 2 nov): «Marcar una reserva» y «Pausar la
// casa», cada una con su hoja en su propio trozo diferido.
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import type { CalendarDay } from "../../../domain/calendar";
import { shortDate } from "../../../domain/dates";
import { toDomainError } from "../../../domain/errors";
import type { Listing } from "../../../domain/listing";
import { reportError } from "../../../shared/beacon";
import { usePreloadWhenIdle } from "../../../shared/idle";
import { Button } from "../../../shared/ui/button";
import { I } from "../../../shared/ui/icons";
import { Notice } from "../../../shared/ui/structure";
import { isChunkLoadError } from "../../comun/chunk-error";
import { useSetAvailable } from "../owner";
import * as CAL_COPY from "./copy/calendar";

const loadCloseSheet = () => import("./close-sheet");
const lazyCloseSheet = () => lazy(() => loadCloseSheet().then((m) => ({ default: m.CloseSheet })));
let CloseSheet = lazyCloseSheet();
const loadMarkSheet = () => import("./mark-sheet");
const lazyMarkSheet = () => lazy(() => loadMarkSheet().then((m) => ({ default: m.MarkSheet })));
let MarkSheet = lazyMarkSheet();

/**
 * El foco vuelve al botón de la fila cuando la hoja ya se desmontó (la página dejó de estar inerte) y la fila muestra el
 * estado esperado (`shown`). Quien cierra la hoja llama antes a `focusWhen` con el estado que la fila tendrá después.
 */
function useFocusAfterSheet<T>(open: boolean, shown: T) {
  const button = useRef<HTMLButtonElement>(null);
  const expected = useRef<{ value: T } | null>(null);
  useEffect(() => {
    if (open || !expected.current || expected.current.value !== shown) return;
    expected.current = null;
    button.current?.focus();
  }, [open, shown]);
  return { button, focusWhen: (value: T) => void (expected.current = { value }) };
}

/** «Marcar una reserva», arriba del calendario editable: abre la hoja con el calendario de rango y, al confirmar, las noches
 *  quedan ocupadas (optimista, como «Guardar cambios») y lo dice un aviso. Si las reglas rechazan el cambio, se dice junto
 *  a la fila. */
export function MarkRow({ today, onMark, calendarDays, prepare }: {
  today: string; onMark: (nights: string[], label: string) => string | null; calendarDays: CalendarDay[] | undefined;
  prepare: (signal: AbortSignal) => Promise<{ warning: string | null }>;
}) {
  const [marking, setMarking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { button, focusWhen } = useFocusAfterSheet(marking, true);
  usePreloadWhenIdle(loadMarkSheet);
  const end = () => {
    focusWhen(true);
    setMarking(false);
  };
  return (
    <>
      <button ref={button} type="button" className="cal-action" aria-haspopup="dialog" onClick={() => (setProblem(null), setMarking(true))}>
        <span className="cal-action-icon">
          <I.calendar size={20} />
        </span>
        <span className="body">
          <b>{CAL_COPY.mark}</b>
        </span>
        <I.chevron />
      </button>
      {problem ? (
        <Notice tone="error">
          {problem}
        </Notice>
      ) : null}
      {marking ? (
        <SheetBoundary name="Marcar una reserva" onRetry={() => (MarkSheet = lazyMarkSheet())}>
          {() => (
            <Suspense fallback={<div className="sheet-backdrop" />}>
              <MarkSheet
                today={today}
                calendarDays={calendarDays}
                prepare={prepare}
                onClose={end}
                onConfirm={(nights, label) => {
                  setProblem(onMark(nights, label));
                  end();
                }}
              />
            </Suspense>
          )}
        </SheetBoundary>
      ) : null}
    </>
  );
}

/** «Pausar la casa» (antes «Cerrar la casa hasta…»), en una casa activa (can(l,"available")): sin pausar, la fila abre la
 *  hoja «Pausar la casa»; pausada, dice hasta cuándo y «Volver a publicarla» la abre en un toque. Las dos escrituras son
 *  optimistas (useSetAvailable); mientras la base no contesta, «Volver a publicarla» no hace nada (sigue enfocable, con
 *  aria-disabled). El foco vuelve a la fila que corresponde: al cancelar, la misma; al confirmar, «Volver a publicarla»;
 *  al volver a publicarla, «Pausar la casa». */
export function PauseRow({ listing: l, userId }: { listing: Listing; userId: string }) {
  const available = useSetAvailable(userId, l);
  const [closing, setClosing] = useState(false);
  const { button, focusWhen } = useFocusAfterSheet(closing, l.available);
  usePreloadWhenIdle(loadCloseSheet);
  const endClosing = (next: boolean) => {
    focusWhen(next);
    setClosing(false);
  };
  const pending = available.isPending;
  return (
    <>
      {l.available ? (
        <button ref={button} type="button" className="cal-action" aria-haspopup="dialog" onClick={() => setClosing(true)}>
          <span className="cal-action-icon">
            <PauseIcon />
          </span>
          <span className="body">
            <b>{CAL_COPY.pause}</b>
          </span>
          <I.chevron />
        </button>
      ) : (
        <div className="cal-action is-paused">
          <span className="cal-action-icon">
            <PauseIcon />
          </span>
          <span className="body">
            <b>{CAL_COPY.paused({ until: l.reopenAt ? shortDate(l.reopenAt) : null })}</b>
            <span className="small muted">{CAL_COPY.pausedNote}</span>
          </span>
          <Button
            ref={button}
            variant="secondary"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              focusWhen(true);
              available.mutate({ available: true });
            }}
          >
            {CAL_COPY.republish}
          </Button>
        </div>
      )}
      {available.error ? (
        <Notice tone="error">
          {toDomainError(available.error).message}
        </Notice>
      ) : null}
      {closing ? (
        <SheetBoundary name="Pausar la casa" onRetry={() => (CloseSheet = lazyCloseSheet())}>
          {() => (
            <Suspense fallback={<div className="sheet-backdrop" />}>
              <CloseSheet
                onClose={() => endClosing(true)}
                onConfirm={(reopenAt) => {
                  endClosing(false);
                  available.mutate({ available: false, reopenAt });
                }}
              />
            </Suspense>
          )}
        </SheetBoundary>
      ) : null}
    </>
  );
}

/** Pausa: dos barras, con el trazo de los iconos de línea (shared/icons). Va en este trozo, no en el JS inicial. */
function PauseIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M9 6v12M15 6v12" />
    </svg>
  );
}

/** Si el trozo de una hoja no llega (sin red, o un despliegue nuevo cambió su nombre) o falla al pintarse, se dice junto a
 *  la fila (lo segundo, además, a /errors). «Reintentar» crea otro componente (`onRetry`), que vuelve a pedir el trozo
 *  (por eso la hoja llega como función: se pinta con el componente nuevo). */
class SheetBoundary extends Component<{ name: string; onRetry: () => void; children: () => ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) reportError(error);
  }
  override render() {
    if (!this.state.failed) return this.props.children();
    return (
      <div className="row gap-8 baseline cal-action-error">
        <p className="field-error" role="alert">
          {CAL_COPY.openError({ name: this.props.name })}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            this.props.onRetry();
            this.setState({ failed: false });
          }}
        >
          {CAL_COPY.retry}
        </Button>
      </div>
    );
  }
}
