// Arrastrar fotos del paso 7 con Pointer Events (sin librería). Mantener pulsada una foto LONG_PRESS_MS la levanta; moverse
// más de SLOP_PX antes, soltar o que el navegador se quede el gesto (pointercancel: el scroll con touch-action pan-y)
// lo cancela. Tras levantar, un touchmove nativo no pasivo en la rejilla impide que el navegador haga scroll (el
// touch-action ya se fijó en el pointerdown; el onTouchMove de React es pasivo y no serviría).
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { LIFT_SCALE, LONG_PRESS_MS, SLOP_PX, type Slot } from "./photo-drag";

export interface PhotoDragOptions {
  ids: readonly string[];
  /** false while uploads are in flight or a change is pending: no lift; turning false mid-gesture cancels it. */
  enabled: boolean;
  scroller: RefObject<HTMLElement | null>;
  onDrop(order: string[], id: string): void;
}
export interface PhotoDrag {
  gridRef: RefObject<HTMLDivElement | null>;
  /** Photo lifted right now (drives `.is-lifted` and `.photos-grid.is-dragging`), or null. */
  liftedId: string | null;
  onPointerDown(e: ReactPointerEvent<HTMLElement>, id: string): void;
}

/** Gesto en curso: hasta levantar solo espera; `lifted` lo lee el touchmove nativo. */
interface Gesture {
  lifted: boolean;
  stop(): void;
  /** Medidos una vez al levantar, en coordenadas del contenido del scroller (los usa el arrastre). */
  slots: Slot[];
  snapshot: readonly string[];
}
const TYPES = ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const;

export function usePhotoDrag(o: PhotoDragOptions): PhotoDrag {
  const gridRef = useRef<HTMLDivElement>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const opts = useRef(o);
  useLayoutEffect(() => {
    opts.current = o;
  });

  // Cancelar si deja de estar permitido a mitad de gesto, y al desmontar.
  useEffect(() => {
    if (!o.enabled) gesture.current?.stop();
  }, [o.enabled]);
  useEffect(() => {
    const grid = gridRef.current;
    const hold = (e: TouchEvent) => {
      if (gesture.current?.lifted) e.preventDefault();
    };
    grid?.addEventListener("touchmove", hold, { passive: false });
    return () => {
      grid?.removeEventListener("touchmove", hold);
      gesture.current?.stop();
    };
  }, []);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>, id: string) {
    if (!opts.current.enabled || e.button || gesture.current || (e.target as Element).closest("button")) return;
    const tile = e.currentTarget;
    const { pointerId, clientX: x0, clientY: y0 } = e;

    const stop = () => {
      clearTimeout(timer);
      for (const t of TYPES) removeEventListener(t, on, true);
      tile.style.transform = "";
      gesture.current = null;
      setLiftedId(null);
    };
    const g: Gesture = { lifted: false, stop, slots: [], snapshot: [] };
    // Otro dedo durante la espera cancela (ya levantada, se ignora); este dedo cancela si se mueve más de SLOP_PX antes de
    // levantar; soltar o pointercancel terminan (tras levantar, la foto vuelve a su sitio: aún no se reordena).
    const on = (ev: PointerEvent) => {
      if (
        ev.type === "pointerdown"
          ? !g.lifted
          : ev.pointerId === pointerId && (ev.type !== "pointermove" || (!g.lifted && Math.hypot(ev.clientX - x0, ev.clientY - y0) > SLOP_PX))
      )
        stop();
    };
    const timer = setTimeout(() => {
      const scroller = opts.current.scroller.current;
      try {
        tile.setPointerCapture(pointerId);
      } catch {
        return stop(); // el puntero ya no existe
      }
      if (!scroller) return stop();
      const box = scroller.getBoundingClientRect();
      g.slots = Array.from(gridRef.current!.querySelectorAll("[data-photo]"), (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - box.left, top: r.top - box.top + scroller.scrollTop, width: r.width, height: r.height };
      });
      g.snapshot = [...opts.current.ids];
      g.lifted = true;
      setLiftedId(id);
      navigator.vibrate?.(10);
      tile.style.transform = matchMedia("(prefers-reduced-motion: reduce)").matches ? "translate(0,0)" : `translate(0,0) scale(${LIFT_SCALE})`;
    }, LONG_PRESS_MS);

    gesture.current = g;
    for (const t of TYPES) addEventListener(t, on, true);
  }

  return { gridRef, liftedId, onPointerDown };
}
