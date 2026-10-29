// Hoja modal de confirmación compartida («Parar suscripción», «¿Cerrar sesión?»): portal a <body>, #root inerte mientras
// está abierta, foco atrapado entre sus dos botones; Escape y el fondo la cierran y, al cerrarse, el foco vuelve a quien
// la abrió. Tras confirmar (o si quien la abrió ya no está o está desactivado), a `returnFocus` o al título de la pantalla.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type ReactPortal, type RefObject } from "react";
import { createPortal } from "react-dom";

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  confirmClassName,
  cancelClassName,
  onConfirm,
  onClose,
  returnFocus,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmClassName: string;
  cancelClassName: string;
  onConfirm(): void;
  onClose(): void;
  returnFocus?: RefObject<HTMLElement | null>;
}): ReactPortal {
  const sheet = useRef<HTMLElement>(null);
  const confirmed = useRef(false);
  const id = useId();
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    document.documentElement.classList.add("sheet-open");
    if (root) root.inert = true;
    sheet.current?.focus();
    return () => {
      document.documentElement.classList.remove("sheet-open");
      if (root) root.inert = false;
      let to = opener;
      if (confirmed.current || !to?.isConnected || to.matches(":disabled")) {
        to = returnFocus?.current ?? document.querySelector("main h1");
        if (to && !returnFocus?.current) to.tabIndex = -1;
      }
      to?.focus({ preventScroll: true });
    };
  }, []);
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      return onClose();
    }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>("button"));
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <section ref={sheet} className="sheet stack" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-text`}>{body}</p>
        <button
          type="button"
          className={confirmClassName}
          onClick={() => {
            confirmed.current = true;
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className={cancelClassName} onClick={onClose}>
          Cancelar
        </button>
      </section>
    </>,
    document.body,
  );
}
