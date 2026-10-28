// Marcos de pantalla del diseño v1: pantallas raíz con una sola barra inferior que crece con las casas
// (domain/navigation.ts tabsFor: dos pestañas sin casas, cinco con al menos una; la del admin solo en /admin) y pantallas
// de flujo sin barra (Ingresar, código, Cuenta, ayuda…), con su cabecera.
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { tabsFor } from "../domain/tabs";
import { I } from "../shared/icons";
import { countNew, inquiriesQuery } from "./inquiries";
import { useListingsCount } from "./own-listings-query";
import { useSession } from "./session";

/** Contador terracota de Anuncios: lo que ya hay en la caché de la cola (no la pide; la pide la pantalla). */
function useReviewCount(enabled: boolean): number {
  const userId = useSession().session?.userId ?? "";
  const { data } = useQuery<{ review: unknown[] }, Error, number>({ queryKey: ["admin-queue", userId], enabled: false, select: (q) => q.review.length });
  return enabled ? (data ?? 0) : 0;
}

/** Contador terracota de Actividad: las nuevas de `["inquiries", uid]`, la misma consulta de Actividad. Con la barra del
 *  propietario la pide en cualquier pestaña si no está en la caché o está vieja (30 s). */
function useNewInquiries(enabled: boolean): number {
  const userId = useSession().session?.userId ?? "";
  const { data } = useQuery({ ...inquiriesQuery(userId), enabled: enabled && !!userId, select: countNew });
  return enabled ? (data ?? 0) : 0;
}

export function TabsFrame({ children }: { children: ReactNode }) {
  const adminZone = useLocation({ select: (l) => l.pathname.startsWith("/admin") });
  const { status } = useSession();
  const { count } = useListingsCount();
  const tabs = tabsFor({ session: status !== "signed-out", isAdmin: adminZone, listingsCount: count });
  const pending = useReviewCount(tabs.some((t) => t.badge === "review"));
  const fresh = useNewInquiries(tabs.some((t) => t.badge === "inquiries"));
  return (
    <div className="app">
      <main className="view">{children}</main>
      <nav className={`tabbar${tabs.length === 2 ? " two" : ""}`} aria-label="Navegación principal">
        {tabs.map(({ to, label, icon, exact, badge }) => {
          const Icon = I[icon];
          const n = badge === "review" ? pending : badge === "inquiries" ? fresh : 0;
          return (
            <Link
              key={to}
              to={to}
              className="nav"
              activeOptions={{ exact, includeSearch: false }}
              activeProps={{ "aria-current": "page" }}
              aria-label={badge === "inquiries" && n > 0 ? `${label}, ${n} ${n === 1 ? "nueva" : "nuevas"}` : undefined}
            >
              <Icon size={22} />
              <span>{label}</span>
              {n > 0 ? (
                <b className="nav-count num" data-testid={badge === "inquiries" ? "inquiries-badge" : undefined}>
                  {n}
                </b>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * La cuenta, arriba a la derecha de las pantallas de las pestañas (fuera de /admin, que tiene su pestaña «Cuenta»): sin
 * sesión, «Ingresar»; con sesión, «Cuenta» a pantalla completa. Mientras se lee la sesión guardada, la misma caja sin
 * verse, y nada salta.
 */
export function AccountButton({ next }: { next?: string }) {
  const { status } = useSession();
  const adminZone = useLocation({ select: (l) => l.pathname.startsWith("/admin") });
  if (adminZone) return null;
  if (status === "signed-in") {
    return (
      <Link to="/cuenta" className="btn btn-ghost btn-header">
        Cuenta
      </Link>
    );
  }
  const out = status === "signed-out";
  return (
    <Link to="/cuenta" search={next ? { next } : {}} className={`btn btn-ghost btn-header${out ? "" : " is-hidden"}`} aria-hidden={!out} tabIndex={out ? undefined : -1}>
      Ingresar
    </Link>
  );
}

export function FlowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="view no-nav">{children}</main>
    </div>
  );
}

/** `next`: adónde vuelve «Ingresar» tras verificar (sin él, a la pantalla de llegada). La cabecera va dentro de `main`:
 *  `role="banner"` la marca como la cabecera de la página (logo y cuenta). */
export function RootHeader({ title, home = "/explorar", action, aside, next }: { title: ReactNode; home?: string; action?: ReactNode; aside?: ReactNode; next?: string }) {
  return (
    <header className="header-root" role="banner">
      <div className="top">
        <Link to={home} aria-label="bnbtico, inicio">
          <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
        </Link>
        <span className="row gap-8">
          {action}
          <AccountButton next={next} />
        </span>
      </div>
      <div className={aside ? "row between baseline wrap gap-4" : undefined}>
        <h1>{title}</h1>
        {aside}
      </div>
    </header>
  );
}

/**
 * `onBack`: «Volver» hace eso en vez de seguir el enlace (el enlace queda como dirección, p. ej. para abrirlo aparte).
 * `historyBack`: «Volver» vuelve atrás en el historial si se llegó desde la app, y si no, a `back` sin apilarla. Lo usan
 * las pantallas que se abren desde Cuenta: así la flecha de Cuenta, que también vuelve atrás, no rebota entre las dos.
 */
export function FlowHeader({
  title,
  back,
  search,
  action,
  onBack,
  historyBack,
}: {
  title: string;
  back: string;
  search?: Record<string, string>;
  action?: ReactNode;
  onBack?: () => void;
  historyBack?: boolean;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const goBack = onBack ?? (historyBack ? () => (canGoBack ? router.history.back() : void router.navigate({ to: back, search, replace: true })) : undefined);
  const click = goBack
    ? (e: MouseEvent) => {
        e.preventDefault();
        goBack();
      }
    : undefined;
  return (
    <header className="header-flow">
      <Link to={back} search={search} aria-label="Volver" className="icon-btn" onClick={click}>
        <I.back />
      </Link>
      <h1>{title}</h1>
      {action}
    </header>
  );
}

/** Pantalla que llega en otro ticket: cabecera raíz y una tarjeta con lo que vendrá. */
export function Placeholder({ title, text, home, action }: { title: string; text: string; home?: string; action?: ReactNode }) {
  return (
    <>
      <RootHeader title={title} home={home} />
      <section className="card stack">
        <p>{text}</p>
        {action}
      </section>
    </>
  );
}
