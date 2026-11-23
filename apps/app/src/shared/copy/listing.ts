// Ficha pública, que pintan el worker y la SPA. Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.
// Donde la frase lleva marcado en medio, la función recibe esa pieza y devuelve la frase entera en trozos.

export const back = "Volver a Explorar";
export const unavailable = "No disponible por ahora";
export const contact = "Contactar por WhatsApp";
export const loadingContact = "Cargando contacto…";
export const availability = "Disponibilidad";
export const calendarUnavailable = "Calendario no disponible";
export const host = ({ verified }: { verified: boolean }) => (verified ? "Anfitrión · WhatsApp verificado" : "Anfitrión");
export const hostVerifiedHint = "Confirmamos que este número recibe mensajes de WhatsApp";
export const negotiable = "A negociar";
export const negotiableInline = "a negociar";
export const perMonth = ({ amount }: { amount: string }) => `${amount} / mes`;
export const perMonthSuffix = "/ mes";
export const parking = ({ paid }: { paid: boolean }) => (paid ? "Parqueo de pago" : "Parqueo gratis");
export const approxArea = "Zona aproximada";
export const fxHint = ({ rate, day }: { rate: string; day: string }) => `Orientativo: ≈ ${rate} por US$1, tipo de referencia del ${day}`;
export const publishedBy = <T,>({ owner, verified }: { owner: T; verified: boolean }) =>
    ["Publicada por ", owner, `${verified ? " · WhatsApp verificado" : ""}. Sin comisiones: fechas, precio y pago los acuerda directamente con el anfitrión. 3bstays no procesa pagos.`] as const;
export const priceNote = "Precios orientativos: el precio final lo acuerda con el anfitrión.";
