// Arrastrar fotos del paso 7 con Pointer Events (sin librería). Mantener pulsada una foto LONG_PRESS_MS la levanta; moverse
// más de SLOP_PX antes, soltar o que el navegador se quede el gesto (pointercancel: el scroll con touch-action pan-y)
// lo cancela. Tras levantar, un touchmove nativo no pasivo en la rejilla impide que el navegador haga scroll (el
// touch-action ya se fijó en el pointerdown; el onTouchMove de React es pasivo y no serviría).
// Levantada, la foto sigue al dedo y las demás se apartan (transform, una vez por frame) hacia su sitio en el orden que
// quedaría. Al soltar en otro sitio se llama a onDrop una vez y los transforms se quedan hasta que llega la lista nueva
// (orden optimista): entonces se quitan sin transición, así la rejilla no vuelve atrás. Soltar en su sitio, pointercancel,
// dejar de estar permitido o que cambie la lista a mitad de gesto: todo vuelve a su sitio y no se pide nada.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { moveTo, reorderOnDrop } from "../../domain/photo-order";
import { LIFT_SCALE, LONG_PRESS_MS, SLOP_PX, shiftBetween, slotAt, type Slot } from "./photo-drag";

export interface PhotoDragOptions {
  ids: readonly string[];
  /** false while uploads are in flight or a change is pending: no lift; turning false mid-gesture cancels it. */
  enabled: boolean;
  scroller: RefObject<HTMLElement | null>;
  onDrop(order: string[], id: string): void;
}
export interface PhotoDrag {
  gridRef: RefObject<HTMLDivElement | null>;
  /** Photo lifted right now (drives `.is-lifted`), or null. */
  liftedId: string | null;
  /** From the lift until the photos are back in place (drives `.photos-grid.is-dragging`; ✕ disabled). */
  dragging: boolean;
  onPointerDown(e: ReactPointerEvent<HTMLElement>, id: string): void;
}

/** Gesto en curso: hasta levantar solo espera; `lifted` lo lee el touchmove nativo. */
interface Gesture {
  lifted: boolean;
  /** `drop`: soltar (reordena si cayó en otro sitio); sin él, cancela. */
  stop(drop?: boolean): void;
  /** Medidos una vez al levantar, en coordenadas del contenido del scroller (los usa el arrastre). */
  slots: Slot[];
  snapshot: readonly string[];
}
const TYPES = ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const;

export function usePhotoDrag(o: PhotoDragOptions): PhotoDrag {
  const gridRef = useRef<HTMLDivElement>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  /** Orden enviado al soltar: cuando la lista llega con él (o cambia), se quitan los transforms. */
  const awaiting = useRef<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const opts = useRef(o);
  useLayoutEffect(() => {
    opts.current = o;
  });

  /** Quita todos los transforms sin transición (la lista ya está en su orden) y termina el arrastre. */
  const settle = () => {
    clearTimeout(settleTimer.current);
    awaiting.current = null;
    const grid = gridRef.current;
    if (grid) {
      grid.classList.add("is-settling");
      for (const t of grid.querySelectorAll<HTMLElement>("[data-photo]")) t.style.transform = "";
      void grid.offsetWidth;
      requestAnimationFrame(() => grid.classList.remove("is-settling"));
    }
    setDragging(false);
  };
  // Llega la lista tras soltar (el orden optimista, o cualquier otra): fuera transforms. Si cambia a mitad de gesto
  // (subida, relectura, ✕): se cancela sin pedir nada.
  const key = o.ids.join();
  useLayoutEffect(() => {
    if (awaiting.current) settle();
    else gesture.current?.stop();
  }, [key]);

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
    if (!opts.current.enabled || e.button || !e.isPrimary || gesture.current || (e.target as Element).closest("button")) return;
    const tile = e.currentTarget;
    const { pointerId, clientX: x0, clientY: y0 } = e;

    let to = 0, frame = 0, box: DOMRect, top0 = 0, scale = "";
    let last: PointerEvent | undefined;
    const tiles = () => gridRef.current?.querySelectorAll<HTMLElement>("[data-photo]") ?? [];
    /** Cada foto desde su sitio al levantar hasta su sitio en `order` (la levantada incluida). */
    const place = (order: readonly string[]) => {
      for (const t of tiles()) {
        const i = g.snapshot.indexOf(t.dataset.photo!), j = order.indexOf(t.dataset.photo!);
        const d = i < 0 || j < 0 || i === j ? null : shiftBetween(g.slots[i]!, g.slots[j]!);
        t.style.transform = d ? `translate(${d.x}px,${d.y}px) scale(${d.s})` : "";
      }
    };
    const paint = () => {
      frame = 0;
      const sc = opts.current.scroller.current;
      if (!last || !sc) return;
      const { clientX: x, clientY: y } = last;
      to = slotAt(g.slots, x - box.left, y - box.top + sc.scrollTop, to);
      place(moveTo(g.snapshot, id, to));
      tile.style.transform = `translate(${x - x0}px,${y - y0 + sc.scrollTop - top0}px)${scale}`;
    };

    const stop = (drop?: boolean) => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      for (const t of TYPES) removeEventListener(t, on, true);
      try {
        tile.releasePointerCapture(pointerId);
      } catch {
        // sin captura (no llegó a levantarse) o el puntero ya no existe
      }
      gesture.current = null;
      setLiftedId(null);
      if (!g.lifted) return;
      const order = drop ? reorderOnDrop(g.snapshot, opts.current.ids, id, to) : null;
      if (order) {
        // La levantada va a su sitio nuevo; las demás se quedan apartadas hasta que llega la lista (o 1 s como mucho).
        place(order);
        awaiting.current = order.join();
        settleTimer.current = setTimeout(settle, 1000);
        opts.current.onDrop(order, id);
      } else {
        place(g.snapshot); // todas vuelven a su sitio con la transición
        settleTimer.current = setTimeout(settle, 150);
      }
    };
    const g: Gesture = { lifted: false, stop, slots: [], snapshot: [] };
    // Otro dedo durante la espera cancela (ya levantada, se ignora); este dedo cancela si se mueve más de SLOP_PX antes de
    // levantar; levantada, moverlo pinta en el frame siguiente; soltarlo suelta y pointercancel cancela.
    const on = (ev: PointerEvent) => {
      if (ev.type === "pointerdown") {
        if (!g.lifted) stop();
      } else if (ev.pointerId === pointerId) {
        if (ev.type !== "pointermove") stop(ev.type === "pointerup");
        else if (g.lifted) {
          last = ev;
          frame ||= requestAnimationFrame(paint);
        } else if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > SLOP_PX) stop();
      }
    };
    const timer = setTimeout(() => {
      const scroller = opts.current.scroller.current;
      try {
        tile.setPointerCapture(pointerId);
      } catch {
        return stop(); // el puntero ya no existe
      }
      if (!scroller) return stop();
      box = scroller.getBoundingClientRect();
      top0 = scroller.scrollTop;
      g.slots = Array.from(tiles(), (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - box.left, top: r.top - box.top + top0, width: r.width, height: r.height };
      });
      g.snapshot = [...opts.current.ids];
      to = g.snapshot.indexOf(id);
      g.lifted = true;
      setLiftedId(id);
      setDragging(true);
      navigator.vibrate?.(10);
      scale = matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : ` scale(${LIFT_SCALE})`;
      tile.style.transform = `translate(0,0)${scale}`;
    }, LONG_PRESS_MS);

    gesture.current = g;
    for (const t of TYPES) addEventListener(t, on, true);
  }

  return { gridRef, liftedId, dragging, onPointerDown };
}
