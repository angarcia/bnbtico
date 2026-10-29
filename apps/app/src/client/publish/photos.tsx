// Pantalla 7 del asistente: fotos, sobre la rejilla compartida con el editor de fotos de una casa publicada
// (photo-grid.tsx). Aquí las fotos se registran en la casa en borrador y no hay pendientes.
import { useQueryClient } from "@tanstack/react-query";
import { MAX_PHOTOS, MIN_PHOTOS, missingPhotosLabel as missingLabel, type Listing } from "../../domain/listing";
import { photosApi } from "../owner";
import { PhotoCounter, PhotoGrid, rereadOwnListing, type PhotoSource } from "./photo-grid";

export function PhotoUploader({ listing, userId }: { listing: Listing; userId: string }) {
  const client = useQueryClient();
  const n = listing.photos.length;
  const source: PhotoSource = {
    listingId: listing.id,
    photos: listing.photos,
    pending: [],
    counter: { text: `${n} de ${MIN_PHOTOS}–${MAX_PHOTOS}`, tone: n < MIN_PHOTOS ? "short" : "ok" },
    room: MAX_PHOTOS - n,
    canAdd: true,
    register: async (folder) => (await photosApi()).add(listing.id, folder),
    remove: async (photo) => (await photosApi()).remove(photo.id),
    reorder: async (ids) => (await photosApi()).reorder(listing.id, ids),
    reread: rereadOwnListing(client, userId, listing.id),
  };
  const header = (
    <>
      <div className="row between baseline">
        <h2>Fotos</h2>
        <PhotoCounter counter={source.counter} />
      </div>
      {/* Con menos de 5 se puede seguir: el mínimo se pide al enviar (revisión UX C4). */}
      {n < MIN_PHOTOS ? <span className="small photos-missing">{missingLabel(MIN_PHOTOS - n)} · puede añadirlas al final</span> : null}
    </>
  );
  return <PhotoGrid source={source} userId={userId} header={header} />;
}
