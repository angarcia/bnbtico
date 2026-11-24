// Los días de una casa en el Calendario y su guardado optimista: la rejilla cambia al instante y, si la base se niega o no
// hay red, vuelve atrás y lo dice un aviso. Las reglas son las del dominio (domain/calendar.ts), las mismas que la RPC
// save_listing_days.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { applyChange, validateChange, type CalendarChange, type CalendarDay } from "../../../domain/calendar";
import { toDomainError } from "../../../domain/errors";
import type { Listing } from "../../../domain/listing";
import { listingDaysKey, publicListingKey } from "../../../shared/listing-query";
import { toast } from "../../../shared/toast";
import { calendarApi, calendarQuery, saveCalendar } from "./calendar-days";
import * as CAL_COPY from "./copy/calendar";

/** El precio por noche de la casa, del que parten los precios especiales (null si no se alquila por noches). */
export const baseOf = (l: Listing) => (l.acceptsNightly ? l.nightlyPriceCrc : null);

/** `cal`: el calendario del anfitrión o, en las rutas del admin, el de Ana (client/editor-port.ts). */
export function useCalendarDays(l: Listing, userId: string, today: string, cal: typeof calendarApi) {
  const client = useQueryClient();
  const options = calendarQuery(userId, l.id, cal);
  const key = options.queryKey;
  const query = useQuery({ ...options, enabled: !!userId });
  const days = useMemo(() => new Map((query.data ?? []).map((d) => [d.day, d])), [query.data]);
  const base = baseOf(l);
  const saveKey = ["calendar-save", l.id] as const;

  const save = useMutation({
    mutationKey: saveKey,
    mutationFn: ({ change }: { change: CalendarChange; previous: CalendarDay[] | undefined }) => saveCalendar(l.id, change, cal),
    onError: (error, { previous }) => {
      client.setQueryData(key, previous);
      toast(toDomainError(error).message);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: publicListingKey(l.publicId) });
      void client.invalidateQueries({ queryKey: listingDaysKey(l.publicId) });
    },
    // Con otro guardado en vuelo, releer ahora pisaría su cambio optimista: lee el último.
    onSettled: () => {
      if (client.isMutating({ mutationKey: saveKey }) <= 1) void client.invalidateQueries({ queryKey: key });
    },
  });

  /** Aplica el cambio a la rejilla al instante y lo guarda; devuelve el motivo si las reglas lo rechazan (y no cambia nada). */
  function commit(change: CalendarChange): string | null {
    const refused = validateChange(change, { today, listing: { status: l.status, available: l.available, nightlyPriceCrc: base } });
    if (refused) return refused;
    const previous = client.getQueryData<CalendarDay[]>(key);
    const apply = () => client.setQueryData<CalendarDay[]>(key, (d) => applyChange(d ?? [], base, change));
    apply();
    // Una lectura en vuelo traería los días de antes; al cancelarla vuelven y se aplica otra vez (es idempotente).
    if (client.isFetching({ queryKey: key })) void client.cancelQueries({ queryKey: key }).then(apply);
    save.mutate({ change, previous });
    return null;
  }

  /** «Marcar una reserva»: las noches ya vienen de llegada a salida − 1; se guardan como ocupadas, sin tocar los precios.
   *  Devuelve el motivo si no se puede. */
  function markBooked(nights: string[]): string | null {
    const current = client.getQueryData<CalendarDay[]>(key);
    if (!current) return CAL_COPY.availabilityUnknown;
    if (current.some((d) => !d.available && nights.includes(d.day))) return CAL_COPY.nightsTaken;
    return commit({ days: nights, available: false, requireFree: true });
  }

  return { query, days, base, commit, markBooked };
}
