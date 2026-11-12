// Calendario del propietario en el navegador: una consulta por casa, `["calendar", uid, casa]`, con todos los días de la
// ventana (hoy … hoy + 365) en una sola petición, así que cambiar de mes no toca la red. Es privada (account.ts
// PRIVATE_KEYS): se guarda en el dispositivo mientras dure la sesión y se borra al cerrarla.
import { queryOptions } from "@tanstack/react-query";
import type { OwnerCalendarApi } from "../domain/api";
import type { CalendarChange } from "../domain/calendar";
import { authApi } from "./session";

export const calendarApi = async (): Promise<OwnerCalendarApi> => {
  await authApi();
  return (await import("./supabase-data")).calendarApi();
};

/** `cal`: el calendario del anfitrión o, en las rutas del admin, el de Ana (client/editor-port.ts). */
export const calendarQuery = (userId: string, listingId: string, cal = calendarApi) =>
  queryOptions({
    queryKey: ["calendar", userId, listingId] as const,
    queryFn: async () => (await cal()).days(listingId),
    staleTime: 30_000,
  });

export const saveCalendar = async (listingId: string, change: CalendarChange, cal = calendarApi) => (await cal()).save(listingId, change);
