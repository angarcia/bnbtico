// Marcos de pantalla del diseño v1: pantallas raíz con barra inferior (3 pestañas del cliente, 5 del propietario) y
// pantallas de flujo sin barra (Ingresar, código, ayuda…), con su cabecera.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { I } from "../shared/icons";
import { useRole } from "./role";

const GUEST = [
  { to: "/explorar", label: "Explorar", icon: I.search, exact: false },
  { to: "/favoritos", label: "Favoritos", icon: I.heart, exact: false },
  { to: "/cuenta", label: "Mi cuenta", icon: I.user, exact: false },
] as const;
const OWNER = [
  { to: "/propietario", label: "Inicio", icon: I.home, exact: true },
  { to: "/propietario/casas", label: "Mis casas", icon: I.house, exact: false },
  { to: "/propietario/calendario", label: "Calendario", icon: I.calendar, exact: false },
  { to: "/propietario/consultas", label: "Consultas", icon: I.chat, exact: false },
  { to: "/cuenta", label: "Cuenta", icon: I.user, exact: false },
] as const;

export function TabsFrame({ children }: { children: ReactNode }) {
  const tabs = useRole() === "owner" ? OWNER : GUEST;
  return (
    <div className="app">
      <main className="view">{children}</main>
      <nav className={`tabbar${tabs.length === 3 ? " three" : ""}`} aria-label="Navegación principal">
        {tabs.map(({ to, label, icon: Icon, exact }) => (
          <Link key={to} to={to} className="nav" activeOptions={{ exact, includeSearch: false }} activeProps={{ "aria-current": "page" }}>
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function FlowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="view no-nav">{children}</main>
    </div>
  );
}

export function RootHeader({ title, home = "/explorar", action, greeting }: { title: ReactNode; home?: string; action?: ReactNode; greeting?: string }) {
  return (
    <header className="header-root">
      <div className="top">
        <Link to={home} aria-label="bnbtico, inicio">
          <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
        </Link>
        {action}
      </div>
      <div>
        {greeting ? <span className="greeting">{greeting}</span> : null}
        <h1>{title}</h1>
      </div>
    </header>
  );
}

export function FlowHeader({ title, back, search }: { title: string; back: string; search?: Record<string, string> }) {
  return (
    <header className="header-flow">
      <Link to={back} search={search} aria-label="Volver" className="icon-btn">
        <I.back />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}

/** Pantalla que llega en otro ticket: cabecera raíz y una tarjeta con lo que vendrá. */
export function Placeholder({ title, text, home }: { title: string; text: string; home?: string }) {
  return (
    <>
      <RootHeader title={title} home={home} />
      <section className="card stack">
        <p>{text}</p>
      </section>
    </>
  );
}
