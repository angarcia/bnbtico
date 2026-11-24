// Piezas de la ficha (mapa, fotos, compartir, favorito, descripción). Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.

export const approxMap = "Mapa con la zona aproximada";
export const approxNote = "Ubicación aproximada. La dirección exacta la comparte el anfitrión.";
export const currency = "Moneda de los precios";
export const close = "Cerrar";
export const description = "Descripción";
export const seeMore = "Ver más";
export const favorite = ({ saved }: { saved: boolean }) => (saved ? "Quitar de favoritos" : "Guardar en favoritos");
export const photos = ({ title }: { title: string }) => `Fotos de ${title}`;
export const photoAlt = ({ title, n }: { title: string; n: number }) => `${title}, foto ${n}`;
export const photoPosition = ({ n, total }: { n: number; total: number }) => `Foto ${n} de ${total}`;
export const share = ({ copied }: { copied: boolean }) => (copied ? "Enlace copiado" : "Compartir ficha");
export const monthly = <T,>({ amount }: { amount: T }) => ["Mensual: ", amount, " / mes"] as const;
export const colones = "Colones";
export const dollars = "Dólares";
