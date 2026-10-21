import Image from "next/image";
import Link from "next/link";
import logo from "../../public/logo-horizontal.png";
import { BottomNav } from "./nav";
import { I } from "./icons";
import type { Role } from "@/lib/auth/types";

export function Shell({ role, children, nav = true, badge }: { role: Role; children: React.ReactNode; nav?: boolean; badge?: number }) {
  return (
    <div className="app">
      <main className={`view${nav ? "" : " no-nav"}`}>{children}</main>
      {nav ? <BottomNav role={role} badge={badge} /> : null}
    </div>
  );
}

/** Logo horizontal (rana + nombre), 38 px de alto: cabecera de las pantallas raíz. */
export function Logo({ href = "/explorar" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="bnbtico, inicio" style={{ display: "inline-flex" }}>
      <Image src={logo} alt="bnbtico" className="logo" style={{ height: 38, width: "auto" }} priority />
    </Link>
  );
}

/**
 * Cabecera de pantalla raíz (barra inferior): logo a la izquierda, acción opcional a la derecha y el título grande debajo.
 * `greeting` va en pequeño sobre el título («Hola, Daniel»).
 */
export function RootHeader({ title, action, greeting, home, tag }: { title: React.ReactNode; action?: React.ReactNode; greeting?: string; home?: string; tag?: React.ReactNode }) {
  return (
    <header className="header-root">
      <div className="top">
        <div className="row" style={{ gap: 10 }}>
          <Logo href={home} />
          {tag}
        </div>
        {action}
      </div>
      <div>
        {greeting ? <span className="greeting">{greeting}</span> : null}
        <h1>{title}</h1>
      </div>
    </header>
  );
}

/** Cabecera de pantalla de flujo: flecha de volver + título 24 px, sin logo; `right` para «Paso 2 de 5» o una acción. */
export function FlowHeader({ title, back, right }: { title: string; back: string; right?: React.ReactNode }) {
  return (
    <header className="header-flow">
      <Link href={back} aria-label="Volver" className="icon-btn"><I.back /></Link>
      <h1>{title}</h1>
      {right ? <div className="right">{right}</div> : null}
    </header>
  );
}

/** Compatibilidad: título de pantalla; con `back` es cabecera de flujo, sin él, cabecera raíz. */
export function ScreenTitle({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return back ? <FlowHeader title={title} back={back} right={right} /> : <RootHeader title={title} action={right} />;
}
