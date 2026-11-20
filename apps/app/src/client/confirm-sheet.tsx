// Hoja modal de confirmación compartida («Parar suscripción», «¿Cerrar sesión?»): portal a <body>, #root inerte mientras
// está abierta, foco atrapado entre sus dos botones; Escape y el fondo la cierran y, al cerrarse, el foco vuelve a quien
// la abrió. Tras confirmar (o si quien la abrió ya no está o está desactivado), a `returnFocus` o al título de la pantalla.
// Aspecto (historia 07): `tone` elige el botón que confirma (principal o destructivo); «Cancelar» es siempre secundario.
// `keep` es la excepción de «Parar suscripción» en escritorio (Ana, 2026-11-19): quedarse es lo principal y parar es un
// texto terracota, para no empujar a parar.
import { useId, useRef, type ReactNode, type ReactPortal, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePrivateSheet } from "./private-sheet";
import { Button, TextButton } from "../shared/button";

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  tone = "default",
  cancelLabel = "Cancelar",
  cancelFirst = false,
  onConfirm,
  onClose,
  returnFocus,
  pending = false,
  error,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "default" | "destructive" | "keep";
  cancelLabel?: string;
  cancelFirst?: boolean;
  onConfirm(): void;
  onClose(): void;
  returnFocus?: RefObject<HTMLElement | null>;
  pending?: boolean;
  error?: string | null;
}): ReactPortal {
  const confirmed = useRef(false);
  const id = useId();
  const { sheet, onKeyDown } = usePrivateSheet({
    onClose: () => { if (!pending) onClose(); },
    focusable: "button",
    trapEmpty: true,
    returnFocus(opener) {
      let to = opener;
      if (confirmed.current || !to?.isConnected || to.matches(":disabled")) {
        to = returnFocus?.current ?? document.querySelector("main h1");
        if (to && !returnFocus?.current) to.tabIndex = -1;
      }
      to?.focus({ preventScroll: true });
    },
  });
  const cancel = (
    <Button variant={tone === "keep" ? "primary" : "secondary"} size="lg" disabled={pending} onClick={onClose}>
      {cancelLabel}
    </Button>
  );
  const confirm = () => {
    confirmed.current = true;
    onConfirm();
  };
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={() => { if (!pending) onClose(); }} />
      <section ref={sheet} className="sheet stack" role="dialog" aria-modal="true" aria-busy={pending} aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-text`}>{body}</p>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {cancelFirst && cancel}
        {tone === "keep" ? (
          <TextButton tone="danger" disabled={pending} aria-busy={pending || undefined} onClick={confirm}>
            {confirmLabel}
          </TextButton>
        ) : (
          <Button variant={tone === "destructive" ? "danger" : "primary"} size="lg" pending={pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        )}
        {!cancelFirst && cancel}
      </section>
    </>,
    document.body,
  );
}
