// Adaptador PostgREST de la suscripción del propietario (fase 5): una lectura (owner_billing) y las dos transiciones
// (stop_subscription, resume_subscription). Las tablas no se leen ni escriben por REST desde aquí: la consulta de casas
// propias no embebe subscriptions (si la migración no está aplicada, solo falla esta lectura).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerBillingApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import type { ListingStatus } from "../../domain/listing";
import { fromBillingJson } from "../../domain/rows";
import { SUBSCRIPTION_MESSAGES } from "../../domain/subscription";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function me(db: SupabaseClient<Database>): Promise<void> {
  const { data } = await db.auth.getSession();
  if (!data.session) throw new DomainError(SUBSCRIPTION_MESSAGES.session, "session");
}

export function createPostgrestOwnerBilling(db: SupabaseClient<Database>): OwnerBillingApi {
  async function transition(fn: "stop_subscription" | "resume_subscription", listingId: string): Promise<ListingStatus> {
    await me(db);
    if (!UUID.test(listingId)) throw new DomainError(SUBSCRIPTION_MESSAGES.notFound, "validation");
    const { data, error } = await db.rpc(fn, { p_listing: listingId });
    if (error) throw toDomainError(error);
    return data;
  }

  return {
    async overview() {
      await me(db);
      const { data, error } = await db.rpc("owner_billing");
      if (error) throw toDomainError(error);
      return fromBillingJson(data);
    },
    stop: (id) => transition("stop_subscription", id),
    resume: (id) => transition("resume_subscription", id),
  };
}
