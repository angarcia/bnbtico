// Pantalla 7 del asistente: fotos, sobre la rejilla compartida con el editor de fotos de una casa publicada
// (photo-grid.tsx). Aquí las fotos se registran en la casa en borrador y no hay pendientes.
import { useQueryClient } from "@tanstack/react-query";
import { MAX_PHOTOS, type Listing } from "../../domain/listing";
import { photosApi } from "../owner";
import { PhotoCounter, PhotoGrid, rereadOwnListing, type PhotoSource } from "./photo-grid";

export function PhotoUploader({ listing, userId }: { listing: Listing; userId: string }) {
  const client = useQueryClient();
  const n = listing.photos.length;
  const source: PhotoSource = {
    listingId: listing.id,
    photos: listing.photos,
    pending: [],
    counter: { text: `${n} de ${MAX_PHOTOS}`, tone: "ok" },
    room: MAX_PHOTOS - n,
    canAdd: true,
    register: async (folder) => (await photosApi()).add(listing.id, folder),
    remove: async (photo) => (await photosApi()).remove(photo.id),
    reorder: async (ids) => (await photosApi()).reorder(listing.id, ids),
    reread: rereadOwnListing(client, userId, listing.id),
  };
  // Hace falta al menos una foto para enviar (2026-10-30): la ayuda lo dice y se va con la primera foto.
  const header = (
    <>
      <div className="row between baseline">
        <h2>Fotos</h2>
        <PhotoCounter counter={source.counter} />
      </div>
      {n === 0 ? <p className="small muted photos-help">Necesita al menos una foto para enviarla a revisión.</p> : null}
    </>
  );
  return <PhotoGrid source={source} userId={userId} header={header} />;
}
