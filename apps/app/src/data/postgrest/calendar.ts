// Adaptador PostgREST del calendario del propietario. Las filas de listing_days solo se escriben con la RPC
// save_listing_days (valida y guarda todo o nada; sus mensajes P0001 pasan tal cual). La lectura filtra por dueño con un
// join a listings: la RLS de listing_days deja leer a cualquiera los días de una casa activa.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerCalendarApi } from "../../domain/api";
import { CALENDAR_MESSAGES, calendarWindow, isIsoDate } from "../../domain/calendar";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { costaRicaToday } from "../../domain/inquiry";
import { readCalendarDays } from "../../domain/airbnb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


async function me(db: SupabaseClient<Database>): Promise<string> {
  const { data } = await db.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
  return id;
}

export function createPostgrestCalendar(db: SupabaseClient<Database>, opts: { now?: () => number } = {}): OwnerCalendarApi {
  const now = opts.now ?? Date.now;

  return {
    async days(listingId) {
      await me(db);
      if (!UUID.test(listingId)) return [];
      const { first, last } = calendarWindow(costaRicaToday(now()));
      const { data, error } = await db.rpc("owner_calendar_days", { p_listing: listingId });
      if (error) throw toDomainError(error);
      return readCalendarDays(data).filter(d => d.day >= first && d.day <= last);
    },

    async save(listingId, change) {
      await me(db);
      if (!UUID.test(listingId)) throw new DomainError(CALENDAR_MESSAGES.notFound, "validation");
      // Lo que no llega a la base con su tipo (una fecha que no existe, un precio con decimales o NaN, que en JSON es
      // null) se rechaza aquí con el mismo mensaje que daría la RPC.
      if (!change.days.every(isIsoDate)) throw new DomainError(CALENDAR_MESSAGES.range, "validation");
      if (change.priceCrc !== undefined && !Number.isInteger(change.priceCrc)) throw new DomainError(CALENDAR_MESSAGES.price, "validation");
      const { error } = await db.rpc("save_listing_days", {
        p_listing: listingId,
        p_days: change.days,
        ...(change.available === undefined ? {} : { p_available: change.available }),
        ...(change.priceCrc === undefined ? {} : { p_price_crc: change.priceCrc }),
      });
      if (error) throw toDomainError(error);
    },
  };
}
