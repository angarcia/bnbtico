// Consulta privada de la cuenta. Solo existe con sesión; se persiste en el dispositivo mientras la sesión dure y se
// borra al cerrarla (ver persist.ts y shell.tsx).
import { queryOptions } from "@tanstack/react-query";
import { authApi } from "./session";

export { PERSISTED_PRIVATE_KEYS as PRIVATE_KEYS } from "./query-policy";

export const accountQuery = (userId: string) =>
  queryOptions({
    queryKey: ["account", userId] as const,
    queryFn: async () => (await authApi()).profile(),
    staleTime: 5 * 60_000,
  });
