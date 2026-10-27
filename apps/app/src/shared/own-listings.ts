// Las casas propias en este teléfono (revisión UX A2): la ficha no manda `listing_view` cuando la abre su dueño, para que sus
// visitas no inflen «N visitas» de Inicio. La ficha del servidor no tiene sesión: la lista vive en el almacenamiento local,
// la escribe la lista de Mis casas y se borra al cerrar sesión. Solo códigos CT-####, nada personal.
import { webStore } from "../data/storage";

const KEY = "bnbtico-mis-casas";

export function rememberOwnListings(publicIds: readonly string[]): void {
  if (typeof window === "undefined") return;
  if (publicIds.length) webStore("local").setItem(KEY, publicIds.join(","));
  else webStore("local").removeItem(KEY);
}

export function forgetOwnListings(): void {
  if (typeof window !== "undefined") webStore("local").removeItem(KEY);
}

export function isOwnListing(publicId: string): boolean {
  if (typeof window === "undefined") return false;
  return (webStore("local").getItem(KEY) ?? "").split(",").includes(publicId);
}
