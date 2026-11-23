import { useQuery } from "@tanstack/react-query";
import { toDomainError } from "../../domain/errors";
import type { Listing } from "../../domain/listing";
import { accountQuery } from "../comun/account";
import { useSession } from "../comun/session";
import { ButtonLink, WaIcon } from "../../shared/ui/button";
import { RouterButtonLink } from "../comun/router-buttons";
import { EmptyState, StatusTag } from "../../shared/ui/structure";
import * as ADMIN_COPY from "./copy/admin";

export const message = (e: unknown) => toDomainError(e).message;
export const titleOf = (l: Listing) => l.title || "Sin nombre";

export function useUserId(): string {
  return useSession().session?.userId ?? "";
}

export const AdminBadge = () => <StatusTag label={{ text: ADMIN_COPY.adminTag, tone: "admin" }} />;

/** Solo el equipo de 3bstays: un usuario sin is_admin no ve la zona aunque tenga el segundo factor. */
export function useIsAdmin(): boolean | null {
  const userId = useUserId();
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  return account.data ? account.data.isAdmin : account.data === null ? false : null;
}

export function NotAdmin() {
  return (
    <EmptyState
      title={ADMIN_COPY.notAdminTitle}
      text={<p className="small muted">{ADMIN_COPY.notAdminText}</p>}
      action={<RouterButtonLink to="/explorar" replace variant="secondary" size="lg">{ADMIN_COPY.explore}</RouterButtonLink>}
    />
  );
}

/** «Avisar a <nombre> por WhatsApp»: abre wa.me con el aviso escrito; 3bstays no manda nada solo. */
export function NoticeLink({ href, name }: { href: string; name: string }) {
  return (
    // Lo manda 3bstays, no es hablar con el anfitrión desde la ficha: secundario con el icono de WhatsApp (D4).
    <ButtonLink variant="secondary" size="xl" block icon={<WaIcon />} href={href} target="_blank" rel="noopener" data-testid="notice-link">
      {ADMIN_COPY.notify({ name })}
    </ButtonLink>
  );
}
