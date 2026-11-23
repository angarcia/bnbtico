// Marcos de pantalla del diseño v1: pantallas raíz con una sola barra inferior que crece con las casas
// (domain/navigation.ts tabsFor: dos pestañas sin casas, cinco con al menos una; la del admin solo en /admin) y pantallas
// de flujo sin barra (Ingresar, código, Cuenta, ayuda…), con su cabecera. Las pestañas llevan además la barra superior
// (logo · ₡ | $ · cuenta), salvo Explorar (que trae su propia cabecera) y la zona del admin.
import { skipToken, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { tabsFor } from "../domain/tabs";
import { I } from "../shared/ui/icons";
import { CurrencySwitch } from "../shared/currency-switch";
import { useDesktop } from "../shared/desktop";
import { useHidingChrome } from "./comun/hiding-chrome";
import { countNew, inquiriesQuery } from "./propietario/inquiries";
import { useListingsCount } from "./comun/own-listings-query";
import { useSession } from "./comun/session";
import { Button } from "../shared/ui/button";
import { BrandLogo, NavBar, NavItemContent, type NavTab } from "../shared/ui/structure";
import { UnderTopBar } from "./comun/screen-header";

const WhatsAppDialog = lazy(() => import("./comun/whatsapp-dialog").then((m) => ({ default: m.WhatsAppDialog })));
const InquiriesDialog = lazy(() => import("./propietario/actividad").then((m) => ({ default: m.InquiriesDialog })));

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
