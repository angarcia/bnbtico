// La entrada del asistente de publicar: retomar el borrador pendiente o crear uno y entrar al paso 1.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DomainError, GENERIC_MESSAGE } from "../../../domain/errors";
import { ownListingKey, ownListingsKey, ownResumableKey } from "../../comun/listing-keys";
import { knownNoDraft } from "../../comun/own-listings-query";
import { addOwnCached, api, resumableQuery } from "../owner";
import { clearCreateFailure, createFailure, startDraft } from "./new-draft";

export const errorMessage = (e: unknown) => (e instanceof DomainError ? e.message : GENERIC_MESSAGE);

/** La lectura que empezó al apoyar el dedo en «+» (Mis casas) vale si es de hace menos de esto: no se repite. */
const RESUMABLE_FRESH_MS = 3000;

/** Verdadero mientras el componente sigue montado (para no navegar desde una respuesta que llega tras cerrar). */
function useMountedRef() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/**
 * Sin borrador pendiente, crea uno y entra al paso 1. Si Mis casas ya lo sabía (`instant`), al instante y el borrador se
 * crea por detrás (2026-11-06); si no, al leer que no hay ninguno (un solo intento por visita: el modo estricto de React
 * monta dos veces). Si hay uno pendiente (`draft`), no crea nada. `failure`: el mensaje si no se pudo crear, también el
 * del borrador que el teléfono empezó sin esperar a la base y la base no creó.
 */
export function usePublishEntry(userId: string) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [lost] = useState(createFailure);
  useEffect(() => clearCreateFailure(), []);
  const [instant] = useState(() => !lost && knownNoDraft(client, userId));
  const resumable = useQuery({ ...resumableQuery(userId), enabled: !!userId && !instant, staleTime: RESUMABLE_FRESH_MS });

  const begun = useRef(false);
  useEffect(() => {
    if (!instant || begun.current) return;
    begun.current = true;
    const id = startDraft(client, userId, (lostId) => {
      // Solo si sigue en ese borrador: quien ya cerró el asistente no se ve llevado de vuelta.
      if (router.state.location.pathname.includes(lostId)) void router.navigate({ to: "/propietario/publicar", replace: true });
    });
    // En lugar de la entrada: «Atrás» desde el paso 1 vuelve a donde se tocó «+».
    void navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: "1" }, replace: true });
  }, [instant, client, userId, router, navigate]);

  // Si se cierra mientras se crea, el borrador queda en Mis casas y no se salta al paso 1.
  const mounted = useMountedRef();
  const create = useMutation({
    mutationFn: async () => (await api()).createDraft(),
    onSuccess: async ({ id, listing }) => {
      // createDraft trae el borrador entero: a la caché sin otro viaje a la base (antes se volvía a pedir aquí).
      client.setQueryData(ownListingKey(userId, id), listing);
      addOwnCached(client, userId, listing); // la barra crece al instante, antes de releer la lista
      void client.invalidateQueries({ queryKey: ownListingsKey(userId) });
      void client.invalidateQueries({ queryKey: ownResumableKey(userId) });
      if (mounted.current) await navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: "1" }, replace: true });
    },
  });

  // Solo con una lectura de esta visita (de después de montar o de los últimos segundos, la del toque en «+»): la caché del
  // teléfono puede traer un borrador ya enviado o descartado, o un «sin borrador» desfasado que crearía otro; la restaurada
  // conserva su hora antigua y no cuenta.
  const fresh = resumable.isFetchedAfterMount || (resumable.isSuccess && !resumable.isFetching && Date.now() - resumable.dataUpdatedAt < RESUMABLE_FRESH_MS);
  const draft = fresh && !resumable.isError ? resumable.data : undefined;

  // Sin borrador pendiente no hay nada que elegir (revisión UX C4); si falla, el botón «Empezar» queda para reintentar.
  const autoStarted = useRef(instant || lost !== null);
  useEffect(() => {
    if (draft !== null || resumable.isFetching || autoStarted.current) return;
    autoStarted.current = true;
    create.mutate();
  }, [draft, resumable.isFetching, create]);

  const failure = create.isError ? errorMessage(create.error) : create.isIdle ? lost : null;
  return { instant, resumable, draft, create, failure };
}
