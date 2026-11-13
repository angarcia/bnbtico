import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { I } from "../shared/icons";
import { usePrivateSheet } from "./private-sheet";
import { useDesktop } from "./desktop";

export interface HouseOption {
  id: string;
  name: string;
}

/** Selector común de Consultas y Calendario. La pantalla conserva sus reglas de casas elegibles y su navegación. */
export function HousePicker({ houses, currentId, onPick, allowAll = false, currentName, zone = false }: {
  houses: readonly HouseOption[];
  currentId: string | null;
  onPick(id: string | null): void;
  allowAll?: boolean;
  /** Una casa de la URL aún fuera de la caché de casas, pero presente en las consultas. */
  currentName?: string;
  zone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useDesktop() && !zone;
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const title = zone ? "Elegir zona" : allowAll ? "Filtrar por casa" : "Elegir casa";
  const name = houses.find((h) => h.id === currentId)?.name ?? currentName ?? (currentId === null && allowAll ? "Todas las casas" : "Casa seleccionada");
  return (
    <div className="house-picker">
      <button ref={trigger} type="button" className="picker-pill" data-testid={zone ? "zone-picker-trigger" : "house-picker-trigger"} aria-label={zone ? `Zona, ${name}` : undefined} aria-haspopup={desktop ? "listbox" : "dialog"} aria-expanded={open} aria-controls={open ? id : undefined} title={name}
        onClick={() => setOpen(desktop ? !open : true)} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}>
        {zone ? <I.pin size={20} /> : <I.house size={20} />}
        <span className="picker-name">{name}</span>
        <span className="picker-arrow"><I.chevronDown size={18} /></span>
      </button>
      {open ? <HousePickerPanel desktop={desktop} trigger={trigger.current} id={id} title={title} houses={houses} currentId={currentId} allowAll={allowAll} onClose={() => setOpen(false)} onPick={(next) => {
        setOpen(false);
        if (next !== currentId) onPick(next);
      }} /> : null}
    </div>
  );
}

function HousePickerPanel({ desktop, trigger, id, title, houses, currentId, allowAll, onPick, onClose }: {
  desktop: boolean;
  trigger: HTMLButtonElement | null;
  id: string;
  title: string;
  houses: readonly HouseOption[];
  currentId: string | null;
  allowAll: boolean;
  onPick(id: string | null): void;
  onClose(): void;
}) {
  const options: { id: string | null; name: string }[] = allowAll ? [{ id: null, name: "Todas las casas" }, ...houses] : [...houses];
  const [focused, setFocused] = useState(() => options.some((h) => h.id === currentId) ? currentId : (options[0]?.id ?? null));
  const list = (
    <div id={desktop ? id : undefined} className="house-picker-list" role="listbox" aria-label={desktop || title === "Elegir zona" ? title : "Elegir casa"} onKeyDown={move}>
      {options.map((h) => (
        <button key={h.id ?? "all"} type="button" role="option" aria-selected={h.id === currentId} tabIndex={h.id === focused ? 0 : -1}
          onFocus={() => setFocused(h.id)} onClick={() => {
            if (desktop) trigger?.focus({ preventScroll: true });
            onPick(h.id);
          }}>
          <span className="picker-option-name">{h.name}</span>
          <span className="picker-check" aria-hidden="true">{h.id === currentId ? <I.check size={20} /> : null}</span>
        </button>
      ))}
    </div>
  );
  return desktop
    ? <PickerPopover trigger={trigger} onClose={onClose}>{list}</PickerPopover>
    : <HousePickerSheet id={id} title={title} onClose={onClose}>{list}</HousePickerSheet>;
}

function move(e: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
  if (!items.length) return;
  e.preventDefault();
  const current = items.findIndex((item) => item === document.activeElement);
  const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

function HousePickerSheet({ id, title, onClose, children }: {
  id: string;
  title: string;
  onClose(): void;
  children: React.ReactNode;
}) {
  const { sheet, onKeyDown } = usePrivateSheet({
    onClose,
    focusable: 'button:not([disabled]):not([tabindex="-1"])',
    trapEmpty: true,
    returnFocus(opener) {
      if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
    },
  });
  useEffect(() => {
    sheet.current?.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sheet]);

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} data-testid="sheet-backdrop" />
      <section id={id} ref={sheet} className="sheet house-picker-sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" title="Cerrar" onClick={onClose}><I.x size={22} /></button>
        </div>
        {children}
      </section>
    </>, document.body,
  );
}

function PickerPopover({ trigger, onClose, children }: {
  trigger: HTMLButtonElement | null;
  onClose(): void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element || !trigger) return;
    function position() {
      if (!element || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const opensUp = below < 220 && above > below;
      element.style.left = `${rect.left}px`;
      element.style.width = `${rect.width}px`;
      element.style.maxHeight = `${Math.min(320, Math.max(0, opensUp ? above : below))}px`;
      element.style.top = opensUp ? "auto" : `${rect.bottom + 8}px`;
      element.style.bottom = opensUp ? `${window.innerHeight - rect.top + 8}px` : "auto";
    }
    position();
    element.showPopover();
    const selected = element.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest" });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      element.hidePopover();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [trigger]);
  useEffect(() => {
    function outside(event: PointerEvent) {
      const path = event.composedPath();
      if (panel.current && !path.includes(panel.current) && (!trigger || !path.includes(trigger))) onClose();
    }
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [trigger, onClose]);

  return (
    <div ref={panel} popover="manual" className="desktop-dropdown" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger) onClose();
    }} onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      trigger?.focus({ preventScroll: true });
      onClose();
    }}>
      {children}
    </div>
  );
}
