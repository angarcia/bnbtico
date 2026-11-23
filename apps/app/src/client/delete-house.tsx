// «Eliminar casa» del anfitrión (historia 28, propuesta aprobada por Ana el 2026-11-16, maqueta
// .scratch/eliminar-casa/maqueta-movil.html): texto terracota al final del detalle de una casa propia y una hoja que nombra la
// casa y explica qué pasa. Sin motivo ni código. Al eliminar vuelve a Mis casas con «Casa eliminada.»; si era la última, a
// Explorar con la vista de cliente. Si falla, la hoja sigue abierta con el aviso y la casa no cambia.
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { canDelete } from "../domain/owner-delete";
import { DomainError, toDomainError } from "../domain/errors";
import type { Listing } from "../domain/listing";
import { toast } from "../shared/toast";
import { ConfirmSheet } from "./comun/confirm-sheet";
import { refresh, removeOwnCached } from "./comun/listing-cache";
import { ownListingsKey } from "./comun/listing-keys";
import { api, ownListingsQuery } from "./owner";
import { TextButton } from "../shared/ui/button";
import { Notice } from "../shared/ui/structure";

// Aquí y no en owner.ts: así solo lo descarga quien abre el detalle de una casa (presupuesto de las pestañas).
/** «Eliminar casa» (historia 28). Sin escritura optimista: no tiene vuelta, la tarjeta sale cuando la base lo confirma. Una
 *  casa que la base ya no encuentra (eliminada en otro teléfono, doble toque) se da por eliminada. Al terminar, con éxito o
 *  sin él, Mis casas se vuelve a pedir: sin red, al recuperarla se ve el estado real. */
export function useDeleteOwn(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (l: Listing) => {
      try {
        await (await api()).deleteOwn(l.id);
      } catch (e) {
        if (!(e instanceof DomainError && e.kind === "not_found")) throw e;
      }
    },
    onSuccess: (_void, l) => {
      removeOwnCached(client, userId, l.id);
      refresh(client, userId, l);
    },
    onSettled: () => void client.invalidateQueries({ queryKey: ownListingsKey(userId) }),
  });
}

/** Cuántas casas quedan, leídas de la base (tras eliminar una: si es 0, la app vuelve a la vista de cliente). No vale la
 *  caché: al llegar al detalle por un enlace, Mis casas puede no haberse pedido todavía. */
export const freshOwnCount = async (client: QueryClient, userId: string): Promise<number> =>
  (await client.fetchQuery({ ...ownListingsQuery(userId), staleTime: 0 })).length;

export const DELETE_HOUSE_COPY = {
  action: "Eliminar casa",
  pending: "Eliminando…",
  done: "Casa eliminada.",
  title: (name: string) => `¿Eliminar «${name}»?`,
  body: "La casa deja de verse en 3bstays, su enlace deja de funcionar y no recibirá más consultas. Su suscripción termina sin reembolso del período ya pagado. Guardamos sus datos por seguridad, pero no podrá recuperarla desde la app.",
  pauseHint: "Si solo quiere dejar de recibir clientes un tiempo, use «Pausar la casa» en el Calendario.",
} as const;

export function DeleteHouse({ listing: l, userId }: { listing: Listing; userId: string }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteOwn(userId);
  const client = useQueryClient();
  const navigate = useNavigate();
  if (!canDelete(l)) return null;
  const name = l.title || "esta casa";
  const close = () => {
    del.reset();
    setOpen(false);
  };
  const confirm = () =>
    del.mutate(l, {
      onSuccess: async () => {
        // Sin red para releer la lista, Mis casas: allí se ve el estado real al volver la conexión.
        const left = await freshOwnCount(client, userId).catch(() => 1);
        setOpen(false);
        toast(DELETE_HOUSE_COPY.done);
        await navigate(left > 0 ? { to: "/propietario/casas", replace: true } : { to: "/explorar", replace: true });
      },
    });
  return (
    <>
      <TextButton tone="danger" placement="delete-house" onClick={() => setOpen(true)}>
        {DELETE_HOUSE_COPY.action}
      </TextButton>
      {open ? (
        <ConfirmSheet
          title={DELETE_HOUSE_COPY.title(name)}
          body={
            <>
              <span className="sheet-line num muted">{[l.publicId, l.zone].filter(Boolean).join(" · ")}</span>
              <span className="sheet-line">{DELETE_HOUSE_COPY.body}</span>
              <Notice as="span" tone="solid" small placement="sheet-line">{DELETE_HOUSE_COPY.pauseHint}</Notice>
            </>
          }
          confirmLabel={del.isPending ? DELETE_HOUSE_COPY.pending : DELETE_HOUSE_COPY.action}
          tone="destructive"
          pending={del.isPending}
          error={del.isError ? toDomainError(del.error).message : null}
          onClose={close}
          onConfirm={confirm}
        />
      ) : null}
    </>
  );
}
