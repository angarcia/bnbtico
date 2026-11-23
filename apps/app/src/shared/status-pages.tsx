import type { ReactNode } from "react";
import { blockedReason, type BlockedReason } from "../domain/blocked";
import { I } from "./ui/icons";
import { SiteTopBar } from "./site-top-bar";
import { ButtonLink, IconButtonLink } from "./ui/button";
import { EmptyState } from "./ui/structure";
import * as STATUS_COPY from "./copy/status";
import * as TOP_BAR_COPY from "./copy/top-bar";

/** Páginas de estado de la ficha (las pinta el worker y van sin JS: los botones son enlaces). Nunca un callejón sin salida:
 *  quien llega por un enlace compartido ve otras casas o puede reintentar (revisión UX N4). */
function StatusPage({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="app">
      <SiteTopBar />
      <main className="view no-nav">
        <header className="header-root status-header">
          {/* En escritorio, la flecha de volver en vez del logo, que ya va en la barra (revisión 2026-11-13). */}
          <IconButtonLink href="/explorar" label={STATUS_COPY.back} placement="status-back">
            <I.back />
          </IconButtonLink>
          <div className="top">
            <a href="/explorar" aria-label={TOP_BAR_COPY.home}>
              <img className="logo" src="/logo-horizontal.png" alt={TOP_BAR_COPY.logo} width={109} height={38} />
            </a>
          </div>
        </header>
        <EmptyState titleLevel={1} title={title} text={children} action={actions} />
      </main>
    </div>
  );
}

export function MissingPage() {
  return (
    <StatusPage title={STATUS_COPY.missingTitle} actions={<ButtonLink href="/explorar" variant="primary">{STATUS_COPY.otherHouses}</ButtonLink>}>
      <p>{STATUS_COPY.missingText}</p>
    </StatusPage>
  );
}

/** `reason`: el motivo que da el worker (fase 5: parada por el propietario o fuera del catálogo por la suscripción); sin él,
 *  el texto genérico. */
export function BlockedPage({ reason }: { reason?: BlockedReason }) {
  return (
    <StatusPage title={STATUS_COPY.blockedTitle} actions={<ButtonLink href="/explorar" variant="primary">{STATUS_COPY.otherHouses}</ButtonLink>}>
      <p>{blockedReason(reason ?? null)}</p>
      <p className="small muted">{STATUS_COPY.blockedNote}</p>
    </StatusPage>
  );
}

export function ErrorPage() {
  return (
    <StatusPage
      title={STATUS_COPY.errorTitle}
      actions={
        <>
          {/* Enlace a la misma página: recarga sin JS. */}
          <ButtonLink href="" variant="primary">{STATUS_COPY.retry}</ButtonLink>
          <ButtonLink href="/explorar" variant="secondary">{STATUS_COPY.explore}</ButtonLink>
        </>
      }
    >
      <p>{STATUS_COPY.errorText}</p>
    </StatusPage>
  );
}
