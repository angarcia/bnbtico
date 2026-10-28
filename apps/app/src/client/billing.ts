// Suscripción del propietario (fase 5): una sola lectura, owner_billing, para Mis casas, el detalle de una casa,
// Cuenta y «Promoción y suscripción». Es privada (account.ts PRIVATE_KEYS): se guarda en el dispositivo mientras dure la
// sesión y se borra al cerrarla. Va aparte de la consulta de casas propias: si falla (un despliegue antes de la migración
// en otro entorno, un error pasajero), las pantallas salen como antes, sin las partes de la suscripción.
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { BillingHouse, BillingOverview, HouseSubscription, PaymentMethodSummary } from "../domain/subscription";
import { houseSubscription } from "../domain/subscription";
import { authApi } from "./session";

export const billingQuery = (userId: string) =>
  queryOptions({
    queryKey: ["billing", userId] as const,
    queryFn: async (): Promise<BillingOverview> => {
      await authApi();
      return (await import("./supabase-data")).ownerBilling().overview();
    },
    staleTime: 30_000, // como las casas propias (owner.ts OWNER_STALE_MS; owner.ts importa este módulo)
    // Sin la RPC (base sin la migración) no tiene sentido insistir: las pantallas ya se pintan sin ella.
    retry: 1,
  });

export interface HouseBilling {
  house: BillingHouse;
  sub: HouseSubscription;
}

export interface Billing {
  today: string;
  method: PaymentMethodSummary | null;
  /** La suscripción de una casa (por id); undefined si no tiene (borrador nunca aprobado) o si la lectura falló. */
  of(listingId: string): HouseBilling | undefined;
  all: HouseBilling[];
}

function index(o: BillingOverview): Billing {
  const all = o.houses.map((house) => ({ house, sub: houseSubscription(house, o.method) }));
  const byId = new Map(all.map((x) => [x.house.listingId, x]));
  return { today: o.today, method: o.method, all, of: (id) => byId.get(id) };
}

const cache = new WeakMap<BillingOverview, Billing>();

/** La suscripción de las casas del propietario; null mientras no hay datos o si la lectura falló. */
export function useBilling(userId: string): Billing | null {
  const { data } = useQuery({ ...billingQuery(userId), enabled: !!userId });
  if (!data) return null;
  let b = cache.get(data);
  if (!b) cache.set(data, (b = index(data)));
  return b;
}
