// Marcos de pantalla del diseño v1: pantallas raíz con una sola barra inferior que crece con las casas
// (domain/navigation.ts tabsFor: dos pestañas sin casas, cinco con al menos una; la del admin solo en /admin) y pantallas
// de flujo sin barra (Ingresar, código, Cuenta, ayuda…), con su cabecera. Las pestañas llevan además la barra superior
// (logo · ₡ | $ · cuenta), salvo Explorar (que trae su propia cabecera) y la zona del admin.
import { skipToken, useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { tabsFor } from "../domain/tabs";
import { CurrencySwitch } from "../shared/currency-switch";
import { I } from "../shared/icons";
import { useHidingChrome } from "./hiding-chrome";
import { countNew, inquiriesQuery } from "./inquiries";
import { useListingsCount } from "./own-listings-query";
import { useSession } from "./session";

/** Contador terracota de Anuncios: lo que ya hay en la caché de la cola (no la pide; la pide la pantalla). `skipToken` en vez
 *  de `enabled: false` sin `queryFn`, que TanStack anotaba como error en cada pantalla (revisión UX 2026-10-29, N8). */
function useReviewCount(enabled: boolean): number {
  const userId = useSession().session?.userId ?? "";
  const { data } = useQuery<{ review: unknown[] }, Error, number>({ queryKey: ["admin-queue", userId], queryFn: skipToken, select: (q) => q.review.length });
  return enabled ? (data ?? 0) : 0;
}

/** Contador terracota de Actividad: las nuevas de `["inquiries", uid]`, la misma consulta de Actividad. Con la barra del
 *  propietario la pide en cualquier pestaña si no está en la caché o está vieja (30 s). */
function useNewInquiries(enabled: boolean): number {
  const userId = useSession().session?.userId ?? "";
  const { data } = useQuery({ ...inquiriesQuery(userId), enabled: enabled && !!userId, select: countNew });
  return enabled ? (data ?? 0) : 0;
}

/** Revisión UX 2026-10-29 (C4, T2, Ana): solo Favoritos conserva la barra de arriba (logo y «₡ | $»); Mis casas, Calendario,
 *  Consultas y Cuenta van sin barra ni título visible (la pestaña de abajo ya dice dónde se está). Explorar trae su propia
 *  cabecera; la zona del admin y «no encontrada» siguen con el logo y el título. */
const TOP_BAR_PATHS = new Set(["/favoritos"]);
const BARE_PATHS = new Set(["/propietario/casas", "/propietario/calendario", "/propietario/actividad", "/cuenta"]);

/** «Ingresar» desde Favoritos vuelve a Favoritos (la lista pasa a la cuenta); desde las demás, a la pantalla de llegada. */
const nextFor = (pathname: string) => (pathname === "/favoritos" ? "/favoritos" : undefined);

export function TabsFrame({ children }: { children: ReactNode }) {
  const adminZone = useLocation({ select: (l) => l.pathname.startsWith("/admin") });
  const pathname = useLocation({ select: (l) => l.pathname });
  useHidingChrome();
  const topBar = TOP_BAR_PATHS.has(pathname);
  const bare = BARE_PATHS.has(pathname);
  const { status } = useSession();
  const { count } = useListingsCount();
  const tabs = tabsFor({ session: status !== "signed-out", isAdmin: adminZone, listingsCount: count });
  const pending = useReviewCount(tabs.some((t) => t.badge === "review"));
  const fresh = useNewInquiries(tabs.some((t) => t.badge === "inquiries"));
  // «Ingresar» desde Favoritos vuelve a Favoritos (la lista pasa a la cuenta).
  const next = status === "signed-out" ? nextFor(pathname) : undefined;
  return (
    <div className="app">
      {topBar ? <TopBar /> : null}
      <UnderTopBar.Provider value={topBar || bare}>
        <main className={topBar ? "view has-topbar" : bare ? "view is-bare" : "view"}>{children}</main>
      </UnderTopBar.Provider>
      <nav className={`tabbar float-card chrome-hide${tabs.length === 3 ? " three" : ""}`} aria-label="Navegación principal">
        {tabs.map(({ to, label, icon, exact, badge }) => {
          const Icon = I[icon];
          const n = badge === "review" ? pending : badge === "inquiries" ? fresh : 0;
          return (
            <Link
              key={to}
              to={to}
              search={to === "/cuenta" && next ? { next } : undefined}
              className="nav"
              activeOptions={{ exact, includeSearch: false }}
              activeProps={{ "aria-current": "page" }}
              aria-label={badge === "inquiries" && n > 0 ? `${label}, ${n} ${n === 1 ? "nueva" : "nuevas"}` : undefined}
            >
              <Icon size={24} />
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

/** En una pestaña con la barra de arriba (Favoritos) o sin ella (Mis casas, Calendario, Consultas, Cuenta): sin logo propio y con
 *  el título solo para lectores de pantalla. */
const UnderTopBar = createContext(false);


/** Barra superior fija de Favoritos: logo y «₡ | $» (la cuenta ya es una pestaña). */
export function TopBar() {
  return (
    <header className="topbar float-card chrome-hide">
      <Link to="/explorar" className="topbar-home" aria-label="bnbtico, inicio">
        <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
      </Link>
      <CurrencySwitch />
    </header>
  );
}

export function FlowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="view no-nav">{children}</main>
    </div>
  );
}

/** Bajo la barra superior, solo el título (y `action` en su fila, si la hay); sin ella (/admin, «no encontrada»), también
 *  el logo (que lleva a `home`) y `role="banner"`, la cabecera de la página. */
export function RootHeader({ title, home = "/explorar", action, aside }: { title: ReactNode; home?: string; action?: ReactNode; aside?: ReactNode }) {
  const under = useContext(UnderTopBar);
  return (
    <header className="header-root" role={under ? undefined : "banner"}>
      {under ? (
        action ? <div className="top">{action}</div> : null
      ) : (
        <div className="top">
          <Link to={home} aria-label="bnbtico, inicio">
            <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
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
