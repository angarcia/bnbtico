import type { ReactNode } from "react";

function StatusPage({ title, children }: { title: string; children: ReactNode }) {
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
          <a href="/explorar" className="btn btn-primary">Explorar otras casas</a>
        </section>
      </main>
    </div>
  );
}

export function MissingPage() {
  return (
    <StatusPage title="Este enlace no existe">
      <p>Revise que el enlace esté completo. Si se lo pasaron por WhatsApp, pida que se lo envíen de nuevo.</p>
    </StatusPage>
  );
}

export function BlockedPage() {
  return (
    <StatusPage title="Este enlace ya no está activo">
      <p>Este anuncio no está disponible en este momento.</p>
      <p className="small muted">Si ya habló con el propietario por WhatsApp, puede seguir esa conversación por su cuenta.</p>
    </StatusPage>
  );
}

export function ErrorPage() {
  return (
    <StatusPage title="No pudimos cargar esta casa">
      <p>Revise su conexión e intente de nuevo en un momento.</p>
    </StatusPage>
  );
}
