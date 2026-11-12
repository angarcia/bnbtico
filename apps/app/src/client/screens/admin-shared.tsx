import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toDomainError } from "../../domain/errors";
import type { Listing } from "../../domain/listing";
import { accountQuery } from "../account";
import { useSession } from "../session";

export const message = (e: unknown) => toDomainError(e).message;
export const titleOf = (l: Listing) => l.title || "Sin nombre";

export function useUserId(): string {
  return useSession().session?.userId ?? "";
}

export const AdminBadge = () => <span className="badge badge-admin">Admin</span>;

/** Solo el equipo de 3bstays: un usuario sin is_admin no ve la zona aunque tenga el segundo factor. */
export function useIsAdmin(): boolean | null {
  const userId = useUserId();
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  return account.data ? account.data.isAdmin : account.data === null ? false : null;
}

export function NotAdmin() {
  return (
    <section className="card stack">
      <h3>Esta sección es solo para el equipo de 3bstays</h3>
      <p className="small muted">Si busca una casa, vuelva a Explorar.</p>
      <Link to="/explorar" replace className="btn btn-ghost btn-lg">
        Ir a Explorar
      </Link>
    </section>
  );
}

/** «Avisar a <nombre> por WhatsApp»: abre wa.me con el aviso escrito; 3bstays no manda nada solo. */
export function NoticeLink({ href, name }: { href: string; name: string }) {
  return (
    <a className="btn btn-wa btn-block" href={href} target="_blank" rel="noopener" data-testid="notice-link">
      Avisar a {name || "el anfitrión"} por WhatsApp
    </a>
  );
}
