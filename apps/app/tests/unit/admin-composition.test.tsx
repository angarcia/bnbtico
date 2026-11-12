import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as screens from "../../src/client/screens/admin";
import type { QueueItem } from "../../src/domain/review";
import { activeListing } from "./fixtures";

const state = vi.hoisted(() => ({
  search: {} as { ver?: string; next?: string },
  session: { userId: "admin", aal: "aal1" } as { userId: string; aal: string } | null,
  account: { isAdmin: true } as { isAdmin: boolean } | null | undefined,
  data: {} as Record<string, unknown>,
  error: null as unknown,
  queries: [] as { queryKey: string[]; enabled: boolean }[],
  outcome: null as null | { kind: string; title: string; text: string; notice?: { href: string; name: string } },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: string[]; enabled: boolean }) => {
    state.queries.push(options);
    return options.queryKey[0] === "account"
      ? { data: state.account }
      : { data: state.data[options.queryKey[0]!], error: state.error, isError: !!state.error };
  },
  useQueryClient: () => ({}),
}));
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useSearch: () => state.search, useParams: () => ({ id: "l-activa" }) }),
  useNavigate: () => vi.fn(),
  Navigate: (props: { to: string; search?: unknown; replace?: boolean }) => <output>{JSON.stringify(props)}</output>,
  Link: ({ to, params, search, replace, activeOptions, children, ...props }: {
    to: string; params?: Record<string, string>; search?: unknown; replace?: boolean; activeOptions?: unknown; children?: ReactNode;
  }) => <a href={to.replace(/\$(\w+)/g, (_, key: string) => params?.[key] ?? key)} data-search={JSON.stringify(search)} data-replace={replace} {...props}>{children}</a>,
}));
vi.mock("../../src/client/chrome", () => ({
  RootHeader: ({ title, home, action }: { title: string; home: string; action?: ReactNode }) => <header data-home={home}>{title}{action}</header>,
  FlowHeader: ({ title, back, action, historyBack }: { title: string; back: string; action?: ReactNode; historyBack?: boolean }) =>
    <header data-back={back} data-history={historyBack}>{title}{action}</header>,
}));
vi.mock("../../src/client/session", () => ({ useSession: () => ({ session: state.session }) }));
vi.mock("../../src/client/account", () => ({ accountQuery: (id: string) => ({ queryKey: ["account", id] }) }));
vi.mock("../../src/client/admin", () => ({
  adminQueueQuery: (id: string) => ({ queryKey: ["queue", id] }),
  adminEditsQuery: (id: string) => ({ queryKey: ["edits", id] }),
  adminHousesQuery: (id: string) => ({ queryKey: ["houses", id] }),
  adminListingQuery: (user: string, id: string) => ({ queryKey: ["listing", user, id] }),
  adminEditQuery: (user: string, id: string) => ({ queryKey: ["edit", user, id] }),
  useQueueWithPending: (_id: string, data: unknown) => data,
  useEditsWithPending: (_id: string, data: unknown) => data,
  useReviewOutcome: () => state.outcome,
  clearReviewOutcome: vi.fn(),
  useReview: () => ({ mutate: vi.fn(), isPending: false }),
  useReviewEdit: () => ({ mutate: vi.fn(), isPending: false }),
  useHouseAction: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
  HOUSE_ACTION_DONE: {},
  loadSecondFactor: vi.fn(),
  verifySecondCode: vi.fn(),
  lastInReview: vi.fn(),
}));

beforeEach(() => {
  state.search = {};
  state.session = { userId: "admin", aal: "aal1" };
  state.account = { isAdmin: true };
  state.data = {};
  state.error = null;
  state.queries = [];
  state.outcome = null;
  vi.stubGlobal("window", { location: { origin: "https://3bstays.test" } });
});
afterEach(() => vi.unstubAllGlobals());

const item = (): QueueItem => ({ listing: { ...activeListing, status: "review" }, ownerName: "Ana Prueba" });
const guarded = [
  [screens.AnunciosScreen, "/admin", "queue"],
  [screens.CasasAdminScreen, "/admin/casas", "houses"],
  [screens.RevisarScreen, "/admin/anuncios/l-activa", "listing"],
  [screens.RevisarEdicionScreen, "/admin/ediciones/l-activa", "edit"],
] as const;

describe("Admin: composición pública antes de separar pantallas", () => {
  it("conserva las seis entradas públicas", () => {
    expect(Object.keys(screens).sort()).toEqual(["AdminBadge", "AnunciosScreen", "CasasAdminScreen", "RevisarEdicionScreen", "RevisarScreen", "SegundoCodigoScreen"]);
  });

  it.each(guarded)("%s niega la sección y desactiva sus consultas cuando no es admin", (Screen) => {
    state.account = { isAdmin: false };
    const html = renderToString(<Screen />);
    expect(html).toContain("Esta sección es solo para el equipo de 3bstays");
    expect(html).toContain('href="/explorar"');
    expect(state.queries.filter((q) => q.queryKey[0] !== "account").every((q) => q.enabled === false)).toBe(true);
  });

  it.each(guarded)("%s conserva el retorno a MFA ante forbidden", (Screen, next) => {
    state.error = { code: "42501" };
    const html = renderToString(<Screen />);
    expect(html).toContain("&quot;to&quot;:&quot;/admin/codigo&quot;");
    expect(html).toContain(`&quot;next&quot;:&quot;${next}&quot;`);
    expect(html).toContain("&quot;replace&quot;:true");
  });

  it.each(guarded)("%s conserva las consultas mientras se resuelve la cuenta", (Screen) => {
    state.account = undefined;
    const html = renderToString(<Screen />);
    expect(html).toContain('aria-busy="true"');
    expect(state.queries.every((q) => q.enabled === true)).toBe(true);
  });

  it.each(guarded)("%s no consulta datos privados sin sesión", (Screen) => {
    state.session = null;
    renderToString(<Screen />);
    expect(state.queries.every((q) => q.enabled === false)).toBe(true);
    expect(state.queries.every((q) => q.queryKey[1] === "")).toBe(true);
  });

  it.each(guarded)("%s muestra otros errores sin redirigir a MFA", (Screen) => {
    state.error = { code: "P0001", message: "Mensaje de prueba" };
    const html = renderToString(<Screen />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Mensaje de prueba");
    expect(html).not.toContain("<output>");
  });

  it("la cola conserva filtros, tarjetas, contadores y aviso al anfitrión", () => {
    state.data.queue = { review: [item()], changes: [], rejected: [], active: 3 };
    state.outcome = { kind: "failed", title: "Otra casa", text: "Sin conexión", notice: { href: "https://wa.me/50687770001", name: "Ana" } };
    const html = renderToString(<screens.AnunciosScreen />).replaceAll("<!-- -->", "").replaceAll("\u00a0", " ");
    expect(html).toContain("Por revisar · 1");
    expect(html).toContain('href="/admin/anuncios/l-activa"');
    expect(html).toContain("Ana Prueba · WhatsApp verificado");
    expect(html).toContain("Cahuita · 2 personas · 5 fotos · ₡42 000");
    expect(html).toContain("No se guardó la decisión sobre «Otra casa»: Sin conexión");
    expect(html).toContain("Avisar a Ana por WhatsApp");
    state.search = { ver: "changes" };
    expect(renderToString(<screens.AnunciosScreen />)).toContain("Nada por aquí.");
  });

  it("casas vacías conserva filtros, explicación y asistencia a borradores", () => {
    state.data.houses = { houses: [], today: "2026-11-04" };
    const html = renderToString(<screens.CasasAdminScreen />);
    expect(html).toContain("Todavía no hay casas aprobadas.");
    expect(html).toContain("Toque una casa para ver sus datos, editarla, pausarla, bloquearla o eliminarla.");
    expect(html).toContain('href="/admin/borradores"');
    state.search = { ver: "activas" };
    expect(renderToString(<screens.CasasAdminScreen />)).toContain("Nada por aquí.");
  });

  it("revisión conserva fotos, datos, acciones y bloqueo al faltar fotos", () => {
    const data = item();
    state.data.listing = data;
    const html = renderToString(<screens.RevisarScreen />);
    expect(html).toContain("Casa Cahuita");
    expect(html).toContain("5 fotos");
    expect(html).toContain("Aprobar y publicar");
    expect(html).toContain("Pedir cambios");
    expect(html).toContain("Rechazar");
    expect(html).toContain('href="/admin/casas/l-activa"');
    data.listing = { ...data.listing, photos: [] };
    const empty = renderToString(<screens.RevisarScreen />);
    expect(empty).toContain("Sin fotos: solo puede pedir cambios.");
    expect(empty).toContain('type="submit" disabled=""');
  });

  it.each([
    [screens.RevisarScreen, "listing", "No encontramos ese anuncio."],
    [screens.RevisarEdicionScreen, "edit", "No encontramos esa edición."],
  ] as const)("%s conserva la ausencia de datos", (Screen, key, text) => {
    state.data[key] = null;
    expect(renderToString(<Screen />)).toContain(text);
  });

  it("edición conserva los datos comparados, lo aprobado y las decisiones independientes", () => {
    const data = item();
    data.listing.edit = {
      status: "review",
      fields: { nombre: { status: "review", reviewNote: null, submittedAt: "2026-11-04" } },
      title: "Nuevo nombre",
      kind: null,
      bathroomShared: null,
      description: null,
      location: null,
      submittedAt: "2026-11-04",
      photos: [],
    };
    state.data.edit = data;
    const html = renderToString(<screens.RevisarEdicionScreen />);
    expect(html).toContain("Nuevo nombre");
    expect(html).toContain("Casa Cahuita");
    expect(html).toContain("Antes de decidir");
    expect(html).toContain("Lo que no cambia");
    expect(html).toContain("5 fotos aprobadas");
    expect(html).toContain("Pedir cambios");
    data.listing.edit.status = "changes";
    data.listing.edit.fields.nombre!.status = "changes";
    data.listing.edit.fields.nombre!.reviewNote = "Cambie el nombre";
    const changes = renderToString(<screens.RevisarEdicionScreen />).replaceAll("<!-- -->", "");
    expect(changes).toContain("Cambios pedidos: Cambie el nombre");
    expect(changes).toContain("Lo pendiente tiene cambios pedidos: espera al anfitrión.");
    expect(changes).not.toContain("Antes de decidir");
  });

  it("MFA conserva espera, denegación, formulario y retorno aal2", () => {
    state.account = undefined;
    expect(renderToString(<screens.SegundoCodigoScreen />)).toContain("Cargando su cuenta");
    state.account = { isAdmin: false };
    expect(renderToString(<screens.SegundoCodigoScreen />)).toContain("Esta sección es solo para el equipo de 3bstays");
    state.account = { isAdmin: true };
    const html = renderToString(<screens.SegundoCodigoScreen />);
    expect(html).toContain('data-back="/cuenta"');
    expect(html).toContain('data-history="true"');
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain("Preparando…");
    state.session!.aal = "aal2";
    state.search = { next: "/admin/casas" };
    expect(renderToString(<screens.SegundoCodigoScreen />)).toContain("&quot;to&quot;:&quot;/admin/casas&quot;");
  });
});
