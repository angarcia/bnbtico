// Shell de la zona en el navegador: router (rutas por código) y caché de Query persistida en IndexedDB.
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Link, Navigate, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect, useLocation } from "@tanstack/react-router";
import { costaRicaToday } from "../domain/dates";
import { normalizeSearch, searchFromString, searchToString, type ExploreSearch, type SearchParams } from "../domain/filters";
import { track } from "../shared/beacon";
import { I } from "../shared/icons";
import { ownerZoneRedirect } from "../domain/tabs";
import { forgetOwnListings, ownListingsHint } from "../shared/own-listings";
import { PERSISTED_PRIVATE_KEYS, PRIVATE_QUERY_KEYS } from "./query-policy";
import { FlowFrame, Placeholder, TabsFrame } from "./chrome";
import { isDesktop } from "./desktop";
import { afterRender, viewTransitions } from "./motion";
import { PERSIST_MAX_AGE, persistOptions } from "./persist";
import { whenIdle } from "../shared/idle";
import { cuentaSearch, nextSearch } from "./cuenta-search";
import { actividadSearch, calendarioSearch, pasoSearch, suscripcionSearch } from "./owner-search";
import { suscripcionScreen } from "./lazy-screens";
import { useListingsCount } from "./own-listings-query";
import { CasaScreen } from "./screens/casa";
import { ExplorarScreen } from "./screens/explorar";
import { currentSession, onSignedOut, useSession } from "./session";
import { UpdateBanner } from "./update-banner";

// En el JS inicial solo van Explorar y la ficha. Las demás pantallas se descargan al abrirlas, al apuntar o tocar
// su enlace (defaultPreload "intent": en el móvil, touchstart) y, en reposo tras el primer pintado, las de las pestañas.
const ownerScreens = () => import("./screens/propietario");
const cuentaScreens = () => import("./screens/cuenta");
const favoritosScreen = () => import("./screens/favoritos");
const actividadScreen = () => import("./screens/actividad");
const calendarioScreen = () => import("./screens/calendario");
const casaEditable = () => import("./screens/casa-editable");
// Publicar sin cuenta (§E): el paso 1, la verificación y la vuelta tras el código, en su propio trozo.
const publicarEntrada = () => import("./screens/publicar-entrada");
type OwnerScreen = "CasasScreen" | "CasaPropietarioScreen" | "EnviadaScreen";
type CuentaScreenName = "CuentaScreen" | "CodigoScreen" | "ListaScreen" | "RecuperarScreen" | "AyudaScreen";
/** La búsqueda de Explorar y Filtros, con la ventana de fechas de hoy en Costa Rica. */
const exploreSearch = (p: SearchParams) => normalizeSearch(p, costaRicaToday(Date.now()));
/** La búsqueda (`/explorar/buscar`): la de Explorar y `abrir`, la tarjeta abierta al llegar (no pasa a Explorar). */
type BuscarSearch = ExploreSearch & { abrir?: "donde" | "cuando" | "quienes" };
const buscarSearch = (p: SearchParams): BuscarSearch => ({
  ...exploreSearch(p),
  ...(p.abrir === "donde" || p.abrir === "cuando" || p.abrir === "quienes" ? { abrir: p.abrir } : {}),
});
const ownerScreen = (name: OwnerScreen) => lazyRouteComponent(ownerScreens, name);
const cuentaScreen = (name: CuentaScreenName) => lazyRouteComponent(cuentaScreens, name);

function prefetchTabs() {
  void favoritosScreen();
  void cuentaScreens();
  if (ownListingsHint() > 0 || location.pathname.startsWith("/propietario")) {
    void ownerScreens();
    void actividadScreen();
    void calendarioScreen();
    void suscripcionScreen();
    void casaEditable();
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
        back="/explorar"
        text="Revise el enlace o vuelva a Explorar."
        action={
          <Link to="/explorar" replace className="btn btn-soft">
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

/** Las pestañas del propietario: sin casas (con la lista leída y sin lectura en curso), a Explorar. */
function OwnerOutlet() {
  const { count, fromData, fetching } = useListingsCount();
  if (fromData && ownerZoneRedirect(count, fetching)) return <Navigate to="/explorar" replace />;
  return <Outlet />;
}

const ownerRoutes = createRoute({ getParentRoute: () => privateRoutes, id: "_owner", component: OwnerOutlet });

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
  if (status === "signed-out") return <Navigate to="/cuenta" search={{ next: location.href }} replace />;
  if (session && session.aal !== "aal2") return <Navigate to="/admin/codigo" search={{ next: location.href }} replace />;
  return <Outlet />;
}

const adminTabs = createRoute({ getParentRoute: () => tabs, id: "_admin", beforeLoad: requireAdmin, component: AdminOutlet });
const adminFlow = createRoute({ getParentRoute: () => flow, id: "_adminFlow", beforeLoad: requireAdmin, component: AdminOutlet });

/** Mientras llega el trozo del asistente con la red lenta (p. ej. al tocar «+» en Mis casas): su cabecera y el esqueleto,
 *  lo mismo que pinta el asistente mientras carga; sin esto, la pantalla de antes se quedaba ~1 s sin responder. Con el
 *  trozo ya en el teléfono no llega a verse. */
const publicarPending = {
  pendingMs: 150,
  pendingMinMs: 0,
  pendingComponent: () => (
    <>
      <header className="header-flow">
        <Link to="/propietario/casas" className="btn-link header-close" aria-label="Cerrar y seguir después">
          <I.x size={20} />
          <span>Cerrar</span>
        </Link>
        <h1>Publicar casa</h1>
      </header>
      <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando sus casas">
        <span className="sk thumb" />
        <span className="sk sk-line" />
      </section>
    </>
  ),
};

/** El mismo esqueleto sin cuenta: «Cerrar» vuelve a Explorar (Mis casas pediría ingresar). */
const PHOTOS_STEP = 7;
const publicarLocalPending = {
  ...publicarPending,
  pendingComponent: () => (
    <>
      <header className="header-flow">
        <Link to="/explorar" className="btn-link header-close" aria-label="Cerrar y seguir después">
          <I.x size={20} />
          <span>Cerrar</span>
        </Link>
        <h1>Publicar casa</h1>
      </header>
      <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando">
        <span className="sk thumb" />
        <span className="sk sk-line" />
      </section>
    </>
  ),
};

// La zona del admin se descarga al abrirla: no entra en el JS inicial.
const adminScreen = (name: "AnunciosScreen" | "CasasAdminScreen" | "RevisarScreen" | "RevisarEdicionScreen" | "SegundoCodigoScreen") => lazyRouteComponent(() => import("./screens/admin"), name);
const adminSearch = (params: Record<string, unknown>): { ver?: "changes" | "rejected" } =>
  params.ver === "changes" || params.ver === "rejected" ? { ver: params.ver } : {};
// El filtro se valida en la pantalla (HOUSE_CHIPS, que vive en el trozo del admin): aquí solo se deja pasar un texto.
const casasSearch = (params: Record<string, unknown>): { ver?: string } => (typeof params.ver === "string" ? { ver: params.ver } : {});
// Editar casas (ronda de Ana del 2 nov, ticket 10): las pantallas del anfitrión con el puerto del admin, en su propio trozo.
const asistir = (name: "AsistirCasaScreen" | "AsistirPasoScreen" | "AsistirCampoScreen" | "AsistirCalendarioScreen" | "BorradoresScreen") =>
  lazyRouteComponent(() => import("./screens/asistir"), name);
const adminSoon = (title: string) => () => <Placeholder title={title} home="/admin" text="Muy pronto: esta sección de la zona del admin llega en otra entrega." />;

/** La ficha de la SPA solo entiende `contacto=1`: reabrir la hoja al volver de Ingresar. */
/** `contacto=1`: vuelta de verificar el WhatsApp (la hoja reabre y sigue sola); `escribir=1`: abrir la hoja desde
 *  Favoritos (revisión UX N6), sin enviar nada. */
const casaSearch = (params: Record<string, unknown>): { contacto?: "1"; escribir?: "1" } =>
  params.contacto === "1" ? { contacto: "1" } : params.escribir === "1" ? { escribir: "1" } : {};

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: async () => {
      const session = await currentSession();
      throw redirect({ to: session || isDesktop() ? "/explorar" : "/que-es-3bstays", replace: true });
    },
  }),
  // Inicio pasó a Mis casas y Mis consultas a Actividad: los enlaces ya enviados siguen funcionando.
  createRoute({ getParentRoute: () => rootRoute, path: "/propietario", beforeLoad: () => { throw redirect({ to: "/propietario/casas", replace: true }); } }),
  createRoute({ getParentRoute: () => rootRoute, path: "/propietario/consultas", beforeLoad: () => { throw redirect({ to: "/propietario/actividad", replace: true }); } }),
  tabs.addChildren([
    createRoute({
      getParentRoute: () => tabs,
      path: "/que-es-3bstays",
      component: lazyRouteComponent(() => import("./screens/que-es-3bstays"), "QueEs3bstaysScreen"),
    }),
    createRoute({ getParentRoute: () => tabs, path: "/explorar", validateSearch: exploreSearch, component: ExplorarScreen }),
    createRoute({ getParentRoute: () => tabs, path: "/explorar/filtros", validateSearch: exploreSearch, component: lazyRouteComponent(() => import("./screens/filtros"), "FiltrosScreen") }),
    createRoute({ getParentRoute: () => tabs, path: "/favoritos", component: lazyRouteComponent(favoritosScreen, "FavoritosScreen") }),
    privateRoutes.addChildren([
      ownerRoutes.addChildren([
        createRoute({ getParentRoute: () => ownerRoutes, path: "/propietario/casas", component: ownerScreen("CasasScreen") }),
        createRoute({ getParentRoute: () => ownerRoutes, path: "/propietario/calendario", validateSearch: calendarioSearch, component: lazyRouteComponent(calendarioScreen, "CalendarioScreen") }),
        createRoute({ getParentRoute: () => ownerRoutes, path: "/propietario/actividad", validateSearch: actividadSearch, component: lazyRouteComponent(actividadScreen, "ActividadScreen") }),
      ]),
    ]),
    adminTabs.addChildren([
      createRoute({ getParentRoute: () => adminTabs, path: "/admin", validateSearch: adminSearch, component: adminScreen("AnunciosScreen") }),
      createRoute({ getParentRoute: () => adminTabs, path: "/admin/casas", validateSearch: casasSearch, component: adminScreen("CasasAdminScreen") }),
      createRoute({ getParentRoute: () => adminTabs, path: "/admin/borradores", component: asistir("BorradoresScreen") }),
      createRoute({ getParentRoute: () => adminTabs, path: "/admin/usuarios", component: adminSoon("Usuarios") }),
    ]),
  ]),
  // /cuenta elige el marco en la pantalla (Ingresar y Cuenta, los dos a pantalla completa, sin la barra inferior).
  createRoute({ getParentRoute: () => rootRoute, path: "/cuenta", validateSearch: cuentaSearch, component: cuentaScreen("CuentaScreen") }),
  flow.addChildren([
    createRoute({ getParentRoute: () => flow, path: "/cuenta/codigo", validateSearch: nextSearch, component: cuentaScreen("CodigoScreen") }),
    createRoute({ getParentRoute: () => flow, path: "/cuenta/lista", validateSearch: nextSearch, component: cuentaScreen("ListaScreen") }),
    createRoute({ getParentRoute: () => flow, path: "/cuenta/recuperar", component: cuentaScreen("RecuperarScreen") }),
    createRoute({ getParentRoute: () => flow, path: "/ayuda", component: cuentaScreen("AyudaScreen") }),
    // Con sesión, /publicar es la entrada de siempre; sin ella, el paso 1 en el teléfono y luego verificar el WhatsApp.
    createRoute({
      getParentRoute: () => flow,
      path: "/publicar",
      beforeLoad: async () => {
        if (await currentSession()) throw redirect({ to: "/propietario/publicar", replace: true });
        if (isDesktop()) throw redirect({ to: "/publicar/$id/$paso", params: { id: "nueva", paso: "1" }, replace: true });
      },
      component: lazyRouteComponent(publicarEntrada, "PublicarEntradaScreen"),
    }),
    // Sin cuenta, los pasos 2–6 se guardan en el teléfono (Ana, 2026-11-04): el código se pide al llegar a las Fotos.
    createRoute({
      getParentRoute: () => flow,
      path: "/publicar/$id/$paso",
      validateSearch: pasoSearch,
      beforeLoad: async ({ params }) => {
        if (await currentSession()) throw redirect({ to: "/publicar/continuar", replace: true });
        const step = Number(params.paso);
        if (params.id !== "nueva" || !Number.isInteger(step) || step < 1 || (step === 1 && !isDesktop())) throw redirect({ to: "/publicar", replace: true });
        if (step >= PHOTOS_STEP) throw redirect({ to: "/publicar/verificar", replace: true });
      },
      ...publicarLocalPending,
      component: lazyRouteComponent(() => import("./screens/publicar"), "PasoLocalScreen"),
    }),
    createRoute({
      getParentRoute: () => flow,
      path: "/publicar/verificar",
      beforeLoad: async () => {
        if (await currentSession()) throw redirect({ to: "/publicar/continuar", replace: true });
      },
      component: lazyRouteComponent(publicarEntrada, "VerificarScreen"),
    }),
    // La búsqueda de Explorar, a pantalla completa y en su propio trozo (se precarga al tocar la píldora).
    createRoute({
      getParentRoute: () => flow,
      path: "/explorar/buscar",
      validateSearch: buscarSearch,
      // En escritorio la búsqueda vive en Explorar (Lugar, Fechas y Personas sobre el mapa): no hay pantalla aparte (revisión 2026-11-13, A4).
      beforeLoad: ({ search: { abrir: _abrir, ...search } }) => {
        if (isDesktop()) throw redirect({ to: "/explorar", search, replace: true });
      },
      component: lazyRouteComponent(() => import("./screens/buscar"), "BuscarScreen") }),
    privateFlow.addChildren([
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id", validateSearch: (p: Record<string, unknown>): { panel?: "suscripcion" } => p.panel === "suscripcion" ? { panel: "suscripcion" } : {}, component: ownerScreen("CasaPropietarioScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id/airbnb", validateSearch: calendarioSearch, component: lazyRouteComponent(() => import("./screens/airbnb"), "AirbnbScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id/enviada", component: ownerScreen("EnviadaScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id/correo", component: lazyRouteComponent(publicarEntrada, "CorreoScreen") }),
      // Cada dato de una casa publicada, en su propio trozo (editar-*).
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id/editar/$campo", component: lazyRouteComponent(() => import("./screens/editar"), "EditarCampoScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/suscripcion", validateSearch: suscripcionSearch, component: lazyRouteComponent(suscripcionScreen, "SuscripcionScreen") }),
      // Tras el código de /publicar/verificar: crea la casa con la respuesta del paso 1 guardada en el teléfono.
      createRoute({ getParentRoute: () => privateFlow, path: "/publicar/continuar", component: lazyRouteComponent(publicarEntrada, "ContinuarScreen") }),
      // El asistente de publicar se descarga al abrirlo (o al apuntar a un enlace hacia él): no entra en el JS inicial.
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/publicar", ...publicarPending, component: lazyRouteComponent(() => import("./screens/publicar"), "PublicarScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/propietario/publicar/$id/$paso", validateSearch: pasoSearch, ...publicarPending, component: lazyRouteComponent(() => import("./screens/publicar"), "PasoScreen") }),
      createRoute({ getParentRoute: () => privateFlow, path: "/admin/codigo", validateSearch: nextSearch, component: adminScreen("SegundoCodigoScreen") }),
    ]),
    adminFlow.addChildren([
      createRoute({ getParentRoute: () => adminFlow, path: "/admin/anuncios/$id", component: adminScreen("RevisarScreen") }),
      createRoute({ getParentRoute: () => adminFlow, path: "/admin/ediciones/$id", component: adminScreen("RevisarEdicionScreen") }),
      createRoute({ getParentRoute: () => adminFlow, path: "/admin/casas/$id", component: asistir("AsistirCasaScreen") }),
      createRoute({ getParentRoute: () => adminFlow, path: "/admin/casas/$id/editar/$campo", component: asistir("AsistirCampoScreen") }),
      createRoute({ getParentRoute: () => adminFlow, path: "/admin/casas/$id/publicar/$paso", validateSearch: pasoSearch, component: asistir("AsistirPasoScreen") }),
      createRoute({ getParentRoute: () => adminFlow, path: "/admin/casas/$id/calendario", component: asistir("AsistirCalendarioScreen") }),
    ]),
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

// Al cerrar sesión (aquí, en otra pestaña o porque el servidor la revocó): fuera la caché privada y la pista de las casas
// (la barra vuelve a dos pestañas).
onSignedOut(() => {
  queryClient.removeQueries({ predicate: (q) => PRIVATE_QUERY_KEYS.has(String(q.queryKey[0])) });
  forgetOwnListings();
});

// La caché del dispositivo se guarda cada segundo como mucho: si la app se cerró justo después de un cambio, lo restaurado
// puede ser anterior. Las consultas privadas restauradas se pintan al instante y se vuelven a pedir por detrás.
const refreshPrivate = () => void queryClient.invalidateQueries({ predicate: (q) => PERSISTED_PRIVATE_KEYS.has(String(q.queryKey[0])) });

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
