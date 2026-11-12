import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useRouter } from "@tanstack/react-router";
import { isContactNext, isPublishNext } from "../../domain/contact-return";
import { I } from "../../shared/icons";
import { accountQuery } from "../account";
import { FlowHeader } from "../chrome";
import { useSession } from "../session";
import { Replace } from "./cuenta-navigation";

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
      <FlowHeader title="Ingresar" back="/explorar" />
      <div className="stack flow">
        <div className="stack gap-8">
          <span className="avatar avatar-ok">
            <I.check size={26} />
          </span>
          <h2 className="flow-title">¡Listo! Su cuenta está creada</h2>
        </div>
        <h3>¿Tiene una casa para alquilar?</h3>
        <Link to="/propietario/publicar" className="btn btn-primary btn-xl">
          Sí, quiero publicarla
        </Link>
        <a
          href={target}
          className="btn btn-ghost btn-lg"
          onClick={(e) => {
            e.preventDefault();
            void router.navigate({ href: target });
          }}
        >
          No, busco casa
        </a>
        {account.data && !account.data.email ? (
          <Link to="/cuenta" search={{ editar: "1" }} className="link small">
            Añadir un correo de recuperación
          </Link>
        ) : null}
      </div>
    </>
  );
}
