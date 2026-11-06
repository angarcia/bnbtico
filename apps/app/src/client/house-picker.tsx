import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { I } from "../shared/icons";
import { usePrivateSheet } from "./private-sheet";

export interface HouseOption {
  id: string;
  name: string;
}

/** Selector común de Consultas y Calendario. La pantalla conserva sus reglas de casas elegibles y su navegación. */
export function HousePicker({ houses, currentId, onPick, allowAll = false, currentName }: {
  houses: readonly HouseOption[];
  currentId: string | null;
  onPick(id: string | null): void;
  allowAll?: boolean;
  /** Una casa de la URL aún fuera de la caché de casas, pero presente en las consultas. */
  currentName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const name = houses.find((h) => h.id === currentId)?.name ?? currentName ?? (currentId === null && allowAll ? "Todas las casas" : "Casa seleccionada");
  return (
    <div className="house-picker">
      <button type="button" className="picker-pill" data-testid="house-picker-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} title={name}
        onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}>
        <I.house size={20} />
        <span className="picker-name">{name}</span>
        <span className="picker-arrow"><I.chevronDown size={18} /></span>
      </button>
      {open ? <HousePickerSheet id={id} houses={houses} currentId={currentId} allowAll={allowAll} onClose={() => setOpen(false)} onPick={(next) => {
        setOpen(false);
        if (next !== currentId) onPick(next);
      }} /> : null}
    </div>
  );
}

function HousePickerSheet({ id, houses, currentId, allowAll, onPick, onClose }: {
  id: string;
  houses: readonly HouseOption[];
  currentId: string | null;
  allowAll: boolean;
  onPick(id: string | null): void;
  onClose(): void;
}) {
  const options: { id: string | null; name: string }[] = allowAll ? [{ id: null, name: "Todas las casas" }, ...houses] : [...houses];
  const [focused, setFocused] = useState(() => options.some((h) => h.id === currentId) ? currentId : (options[0]?.id ?? null));
  const { sheet, onKeyDown } = usePrivateSheet({
    onClose,
    focusable: 'button:not([disabled]):not([tabindex="-1"])',
    trapEmpty: true,
    returnFocus(opener) { if (opener?.isConnected) opener.focus({ preventScroll: true }); },
  });
  useEffect(() => {
    sheet.current?.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sheet]);

  function move(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    if (!items.length) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} data-testid="sheet-backdrop" />
      <section id={id} ref={sheet} className="sheet house-picker-sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={`${id}-title`}>{allowAll ? "Filtrar por casa" : "Elegir casa"}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" title="Cerrar" onClick={onClose}><I.x size={22} /></button>
        </div>
        <div className="house-picker-list" role="listbox" aria-label="Elegir casa" onKeyDown={move}>
          {options.map((h) => (
            <button key={h.id ?? "all"} type="button" role="option" aria-selected={h.id === currentId} tabIndex={h.id === focused ? 0 : -1}
              onFocus={() => setFocused(h.id)} onClick={() => onPick(h.id)}>
              <span className="picker-option-name">{h.name}</span>
              <span className="picker-check" aria-hidden="true">{h.id === currentId ? <I.check size={20} /> : null}</span>
            </button>
          ))}
        </div>
      </section>
    </>, document.body,
  );
}
