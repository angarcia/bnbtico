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

/** «Nuevas» = las que el propietario todavía no vio ni abrió en WhatsApp. */
export const countNew = (list: readonly Pick<OwnerInquiry, "openedAt">[] | undefined): number => list?.filter((i) => !i.openedAt).length ?? 0;

interface SeenDeps {
  mark?: (id: string) => Promise<void>;
  now?: () => string;
}

interface OpenDeps extends SeenDeps {
  assign?: (url: string) => void;
  /** Cuánto se espera a la base antes de salir a WhatsApp (la petición lleva keepalive y sigue aunque se salga). */
  wait?: number;
}

type SeenInquiry = Pick<OwnerInquiry, "id" | "openedAt" | "updatedAt">;

/** Comparte el marcado optimista al ver la tarjeta y al abrir el chat antes de que se marque sola. */
export async function markInquirySeen(client: QueryClient, userId: string, inquiry: SeenInquiry, deps: SeenDeps = {}) {
  if (inquiry.openedAt) return;
  const { mark = async (id) => (await api()).markOpened(id), now = () => new Date().toISOString() } = deps;
  const key = inquiriesQuery(userId).queryKey;
  // Una lectura en vuelo traería la consulta aún sin abrir y pisaría el cambio.
  if (client.isFetching({ queryKey: key })) await client.cancelQueries({ queryKey: key });
  const current = client.getQueryData<OwnerInquiry[]>(key)?.find((i) => i.id === inquiry.id);
  if (current && (current.openedAt || current.updatedAt !== inquiry.updatedAt)) return;
  const openedAt = now();
  client.setQueryData<OwnerInquiry[]>(key, (list) => list?.map((i) => (i.id === inquiry.id ? { ...i, openedAt } : i)));
  await mark(inquiry.id).catch(() => undefined);
}

/** «Abrir WhatsApp» abre el chat sin texto, con una espera máxima si aún falta marcarla. */
export async function openInquiry(client: QueryClient, userId: string, inquiry: SeenInquiry & Pick<OwnerInquiry, "clientPhone">, deps: OpenDeps = {}) {
  const { assign = (url) => window.location.assign(url), wait = 400 } = deps;
  if (!inquiry.openedAt) await Promise.race([markInquirySeen(client, userId, inquiry, deps), new Promise((resolve) => setTimeout(resolve, wait))]);
  assign(waUrl(inquiry.clientPhone));
}
