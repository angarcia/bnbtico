// Shell de la zona en el navegador: router (rutas por código) y caché de Query persistida en IndexedDB.
import { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Link, Navigate, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect, useLocation } from "@tanstack/react-router";
import { normalizeSearch, searchFromString, searchToString } from "../domain/filters";
import { track } from "../shared/beacon";
import { forgetOwnListings } from "../shared/own-listings";
import { PRIVATE_KEYS } from "./account";
import { FlowFrame, Placeholder, TabsFrame } from "./chrome";
import { afterRender, viewTransitions } from "./motion";
import { PERSIST_MAX_AGE, persistOptions } from "./persist";
import { whenIdle } from "../shared/idle";
import { cuentaSearch, nextSearch } from "./cuenta-search";
import { setRole, storedRole } from "./role";
import { CasaScreen } from "./screens/casa";
import { ExplorarScreen } from "./screens/explorar";
import { FiltrosScreen } from "./screens/filtros";
import { currentSession, onSignedOut, useSession } from "./session";
import { UpdateBanner } from "./update-banner";

// En el JS inicial solo van Explorar, Filtros y la ficha. Las demás pantallas se descargan al abrirlas, al apuntar o tocar
// su enlace (defaultPreload "intent": en el móvil, touchstart) y, en reposo tras el primer pintado, las de las pestañas.
const ownerScreens = () => import("./screens/propietario");
const cuentaScreens = () => import("./screens/cuenta");
const favoritosScreen = () => import("./screens/favoritos");
const consultasScreen = () => import("./screens/consultas");
const calendarioScreen = () => import("./screens/calendario");
type OwnerScreen = "InicioScreen" | "CasasScreen" | "CasaPropietarioScreen" | "EnviadaScreen";
type CuentaScreenName = "CuentaScreen" | "CodigoScreen" | "ListaScreen" | "RecuperarScreen" | "AyudaScreen";
const ownerScreen = (name: OwnerScreen) => lazyRouteComponent(ownerScreens, name);
const cuentaScreen = (name: CuentaScreenName) => lazyRouteComponent(cuentaScreens, name);

function prefetchTabs() {
  void favoritosScreen();
  void cuentaScreens();
  if (storedRole() === "owner" || location.pathname.startsWith("/propietario")) {
    void ownerScreens();
    void consultasScreen();
    void calendarioScreen();
  }
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <UpdateBanner />
    </>
  ),
  notFoundComponent: () => (
    <TabsFrame>
      <Placeholder
        title="No encontramos esta página"
        text="Revise el enlace o vuelva a Explorar."
        action={
          <Link to="/explorar" className="btn btn-primary">
            Ir a Explorar
          </Link>
        }
      />
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

const requireSession = async ({ location }: { location: { href: string } }) => {
  if (!(await currentSession())) throw redirect({ to: "/cuenta", search: { next: location.href }, replace: true });
};

const privateRoutes = createRoute({ getParentRoute: () => tabs, id: "_private", beforeLoad: requireSession, component: PrivateOutlet });

const flow = createRoute({
  getParentRoute: () => rootRoute,
  id: "_flow",
  component: () => (
    <FlowFrame>
      <Outlet />
    </FlowFrame>
  ),
});

/** Pantallas privadas sin barra inferior (detalle de una casa, «enviada», publicar). */
const privateFlow = createRoute({ getParentRoute: () => flow, id: "_privateFlow", beforeLoad: requireSession, component: PrivateOutlet });

/** Admin: sesión y segundo código (aal2). Solo UX: la base exige aal2 en cada política y en review_listing. */
const requireAdmin = async ({ location }: { location: { href: string } }) => {
  const session = await currentSession();
  if (!session) throw redirect({ to: "/cuenta", search: { next: location.href }, replace: true });
  if (session.aal !== "aal2") throw redirect({ to: "/admin/codigo", search: { next: location.href }, replace: true });
};

/** Si la sesión baja de nivel o termina estando aquí, de vuelta al segundo código o a Ingresar. */
function AdminOutlet() {
  const { status, session } = useSession();
  const location = useLocation();
  const aal2 = session?.aal === "aal2";
  // Con el segundo código, la barra y Cuenta pasan a modo admin también fuera de /admin (B12c).
  useEffect(() => {
    if (aal2) setRole("admin");
  }, [aal2]);
  if (status === "signed-out") return <Navigate to="/cuenta" search={{ next: location.href }} replace />;
  if (session && session.aal !== "aal2") return <Navigate to="/admin/codigo" search={{ next: location.href }} replace />;
  return <Outlet />;
}

const adminTabs = createRoute({ getParentRoute: () => tabs, id: "_admin", beforeLoad: requireAdmin, component: AdminOutlet });
const adminFlow = createRoute({ getParentRoute: () => flow, id: "_adminFlow", beforeLoad: requireAdmin, component: AdminOutlet });
// La zona del admin se descarga al abrirla: no entra en el JS inicial.
const adminScreen = (name: "AnunciosScreen" | "RevisarScreen" | "SegundoCodigoScreen") => lazyRouteComponent(() => import("./screens/admin"), name);
const adminSearch = (params: Record<string, unknown>): { ver?: "changes" | "rejected" } =>
  params.ver === "changes" || params.ver === "rejected" ? { ver: params.ver } : {};
const adminSoon = (title: string) => () => <Placeholder title={title} home="/admin" text="Muy pronto: esta sección de la zona del admin llega en otra entrega." />;

/** Calendario: `casa` (id de una casa propia) y `mes` (`YYYY-MM`); la pantalla elige la casa y acota el mes a la ventana. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const calendarioSearch = (params: Record<string, unknown>): { casa?: string; mes?: string } => ({
  ...(typeof params.casa === "string" && UUID.test(params.casa) ? { casa: params.casa } : {}),
  ...(typeof params.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? { mes: params.mes } : {}),
});

/** La ficha de la SPA solo entiende `contacto=1`: reabrir la hoja al volver de Ingresar. */
const casaSearch = (params: Record<string, unknown>): { contacto?: "1" } => (params.contacto === "1" ? { contacto: "1" } : {});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/explorar", replace: true }); } }),
  tabs.addChildren([
    createRoute({ getParentRoute: () => tabs, path: "/explorar", validateSearch: normalizeSearch, component: ExplorarScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/explorar/filtros", validateSearch: normalizeSearch, component: FiltrosScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/favoritos", component: lazyRouteComponent(favoritosScreen, "FavoritosScreen") }),
    privateRoutes.addChildren([
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario", component: ownerScreen("InicioScreen") }),
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario/casas", component: ownerScreen("CasasScreen") }),
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario/calendario", validateSearch: calendarioSearch, component: lazyRouteComponent(calendarioScreen, "CalendarioScreen") }),
      createRoute({ getParentRoute: () => privateRoutes, path: "/propietario/consultas", component: lazyRouteComponent(consultasScreen, "ConsultasScreen") }),
    ]),
    adminTabs.addChildren([
      createRoute({ getParentRoute: () => adminTabs, path: "/admin", validateSearch: adminSearch, component: adminScreen("AnunciosScreen") }),
      createRoute({ getParentRoute: () => adminTabs, path: "/admin/casas", component: adminSoon("Casas") }),
      createRoute({ getParentRoute: () => adminTabs, path: "/admin/usuarios", component: adminSoon("Usuarios") }),
    ]),
  ]),
  // /cuenta elige el marco en la pantalla (Ingresar y Mi cuenta, los dos con la barra inferior).
  createRoute({ getParentRoute: () => rootRoute, path: "/cuenta", validateSearch: cuentaSearch, component: cuentaScreen("CuentaScreen") }),
  flow.addChildren([
    createRoute({ getParentRoute: () => flow, path: "/cuenta/codigo", validateSearch: nextSearch, component: cuentaScreen("CodigoScreen") }),
    createRoute({ getParentRoute: () => flow, path: "/cuenta/lista", validateSearch: nextSearch, component: cuentaScreen("ListaScreen") }),
    createRoute({ getParentRoute: () => flow, path: "/cuenta/recuperar", component: cuentaScreen("RecuperarScreen") }),
    createRoute({ getParentRoute: () => flow, path: "/ayuda", component: cuentaScreen("AyudaScreen") }),
    privateFlow.addChildren([
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id", component: ownerScreen("CasaPropietarioScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id/enviada", component: ownerScreen("EnviadaScreen") }),
      // El asistente de publicar se descarga al abrirlo (o al apuntar a un enlace hacia él): no entra en el JS inicial.
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/publicar", component: lazyRouteComponent(() => import("./screens/publicar"), "PublicarScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/publicar/$id/$paso", component: lazyRouteComponent(() => import("./screens/publicar"), "PasoScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/admin/codigo", validateSearch: nextSearch, component: adminScreen("SegundoCodigoScreen") }),
    ]),
    adminFlow.addChildren([createRoute({ getParentRoute: () => adminFlow, path: "/admin/anuncios/$id", component: adminScreen("RevisarScreen") })]),
  ]),
  createRoute({ getParentRoute: () => rootRoute, path: "/casa/$publicId", validateSearch: casaSearch, component: CasaScreen }),
]);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  // Explorar ↔ ficha con View Transitions (client/motion.ts); el resto, instantáneo.
  defaultViewTransition: viewTransitions(),
  // URL legible y compartible (`?prov=Todas&min=44000`) en vez del JSON por defecto de TanStack.
  parseSearch: searchFromString,
  stringifySearch: searchToString,
});

// Escrituras con networkMode "always": sin red fallan al momento con «Sin conexión» (toDomainError) en vez de quedar
// en pausa hasta que vuelva la red. En la v1 no hay cola de escrituras.
const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: PERSIST_MAX_AGE }, mutations: { networkMode: "always" } } });

// Al cerrar sesión (aquí, en otra pestaña o porque el servidor la revocó): fuera la caché privada y de vuelta a modo cliente.
onSignedOut(() => {
  queryClient.removeQueries({ predicate: (q) => PRIVATE_KEYS.has(String(q.queryKey[0])) });
  forgetOwnListings();
  setRole("guest");
});

// La caché del dispositivo se guarda cada segundo como mucho: si la app se cerró justo después de un cambio, lo restaurado
// puede ser anterior. Las consultas privadas restauradas se pintan al instante y se vuelven a pedir por detrás.
const refreshPrivate = () => void queryClient.invalidateQueries({ predicate: (q) => PRIVATE_KEYS.has(String(q.queryKey[0])) });

// La foto de la tarjeta a la que se vuelve desde la ficha (client/motion.ts). El router emite onRendered dentro de la
// actualización de la View Transition, después de pintar y de restaurar el scroll: la captura del estado nuevo ya ve la
// tarjeta en su sitio.
router.subscribe("onRendered", afterRender);

// Las pantallas de las pestañas, en reposo tras el primer pintado: tocar una pestaña no espera a la red.
const stopPrefetch = router.subscribe("onRendered", () => {
  stopPrefetch();
  whenIdle(prefetchTabs);
});

// Una vista de página por ruta resuelta (cambiar solo los filtros de la URL no cuenta).
router.subscribe("onResolved", (e) => {
  if (e.pathChanged || !e.fromLocation) track("page_view");
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function Shell() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={refreshPrivate}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  );
}
