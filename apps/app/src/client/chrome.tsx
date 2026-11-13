// Marcos de pantalla del diseño v1: pantallas raíz con una sola barra inferior que crece con las casas
// (domain/navigation.ts tabsFor: dos pestañas sin casas, cinco con al menos una; la del admin solo en /admin) y pantallas
// de flujo sin barra (Ingresar, código, Cuenta, ayuda…), con su cabecera. Las pestañas llevan además la barra superior
// (logo · ₡ | $ · cuenta), salvo Explorar (que trae su propia cabecera) y la zona del admin.
import { skipToken, useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { createContext, lazy, Suspense, useContext, useState, type MouseEvent, type ReactNode } from "react";
import { tabsFor } from "../domain/tabs";
import { I } from "../shared/icons";
import { CurrencySwitch } from "../shared/currency-switch";
import { useDesktop } from "./desktop";
import { useHidingChrome } from "./hiding-chrome";
import { countNew, inquiriesQuery } from "./inquiries";
import { useListingsCount } from "./own-listings-query";
import { useSession } from "./session";

const WhatsAppDialog = lazy(() => import("./whatsapp-dialog").then((m) => ({ default: m.WhatsAppDialog })));
const InquiriesDialog = lazy(() => import("./screens/actividad").then((m) => ({ default: m.InquiriesDialog })));

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
// Ninguna pestaña lleva barra superior con el logo (Favoritos tampoco, 2026-11-03): el contenido empieza arriba.
const BARE_PATHS = new Set(["/favoritos", "/propietario/casas", "/propietario/calendario", "/propietario/actividad", "/cuenta"]);

/** «Ingresar» desde Favoritos vuelve a Favoritos (la lista pasa a la cuenta); desde las demás, a la pantalla de llegada. */
const nextFor = (pathname: string) => (pathname === "/favoritos" ? "/favoritos" : undefined);

export function TabsFrame({ children, ownerHouseDetail = false, publishing = false }: { children: ReactNode; ownerHouseDetail?: boolean; publishing?: boolean }) {
  const adminZone = useLocation({ select: (l) => l.pathname.startsWith("/admin") });
  const pathname = useLocation({ select: (l) => l.pathname });
  useHidingChrome();
  const bare = BARE_PATHS.has(pathname);
  const { status } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const [inquiriesOpen, setInquiriesOpen] = useState(false);
  const signInTab = pathname === "/cuenta" && status === "signed-out";
  const narrowGutter = pathname === "/cuenta" && !signInTab;
  const ownerInquiries = pathname === "/propietario/actividad";
  const ownerCalendar = pathname === "/propietario/calendario";
  const { count } = useListingsCount();
  const desktop = useDesktop() && !adminZone;
  const desktopSignIn = desktop && status === "signed-out";
  const defaultTabs = tabsFor({ session: status !== "signed-out", isAdmin: adminZone, listingsCount: count, desktop });
  const tabs = desktop ? defaultTabs.filter(({ to }) => to !== "/que-es-3bstays") : defaultTabs;
  const brandOpensAbout = status === "signed-out";
  const pending = useReviewCount(tabs.some((t) => t.badge === "review"));
  const fresh = useNewInquiries(tabs.some((t) => t.badge === "inquiries"));
  const desktopInquiries = desktop && tabs.some((t) => t.badge === "inquiries");
  const inquiriesLabel = fresh ? `Consultas, ${fresh} ${fresh === 1 ? "nueva" : "nuevas"}` : "Consultas";
  // «Ingresar» desde Favoritos vuelve a Favoritos (la lista pasa a la cuenta).
  const next = status === "signed-out" ? nextFor(pathname) : undefined;
  const navigation = (
      <nav className={`tabbar ${desktop ? "desktop-nav" : "chrome-hide"}${tabs.length === 3 ? " three" : ""}`} aria-label="Navegación principal">
        {desktop && (
          <Link
            className="desktop-brand"
            to={brandOpensAbout ? "/que-es-3bstays" : "/explorar"}
            aria-label={brandOpensAbout ? "Qué es 3bstays" : "3bstays, inicio"}
            activeOptions={{ exact: true, includeSearch: false }}
            activeProps={brandOpensAbout ? { "aria-current": "page" } : {}}
            replace
          >
            <img src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />
          </Link>
        )}
        {tabs.map(({ to, label, icon, exact, badge }) => {
          const Icon = I[icon];
          if (desktopSignIn && to === "/cuenta") return null;
          if (desktopInquiries && badge === "inquiries") return null;
          const n = badge === "review" ? pending : badge === "inquiries" ? fresh : 0;
          return (
            <Link
              key={to}
              to={to}
              search={to === "/cuenta" && next ? { next } : undefined}
              // Cambiar de pestaña no deja rastro en el historial (2026-11-03): «Atrás» solo vuelve dentro de la pestaña.
              replace
              className="nav"
              activeOptions={{ exact, includeSearch: false }}
              activeProps={{ "aria-current": "page" }}
              aria-label={badge === "inquiries" && n > 0 ? `${label}, ${n} ${n === 1 ? "nueva" : "nuevas"}` : undefined}
            >
              <Icon size={26} />
              {to === "/que-es-3bstays" ? (
                <>
                  <img className="nav-wordmark" src="/logo-horizontal.png" alt="" />
                  <span className="sr-only">{label}</span>
                </>
              ) : <span>{label}</span>}
              {n > 0 ? (
                <b className="nav-count num" data-testid={badge === "inquiries" ? "inquiries-badge" : undefined}>
                  {n}
                </b>
              ) : null}
            </Link>
          );
        })}
        {desktop && (
          <>
            <CurrencySwitch className="desktop-currency" />
            {desktopSignIn ? (
              <button type="button" className="btn btn-primary desktop-sign-in" aria-haspopup="dialog" onClick={() => setSignInOpen(true)}>
                <I.user size={22} /> Ingresar
              </button>
            ) : null}
            {desktopInquiries && (
              <button type="button" className="nav desktop-inquiries" aria-label={inquiriesLabel} title="Consultas"
                aria-haspopup="dialog" aria-expanded={inquiriesOpen} onClick={() => setInquiriesOpen(true)}>
                <I.chat size={26} />
                {fresh > 0 && <b className="nav-count num" data-testid="inquiries-badge" aria-hidden="true">{fresh}</b>}
              </button>
            )}
            <Link to="/ayuda" className="nav desktop-help" aria-label="Ayuda por WhatsApp" title="Ayuda por WhatsApp" activeProps={{ "aria-current": "page" }}>
              <I.wa size={24} />
              <span>Ayuda por WhatsApp</span>
            </Link>
          </>
        )}
      </nav>
  );
  return (
    <div className={`app${desktop ? " desktop-app" : ""}${publishing ? " publish-flow" : ""}`}>
      {desktop && navigation}
      <UnderTopBar.Provider value={bare}>
        <main className={`view${bare ? " is-bare" : ""}${signInTab ? " sign-in-tab" : narrowGutter ? " view-narrow-gutter" : ""}${ownerCalendar ? " owner-calendar" : ""}${ownerInquiries ? " owner-inquiries" : ""}${ownerHouseDetail ? " owner-house-detail" : ""}`}>{children}</main>
      </UnderTopBar.Provider>
      {!desktop && navigation}
      {desktopInquiries && inquiriesOpen && (
        <Suspense fallback={null}>
          <InquiriesDialog onClose={() => setInquiriesOpen(false)} />
        </Suspense>
      )}
      {desktop && signInOpen ? (
        <Suspense fallback={null}>
          <WhatsAppDialog mode="account" next={next} onClose={() => setSignInOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** En una pestaña sin barra de arriba (Favoritos, Mis casas, Calendario, Consultas, Cuenta): sin logo y con el título solo
 *  para lectores de pantalla. */
const UnderTopBar = createContext(false);


export function FlowFrame({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const help = useLocation({ select: ({ pathname }) => pathname === "/ayuda" });
  const verifyingCode = useLocation({ select: ({ pathname }) => pathname === "/cuenta/codigo" });
  const publishing = useLocation({ select: ({ pathname }) => /^(?:\/propietario)?\/publicar(?:\/|$)/.test(pathname) });
  const ownerHouseDetail = useLocation({ select: ({ pathname }) => /^\/propietario\/casas\/[^/]+\/?$/.test(pathname) });
  const editingPhotos = useLocation({ select: ({ pathname }) =>
    /^\/propietario\/casas\/[^/]+\/editar\/fotos\/?$/.test(pathname)
  });
  const editingField = useLocation({ select: ({ pathname }) =>
    /^\/propietario\/casas\/[^/]+\/editar\/[^/]+\/?$/.test(pathname)
  });
  if (desktop && (ownerHouseDetail || editingField)) return <TabsFrame ownerHouseDetail>{children}</TabsFrame>;
  if (desktop && help) return <TabsFrame>{children}</TabsFrame>;
  if (desktop && publishing) return <TabsFrame publishing>{children}</TabsFrame>;
  return (
    <div className={editingPhotos ? "app edit-photos-flow" : publishing || editingField ? "app publish-flow" : "app"}>
      <main className={`view no-nav${ownerHouseDetail ? " owner-house-detail" : verifyingCode ? " code-flow" : ""}`}>{children}</main>
    </div>
  );
}

/** Bajo la barra superior, solo el título (y `action` en su fila, si la hay); sin ella (/admin, «no encontrada»), también
 *  el logo tipográfico sin fondo, de 38 px de alto (que lleva a `home`), y `role="banner"`, la cabecera de la página. */
export function RootHeader({ title, home = "/explorar", action, aside }: { title: ReactNode; home?: string; action?: ReactNode; aside?: ReactNode }) {
  const under = useContext(UnderTopBar);
  return (
    <header className="header-root" role={under ? undefined : "banner"}>
      {under ? (
        action ? <div className="top">{action}</div> : null
      ) : (
        <div className="top">
          <Link to={home} replace aria-label="3bstays, inicio">
            <img className="logo" src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />
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
