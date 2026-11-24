// Los meses del Calendario del propietario, uno debajo de otro, del actual al último de la ventana.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "@tanstack/react-router";
import { addMonths, monthTitle } from "../../../domain/calendar";
import { ignoreChromeScroll } from "../../comun/hiding-chrome";

/** Con mes pedido (`?mes=`), lo lleva arriba al abrir; sin él, la pantalla abre arriba del todo. Solo al abrir: luego manda
 *  el dedo, y desplazarse no cambia la URL. */
function useScrollToMonth(box: RefObject<HTMLDivElement | null>, target: string | null, first: string | undefined) {
  const router = useRouter();
  useLayoutEffect(() => {
    if (!target || target === first) return;
    const toTarget = () => {
      ignoreChromeScroll(300);
      box.current?.querySelector(`[data-month="${target}"]`)?.scrollIntoView({ block: "start" });
    };
    toTarget();
    // Al llegar desde la app, la restauración del desplazamiento del router corre en su onRendered, después de este
    // efecto, y devuelve la página arriba: se lleva el mes otra vez justo después (una sola vez).
    const stop = router.subscribe("onRendered", () => {
      stop();
      toTarget();
    });
    return stop;
    // Solo al abrir.
  }, []);
}

/** Los meses con su rejilla montada: los dos primeros y el pedido (con el siguiente) desde el principio, para que nada
 *  crezca encima del pedido; los demás, al acercarse a la vista (a una pantalla), y ya no se desmontan. */
function useMonthsNearView(box: RefObject<HTMLDivElement | null>, months: string[], target: string | null): Set<string> {
  const [mounted, setMounted] = useState(() => new Set([months[0]!, months[1]!, ...(target ? [target, addMonths(target, 1)] : [])].filter((m) => months.includes(m))));
  useEffect(() => {
    const blocks = box.current?.querySelectorAll<HTMLElement>(".cal-month-block");
    if (!blocks) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).map((e) => (observer.unobserve(e.target), (e.target as HTMLElement).dataset.month!));
        if (seen.length) setMounted((prev) => (seen.every((m) => prev.has(m)) ? prev : new Set([...prev, ...seen])));
      },
      { rootMargin: "100% 0px" },
    );
    blocks.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, []);
  return mounted;
}

/** Los meses uno debajo de otro, cada uno con su título fijo arriba; la rejilla de cada mes la pinta `render`. */
export function CalendarMonths({ months, target, render }: { months: string[]; target: string | null; render: (month: string) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useScrollToMonth(box, target, months[0]);
  const mounted = useMonthsNearView(box, months, target);
  return (
    <div className="cal-months" ref={box}>
      {months.map((m) => (
        <section key={m} className="cal-month-block" data-month={m} aria-label={monthTitle(m)}>
          <h2 className="cal-month-title">{monthTitle(m)}</h2>
          {mounted.has(m) ? render(m) : <div className="cal-month-placeholder" aria-hidden="true" />}
        </section>
      ))}
    </div>
  );
}
