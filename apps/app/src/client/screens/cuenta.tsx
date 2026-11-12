// Cuenta en el navegador: Ingresar (pantalla 06), código (07), Cuenta (08 y 20, a pantalla completa desde arriba; lo del
// propietario aparece con al menos una casa), cuenta lista, recuperar y ayuda. Todo contra AuthApi; supabase-js se carga
// al enviar el primer formulario o si ya hay sesión.
import { getRouteApi } from "@tanstack/react-router";
import { FlowFrame, FlowHeader, TabsFrame } from "../chrome";
import { useSession } from "../session";
import { SignInForm } from "../sign-in";
import { backFrom, useContactMode } from "./cuenta-navigation";
import { MyAccount } from "./cuenta-profile";

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
  if (status === "signed-out") {
    if (fromFlow)
      return (
        <FlowFrame>
          {/* Un enlace viejo con `?modo=entrar` abre el mismo flujo único. */}
          <EntryForm next={search.next} />
        </FlowFrame>
      );
    return (
      <TabsFrame>
        <h1 className="sr-only">Ingresar</h1>
        <SignInForm next={search.next} mode="account" />
      </TabsFrame>
    );
  }
  const editing = search.editar === "1";
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

/** Ingresar a pantalla completa: la cabecera del modo y el formulario. */
function EntryForm({ next }: { next?: string }) {
  const { contact, publish, header } = useContactMode(next);
  return (
    <>
      <FlowHeader title={header} back={backFrom(next)} />
      <SignInForm next={next} mode={contact ? "contact" : publish ? "publish" : "account"} />
    </>
  );
}
