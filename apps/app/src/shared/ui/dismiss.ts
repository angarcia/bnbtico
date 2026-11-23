// Cierre de desplegables y paneles no modales (historia 07, paso 3): selector de casa en escritorio y paneles Lugar, Fechas
// y Noches de Explorar. Escape (no sigue hacia arriba), tocar o hacer clic fuera y, si se pide, perder el foco. No es una
// superficie modal: no bloquea la página ni atrapa el foco (eso es shared/overlay.tsx).
import { useEffect, useRef, type FocusEvent, type KeyboardEvent } from "react";

export type DismissReason = "escape" | "outside" | "blur";

export function useDismiss({ open = true, inside, onDismiss, blur = false }: {
  open?: boolean;
  /** Lo que cuenta como dentro (el panel y su disparador). */
  inside: () => readonly (Node | null | undefined)[];
  onDismiss(reason: DismissReason): void;
  /** Cerrar también cuando el foco sale de lo de dentro. */
  blur?: boolean;
}) {
  const latest = useRef({ inside, onDismiss });
  latest.current = { inside, onDismiss };
  const within = (node: unknown) => node instanceof Node && latest.current.inside().some((el) => el?.contains(node));
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!within(event.target)) latest.current.onDismiss("outside");
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  return {
    onKeyDown(event: KeyboardEvent) {
      if (!open || event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onDismiss("escape");
    },
    onBlur(event: FocusEvent) {
      if (open && blur && !within(event.relatedTarget)) latest.current.onDismiss("blur");
    },
  };
}
