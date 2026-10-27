import type { ReactNode } from "react";

/** Páginas de estado de la ficha (las pinta el worker y van sin JS: los botones son enlaces). Nunca un callejón sin salida:
 *  quien llega por un enlace compartido ve otras casas o puede reintentar (revisión UX N4). */
function StatusPage({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="app">
      <main className="view no-nav">
        <header className="header-root">
          <div className="top">
            <a href="/explorar" aria-label="bnbtico, inicio">
              <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
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
    <StatusPage title="Este enlace no existe" actions={<a href="/explorar" className="btn btn-primary">Ver otras casas en el Caribe</a>}>
      <p>Revise que el enlace esté completo. Si se lo pasaron por WhatsApp, pida que se lo envíen de nuevo.</p>
    </StatusPage>
  );
}

export function BlockedPage() {
  return (
    <StatusPage title="Este enlace ya no está activo" actions={<a href="/explorar" className="btn btn-primary">Ver otras casas en el Caribe</a>}>
      <p>Este anuncio no está disponible en este momento.</p>
      <p className="small muted">Si ya habló con el propietario por WhatsApp, puede seguir esa conversación por su cuenta.</p>
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
