// Shell de la zona en el navegador: router (rutas por código) y caché de Query persistida en IndexedDB.
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { normalizeSearch, searchFromString, searchToString } from "../domain/filters";
import { I } from "../shared/icons";
import { PERSIST_MAX_AGE, persistOptions } from "./persist";
import { CasaScreen } from "./screens/casa";
import { ExplorarScreen } from "./screens/explorar";
import { FiltrosScreen } from "./screens/filtros";

const TABS = [
  { to: "/explorar", label: "Explorar", icon: I.search },
  { to: "/favoritos", label: "Favoritos", icon: I.heart },
  { to: "/cuenta", label: "Mi cuenta", icon: I.user },
] as const;

function TabsFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="view">{children}</main>
      <nav className="tabbar three" aria-label="Navegación principal">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="nav" activeProps={{ "aria-current": "page" }}>
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Screen({ title, text }: { title: string; text: string }) {
  return (
    <>
      <header className="header-root">
        <div className="top">
          <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
        </div>
        <h1>{title}</h1>
      </header>
      <section className="card stack">
        <p>{text}</p>
      </section>
    </>
  );
}

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <TabsFrame>
      <Screen title="No encontramos esta página" text="Revise el enlace o vuelva a Explorar desde la barra de abajo." />
    </TabsFrame>
  ),
});

const tabs = createRoute({
  getParentRoute: () => rootRoute,
  id: "_tabs",
  component: () => (
    <TabsFrame>
      <Outlet />
    </TabsFrame>
  ),
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/explorar", replace: true }); } }),
  tabs.addChildren([
    createRoute({ getParentRoute: () => tabs, path: "/explorar", validateSearch: normalizeSearch, component: ExplorarScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/explorar/filtros", validateSearch: normalizeSearch, component: FiltrosScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/favoritos", component: () => <Screen title="Favoritos" text="Toque el corazón en una casa para guardarla aquí. No necesita cuenta." /> }),
    createRoute({ getParentRoute: () => tabs, path: "/cuenta", component: () => <Screen title="Mi cuenta" text="Muy pronto podrá ingresar con su número de WhatsApp." /> }),
  ]),
  createRoute({ getParentRoute: () => rootRoute, path: "/casa/$publicId", component: CasaScreen }),
]);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  // URL legible y compartible (`?prov=Todas&min=44000`) en vez del JSON por defecto de TanStack.
  parseSearch: searchFromString,
  stringifySearch: searchToString,
});

const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: PERSIST_MAX_AGE } } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function Shell() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  );
}
