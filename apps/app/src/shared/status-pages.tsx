import type { ReactNode } from "react";
import { blockedReason, type BlockedReason } from "../domain/blocked";
import { SiteTopBar } from "./site-top-bar";

/** Páginas de estado de la ficha (las pinta el worker y van sin JS: los botones son enlaces). Nunca un callejón sin salida:
 *  quien llega por un enlace compartido ve otras casas o puede reintentar (revisión UX N4). */
function StatusPage({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="app">
      <SiteTopBar />
      <main className="view no-nav">
        <header className="header-root status-header">
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
    <StatusPage title="Este enlace no existe" actions={<a href="/explorar" className="btn btn-soft">Ver otras casas en el Caribe</a>}>
      <p>Revise que el enlace esté completo. Si se lo pasaron por WhatsApp, pida que se lo envíen de nuevo.</p>
    </StatusPage>
  );
}

/** `reason`: el motivo que da el worker (fase 5: parada por el propietario o fuera del catálogo por la suscripción); sin él,
 *  el texto genérico. */
export function BlockedPage({ reason }: { reason?: BlockedReason }) {
  return (
    <StatusPage title="Este enlace ya no está activo" actions={<a href="/explorar" className="btn btn-soft">Ver otras casas en el Caribe</a>}>
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
          <a href="" className="btn btn-primary">Intentar de nuevo</a>
          <a href="/explorar" className="btn btn-ghost">Ir a Explorar</a>
        </>
      }
    >
      <p>Revise su conexión e intente de nuevo en un momento.</p>
    </StatusPage>
  );
}
