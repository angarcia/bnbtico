// Cabecera común de las pantallas de la app (raíz, flujo y asistente) y la pantalla provisional. Sale de chrome.tsx (los marcos
// de pestañas y de flujo, del arranque) para que las áreas no importen el arranque (estructura por áreas, 2026-11-22).
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { I } from "../../shared/ui/icons";
import { useDesktop } from "../../shared/desktop";
import { IconButton } from "../../shared/ui/button";
import { EmptyState } from "../../shared/ui/structure";
import { RouterIconLink } from "./router-buttons";

/** En una pestaña sin barra de arriba (Favoritos, Mis casas, Calendario, Consultas, Cuenta): sin logo y con el título solo
 *  para lectores de pantalla. */
export const UnderTopBar = createContext(false);

type HeaderBack = {
  to: string;
  search?: Record<string, string>;
  /** «Volver» hace eso en vez de seguir el enlace (el enlace queda como dirección, p. ej. para abrirlo aparte). */
  onBack?: () => void;
  /** Vuelve atrás en el historial si se llegó desde la app, y si no, a `to` sin apilarla. Lo usan las pantallas que se abren
   *  desde Cuenta: así la flecha de Cuenta, que también vuelve atrás, no rebota entre las dos. */
  historyBack?: boolean;
};
export type HeaderClose =
  | { to: string; search?: Record<string, string>; label: string; title?: string }
  | { onClick: () => void; label: string; title?: string; disabled?: boolean; busy?: boolean };

type ScreenHeaderProps =
  | {
      /** Pestaña o pantalla raíz: en escritorio, cabecera de página con el título y `action` a la derecha; en el teléfono,
       *  bajo una pestaña sin barra, el título solo para lectores de pantalla (y `action` en su fila); sin ella (/admin,
       *  «no encontrada»), el logo de 38 px que lleva a `home` y `role="banner"`. */
      kind: "root";
      title: ReactNode;
      home?: string;
      action?: ReactNode;
      aside?: ReactNode;
    }
  | {
      /** Pantalla de flujo: la flecha **o** la ✕ a la izquierda, el título de 24 px con elipsis y `action` al final. */
      kind: "flow";
      title: string;
      titleId?: string;
      back?: HeaderBack;
      close?: HeaderClose;
      action?: ReactNode;
    }
  | {
      /** El asistente de publicar: título a la izquierda, `action` y la ✕ de 44 px a la derecha (diseño v1, 33); debajo, `below`
       *  (el progreso). La misma cabecera mientras carga el trozo del asistente (shell.tsx). */
      kind: "wizard";
      title: string;
      close: HeaderClose;
      action?: ReactNode;
      below?: ReactNode;
    };

/** La ✕: a la derecha en el asistente (`header-close`, 20 px); a la izquierda en una cabecera de flujo (Filtros en una
 *  ventana), sin colocación propia. */
function CloseButton({ close, left = false }: { close: HeaderClose; left?: boolean }) {
  const placement = left ? undefined : "header-close";
  const icon = <I.x size={left ? undefined : 20} />;
  if ("to" in close)
    return <RouterIconLink to={close.to} search={close.search} label={close.label} title={close.title} placement={placement}>{icon}</RouterIconLink>;
  return <IconButton label={close.label} title={close.title} placement={placement} onClick={close.onClick} disabled={close.disabled} aria-busy={close.busy || undefined}>{icon}</IconButton>;
}

function BackLink({ back }: { back: HeaderBack }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { to, search, onBack, historyBack } = back;
  const goBack = onBack ?? (historyBack ? () => (canGoBack ? router.history.back() : void router.navigate({ to, search, replace: true })) : undefined);
  const click = goBack
    ? (e: MouseEvent) => {
        e.preventDefault();
        goBack();
      }
    : undefined;
  return (
    <RouterIconLink to={to} search={search} label="Volver" onClick={click}>
      <I.back />
    </RouterIconLink>
  );
}

/** La cabecera de toda pantalla de la app (no la de la ficha SSR, que no tiene router). */
export function ScreenHeader(props: ScreenHeaderProps) {
  if (props.kind === "root") return <RootHeader {...props} />;
  if (props.kind === "wizard")
    return (
      <div className="wizard-heading">
        <header className="header-flow publish-header">
          <h1>{props.title}</h1>
          {props.action}
          <CloseButton close={props.close} />
        </header>
        {props.below}
      </div>
    );
  return (
    <header className="header-flow">
      {props.back ? <BackLink back={props.back} /> : props.close ? <CloseButton close={props.close} left /> : null}
      <h1 id={props.titleId}>{props.title}</h1>
      {props.action}
    </header>
  );
}

function RootHeader({ title, home = "/explorar", action, aside }: { title: ReactNode; home?: string; action?: ReactNode; aside?: ReactNode }) {
  const under = useContext(UnderTopBar);
  const desktop = useDesktop();
  // En escritorio, bajo la barra superior: cabecera de página con el título visible, sin repetir el logo (revisión 2026-11-13, A9).
  if (desktop)
    return (
      <header className="header-root page-header">
        <div className="page-header-text">
          <h1>{title}</h1>
          {aside}
        </div>
        {action ? <div className="page-header-actions">{action}</div> : null}
      </header>
    );
  return (
    <header className="header-root" role={under ? undefined : "banner"}>
      {under ? (
        action ? <div className="top">{action}</div> : null
      ) : (
        <div className="top">
          <Link to={home} replace aria-label="3bstays, inicio">
            <img className="logo" src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />
          </Link>
          {action}
        </div>
      )}
      {/* En las pestañas el título solo lo leen los lectores de pantalla (T2); lo de al lado se queda. */}
      <div className={aside ? "row between baseline wrap gap-4" : undefined}>
        <h1 className={under ? "sr-only" : undefined}>{title}</h1>
        {aside}
      </div>
    </header>
  );
}

/** Pantalla que llega en otro ticket: cabecera raíz y una tarjeta con lo que vendrá. */
export function Placeholder({ title, text, home, action, back }: { title: string; text: string; home?: string; action?: ReactNode; back?: string }) {
  const desktop = useDesktop();
  return (
    <>
      {/* En escritorio, con `back`, la flecha de volver como las demás pantallas que no son pestañas. */}
      {back && desktop ? <ScreenHeader kind="flow" title={title} back={{ to: back, historyBack: true }} /> : <ScreenHeader kind="root" title={title} home={home} />}
      <EmptyState placement="placeholder-card" text={<p>{text}</p>} action={action} />
    </>
  );
}
