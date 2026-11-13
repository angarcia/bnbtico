import { useEffect, useRef, type KeyboardEvent } from "react";
import { useModal } from "../shared/modal";

export function usePrivateSheet({
  onClose,
  focusable,
  returnFocus,
  trapEmpty = false,
  enabled = true,
}: {
  onClose(): void;
  focusable: string;
  returnFocus?(opener: HTMLElement | null): void;
  trapEmpty?: boolean;
  enabled?: boolean;
}) {
  const sheet = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [enabled]);
  useModal(enabled);
  useEffect(() => {
    if (!enabled) return;
    sheet.current?.focus();
    return () => returnFocus?.(opener.current);
  }, [enabled]);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      return onClose();
    }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = sheet.current.querySelectorAll<HTMLElement>(focusable);
    const first = items[0];
    const last = items[items.length - 1];
    if (!trapEmpty && (!first || !last)) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  return { sheet, onKeyDown };
}
