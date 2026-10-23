// Shell de la zona en el navegador: router (rutas por código) y caché de Query persistida en IndexedDB.
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Navigate, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, redirect, useLocation } from "@tanstack/react-router";
import { normalizeSearch, searchFromString, searchToString } from "../domain/filters";
import { PRIVATE_KEYS } from "./account";
import { FlowFrame, Placeholder, TabsFrame } from "./chrome";
import { PERSIST_MAX_AGE, persistOptions } from "./persist";
import { setRole } from "./role";
import { CasaScreen } from "./screens/casa";
import { AyudaScreen, CodigoScreen, CuentaScreen, ListaScreen, RecuperarScreen, cuentaSearch, nextSearch } from "./screens/cuenta";
import { ExplorarScreen } from "./screens/explorar";
import { FiltrosScreen } from "./screens/filtros";
import { CalendarioScreen, CasasScreen, ConsultasScreen, InicioScreen } from "./screens/propietario";
import { currentSession, onSignedOut, useSession } from "./session";

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <TabsFrame>
      <Placeholder title="No encontramos esta página" text="Revise el enlace o vuelva a Explorar desde la barra de abajo." />
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

/** Sin sesión (o si la sesión termina estando aquí) lleva a Ingresar y, tras verificar, de vuelta a esta ruta. */
function PrivateOutlet() {
  const { status } = useSession();
  const location = useLocation();
  if (status === "signed-out") return <Navigate to="/cuenta" search={{ next: location.href }} replace />;
  return <Outlet />;
}

const privateRoutes = createRoute({
  getParentRoute: () => tabs,
  id: "_private",
  beforeLoad: async ({ location }) => {
    if (!(await currentSession())) throw redirect({ to: "/cuenta", search: { next: location.href }, replace: true });
  },
  component: PrivateOutlet,
});

const flow = createRoute({
  getParentRoute: () => rootRoute,
  id: "_flow",
  component: () => (
    <FlowFrame>
      <Outlet />
    </FlowFrame>
  ),
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/explorar", replace: true }); } }),
  tabs.addChildren([
    createRoute({ getParentRoute: () => tabs, path: "/explorar", validateSearch: normalizeSearch, component: ExplorarScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/explorar/filtros", validateSearch: normalizeSearch, component: FiltrosScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/favoritos", component: () => <Placeholder title="Favoritos" text="Toque el corazón en una casa para guardarla aquí. No necesita cuenta." /> }),
    privateRoutes.addChildren([
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario", component: InicioScreen }),
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario/casas", component: CasasScreen }),
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario/calendario", component: CalendarioScreen }),
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario/consultas", component: ConsultasScreen }),
    ]),
  ]),
  // Mi cuenta con sesión lleva la barra inferior; Ingresar (sin sesión) es una pantalla de flujo: la ruta elige el marco.
  createRoute({ getParentRoute: () => rootRoute, path: "/cuenta", validateSearch: cuentaSearch, component: CuentaScreen }),
  flow.addChildren([
    createRoute({ getParentRoute: () => flow, path: "/cuenta/codigo", validateSearch: nextSearch, component: CodigoScreen }),
    createRoute({ getParentRoute: () => flow, path: "/cuenta/lista", validateSearch: nextSearch, component: ListaScreen }),
    createRoute({ getParentRoute: () => flow, path: "/cuenta/recuperar", component: RecuperarScreen }),
    createRoute({ getParentRoute: () => flow, path: "/ayuda", component: AyudaScreen }),
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

// Al cerrar sesión (aquí, en otra pestaña o porque el servidor la revocó): fuera la caché privada y de vuelta a modo cliente.
onSignedOut(() => {
  queryClient.removeQueries({ predicate: (q) => PRIVATE_KEYS.has(String(q.queryKey[0])) });
  setRole("guest");
});

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
