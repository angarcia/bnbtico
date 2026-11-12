import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as screens from "../../src/client/screens/cuenta";

const state = vi.hoisted(() => ({
  search: {} as { next?: string; editar?: string },
  status: "signed-out",
  count: 0 as number | undefined,
  account: undefined as undefined | { id: string; name: string; phone: string; email: string | null; description: string | null; isAdmin: boolean },
  pending: null as null | { phone: string; mode: "register" | "login"; sentAt: number },
  listing: null as null | { ownerName: string },
  favorites: [] as string[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.account }),
  useQueryClient: () => ({}),
}));
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useSearch: () => state.search }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ navigate: vi.fn(), history: { back: vi.fn() } }),
  useCanGoBack: () => false,
  Navigate: (props: { to: string; search?: unknown; replace?: boolean }) => <output>{JSON.stringify(props)}</output>,
  Link: ({ to, search, replace, children, ...props }: { to: string; search?: unknown; replace?: boolean; children?: ReactNode }) =>
    <a href={to} data-search={JSON.stringify(search)} data-replace={replace} {...props}>{children}</a>,
}));
vi.mock("../../src/client/chrome", () => ({
  FlowFrame: ({ children }: { children: ReactNode }) => <main data-frame="flow">{children}</main>,
  TabsFrame: ({ children }: { children: ReactNode }) => <main data-frame="tabs">{children}</main>,
  FlowHeader: ({ title, back, search, historyBack }: { title: string; back: string; search?: unknown; historyBack?: boolean }) =>
    <header data-back={back} data-search={JSON.stringify(search)} data-history={historyBack}>{title}</header>,
}));
vi.mock("../../src/client/session", () => ({
  useSession: () => ({ status: state.status, session: state.status === "signed-out" ? null : { userId: "u1" } }),
  pendingOtp: () => state.pending,
  authApi: vi.fn(),
}));
vi.mock("../../src/client/account", () => ({ accountQuery: (id: string) => ({ queryKey: ["account", id] }) }));
vi.mock("../../src/client/own-listings-query", () => ({
  useListingsCount: () => ({ count: state.count }),
  ownListingsQuery: (id: string) => ({ queryKey: ["own-listings", id] }),
}));
vi.mock("../../src/client/sign-in", () => ({
  SignInForm: ({ mode, next }: { mode: string; next?: string }) => <form data-mode={mode} data-next={next} />,
  ContactCard: ({ next }: { next?: string }) => <aside data-contact={next} />,
  ReturnCard: ({ next }: { next?: string }) => <aside data-return={next} />,
  useReturnListing: () => state.listing,
}));
vi.mock("../../src/client/turnstile", () => ({ useTurnstile: () => ({ container: null, token: vi.fn() }) }));
vi.mock("../../src/shared/favorites-store", () => ({ useFavorites: () => state.favorites }));
vi.mock("../../src/client/publish-promo", () => ({ PublishPromoRow: () => <a href="/publicar">Publicar mi casa</a> }));
vi.mock("../../src/client/lazy-screens", () => ({ suscripcionScreen: () => new Promise(() => {}) }));
vi.mock("../../src/client/support-numbers", () => ({ SUPPORT_NUMBERS: { owner: "50680000001", guest: "50680000002" } }));

beforeEach(() => {
  state.search = {};
  state.status = "signed-out";
  state.count = 0;
  state.account = undefined;
  state.pending = null;
  state.listing = null;
  state.favorites = [];
});

const cuenta = () => renderToString(<screens.CuentaScreen />);
const signIn = () => {
  state.status = "signed-in";
  state.account = { id: "u1", name: "Ana Prueba", phone: "+50688881234", email: null, description: null, isAdmin: false };
};

describe("Cuenta: composición pública antes de dividir responsabilidades", () => {
  it("conserva las cinco entradas públicas", () => {
    expect(Object.keys(screens).sort()).toEqual(["AyudaScreen", "CodigoScreen", "CuentaScreen", "ListaScreen", "RecuperarScreen"]);
  });

  it.each([undefined, "/favoritos"])("ingresar desde %s conserva pestañas y retorno", (next) => {
    state.search = { next };
    const html = cuenta();
    expect(html).toContain('data-frame="tabs"');
    expect(html).toContain('<h1 class="sr-only">Ingresar</h1>');
    expect(html).toContain('data-mode="account"');
    if (next) expect(html).toContain('data-next="/favoritos"');
  });

  it.each([
    ["/casa/CT-1234?contacto=1", "contact", "Escribirle a Ana", "/casa/CT-1234"],
    ["/publicar/continuar", "publish", "Publicar casa", "/explorar"],
    ["/propietario/casas", "account", "Ingresar", "/explorar"],
  ])("el flujo %s conserva cabecera, modo y vuelta", (next, mode, title, back) => {
    state.search = { next };
    state.listing = { ownerName: "Ana Prueba" };
    const html = cuenta();
    expect(html).toContain('data-frame="flow"');
    expect(html).toContain(`data-mode="${mode}"`);
    expect(html).toContain(`data-back="${back}"`);
    expect(html).toContain(title);
  });

  it("sin OTP vuelve a Cuenta y conserva next", () => {
    state.search = { next: "/favoritos" };
    const html = renderToString(<screens.CodigoScreen />);
    expect(html).toContain("&quot;to&quot;:&quot;/cuenta&quot;");
    expect(html).toContain("&quot;next&quot;:&quot;/favoritos&quot;");
    expect(html).toContain("&quot;replace&quot;:true");
  });

  it.each([
    ["/casa/CT-1234?contacto=1", 'data-contact="/casa/CT-1234?contacto=1"'],
    ["/publicar/continuar", "Después seguimos con su casa"],
    ["/favoritos", 'data-return="/favoritos"'],
  ])("código conserva contexto y enfriamiento para %s", (next, marker) => {
    state.search = { next };
    state.pending = { phone: "+50688881234", mode: "login", sentAt: Date.now() };
    const html = renderToString(<screens.CodigoScreen />);
    expect(html).toContain("Introduzca el código");
    expect(html).toContain("+506 8888 1234");
    expect(html).toContain("Puede pedir otro en");
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain(marker);
    expect(html).not.toContain("Pedir otro código");
  });

  it("lista ofrece publicar y respeta el retorno con búsqueda", () => {
    signIn();
    state.search = { next: "/explorar?zona=Cocles" };
    const html = renderToString(<screens.ListaScreen />);
    expect(html).toContain('href="/explorar?zona=Cocles"');
    expect(html).toContain("Sí, quiero publicarla");
    expect(html).toContain("Añadir un correo de recuperación");
    state.account!.email = "ana@ejemplo.com";
    expect(renderToString(<screens.ListaScreen />)).not.toContain("Añadir un correo de recuperación");
  });

  it("lista sin sesión vuelve a Cuenta", () => {
    expect(renderToString(<screens.ListaScreen />)).toContain("&quot;to&quot;:&quot;/cuenta&quot;");
  });

  it("Cuenta sin casas muestra perfil y publicación, no suscripción", () => {
    signIn();
    const html = cuenta();
    expect(html).toContain('data-frame="tabs"');
    expect(html).toContain("Ana Prueba");
    expect(html).toContain("WhatsApp verificado");
    expect(html).toContain("Pronto podrá verificar también su identidad (opcional).");
    expect(html).toContain("Publicar mi casa");
    expect(html).toContain("Línea de 3bstays para clientes");
    expect(html).not.toContain("Próximo cobro");
    expect(html).not.toContain('id="account-name"');
  });

  it("editar abre el perfil sin cambios pendientes y con valores opcionales vacíos", () => {
    signIn();
    state.search = { editar: "1" };
    const html = cuenta();
    expect(html).toContain('data-frame="flow"');
    expect(html).toContain('id="account-name"');
    expect(html).toContain('value="Ana Prueba"');
    expect(html).toContain('disabled="">Guardar cambios</button>');
    expect(html).not.toContain("Cambios guardados.");
  });

  it.each([0, 1, 2])("Cuenta de anfitrión conserva suscripción y %s favoritos", (count) => {
    signIn();
    state.count = 1;
    state.favorites = Array.from({ length: count }, (_, i) => `CT-${i}`);
    state.account!.isAdmin = true;
    const html = cuenta();
    expect(html).toContain("Próximo cobro");
    expect(html).toContain(count === 0 ? "Ninguna casa guardada" : count === 1 ? "1 casa guardada" : "2 casas guardadas");
    expect(html).toContain("Revisión de anuncios · admin");
    expect(html).toContain("Línea de 3bstays para anfitriones");
    expect(html).not.toContain("Publicar mi casa");
  });

  it.each([0, 1, undefined])("ayuda elige el canal por casas (%s), no por sesión", (count) => {
    state.count = count;
    const html = renderToString(<screens.AyudaScreen />);
    expect(html).toContain(count ? "atención a anfitriones" : "atención a clientes");
    expect(html).toContain(count ? "https://wa.me/50680000001" : "https://wa.me/50680000002");
    expect(html).toContain('data-back="/cuenta"');
    expect(html).toContain('data-history="true"');
  });

  it("recuperación conserva correo desactivado y ayuda sin enviar documentos", () => {
    const html = renderToString(<screens.RecuperarScreen />);
    expect(html).toContain('id="recovery-email"');
    expect(html).toContain('disabled="">Recuperar con mi correo</button>');
    expect(html).toContain("No mande documentos ni códigos por este formulario.");
    expect(html).toContain('href="/ayuda"');
  });
});
