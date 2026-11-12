import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LOCAL_USER, editorListingQuery, useEditor } from "./editor-port";
import { useSession } from "./session";

export function useUserId(): string {
  return useSession().session?.userId ?? "";
}

/** La casa que se edita: la propia o, en las rutas del admin, la de otro (client/editor-port.ts). */
export function useOwnListing(id: string) {
  const session = useUserId();
  const port = useEditor();
  // Sin cuenta, el borrador del teléfono (publicar hasta las fotos): su caché va con un «usuario» propio.
  const userId = port.local ? LOCAL_USER : session;
  const client = useQueryClient();
  const [options] = useState(() => editorListingQuery(port, userId, id, client));
  return { userId, query: useQuery({ ...options, enabled: !!userId }) };
}
