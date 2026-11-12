import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serviceClient } from "../../db/local";

const FOTOS = new URL("../../../../../design/pantallas/fotos/", import.meta.url).pathname;
// Una foto real por variante: beach.jpg (1000 px, 63 KB) pesa lo que una variante de 800 a calidad 0,8.
const PHOTOS = ["beach.jpg", "loft.jpg", "kitchen.jpg", "bedroom.jpg", "garden.jpg"].map((f) => readFileSync(join(FOTOS, f)));

/** Pasa las fotos sembradas por el arnés (nombres antiguos, sin objeto) a carpetas `<casa>/<uuid>` con sus tres variantes
 * subidas a Storage local, como las deja la subida real (ticket 08). Para medir con fotos de verdad. */
export async function realPhotos(listingId: string) {
  const db = serviceClient();
  const { data, error } = await db.from("listing_photos").select("id, position").eq("listing_id", listingId).order("position");
  if (error) throw error;
  for (const [i, row] of data.entries()) {
    const folder = `${listingId}/${randomUUID()}`;
    for (const size of [480, 800, 1600]) {
      const up = await db.storage.from("listings").upload(`${folder}/${size}.jpg`, PHOTOS[i % PHOTOS.length]!, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
      if (up.error) throw up.error;
    }
    const upd = await db.from("listing_photos").update({ path: folder }).eq("id", row.id);
    if (upd.error) throw upd.error;
  }
}
