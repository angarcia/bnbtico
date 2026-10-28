// Las consultas del propietario en el navegador (Actividad). Una sola consulta, `["inquiries", uid]`: la leen la pantalla y el
// contador de la pestaña. Es privada (account.ts PRIVATE_KEYS): se guarda en el dispositivo mientras dure
// la sesión y se borra al cerrarla. Este módulo va en el JS inicial (lo usa la barra): sin el dominio de las consultas.
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { InquiriesApi } from "../domain/api";
import type { OwnerInquiry } from "../domain/inquiry";
import { waUrl } from "../domain/whatsapp";
import { authApi } from "./session";

const api = async (): Promise<InquiriesApi> => {
  await authApi();
  return (await import("./supabase-data")).inquiriesApi();
};

export const inquiriesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["inquiries", userId] as const,
    queryFn: async () => (await api()).listForOwner(),
    staleTime: 30_000,
  });

/** «Nuevas» = las que el propietario todavía no abrió. */
export const countNew = (list: readonly Pick<OwnerInquiry, "openedAt">[] | undefined): number => list?.filter((i) => !i.openedAt).length ?? 0;

interface OpenDeps {
  mark?: (id: string) => Promise<void>;
  assign?: (url: string) => void;
  now?: () => string;
  /** Cuánto se espera a la base antes de salir a WhatsApp (la petición lleva keepalive y sigue aunque se salga). */
  wait?: number;
}

/**
 * «Abrir WhatsApp» en una consulta: deja de ser «Nueva» en la caché al momento, pide a la base marcarla (sin deshacer si
 * falla: se marca la próxima vez) y abre el chat con el cliente sin texto, porque la conversación ya existe.
 */
export async function openInquiry(client: QueryClient, userId: string, inquiry: Pick<OwnerInquiry, "id" | "openedAt" | "clientPhone">, deps: OpenDeps = {}) {
  const { mark = async (id) => (await api()).markOpened(id), assign = (url) => window.location.assign(url), now = () => new Date().toISOString(), wait = 400 } = deps;
  if (!inquiry.openedAt) {
    const openedAt = now();
    const key = inquiriesQuery(userId).queryKey;
    // Una lectura en vuelo traería la consulta aún sin abrir y pisaría el cambio.
    if (client.isFetching({ queryKey: key })) await client.cancelQueries({ queryKey: key });
    client.setQueryData<OwnerInquiry[]>(key, (list) => list?.map((i) => (i.id === inquiry.id ? { ...i, openedAt } : i)));
    const sent = mark(inquiry.id).catch(() => undefined);
    await Promise.race([sent, new Promise((resolve) => setTimeout(resolve, wait))]);
  }
  assign(waUrl(inquiry.clientPhone));
}
