// Zona del admin: anuncios, casas, segundo código, revisar un anuncio y una edición (todo en el trozo diferido admin-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

import { plural } from "../../../domain/plural";

// Común
export const adminTag = "Admin";
export const notAdminTitle = "Esta sección es solo para el equipo de 3bstays";
export const notAdminText = "Si busca una casa, vuelva a Explorar.";
export const explore = "Ir a Explorar";
export const notify = ({ name }: { name: string }) => `Avisar a ${name || "el anfitrión"} por WhatsApp`;
export const nothingHere = "Nada por aquí.";
export const noName = "Sin nombre";
export const edit = "Editar";
export const editSummary = ({ summary }: { summary: string }) => `Edición: ${summary}`;
export const verifiedOwner = ({ name }: { name: string }) => `${name} · WhatsApp verificado`;
export const noDescription = "Sin descripción";
export const noDescriptionDot = "Sin descripción.";
export const noNote = "Sin nota adicional.";
export const approve = "Aprobar";
export const askChanges = "Pedir cambios";
export const before = "Antes";
export const now = "Ahora";

// Anuncios
export const listingsTitle = "Anuncios";
export const toReview = "por revisar";
export const withChanges = "con cambios";
export const active = "activas";
export const filterListings = "Filtrar anuncios";
export const outcome = ({ title, text, failed }: { title: string; text: string; failed: boolean }) =>
  failed ? `No se guardó la decisión sobre «${title}»: ${text}` : `«${title}»: ${text}`;
export const editsToReview = "Ediciones por revisar";
export const loadingQueue = "Cargando la cola";
export const noPending = "No hay anuncios pendientes.";
export const queueFoot = "Las más antiguas primero. El anfitrión ve la decisión en Mis casas; avísele por WhatsApp con el botón.";

// Casas
export const housesTitle = "Casas";
export const searchHouses = "Buscar casas";
export const searchPlaceholder = "Nombre, CT-#### o anfitrión";
export const filterHouses = "Filtrar casas";
export const loadingHouses = "Cargando las casas";
export const noMatch = "Ninguna casa coincide con la búsqueda.";
export const noApproved = "Todavía no hay casas aprobadas.";
export const housesList = "Casas";
export const housesFoot = "Toque una casa para ver sus datos, editarla, pausarla, bloquearla o eliminarla.";
export const drafts = "Borradores sin enviar";
export const publicPage = "Ver ficha pública";
export const listingData = "Ver datos del anuncio";
export const editHouse = "Editar casa";
export const editCalendar = "Editar calendario";
export const resume = "Reanudar";
export const unblock = "Desbloquear";
export const pause = "Pausar";
export const block = "Bloquear";
export const onlyPublished = "Solo se pausa o se bloquea una casa publicada.";
export const deleteHouse = "Eliminar casa";
export const deleteConfirm = <T,>({ id }: { id: T }) => ["Para confirmar, escriba ", id] as const;
export const cancel = "Cancelar";

// Segundo código
export const codeTitle = "Segundo código";
export const loadingAccount = "Cargando su cuenta";
export const codeHeading = ({ enrol }: { enrol: boolean }) => (enrol ? "Vincule su app de autenticación" : "Confirme que es usted");
export const enrolText =
  "Para revisar anuncios le pedimos un segundo código. Escanee este código QR con su app de autenticación (Google Authenticator, 1Password u otra) y escriba abajo el código de 6 dígitos que le muestre.";
export const codeText = "Abra su app de autenticación y escriba el código de 6 dígitos de 3bstays.";
export const qrAlt = "Código QR para su app de autenticación";
export const cantScan = "¿No puede escanearlo? Escriba esta clave en la app:";
export const secretLabel = "Clave para la app de autenticación";
export const verify = ({ busy, preparing }: { busy: boolean; preparing: boolean }) => (busy ? "Verificando…" : preparing ? "Preparando…" : "Verificar y entrar");

// Revisar un anuncio
export const reviewTitle = "Revisar anuncio";
export const asGuest = "Ver como cliente";
export const listingNotFound = "No encontramos ese anuncio.";
export const loadingListing = "Cargando el anuncio";
export const photosCount = ({ count }: { count: number }) => plural(count, { one: `${count} foto`, other: `${count} fotos` });
export const photoAlt = ({ n }: { n: number }) => `Foto ${n}`;
export const noPhotos = "Sin fotos";
export const proposedZone = "Zona propuesta por el anfitrión";
export const description = "Descripción";
export const noPhotosNote = "Sin fotos: solo puede pedir cambios.";
export const approvePublish = "Aprobar y publicar";
export const noteRequired = "(obligatorio si pide cambios)";
export const noteLabel = <T,>({ hint }: { hint: T }) => ["Mensaje para el anfitrión ", hint] as const;
export const notePlaceholder = "Ej.: la foto 4 muestra un número de teléfono; súbala sin él.";
export const monthly = ({ amount }: { amount: string | null }) => (amount === null ? "mensual a negociar" : `mensual ${amount}`);
export const noPrice = "Sin precio";
export const parking = ({ paid }: { paid: boolean }) => (paid ? "Parqueo de pago" : "Parqueo gratuito");
export const noFeatures = "Sin características marcadas";
export const verifiedPhone = <T,>({ phone }: { phone: T }) => ["WhatsApp verificado · ", phone] as const;
export const checklist = "Antes de decidir";
export const checkPhotos = "Las fotos son de la casa y sin teléfonos ni logos";
export const checkText = "La descripción no tiene enlaces ni publicidad";
export const checkPrice = "Zona y precio coherentes";

// Revisar una edición
export const editTitle = "Revisar edición";
export const editNotFound = "No encontramos esa edición.";
export const loadingEdit = "Cargando la edición";
export const waitingOwner = "Lo pendiente tiene cambios pedidos: espera al anfitrión.";
export const name = "Nombre";
export const kind = "Tipo";
export const location = "Ubicación";
export const newPhotos = "Fotos nuevas";
export const newPhoto = ({ n }: { n: number }) => `Foto nueva ${n}`;
export const unchanged = "Lo que no cambia";
export const approvedPhotos = ({ count }: { count: number }) => plural(count, { one: `${count} foto aprobada`, other: `${count} fotos aprobadas` });
export const mapFallback = ({ before, after }: { before: string; after: string }) => `Antes: ${before || "sin ubicación"} · Ahora: ${after}`;
export const changesAsked = ({ note }: { note: string }) => `Cambios pedidos: ${note || "sin nota adicional."}`;
export const decideNote = "Mensaje para el anfitrión (obligatorio si pide cambios)";
export const decidePlaceholder = "Mensaje para el anfitrión si pide cambios";
export const tabReview = ({ count }: { count: number }) => (count ? `Por revisar · ${count}` : "Por revisar");
export const tabChanges = "Cambios pedidos";
export const tabRejected = "Rechazados";
export const pauseTitle = "Pausar casa";
export const pauseBody = "Sale de Explorar y su enlace deja de funcionar. El anfitrión la sigue viendo y editando, con el motivo; usted la reanuda cuando todo esté en orden. La suscripción no cambia.";
export const blockTitle = "Bloquear casa";
export const blockBody = "Igual para el público. El anfitrión verá el motivo y «Escribir a 3bstays», no podrá editarla ni reactivarla y su suscripción se para: sin cobro ni avisos mientras esté bloqueada.";
export const deleteTitle = "Eliminar casa";
export const deleteBody = "Desaparece para todos, también para el anfitrión y de los favoritos de los clientes. Los datos, fotos y consultas quedan guardados, ocultos. No hay «deshacer» en la app.";
export const reasonForHost = "Motivo (lo verá el anfitrión)";
export const reasonForLog = "Motivo (queda en el registro)";
export const codeLength = "El código tiene 6 dígitos.";
export const noKind = "Sin tipo";
export const mapLabel = ({ before, after }: { before: string; after: string }) => `Mapa con la ubicación de antes (${before}) y la de ahora (${after})`;
export const savedApprove = "Aprobada y publicada. El enlace ya funciona.";
export const savedChanges = "Cambios pedidos. El anfitrión verá su mensaje.";
export const donePause = "Casa pausada";
export const doneResume = "Casa reanudada";
export const doneBlock = "Casa bloqueada";
export const doneUnblock = "Casa desbloqueada";
export const doneDelete = "Casa eliminada";
export const bathShared = ({ shared }: { shared: boolean }) => (shared ? "baño compartido" : "baño privado");
export const people = ({ count }: { count: number }) => `${count} personas`;
export const rooms = ({ count }: { count: number }) => `${count} hab`;
export const baths = ({ count }: { count: number }) => plural(count, { one: `${count} baño`, other: `${count} baños` });
export const untitled = "Sin nombre";
