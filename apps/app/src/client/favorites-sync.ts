// Favoritos de la cuenta: al ingresar (y al abrir la app con sesión) los del teléfono suben y el teléfono se queda con
// la mezcla. Cerrar sesión no borra nada: la lista es «de este teléfono».
import { favoritesStore, syncFavorites } from "../shared/favorites-store";
import { onSignedIn, sessionState } from "./session";

const sync = () => void import("./supabase-data").then((m) => syncFavorites(favoritesStore, m.favoritesApi())).catch(() => {});

export function startFavoritesSync(): void {
  onSignedIn(sync);
  if (sessionState().status === "signed-in") sync();
}
