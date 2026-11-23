// «¿Qué es 3bstays?» (trozo diferido que-es-3bstays-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva un
// enlace o una imagen en medio, la función recibe esas piezas y devuelve la frase entera en trozos.

export const loading = "Cargando…";
export const home = "3bstays, inicio";
export const logo = "3bstays";
export const guestTitle = "¿Busca alojamiento en Costa Rica?";
export const guestLine = <T,>({ link, logo }: { link: T; logo: T }) => ["Encuentre ", link, " su alojamiento ", logo] as const;
export const guestLink = "aquí";
export const guestLinkLabel = "Aquí, explorar alojamientos";
export const slogan = "Bueno, bonito y bien tico.";
export const intro = "Escriba directo al anfitrión por WhatsApp, sin comisiones de plataforma.";
export const ownerTitle = "¿Tiene una casa en Costa Rica?";
export const ownerText = ({ free }: { free: boolean }) =>
  free
    ? "Publique su casa gratis y reciba consultas por WhatsApp, sin comisiones ni cargos por reserva."
    : "Publique su casa y reciba consultas por WhatsApp, sin comisiones ni cargos por reserva.";
export const publish = "Publicar mi casa";
export const offerLabel = "Oferta de lanzamiento para nuevos anfitriones";
export const priceTitle = ({ months }: { months?: number | null }) => (months ? `Anuncie su casa gratis durante ${months} meses` : "Suscripción por casa activa");
export const rate = <T,>({ fee, after }: { fee: T; after: boolean }) => [after ? "Después, " : "", fee, " al mes por casa activa"] as const;
export const pays = "Una reserva de fin de semana lo paga.";
export const terms = "Sin comisiones ni permanencia.";
export const offerLink = ({ months }: { months?: number | null }) => (months ? `Publique ahora y obtenga ${months} meses gratis` : "Publique su casa ahora");
