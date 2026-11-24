// Lo que la pantalla de la suscripción lee y vigila: qué casas enseña (todas o la de `?casa=`), la URL corregida y la vuelta
// de la pasarela con `?pago=ok`.
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { scopeBilling, scopeFix, type SuscripcionSearch } from "../../../domain/subscription-scope";
import { listingsKey, ownListingsKey } from "../../comun/listing-keys";
import { billingQuery, useBilling } from "./billing";

const SAVE_WAIT_MS = 10_000;

/**
 * Las casas de la suscripción y, con `?casa=`, la de esa casa (`scoped`). `settled`: leído de la base tras abrir la
 * pantalla y sin error (sin red, o si falló, `casa` se queda y no se ven las demás). Corrige la URL una sola vez: fuera
 * `pago=ok` siempre y `casa` si no es suya (con los datos ya leídos); el hash se queda. En el panel de una casa
 * (`panelBack`) la URL no es suya y no se toca.
 */
export function useSubscriptionScope(userId: string, search: SuscripcionSearch, panelBack: string | undefined) {
  // Con `?casa=` se vuelve a leer siempre al abrir: una casa aprobada hace un momento aún no está en la caché.
  const billing = useQuery({ ...billingQuery(userId), enabled: !!userId, refetchOnMount: search.casa ? "always" : true });
  const restoring = useIsRestoring();
  const indexed = useBilling(userId);
  const hash = useLocation({ select: (l) => l.hash });
  const navigate = useNavigate();
  const scope = indexed ? scopeBilling(indexed.all, search.casa) : null;
  const settled = !!indexed && billing.isFetchedAfterMount && billing.isSuccess && !billing.isFetching && !restoring;
  useEffect(() => {
    const fix = scopeFix(search, { unknown: !!scope?.unknown, settled });
    if (fix && !panelBack) void navigate({ to: "/propietario/suscripcion", search: fix, hash, replace: true });
  }, [search, scope?.unknown, settled, panelBack]); // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = scope?.scoped ?? null;
  // Con casa: «Suscripción» desde el primer pintado (y mientras se confirma una casa que aún no está en la caché).
  const single = !!panelBack || (!!search.casa && (scoped !== null || (indexed ? !settled : billing.isPending)));
  return { billing, indexed, scoped, settled, single, hash };
}

export type Saving = "saving" | "saved" | "late" | null;

/** Vuelta de la pasarela con `?pago=ok` (la pantalla lo quita de la URL): se vuelve a leer owner_billing hasta ~10 s.
 *  `dismiss` retira el aviso en cuanto el propietario hace otra cosa (parar o reactivar una casa). */
export function useSavingMethod(userId: string, pago: "ok" | undefined): [Saving, () => void] {
  const client = useQueryClient();
  const [saving, setSaving] = useState<Saving>(() => (pago === "ok" ? "saving" : null));
  useEffect(() => {
    if (saving !== "saving" || !userId) return;
    let stopped = false;
    const started = Date.now();
    void (async () => {
      while (!stopped) {
        const o = await client.fetchQuery({ ...billingQuery(userId), staleTime: 0 }).catch(() => null);
        if (stopped) return;
        if (o?.method) {
          setSaving("saved");
          void client.invalidateQueries({ queryKey: ownListingsKey(userId) });
          void client.invalidateQueries({ queryKey: listingsKey });
          return;
        }
        if (Date.now() - started >= SAVE_WAIT_MS) return setSaving("late");
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [saving, userId, client]);
  const dismiss = () => setSaving((s) => (s === "saving" ? s : null));
  return [saving, dismiss];
}
