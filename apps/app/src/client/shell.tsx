import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { I } from "./icons";

const TABS = [
  { to: "/explorar", label: "Explorar", icon: I.search },
  { to: "/favoritos", label: "Favoritos", icon: I.heart },
  { to: "/cuenta", label: "Mi cuenta", icon: I.user },
] as const;

function TabBar() {
  return (
    <nav className="tabbar three" aria-label="Navegación principal">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="nav" activeProps={{ "aria-current": "page" }}>
          <Icon size={22} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function Layout() {
  return (
    <div className="app">
      <main className="view">
        <Outlet />
      </main>
      <TabBar />
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
  component: Layout,
  notFoundComponent: () => <Screen title="No encontramos esta página" text="Revise el enlace o vuelva a Explorar desde la barra de abajo." />,
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/explorar", replace: true }); } }),
  createRoute({ getParentRoute: () => rootRoute, path: "/explorar", component: () => <Screen title="Explorar" text="Muy pronto verá aquí las casas del Caribe, empezando por Limón." /> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/favoritos", component: () => <Screen title="Favoritos" text="Toque el corazón en una casa para guardarla aquí. No necesita cuenta." /> }),
  createRoute({ getParentRoute: () => rootRoute, path: "/cuenta", component: () => <Screen title="Mi cuenta" text="Muy pronto podrá ingresar con su número de WhatsApp." /> }),
]);

const router = createRouter({ routeTree, defaultPreload: "intent" });
const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function Shell() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
