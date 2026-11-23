// La tarjeta y la fila para publicar, con la oferta (trozo diferido publish-promo-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const title = "¿Tiene una casa en el Caribe?";
export const offer = <T,>({ months, places }: { months: number; places: T }) => [`Publíquela gratis ${months} meses. `, places] as const;
export const places = ({ remaining, size }: { remaining: number; size: number }) => `Quedan ${remaining} de ${size} plazas.`;
export const paid = ({ fee }: { fee: string }) => `Publíquela por ${fee} al mes.`;
export const free = "Publíquela gratis.";
export const note = ({ fee }: { fee: string | null }) =>
  fee ? `Después, ${fee} al mes por casa. Sin comisiones; los clientes le escriben por WhatsApp.` : "Sin comisiones; los clientes le escriben por WhatsApp.";
export const button = ({ free }: { free: boolean }) => (free ? "Publicar mi casa gratis" : "Publicar mi casa");
export const rowTitle = ({ free }: { free: boolean }) => (free ? "¿Quiere publicar su casa gratis?" : "¿Quiere publicar su casa?");
export const rowOffer = ({ months, remaining, size }: { months: number; remaining: number; size: number }) => `Gratis ${months} meses · quedan ${remaining} de ${size} plazas`;
export const rowPaid = ({ fee }: { fee: string }) => `${fee} al mes por casa, sin comisiones`;
export const rowFree = "Sin comisiones por alquiler";
