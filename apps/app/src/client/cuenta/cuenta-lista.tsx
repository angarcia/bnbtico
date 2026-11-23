import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useRouter } from "@tanstack/react-router";
import { isContactNext, isPublishNext } from "../../domain/contact-return";
import { I } from "../../shared/ui/icons";
import { accountQuery } from "../comun/account";
import { ScreenHeader } from "../comun/screen-header";
import { useSession } from "../comun/session";
import { Replace } from "./cuenta-navigation";
import { ButtonLink } from "../../shared/ui/button";
import { RouterButtonLink } from "../comun/router-buttons";
import * as ACCOUNT_COPY from "./copy/account";

// ---------- /cuenta/lista ----------
const listaRoute = getRouteApi("/_flow/cuenta/lista");

export function ListaScreen() {
  const { next } = listaRoute.useSearch();
  const { status, session } = useSession();
  const account = useQuery({ ...accountQuery(session?.userId ?? ""), enabled: !!session });
  const router = useRouter();
  if (status === "signed-out") return <Navigate to="/cuenta" replace />;
  // Enlaces viejos: la vuelta a la hoja de contacto o al asistente de publicar no se detiene en «¡Listo!».
  if (next && (isContactNext(next) || isPublishNext(next))) return <Replace href={next} />;
  // `next` puede llevar su propia búsqueda: se navega con `href`, no con `to`.
  const target = next ?? "/explorar";
  return (
    <>
      <ScreenHeader kind="flow" title={ACCOUNT_COPY.signIn} back={{ to: "/explorar" }} />
      <div className="stack flow">
        <div className="stack gap-8">
          <span className="avatar avatar-ok">
            <I.check size={26} />
          </span>
          <h2 className="flow-title">{ACCOUNT_COPY.created}</h2>
        </div>
        <h3>{ACCOUNT_COPY.ownHouse}</h3>
        <RouterButtonLink to="/propietario/publicar" variant="primary" size="xl">
          {ACCOUNT_COPY.yesPublish}
        </RouterButtonLink>
        <ButtonLink
          href={target}
          variant="secondary"
          size="lg"
          onClick={(e) => {
            e.preventDefault();
            void router.navigate({ href: target });
          }}
        >
          {ACCOUNT_COPY.noSearching}
        </ButtonLink>
        {account.data && !account.data.email ? (
          <Link to="/cuenta" search={{ editar: "1" }} className="link small">
            {ACCOUNT_COPY.addRecovery}
          </Link>
        ) : null}
      </div>
    </>
  );
}
