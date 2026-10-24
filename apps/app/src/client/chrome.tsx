// Marcos de pantalla del diseño v1: pantallas raíz con barra inferior (3 pestañas del cliente, 5 del propietario, 4 del admin) y
// pantallas de flujo sin barra (Ingresar, código, ayuda…), con su cabecera.
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { I } from "../shared/icons";
import { useRole } from "./role";
import { useSession } from "./session";

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

const ADMIN = [
  { to: "/admin", label: "Anuncios", icon: I.inbox, exact: true },
  { to: "/admin/casas", label: "Casas", icon: I.pin, exact: false },
  { to: "/admin/usuarios", label: "Usuarios", icon: I.users, exact: false },
  { to: "/cuenta", label: "Cuenta", icon: I.user, exact: false },
] as const;

/** Contador terracota de Anuncios: lo que ya hay en la caché de la cola (no la pide; la pide la pantalla). */
function useReviewCount(enabled: boolean): number {
  const userId = useSession().session?.userId ?? "";
  const { data } = useQuery<{ review: unknown[] }, Error, number>({ queryKey: ["admin-queue", userId], enabled: false, select: (q) => q.review.length });
  return enabled ? (data ?? 0) : 0;
}

export function TabsFrame({ children }: { children: ReactNode }) {
  // En /propietario/* la barra es la del propietario desde el primer pintado (la pantalla fija además el modo).
  const zone = useLocation({ select: (l) => (l.pathname.startsWith("/propietario") ? "owner" : l.pathname.startsWith("/admin") ? "admin" : null) });
  const role = useRole();
  const tabs = zone === "admin" ? ADMIN : role === "owner" || zone === "owner" ? OWNER : GUEST;
  const pending = useReviewCount(zone === "admin");
  return (
    <div className="app">
      <main className="view">{children}</main>
      <nav className={`tabbar${tabs.length === 3 ? " three" : ""}`} aria-label="Navegación principal">
        {tabs.map(({ to, label, icon: Icon, exact }) => (
          <Link key={to} to={to} className="nav" activeOptions={{ exact, includeSearch: false }} activeProps={{ "aria-current": "page" }}>
            <Icon size={22} />
            <span>{label}</span>
            {to === "/admin" && pending > 0 ? <b className="nav-count num">{pending}</b> : null}
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

export function RootHeader({ title, home = "/explorar", action, greeting, aside }: { title: ReactNode; home?: string; action?: ReactNode; greeting?: string; aside?: ReactNode }) {
  return (
    <header className="header-root">
      <div className="top">
        <Link to={home} aria-label="bnbtico, inicio">
          <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
        </Link>
        {action}
      </div>
      <div className={aside ? "row between baseline wrap gap-4" : undefined}>
        {greeting ? <span className="greeting">{greeting}</span> : null}
        <h1>{title}</h1>
        {aside}
      </div>
    </header>
  );
}

export function FlowHeader({ title, back, search, action }: { title: string; back: string; search?: Record<string, string>; action?: ReactNode }) {
  return (
    <header className="header-flow">
      <Link to={back} search={search} aria-label="Volver" className="icon-btn">
        <I.back />
      </Link>
      <h1>{title}</h1>
      {action}
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
