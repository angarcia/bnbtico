// Hoja modal de confirmación compartida («Parar suscripción», «¿Cerrar sesión?»), sobre `Sheet` (shared/overlay.tsx): Escape,
// el fondo y Atrás en el teléfono la cierran salvo mientras `pending`; el foco vuelve a quien la abrió. Tras confirmar (o si
// quien la abrió ya no está o está desactivado), a `returnFocus` o al título de la pantalla.
// Aspecto (historia 07): `tone` elige el botón que confirma (principal o destructivo); «Cancelar» es siempre secundario.
// `keep` es la excepción de «Parar suscripción» en escritorio (Ana, 2026-11-19): quedarse es lo principal y parar es un
// texto terracota, para no empujar a parar.
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { Sheet } from "../shared/overlay";
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
}) {
  const confirmed = useRef(false);
  const textId = useId();
  const cancel = (
    <Button variant={tone === "keep" ? "primary" : "secondary"} size="lg" disabled={pending} onClick={onClose}>
      {cancelLabel}
    </Button>
  );
  const confirm = () => {
    confirmed.current = true;
    onConfirm();
  };
  return (
    <Sheet title={title} closeButton={false} describedBy={textId} busy={pending} onClose={onClose}
      returnFocus={(opener) => (confirmed.current ? returnFocus?.current ?? null : opener)}>
      <p id={textId}>{body}</p>
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
    </Sheet>
  );
}
