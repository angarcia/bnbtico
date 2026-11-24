// Qué casa enseña el Calendario del propietario: la de `?casa=`, la última usada en este teléfono o la primera activa;
// nunca un borrador sin enviar (revisión UX A5).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Listing } from "../../../domain/listing";
import { ownListingsQuery } from "../owner";
import { calendarQuery } from "./calendar-days";

const LAST_HOUSE = "3bstays-calendario-casa";

/** Casas con calendario (revisión UX A5): todo lo enviado alguna vez (en revisión, con cambios pedidos, activa, pausada) y
 *  las ya publicadas que se están editando. Fuera: los borradores nunca enviados y las rechazadas. */
const hasCalendar = (l: Listing) => l.status !== "rejected" && !(l.status === "draft" && l.firstPublishedAt === null);

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_HOUSE);
  } catch {
    return null;
  }
}
function storeLast(id: string) {
  try {
    localStorage.setItem(LAST_HOUSE, id);
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
}

/**
 * La lista de casas con calendario y la que se muestra. Pide los días de la casa de la URL o de la última usada a la vez
 * que la lista, sin esperarla (auditoría de viajes 2026-11-05; si al final se muestra otra, solo sobra esa petición),
 * recuerda la mostrada y, si `?casa=` apunta a una casa sin calendario o que ya no existe, llama a `onCorrect` con la que
 * se muestra para que la URL pase a ella.
 */
export function useCalendarHouse(userId: string, casa: string | undefined, onCorrect: (id: string) => void) {
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const houses = listings.data?.filter(hasCalendar);
  const last = readLast();
  const client = useQueryClient();
  const guess = casa ?? last;
  useEffect(() => {
    if (userId && guess) void client.prefetchQuery(calendarQuery(userId, guess));
  }, [client, userId, guess]);

  const current =
    houses?.find((l) => l.id === casa) ?? houses?.find((l) => l.id === last) ?? houses?.find((l) => l.status === "active") ?? houses?.[0];
  useEffect(() => {
    if (current) storeLast(current.id);
  }, [current]);

  const corrected = casa && current && casa !== current.id ? current.id : null;
  useEffect(() => {
    if (corrected) onCorrect(corrected);
    // `onCorrect` cambia en cada render: basta con depender de la casa corregida.
  }, [corrected]);

  // Para el estado vacío: el borrador sin enviar más reciente (la lista llega de la más nueva a la más vieja).
  const draft = listings.data?.find((l) => l.status === "draft" && l.firstPublishedAt === null);
  return { listings, houses, current, draft };
}
