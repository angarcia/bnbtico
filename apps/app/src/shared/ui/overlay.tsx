// Ventanas y hojas comunes (historia 07, paso 3; API en docs/componentes.md). Un comportamiento (`useOverlay`, sobre la pila
// de shared/overlay-stack.ts) y tres contenedores tipados:
// - `Sheet`: hoja inferior en el teléfono; en escritorio, la ventana normal (CSS), salvo `layout="picker"` (sigue abajo).
// - `Dialog size="normal" | "wide"`: ventana de escritorio, 520 px o hasta 960 px, con cabecera, cuerpo con su scroll y pie fijo.
// - `FullScreen`: Descripción y Vista previa.
// Base: `<section role="dialog">` con portal a <body> y la pila propia, no `<dialog>`: la pila ya da el bloqueo del scroll,
// el fondo animado, el retorno del foco y las superficies apiladas, y el aviso (`toast`) puede quedar por encima con
// `--z-toast` (la capa superior de `<dialog>` lo taparía siempre). Sin router ni consultas: la usa también la ficha SSR.
import { createContext, useContext, useEffect, useId, useRef, useState, type FocusEventHandler, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { openOverlay, type CloseReason } from "./overlay-stack";
import { Button, IconButton } from "./button";
import { I } from "./icons";
import * as OVERLAY_COPY from "./copy/overlay";

export type { CloseReason };
export type Dismissible = { escape?: boolean; backdrop?: boolean; back?: boolean };

export interface OverlayOptions {
  /** Cerrar (Escape, el fondo, la X o «Cancelar» del pie, Atrás). Quien la abre la desmonta. */
  onClose(reason: CloseReason): void;
  /** Mientras guarda: no se cierra de ninguna forma. */
  busy?: boolean;
  /** Qué cierra, además de la X (por defecto, según la variante). */
  dismissible?: Dismissible;
  /** true = hay cambios sin guardar: Escape, el fondo, Atrás y la X preguntan «¿Descartar los cambios?» (D10). */
  confirmDiscard?: () => boolean;
  /** Foco al abrir (por defecto, el contenedor). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** A quién vuelve el foco al cerrar (por defecto, quien la abrió; si ya no está, el título de la pantalla). */
  returnFocus?: (opener: HTMLElement | null) => HTMLElement | null;
}

/** Profundidad en la pila de React: la de dentro se pinta encima (clase `is-stacked`). */
const Depth = createContext(0);
const desktopNow = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/** Qué cierra cada variante si `dismissible` no dice otra cosa; `backOnDesktop`: Atrás también en escritorio. */
export type OverlayDefaults = Required<Dismissible> & { backOnDesktop?: boolean };

export function useOverlay(options: OverlayOptions & { defaults: OverlayDefaults }) {
  const ref = useRef<HTMLElement>(null);
  const latest = useRef(options);
  latest.current = options;
  const [asking, setAsking] = useState<CloseReason | null>(null);
  const askingRef = useRef(asking);
  askingRef.current = asking;

  function request(reason: CloseReason): boolean {
    const { busy, dismissible, defaults, confirmDiscard, onClose } = latest.current;
    if (busy || askingRef.current) return false;
    if (reason !== "button" && !(dismissible?.[reason] ?? defaults[reason])) return false;
    if (confirmDiscard?.()) {
      setAsking(reason);
      return false;
    }
    onClose(reason);
    return true;
  }
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { dismissible, defaults } = latest.current;
    const remove = openOverlay({
      el,
      // Atrás solo en el teléfono (D9); la pantalla completa lo atiende siempre (la Descripción ya lo hacía).
      back: (dismissible?.back ?? defaults.back) && (!!defaults.backOnDesktop || !desktopNow()),
      request: (reason) => requestRef.current(reason),
      restore: (opener) => (latest.current.returnFocus ? latest.current.returnFocus(opener) : opener),
    });
    (latest.current.initialFocus?.current ?? el).focus();
    return remove;
  }, []);

  return {
    ref,
    /** Cerrar desde un botón propio (la X, «Cancelar»): pregunta si hay cambios, como Escape. */
    close: () => request("button"),
    /** El fondo: cierra si la variante lo permite. */
    backdrop: () => request("backdrop"),
    discard: asking
      ? { keep: () => setAsking(null), discard: () => latest.current.onClose(asking) }
      : null,
  };
}

type Content = ReactNode | ((overlay: { titleId: string; close: () => void }) => ReactNode);

interface Chrome extends OverlayOptions {
  /** Título visible de la cabecera (`aria-labelledby`). Sin él: `label` o `labelledBy`. */
  title?: ReactNode;
  /** Línea pequeña bajo el título (hoja y ventana). */
  subtitle?: ReactNode;
  /** X de la cabecera (por defecto, con título). */
  closeButton?: boolean;
  /** Antes del título en la cabecera (p. ej. «Volver al número»). */
  headerStart?: ReactNode;
  /** `id` del contenedor (para `aria-controls` del disparador). */
  id?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  /** Pie fijo (los botones de la acción). */
  footer?: ReactNode;
  children: Content;
}

type SheetLayout = "contact" | "picker" | "airbnb";
type DialogLayout = "sign-in" | "inquiries" | "photos" | "filters" | "field";
type FullScreenLayout = "description" | "preview";

const SHEET_DEFAULTS = { escape: true, backdrop: true, back: true };

/** Hoja inferior (móvil); en escritorio, ventana normal centrada. */
export function Sheet({ layout, keyboardRoom, onFocus, onBlur, ...props }: Chrome & {
  layout?: SheetLayout;
  /** Sitio extra abajo mientras un campo con teclado tiene el foco (hoja de contacto). */
  keyboardRoom?: boolean;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
}) {
  const cls = `sheet${layout ? ` sheet-${layout}` : ""}${keyboardRoom ? " kb" : ""}`;
  return <Surface kind="sheet" cls={cls} defaults={SHEET_DEFAULTS} grabber onFocus={onFocus} onBlur={onBlur} {...props} />;
}

const DIALOG_DEFAULTS = { escape: true, backdrop: true, back: false };
const WIDE_DEFAULTS = { escape: true, backdrop: false, back: false };

/** Ventana de escritorio: `normal` (520 px) o `wide` (hasta 960 px; nunca se cierra con el fondo). */
export function Dialog({ size = "normal", layout, ...props }: Chrome & { size?: "normal" | "wide"; layout?: DialogLayout }) {
  const cls = `dialog dialog-${size}${layout ? ` dialog-${layout}` : ""}`;
  return <Surface kind="dialog" cls={cls} defaults={size === "wide" ? WIDE_DEFAULTS : DIALOG_DEFAULTS} {...props} />;
}

const FULL_DEFAULTS = { escape: true, backdrop: false, back: true, backOnDesktop: true };

/** Pantalla completa sobre la página (Descripción, Vista previa). Atrás la cierra también en escritorio. */
export function FullScreen({ layout, ...props }: Chrome & { layout: FullScreenLayout }) {
  return <Surface kind="full" cls={layout === "description" ? "description-screen" : "ficha-preview"} defaults={FULL_DEFAULTS} {...props} />;
}

function Surface({ kind, cls, defaults, grabber = false, id, title, subtitle, closeButton = !!title, headerStart, label, labelledBy, describedBy, footer, children, onFocus, onBlur, ...options }: Chrome & {
  kind: "sheet" | "dialog" | "full";
  cls: string;
  defaults: OverlayDefaults;
  grabber?: boolean;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
}) {
  const depth = useContext(Depth);
  const titleId = useId();
  const overlay = useOverlay({ ...options, defaults });
  const stacked = depth > 0 ? " is-stacked" : "";
  const head = title || closeButton || headerStart ? (
    <div className={kind === "sheet" ? "sheet-head" : "row between dialog-head"}>
      {headerStart}
      {kind !== "full" && subtitle ? (
        <div>
          <h2 id={titleId}>{title}</h2>
          <span className="small muted">{subtitle}</span>
        </div>
      ) : title ? <h2 id={titleId}>{title}</h2> : null}
      {closeButton ? (
        <IconButton label={OVERLAY_COPY.close} disabled={options.busy} onClick={overlay.close}>
          <I.x size={kind === "sheet" ? 22 : 20} />
        </IconButton>
      ) : null}
    </div>
  ) : null;
  const body = typeof children === "function" ? children({ titleId, close: overlay.close }) : children;
  return createPortal(
    <Depth.Provider value={depth + 1}>
      {kind === "full" ? null : (
        <div className={`sheet-backdrop${stacked}`} data-testid="sheet-backdrop" onClick={overlay.backdrop} />
      )}
      <section
        ref={overlay.ref}
        id={id}
        className={cls + stacked}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={label ? undefined : labelledBy ?? titleId}
        aria-describedby={describedBy}
        aria-busy={options.busy || undefined}
        tabIndex={-1}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {grabber ? <span className="grabber" aria-hidden="true" /> : null}
        {kind === "dialog" ? (
          <>
            {head}
            <div className="dialog-body">{body}</div>
            {footer ? <div className="dialog-foot">{footer}</div> : null}
          </>
        ) : (
          <>
            {head}
            {body}
            {footer}
          </>
        )}
      </section>
      {overlay.discard ? <DiscardConfirm desktop={kind === "dialog" || desktopNow()} {...overlay.discard} /> : null}
    </Depth.Provider>,
    document.body,
  );
}

/** «¿Descartar los cambios?» (D10), apilada encima: «Seguir editando» la cierra; «Descartar» cierra las dos sin guardar.
 *  Exportada para la salida de una ruta con cambios (Atrás sobre la ventana de un apartado, historia 06). */
export function DiscardConfirm({ desktop, keep, discard }: { desktop: boolean; keep(): void; discard(): void }) {
  const size = desktop ? "md" : "lg";
  const keepButton = <Button variant="secondary" size={size} onClick={keep}>{OVERLAY_COPY.keepEditing}</Button>;
  const discardButton = <Button variant="danger" size={size} onClick={discard}>{OVERLAY_COPY.discard}</Button>;
  const text = <p>{OVERLAY_COPY.discardText}</p>;
  // En escritorio, una ventana normal con el pie a la derecha (muestra 6); en el teléfono, la hoja de confirmación de siempre.
  return desktop ? (
    <Dialog title={OVERLAY_COPY.discardTitle} closeButton={false} onClose={keep} footer={<>{keepButton}{discardButton}</>}>{text}</Dialog>
  ) : (
    <Sheet title={OVERLAY_COPY.discardTitle} closeButton={false} onClose={keep}>{text}{discardButton}{keepButton}</Sheet>
  );
}
