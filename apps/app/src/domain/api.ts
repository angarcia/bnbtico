// Interfaces de datos de la app. Dos implementaciones: el adaptador PostgREST (único módulo que importa supabase-js)
// y un fake en memoria que aplica las mismas reglas de propiedad y estado. Una suite de contrato corre contra las dos.
// Todas las operaciones fallan con DomainError (mensaje en español).
import type { CalendarChange, CalendarDay } from "./calendar";
import type { FavoriteEntry } from "./favorites";
import type { Filters } from "./filters";
import type { VariantSize } from "./image";
import type { LinkState, Listing, ListingDraft, Photo, PublicListing, SitemapEntry, Step } from "./listing";
import type { InquiryDraft, OwnerInquiry } from "./inquiry";
import type { AdminQueue, QueueItem, ReviewDecision } from "./review";

export type { AdminQueue, QueueItem, ReviewDecision } from "./review";

export interface PublicListingsApi {
  /** Catálogo con filtros; más recientes primero, como mucho 60. */
  searchPublic(filters: Filters): Promise<PublicListing[]>;
  /** Ficha pública por `CT-####`; null si no está activa. */
  getPublic(publicId: string): Promise<PublicListing | null>;
  /** Las casas activas de una lista de `CT-####` en una sola consulta (Favoritos); las demás no vuelven. Sin orden. */
  getManyPublic(publicIds: string[]): Promise<PublicListing[]>;
  linkState(publicId: string): Promise<LinkState>;
  /** Provincias con al menos una casa activa. */
  provincesWithListings(): Promise<string[]>;
  /** Casas activas para el sitemap, la más reciente primero. */
  sitemap(): Promise<SitemapEntry[]>;
  /** Cuántas casas hay activas (plazas ocupadas de la oferta de lanzamiento). */
  countActive(): Promise<number>;
  /** Días que difieren del habitual (ocupados o con ★) de una casa activa, de hoy (Costa Rica) a hoy + 365, en orden.
   *  `[]` si la casa no está publicada. RPC public_listing_days. */
  getPublicDays(publicId: string): Promise<CalendarDay[]>;
}

/**
 * Casas del propietario con sesión. Las reglas las pone la base (RLS, trigger listings_protect, política
 * listings_owner_delete, RPC set_listing_available); el fake las repite con los mismos mensajes.
 */
export interface OwnerListingsApi {
  /** Las casas propias en cualquier estado, la más reciente primero (el admin tampoco ve aquí las ajenas). */
  listOwn(): Promise<Listing[]>;
  /** null si no existe o es de otro propietario. */
  getOwn(id: string): Promise<Listing | null>;
  /** Borrador nuevo con su CT-####, el WhatsApp del perfil y todo lo demás vacío (nada preseleccionado). */
  createDraft(): Promise<{ id: string; publicId: string }>;
  /** El borrador pendiente para retomar desde cualquier dispositivo: el más reciente que nunca se revisó; null si no hay. */
  findResumable(): Promise<Listing | null>;
  /**
   * Guarda una pantalla del asistente: lee el borrador del servidor, mezcla el parche, valida esa pantalla (`planStep`,
   * con el número de fotos del servidor) y escribe todas las columnas que cambian, también las que limpia `normalize`.
   * Devuelve el borrador guardado. Fuera de borrador o cambios pedidos falla con el mensaje del trigger listings_protect.
   * Con `known` (el borrador que ya tiene el navegador) no lo relee: el guardado es una sola petición, que con keepalive
   * llega aunque la app se cierre justo después de «Continuar». La base sigue protegiendo estado y dueño, y submit_listing
   * vuelve a comprobarlo todo al enviar.
   * (Firma ampliada en el ticket 07: `step`, porque la validación depende de la pantalla, y `known`.)
   */
  saveStep(id: string, step: Step, patch: Partial<ListingDraft>, known?: Listing): Promise<Listing>;
  /** Envía a revisión con la RPC submit_listing; sus mensajes en español pasan tal cual. */
  submit(id: string): Promise<void>;
  /** Activa, con cambios pedidos o rechazada → borrador (deja de verse hasta la nueva aprobación). */
  reopenForEdit(id: string): Promise<void>;
  /**
   * «Disponible para consultas», solo con la casa activa (RPC set_listing_available). Al cerrar, `reopenAt` opcional
   * (`YYYY-MM-DD`, de mañana a hoy + 365): esa noche la base la abre sola. Abrir a mano borra la fecha; una fecha al abrir
   * se rechaza. Ninguna de las dos cosas cambia el estado de la casa.
   */
  setAvailable(id: string, available: boolean, reopenAt?: string | null): Promise<void>;
  /** Solo un borrador que nunca se revisó; si no, el error dice por qué. */
  deleteDraft(id: string): Promise<void>;
}

/** Las tres variantes JPEG de una foto, ya generadas en el navegador. */
export type PhotoVariants = Record<VariantSize, Blob>;

export const UPLOAD_FAILED_MESSAGE = "No pudimos subir esa foto. Intente de nuevo.";

/**
 * Fotos de una casa en borrador o con cambios pedidos (ticket 08). Los objetos van directo del navegador a Storage con la
 * sesión del dueño; la base registra, ordena y pone los topes (RPCs add/remove/reorder_listing_photo(s), máximo 15 fotos,
 * 45 objetos por carpeta de casa). Firma decidida en el ticket 08: `upload` recibe las tres variantes de una foto (no un
 * archivo) y `discard` limpia lo subido que no llegó a registrarse.
 */
export interface PhotosApi {
  /**
   * Sube las tres variantes a `<casa>/<uuid>/{480,800,1600}.jpg` con caché de un año y devuelve la carpeta `<casa>/<uuid>`.
   * Como mucho tres objetos a la vez entre todas las fotos que suba esta instancia; `onUploaded` avisa de cada objeto.
   * Si alguno falla, borra los que sí subió y falla con UPLOAD_FAILED_MESSAGE.
   */
  upload(listingId: string, variants: PhotoVariants, onUploaded?: () => void): Promise<string>;
  /** Registra la carpeta como una foto al final (posición calculada en la base). Más de 15: «Máximo 15 fotos.». */
  add(listingId: string, folder: string): Promise<Photo>;
  /** Borra los objetos de una carpeta subida que no se registró (por ejemplo, porque se llegó al tope). */
  discard(folder: string): Promise<void>;
  /** Quita la fila (las demás se recompactan) y después sus objetos: las tres variantes o el archivo de una foto anterior. */
  remove(photoId: string): Promise<void>;
  /** El orden completo de una vez; la primera es la portada. Una lista que no es la de la casa falla sin cambiar nada. */
  reorder(listingId: string, photoIds: string[]): Promise<void>;
}

/**
 * Revisión del admin (ticket 09). Solo un admin con el segundo factor (sesión aal2) ve y decide: lo exige la base (RLS y
 * review_listing). Firma decidida en el ticket 09: `queue` devuelve la cola ya separada por estado. Sin ser admin no se
 * obtiene nada (cola vacía, `get` null, `review` con el mensaje de la base); un admin en aal1 recibe
 * REVIEW_MESSAGES.mfaRequired en las tres.
 */
export interface AdminListingsApi {
  queue(): Promise<AdminQueue>;
  /** Una casa en cualquier estado, con su propietario; null si no existe. */
  get(id: string): Promise<QueueItem | null>;
  /** RPC review_listing. Motivo obligatorio para pedir cambios o rechazar, hasta 2000 caracteres. */
  review(id: string, decision: ReviewDecision, note: string): Promise<void>;
}

/**
 * Calendario del propietario (fase 4). Las filas de listing_days solo se escriben con la RPC save_listing_days, que
 * valida y guarda todo o nada (mismos mensajes que CALENDAR_MESSAGES y validateChange); el fake aplica applyChange.
 * Sin sesión, las dos fallan con «Su sesión venció. Ingrese de nuevo.» (kind `session`) antes de llegar a la red.
 */
export interface OwnerCalendarApi {
  /** Los días guardados de una casa propia, de hoy (Costa Rica) a hoy + 365, en orden; `[]` si no es del usuario. */
  days(listingId: string): Promise<CalendarDay[]>;
  /** Guarda el cambio en todos los días a la vez o en ninguno; si la casa está activa, la ficha pública se refresca. */
  save(listingId: string, change: CalendarChange): Promise<void>;
}

export interface ListingsApi extends PublicListingsApi, OwnerListingsApi {
  photos: PhotosApi;
  admin: AdminListingsApi;
}

// ---------- Consultas y favoritos (fase 3) ----------

/**
 * Consultas por WhatsApp. Las reglas las pone la base (RPCs create_inquiry, mark_inquiry_opened y owner_inquiries; la
 * tabla no se escribe por REST); el fake las repite con los mismos mensajes (INQUIRY_MESSAGES). Sin sesión, todas fallan
 * con «Su sesión venció. Ingrese de nuevo.» (kind `session`) antes de llegar a la red.
 */
export interface InquiriesApi {
  /**
   * Registra (o renueva, si el mismo cliente escribió a esa casa en los últimos 7 días) la consulta y devuelve el WhatsApp
   * de la casa: es el único camino por el que un cliente obtiene ese número. Valida en la base (casa publicada y
   * disponible, no propia, fechas, personas, mensaje, 20 casas distintas por día).
   */
  create(publicId: string, draft: InquiryDraft): Promise<{ inquiryId: string; whatsappPhone: string }>;
  /** Mis consultas: las de las casas del propietario de la sesión, con nombre y WhatsApp del cliente; la más reciente primero. */
  listForOwner(): Promise<OwnerInquiry[]>;
  /** El propietario abrió el chat: la consulta deja de ser «Nueva». Solo el dueño; si no, «No encontramos esa consulta.». */
  markOpened(id: string): Promise<void>;
}

/**
 * Favoritos sincronizados de la cuenta (solo con sesión; los anónimos viven en el teléfono y nunca tocan la red).
 * Solo se guardan casas publicadas; las que dejan de estarlo no vuelven en `list`.
 * (Desviación del spec: `list` devuelve también la fecha de guardado, para mezclar con los del teléfono por fecha.)
 */
export interface FavoritesApi {
  /** Los de la cuenta, el más reciente primero. */
  list(): Promise<FavoriteEntry[]>;
  /** Idempotente. Una casa no publicada: «Esta casa ya no está publicada.». */
  add(publicId: string): Promise<void>;
  /** Idempotente. */
  remove(publicId: string): Promise<void>;
  /** Para la mezcla al ingresar: añade los que estén publicados e ignora el resto, sin fallar por ellos. */
  addMany(publicIds: string[]): Promise<void>;
}

// ---------- Cuenta ----------
export interface Account {
  id: string;
  name: string;
  phone: string; // E.164
  phoneVerified: boolean;
  email: string | null;
  description: string | null;
  /** Lo pone la base al aprobar la primera casa (review_listing); la app solo lo lee. */
  isOwner: boolean;
  /** Lo marca `seed_admin` (local/pruebas) o una sentencia SQL; nunca la app. */
  isAdmin: boolean;
}

export type StartInput = { mode: "register"; name: string; phone: string } | { mode: "login"; phone: string };

export interface PendingOtp {
  mode: "register" | "login";
  name?: string;
  phone: string;
  /** Momento del último envío (ms), para el enfriamiento de 30 s y la caducidad de 10 min. */
  sentAt: number;
}

export interface Session {
  userId: string;
  /** Nivel de autenticación del JWT: aal2 tras el segundo código del admin. */
  aal: "aal1" | "aal2";
}

/** Solo lo que el usuario puede cambiar de su perfil: la base concede update en estas tres columnas y nada más. */
export type ProfilePatch = Partial<Pick<Account, "name" | "email" | "description">>;

/**
 * Cuenta y sesión. La sesión vive en el dispositivo (detrás de un adaptador de almacenamiento) y sobrevive a reinicios
 * hasta `logout`, que la revoca en el servidor. El número pendiente de verificar vive diez minutos en el almacenamiento
 * de la pestaña.
 *
 * Cambios respecto a la declaración del ticket 02 (ticket 05):
 * - `ProfilePatch` ya no incluye `isOwner`: la columna no se puede actualizar desde la app (grant por columna) y la marca
 *   la base al aprobar una casa. El modo propietario de la interfaz es estado del cliente.
 * - `onSessionChange`: la sesión puede terminar sola (refresco rechazado, cierre en otra pestaña) y la interfaz debe enterarse.
 * - `enrolMfa`/`verifyMfa` pasan a `MfaApi` (ticket 09), para que los adaptadores de este ticket no lleven métodos vacíos.
 */
export interface AuthApi {
  /**
   * Valida nombre y número y pide el código por WhatsApp. Falla si no pasaron 30 s desde el último envío a ese número.
   * `captchaToken` (ticket 11): token de Turnstile para la protección de bots de Supabase Auth; sin él si no está configurada.
   */
  start(input: StartInput, captchaToken?: string): Promise<void>;
  pending(): PendingOtp | null;
  /** Comprueba el código del número pendiente y abre sesión. */
  verify(code: string): Promise<Account>;
  resend(captchaToken?: string): Promise<void>;
  cancel(): void;
  session(): Promise<Session | null>;
  onSessionChange(listener: (session: Session | null) => void): () => void;
  profile(): Promise<Account | null>;
  updateProfile(patch: ProfilePatch): Promise<Account>;
  logout(): Promise<void>;
}

/**
 * El factor del admin: ya verificado (basta un código de la app) o recién inscrito, con lo que necesita la app de
 * autenticación para darlo de alta: el QR (`data:image/svg+xml`, para un `<img>`) y el mismo secreto en base32.
 */
export type MfaFactor = { factorId: string; verified: true } | { factorId: string; verified: false; qrCode: string; secret: string };

/**
 * Segundo factor del admin (ticket 09; app de autenticación TOTP desde el 2026-10-23, porque el MFA por teléfono de
 * Supabase es solo del plan Pro). Tras verificar un código la sesión pasa a aal2 (`Session.aal`) y lo avisa
 * `onSessionChange`. Clientes y propietarios no lo usan.
 */
export interface MfaApi {
  /**
   * El factor TOTP verificado de la cuenta; si no lo hay, inscribe uno nuevo (descartando los que quedaron sin verificar,
   * cuyo secreto ya no se puede volver a mostrar).
   */
  enrolMfa(): Promise<MfaFactor>;
  /** Comprueba un código de la app (reto y verificación); el factor queda verificado y la sesión en aal2. */
  verifyMfa(factorId: string, code: string): Promise<void>;
}
