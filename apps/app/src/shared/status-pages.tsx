import type { ReactNode } from "react";
import { blockedReason, type BlockedReason } from "../domain/blocked";
import { I } from "./icons";
import { SiteTopBar } from "./site-top-bar";
import { ButtonLink, IconButtonLink } from "./button";

/** Páginas de estado de la ficha (las pinta el worker y van sin JS: los botones son enlaces). Nunca un callejón sin salida:
 *  quien llega por un enlace compartido ve otras casas o puede reintentar (revisión UX N4). */
function StatusPage({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="app">
      <SiteTopBar />
      <main className="view no-nav">
        <header className="header-root status-header">
          {/* En escritorio, la flecha de volver en vez del logo, que ya va en la barra (revisión 2026-11-13). */}
          <IconButtonLink href="/explorar" label="Volver a Explorar" placement="status-back">
            <I.back />
          </IconButtonLink>
          <div className="top">
            <a href="/explorar" aria-label="3bstays, inicio">
              <img className="logo" src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />
            </a>
          </div>
        </header>
        <section className="card stack">
          <h1 className="status-title">{title}</h1>
          {children}
          {actions}
        </section>
      </main>
    </div>
  );
}

export function MissingPage() {
  return (
    <StatusPage title="Este enlace no existe" actions={<ButtonLink href="/explorar" variant="primary">Ver otras casas en el Caribe</ButtonLink>}>
      <p>Revise que el enlace esté completo. Si se lo pasaron por WhatsApp, pida que se lo envíen de nuevo.</p>
    </StatusPage>
  );
}

/** `reason`: el motivo que da el worker (fase 5: parada por el propietario o fuera del catálogo por la suscripción); sin él,
 *  el texto genérico. */
export function BlockedPage({ reason }: { reason?: BlockedReason }) {
  return (
    <StatusPage title="Este enlace ya no está activo" actions={<ButtonLink href="/explorar" variant="primary">Ver otras casas en el Caribe</ButtonLink>}>
      <p>{blockedReason(reason ?? null)}</p>
      <p className="small muted">Si ya habló con el anfitrión por WhatsApp, puede seguir esa conversación por su cuenta.</p>
    </StatusPage>
  );
}

export function ErrorPage() {
  return (
    <StatusPage
      title="No pudimos cargar esta casa"
      actions={
        <>
          {/* Enlace a la misma página: recarga sin JS. */}
          <ButtonLink href="" variant="primary">Intentar de nuevo</ButtonLink>
          <ButtonLink href="/explorar" variant="secondary">Ir a Explorar</ButtonLink>
        </>
      }
    >
      <p>Revise su conexión e intente de nuevo en un momento.</p>
    </StatusPage>
  );
}
