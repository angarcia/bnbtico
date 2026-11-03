// Puerto de la edición de una casa (ronda de Ana del 2 nov, ticket 10): el asistente, la ficha editable, «Editar un dato»,
// las fotos y el calendario leen y guardan a través de él, sin saber de quién es la casa. Por defecto es el del anfitrión
// (sus adaptadores de siempre); en las rutas del admin (screens/asistir.tsx) se cambia por el de Ana, que guarda con las
// RPCs admin_* al momento y sin revisión. Mismas pantallas, mismas reglas: solo cambian el adaptador, las rutas y el copy.
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { OwnerCalendarApi, OwnerListingsApi, PhotosApi } from "../domain/api";
import { calendarApi } from "./calendar-days";
import { OWNER_STALE_MS, api, loadedApi, ownListingQuery, photosApi } from "./owner";
import { savesSettled } from "./save-queue";

export type EditorListings = Pick<OwnerListingsApi, "getOwn" | "saveStep" | "submit" | "updateLive" | "saveEdit" | "discardEditField">;
export type EditorPhotos = Pick<PhotosApi, "add" | "remove" | "reorder" | "addEditPhoto" | "removeEditPhoto" | "reorderEditPhotos">;

export interface EditorPort {
  /** Ana (el admin): lo que guarda se publica al momento, sin revisión, y no hay «Descartar» de lo pendiente del anfitrión. */
  admin: boolean;
  listings(): Promise<EditorListings>;
  /** El adaptador si ya está cargado: el asistente guarda en el mismo tick de «Continuar». */
  loaded(): EditorListings | null;
  photos(): Promise<EditorPhotos>;
  calendar(): Promise<OwnerCalendarApi>;
  /** Rutas de cada zona, con los mismos parámetros y la misma búsqueda. */
  step: "/propietario/publicar/$id/$paso" | "/admin/casas/$id/publicar/$paso";
  field: "/propietario/casas/$id/editar/$campo" | "/admin/casas/$id/editar/$campo";
  ficha: "/propietario/casas/$id" | "/admin/casas/$id";
  close: "/propietario/casas" | "/admin/borradores";
}

export const ownerPort: EditorPort = {
  admin: false,
  listings: api,
  loaded: loadedApi,
  photos: photosApi,
  calendar: calendarApi,
  step: "/propietario/publicar/$id/$paso",
  field: "/propietario/casas/$id/editar/$campo",
  ficha: "/propietario/casas/$id",
  close: "/propietario/casas",
};

export const EditorContext = createContext<EditorPort>(ownerPort);
export const useEditor = (): EditorPort => useContext(EditorContext);

/** La casa que se edita, con la clave de siempre (`own-listing`, la que tocan las escrituras optimistas y las relecturas).
 *  La del admin se lee con su adaptador, que no filtra por dueño. */
export const editorListingQuery = (port: EditorPort, userId: string, id: string, client: QueryClient) =>
  port.admin
    ? queryOptions({
        queryKey: ["own-listing", userId, id] as const,
        queryFn: async () => {
          await savesSettled(id);
          return (await port.listings()).getOwn(id);
        },
        staleTime: OWNER_STALE_MS,
      })
    : ownListingQuery(userId, id, client);
