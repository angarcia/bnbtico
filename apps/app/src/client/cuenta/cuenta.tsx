// Cuenta en el navegador: Ingresar (pantalla 06), código (07), Cuenta (08 y 20, a pantalla completa desde arriba; lo del
// propietario aparece con al menos una casa), cuenta lista, recuperar y ayuda. Todo contra AuthApi; supabase-js se carga
// al enviar el primer formulario o si ya hay sesión.
import { getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { FlowFrame, TabsFrame } from "../app/chrome";
import { ScreenHeader } from "../comun/screen-header";
import { useSession } from "../comun/session";
import { SignInForm } from "../comun/sign-in";
import { WhatsAppDialog } from "../comun/whatsapp-dialog";
import { useDesktop } from "../../shared/desktop";
import { backFrom, useContactMode } from "./cuenta-navigation";
import { MyAccount } from "./cuenta-profile";
import * as ACCOUNT_COPY from "./copy/account";

export { CodigoScreen } from "./cuenta-codigo";
export { ListaScreen } from "./cuenta-lista";
export { AyudaScreen, RecuperarScreen } from "./cuenta-ayuda";

// ---------- /cuenta ----------
const cuentaRoute = getRouteApi("/cuenta");

export function CuentaScreen() {
  const { status } = useSession();
  const search = cuentaRoute.useSearch();
  // Revisión UX 2026-10-29 (C4, C5): Ingresar y Cuenta son la pestaña de la derecha. A pantalla completa, con su cabecera,
  // solo cuando se llega desde un flujo (escribir al propietario, publicar…) o al editar los datos.
  const fromFlow = !!search.next && search.next !== "/favoritos";
  const desktop = useDesktop();
  if (status === "signed-out") {
    // En escritorio, Ingresar es siempre la ventana de WhatsApp, también al llegar desde un flujo o una dirección privada.
    if (desktop)
      return (
        <TabsFrame>
          <DesktopSignIn next={search.next} />
        </TabsFrame>
      );
    if (fromFlow)
      return (
        <FlowFrame>
          {/* Un enlace viejo con `?modo=entrar` abre el mismo flujo único. */}
          <EntryForm next={search.next} />
        </FlowFrame>
      );
    return (
      <TabsFrame>
        <h1 className="sr-only">{ACCOUNT_COPY.signIn}</h1>
        <SignInForm next={search.next} mode="account" />
      </TabsFrame>
    );
  }
  const editing = search.editar === "1";
  // En escritorio, «?editar=1» abre el perfil ya editable dentro de la pestaña, no a pantalla completa.
  if (desktop && editing && !fromFlow)
    return (
      <TabsFrame>
        <MyAccount editing tab />
      </TabsFrame>
    );
  if (editing || fromFlow)
    return (
      <FlowFrame>
        <MyAccount editing={editing} />
      </FlowFrame>
    );
  return (
    <TabsFrame>
      <MyAccount editing={false} tab />
    </TabsFrame>
  );
}

/** Ingresar en escritorio: la ventana de la barra sobre la pantalla. Al cerrarla sin entrar se vuelve adonde se estaba; al
 *  entrar, el formulario del código ya llevó a su destino y no se vuelve atrás. */
function DesktopSignIn({ next }: { next?: string }) {
  const { publish } = useContactMode(next);
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const close = () => {
    if (router.state.location.pathname !== "/cuenta") return;
    if (canGoBack) router.history.back();
    else void navigate({ to: "/explorar", replace: true });
  };
  return (
    <>
      <h1 className="sr-only">{ACCOUNT_COPY.signIn}</h1>
      <WhatsAppDialog mode={publish ? "publish" : "account"} next={next} onClose={close} />
    </>
  );
}

/** Ingresar a pantalla completa: la cabecera del modo y el formulario. */
function EntryForm({ next }: { next?: string }) {
  const { contact, publish, header } = useContactMode(next);
  return (
    <>
      <ScreenHeader kind="flow" title={header} back={{ to: backFrom(next) }} />
      <SignInForm next={next} mode={contact ? "contact" : publish ? "publish" : "account"} />
    </>
  );
}
