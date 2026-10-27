// Consulta privada de la cuenta. Solo existe con sesión; se persiste en el dispositivo mientras la sesión dure y se
// borra al cerrarla (ver persist.ts y shell.tsx).
import { queryOptions } from "@tanstack/react-query";
import { authApi } from "./session";

/** Claves de consultas privadas (cuenta, casas, consultas, calendario y suscripción del propietario, cola del admin): solo se persisten con sesión y se borran al cerrarla. */
export const PRIVATE_KEYS = new Set(["account", "inquiries", "own-listings", "own-listing", "own-resumable", "own-stats", "calendar", "billing", "admin-queue", "admin-listing"]);

export const accountQuery = (userId: string) =>
  queryOptions({
    queryKey: ["account", userId] as const,
    queryFn: async () => (await authApi()).profile(),
    staleTime: 5 * 60_000,
  });
