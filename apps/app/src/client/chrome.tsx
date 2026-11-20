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
import { Button, IconButton } from "../shared/button";
import { BrandLogo, EmptyState, NavBar, NavItemContent, type NavTab } from "../shared/structure";
import { RouterIconLink } from "./router-buttons";

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

export function TabsFrame({ children, ownerHouseDetail = false, publishing = false, measure = false }: { children: ReactNode; ownerHouseDetail?: boolean; publishing?: boolean; measure?: boolean }) {
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
  // Con una sola casa, «Mi casa» es la gestión de esa casa (historia 01 de la revisión 2026-11-17): la misma maqueta que su detalle.
  const singleHouse = pathname === "/propietario/casas" && count === 1;
  // El admin lleva también la barra superior en escritorio, con sus pestañas (revisión 2026-11-13, A5).
  const desktop = useDesktop();
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
  const shownTabs: (NavTab & { exact: boolean })[] = tabs.flatMap(({ to, label, icon, exact, badge }) => {
    if ((desktopSignIn && to === "/cuenta") || (desktopInquiries && badge === "inquiries")) return [];
    const n = badge === "review" ? pending : badge === "inquiries" ? fresh : 0;
    return [{ to, label, icon, exact, count: n, countTestId: badge === "inquiries" ? "inquiries-badge" : undefined, ariaLabel: badge === "inquiries" && n > 0 ? `${label}, ${n} ${n === 1 ? "nueva" : "nuevas"}` : undefined, wordmark: to === "/que-es-3bstays" }];
  });
  const navigation = (
    <NavBar
      desktop={desktop}
      three={tabs.length === 3}
      tabs={shownTabs}
      brand={desktop ? (
        <Link
          className="desktop-brand"
          to={brandOpensAbout ? "/que-es-3bstays" : "/explorar"}
          aria-label={brandOpensAbout ? "Qué es 3bstays" : "3bstays, inicio"}
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={brandOpensAbout ? { "aria-current": "page" } : {}}
          replace
        >
          <BrandLogo />
        </Link>
      ) : undefined}
      renderLink={(tab, props) => (
        <Link
          key={tab.to}
          to={tab.to}
          search={tab.to === "/cuenta" && next ? { next } : undefined}
          // Cambiar de pestaña no deja rastro en el historial (2026-11-03): «Atrás» solo vuelve dentro de la pestaña.
          replace
          activeOptions={{ exact: tab.exact, includeSearch: false }}
          activeProps={{ "aria-current": "page" }}
          {...props}
        />
      )}
      end={desktop ? (
        <>
          {adminZone ? <span className="desktop-currency" /> : <CurrencySwitch placement="desktop-currency" />}
          {desktopSignIn ? (
            <Button variant="secondary" placement="desktop-sign-in" icon={<I.user size={22} />} aria-haspopup="dialog" onClick={() => setSignInOpen(true)}>
              Ingresar
            </Button>
          ) : null}
          {desktopInquiries && (
            <button type="button" className="nav desktop-inquiries" aria-label={inquiriesLabel} title="Consultas"
              aria-haspopup="dialog" aria-expanded={inquiriesOpen} onClick={() => setInquiriesOpen(true)}>
              <NavItemContent icon="chat" label="Consultas" labelHidden count={fresh} countTestId="inquiries-badge" countHidden />
            </button>
          )}
          {adminZone ? null : <Link to="/ayuda" className="nav desktop-help" aria-label="Ayuda por WhatsApp" title="Ayuda por WhatsApp" activeProps={{ "aria-current": "page" }}>
            <NavItemContent icon="wa" label="Ayuda por WhatsApp" iconSize={24} />
          </Link>}
        </>
      ) : undefined}
    />
  );
  return (
    <div className={`app${desktop ? " desktop-app" : ""}${publishing ? " publish-flow" : ""}`}>
      {desktop && navigation}
      <UnderTopBar.Provider value={bare}>
        <main className={`view${bare ? " is-bare" : ""}${signInTab ? " sign-in-tab" : narrowGutter ? " view-narrow-gutter" : ""}${ownerCalendar ? " owner-calendar" : ""}${ownerInquiries ? " owner-inquiries" : ""}${ownerHouseDetail || singleHouse ? " owner-house-detail" : ""}${measure ? " view-measure" : ""}`}>{children}</main>
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
  const admin = useLocation({ select: ({ pathname }) => pathname.startsWith("/admin") });
  const adminHouse = useLocation({ select: ({ pathname }) => /^\/admin\/casas\/[^/]+(?:\/editar\/[^/]+)?\/?$/.test(pathname) });
  const accountFlow = useLocation({ select: ({ pathname }) => pathname.startsWith("/cuenta") });
  const subscription = useLocation({ select: ({ pathname }) => pathname === "/propietario/suscripcion" });
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
  // En escritorio, la ayuda, Ingresar y el código desde un flujo y la suscripción llevan la barra superior; las de texto, con
  // líneas de lectura (revisión 2026-11-13, A4 y A9).
  if (desktop && (help || accountFlow)) return <TabsFrame measure>{children}</TabsFrame>;
  if (desktop && admin) return <TabsFrame ownerHouseDetail={adminHouse}>{children}</TabsFrame>;
  if (desktop && subscription) return <TabsFrame measure>{children}</TabsFrame>;
  if (desktop && publishing) return <TabsFrame publishing>{children}</TabsFrame>;
  return (
    <div className={editingPhotos ? "app edit-photos-flow" : publishing || editingField ? "app publish-flow" : "app"}>
      <main className={`view no-nav${ownerHouseDetail ? " owner-house-detail" : verifyingCode ? " code-flow" : ""}`}>{children}</main>
    </div>
  );
}

type HeaderBack = {
  to: string;
  search?: Record<string, string>;
  /** «Volver» hace eso en vez de seguir el enlace (el enlace queda como dirección, p. ej. para abrirlo aparte). */
  onBack?: () => void;
  /** Vuelve atrás en el historial si se llegó desde la app, y si no, a `to` sin apilarla. Lo usan las pantallas que se abren
   *  desde Cuenta: así la flecha de Cuenta, que también vuelve atrás, no rebota entre las dos. */
  historyBack?: boolean;
};
export type HeaderClose =
  | { to: string; search?: Record<string, string>; label: string; title?: string }
  | { onClick: () => void; label: string; title?: string; disabled?: boolean; busy?: boolean };

type ScreenHeaderProps =
  | {
      /** Pestaña o pantalla raíz: en escritorio, cabecera de página con el título y `action` a la derecha; en el teléfono,
       *  bajo una pestaña sin barra, el título solo para lectores de pantalla (y `action` en su fila); sin ella (/admin,
       *  «no encontrada»), el logo de 38 px que lleva a `home` y `role="banner"`. */
      kind: "root";
      title: ReactNode;
      home?: string;
      action?: ReactNode;
      aside?: ReactNode;
    }
  | {
      /** Pantalla de flujo: la flecha **o** la ✕ a la izquierda, el título de 24 px con elipsis y `action` al final. */
      kind: "flow";
      title: string;
      titleId?: string;
      back?: HeaderBack;
      close?: HeaderClose;
      action?: ReactNode;
    }
  | {
      /** El asistente de publicar: título a la izquierda, `action` y la ✕ de 44 px a la derecha (diseño v1, 33); debajo, `below`
       *  (el progreso). La misma cabecera mientras carga el trozo del asistente (shell.tsx). */
      kind: "wizard";
      title: string;
      close: HeaderClose;
      action?: ReactNode;
      below?: ReactNode;
    };

/** La ✕: a la derecha en el asistente (`header-close`, 20 px); a la izquierda en una cabecera de flujo (Filtros en una
 *  ventana), sin colocación propia. */
function CloseButton({ close, left = false }: { close: HeaderClose; left?: boolean }) {
  const placement = left ? undefined : "header-close";
  const icon = <I.x size={left ? undefined : 20} />;
  if ("to" in close)
    return <RouterIconLink to={close.to} search={close.search} label={close.label} title={close.title} placement={placement}>{icon}</RouterIconLink>;
  return <IconButton label={close.label} title={close.title} placement={placement} onClick={close.onClick} disabled={close.disabled} aria-busy={close.busy || undefined}>{icon}</IconButton>;
}

function BackLink({ back }: { back: HeaderBack }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { to, search, onBack, historyBack } = back;
  const goBack = onBack ?? (historyBack ? () => (canGoBack ? router.history.back() : void router.navigate({ to, search, replace: true })) : undefined);
  const click = goBack
    ? (e: MouseEvent) => {
        e.preventDefault();
        goBack();
      }
    : undefined;
  return (
    <RouterIconLink to={to} search={search} label="Volver" onClick={click}>
      <I.back />
    </RouterIconLink>
  );
}

/** La cabecera de toda pantalla de la app (no la de la ficha SSR, que no tiene router). */
export function ScreenHeader(props: ScreenHeaderProps) {
  if (props.kind === "root") return <RootHeader {...props} />;
  if (props.kind === "wizard")
    return (
      <div className="wizard-heading">
        <header className="header-flow publish-header">
          <h1>{props.title}</h1>
          {props.action}
          <CloseButton close={props.close} />
        </header>
        {props.below}
      </div>
    );
  return (
    <header className="header-flow">
      {props.back ? <BackLink back={props.back} /> : props.close ? <CloseButton close={props.close} left /> : null}
      <h1 id={props.titleId}>{props.title}</h1>
      {props.action}
    </header>
  );
}

function RootHeader({ title, home = "/explorar", action, aside }: { title: ReactNode; home?: string; action?: ReactNode; aside?: ReactNode }) {
  const under = useContext(UnderTopBar);
  const desktop = useDesktop();
  // En escritorio, bajo la barra superior: cabecera de página con el título visible, sin repetir el logo (revisión 2026-11-13, A9).
  if (desktop)
    return (
      <header className="header-root page-header">
        <div className="page-header-text">
          <h1>{title}</h1>
          {aside}
        </div>
        {action ? <div className="page-header-actions">{action}</div> : null}
      </header>
    );
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

/** Pantalla que llega en otro ticket: cabecera raíz y una tarjeta con lo que vendrá. */
export function Placeholder({ title, text, home, action, back }: { title: string; text: string; home?: string; action?: ReactNode; back?: string }) {
  const desktop = useDesktop();
  return (
    <>
      {/* En escritorio, con `back`, la flecha de volver como las demás pantallas que no son pestañas. */}
      {back && desktop ? <ScreenHeader kind="flow" title={title} back={{ to: back, historyBack: true }} /> : <ScreenHeader kind="root" title={title} home={home} />}
      <EmptyState placement="placeholder-card" text={<p>{text}</p>} action={action} />
    </>
  );
}
