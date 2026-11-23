import { useQuery } from "@tanstack/react-query";
import { toDomainError } from "../../domain/errors";
import type { Listing } from "../../domain/listing";
import { accountQuery } from "../account";
import { useSession } from "../session";
import { ButtonLink, WaIcon } from "../../shared/ui/button";
import { RouterButtonLink } from "../router-buttons";
import { EmptyState, StatusTag } from "../../shared/ui/structure";

export const message = (e: unknown) => toDomainError(e).message;
export const titleOf = (l: Listing) => l.title || "Sin nombre";

export function useUserId(): string {
  return useSession().session?.userId ?? "";
}

export const AdminBadge = () => <StatusTag label={{ text: "Admin", tone: "admin" }} />;

/** Solo el equipo de 3bstays: un usuario sin is_admin no ve la zona aunque tenga el segundo factor. */
export function useIsAdmin(): boolean | null {
  const userId = useUserId();
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  return account.data ? account.data.isAdmin : account.data === null ? false : null;
}

export function NotAdmin() {
  return (
    <EmptyState
      title="Esta sección es solo para el equipo de 3bstays"
      text={<p className="small muted">Si busca una casa, vuelva a Explorar.</p>}
      action={<RouterButtonLink to="/explorar" replace variant="secondary" size="lg">Ir a Explorar</RouterButtonLink>}
    />
  );
}

/** «Avisar a <nombre> por WhatsApp»: abre wa.me con el aviso escrito; 3bstays no manda nada solo. */
export function NoticeLink({ href, name }: { href: string; name: string }) {
  return (
    // Lo manda 3bstays, no es hablar con el anfitrión desde la ficha: secundario con el icono de WhatsApp (D4).
    <ButtonLink variant="secondary" size="xl" block icon={<WaIcon />} href={href} target="_blank" rel="noopener" data-testid="notice-link">
      Avisar a {name || "el anfitrión"} por WhatsApp
    </ButtonLink>
  );
}
