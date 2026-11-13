// Interfaces de datos de la app. Dos implementaciones: el adaptador PostgREST (único módulo que importa supabase-js)
// y un fake en memoria que aplica las mismas reglas de propiedad y estado. Una suite de contrato corre contra las dos.
// Todas las operaciones fallan con DomainError (mensaje en español).
import type { CalendarChange, CalendarDay } from "./calendar";
import type { EditPatch, ListingEdit, LivePatch, ReviewedField } from "./edit";
import type { FavoriteEntry } from "./favorites";
import type { Filters } from "./filters";
import type { FxRate } from "./fx";
import type { VariantSize } from "./image";
import type { Feature, LinkState, Listing, ListingDraft, ListingStatus, Photo, PublicListing, SearchListing, SitemapEntry, Step } from "./listing";
import type { InquiryDetails, OwnerInquiry } from "./inquiry";
import type { AdminHouses } from "./admin-houses";
import type { AdminQueue, EditDecision, QueueItem, ReviewDecision } from "./review";
import type { NearZone, Place, Zone, ZoneWithListings } from "./zones";
import type {
  BillingOverview,
  BlockedReason,
  DayRunResult,
  PaymentEvent,
  PaymentEventResult,
  PaymentProviderName,
  PaymentSetupContext,
  ReminderOutcome,
  ReminderToSend,
} from "./subscription";

export type { AdminQueue, EditDecision, QueueItem, ReviewDecision } from "./review";

export interface PublicListingsApi {
  /** Catálogo con filtros, todos dentro de la RPC search_listings: zona a 5 km, noches libres, provincia (solo sin zona),
   *  personas, habitaciones, características y precio por noche; más recientes primero, como mucho 60. Con llegada y salida,
   *  cada casa trae su total orientativo (`stayTotalCrc`, domain/stay-price.ts). Rango inválido: «Revise las fechas.» */
  searchPublic(filters: Filters): Promise<SearchListing[]>;
  /** Zonas activas con alguna casa activa y abierta a 5 km o menos (o con esa zona), Caribe primero y por nombre. */
  zonesWithListings(): Promise<ZoneWithListings[]>;
  /** Ficha pública por `CT-####`; null si no está activa. */
  getPublic(publicId: string): Promise<PublicListing | null>;
  /** Las casas activas de una lista de `CT-####` en una sola consulta (Favoritos); las demás no vuelven. Sin orden. */
  getManyPublic(publicIds: string[]): Promise<PublicListing[]>;
  linkState(publicId: string): Promise<LinkState>;
  /** Provincias con al menos una casa activa. */
  provincesWithListings(): Promise<string[]>;
  /** Características de todas las casas visibles en Explorar, sin duplicados. */
  featuresWithListings(): Promise<Feature[]>;
  /** Casas activas para el sitemap, la más reciente primero. */
  sitemap(): Promise<SitemapEntry[]>;
  /** Cuántas casas hay activas (plazas ocupadas de la oferta de lanzamiento). */
  countActive(): Promise<number>;
  /** Días que difieren del habitual (ocupados o con ★) de una casa activa, de hoy (Costa Rica) a hoy + 365, en orden.
   *  `[]` si la casa no está publicada. RPC public_listing_days. */
  getPublicDays(publicId: string): Promise<CalendarDay[]>;
  /** Tipo de cambio vigente (el del día más reciente de fx_rates; el inicial si no hay otro). Ticket 21. */
  fxRate(): Promise<FxRate>;
  /** Plazas de la oferta de lanzamiento ya asignadas (RPC launch_offer_taken; fase 5): la entrada de launchOffer. */
  offerTaken(): Promise<number>;
  /** Motivo del 410 de un enlace bloqueado (RPC listing_blocked_reason); null si el enlace no está bloqueado. */
  blockedReason(publicId: string): Promise<BlockedReason | null>;
}

/**
 * Casas del propietario con sesión. Las reglas las pone la base (RLS, trigger listings_protect, política
 * listings_owner_delete, RPC set_listing_available); el fake las repite con los mismos mensajes.
 */
/** Lo que el propietario ve de su ficha en 30 días (revisión UX A2). */
export interface ListingStats {
  views: number;
  inquiries: number;
}

/** Actividad de 30 días de una casa propia (RPC owner_activity). */
export interface ListingActivity {
  listingId: string;
  publicId: string;
  views: number;
  whatsappTaps: number;
  inquiries: number;
}

export interface OwnerListingsApi {
  /** Las casas propias en cualquier estado, la más reciente primero (el admin tampoco ve aquí las ajenas). */
  listOwn(): Promise<Listing[]>;
  /** null si no existe o es de otro propietario. */
  getOwn(id: string): Promise<Listing | null>;
  /** Borrador nuevo con su CT-####, el WhatsApp del perfil y todo lo demás vacío (nada preseleccionado). Devuelve también el
   *  borrador entero (`listing`, igual que getOwn): la pantalla de «+» lo guarda en caché sin otro viaje a la base. `id`: el
   *  que ya eligió el teléfono para entrar al paso 1 sin esperar a la base (un UUID nuevo); si ya existe, falla sin tocar nada. */
  createDraft(id?: string): Promise<{ id: string; publicId: string; listing: Listing }>;
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
  /**
   * Con cambios pedidos o rechazada → borrador. Una casa publicada ya no vuelve a borrador (se edita con updateLive y
   * saveEdit): falla con «Solo 3bstays puede cambiar el estado de un anuncio.».
   */
  reopenForEdit(id: string): Promise<void>;
  /** Datos al momento de una casa publicada (RPC update_listing_live). */
  updateLive(id: string, patch: LivePatch): Promise<void>;
  /**
   * Guarda un dato con revisión y lo envía a revisión en el mismo paso (RPC save_edit; revisión UX 2026-10-29, A5), con las
   * reglas de submit_listing para ese dato; lo igual a lo aprobado sale de la revisión. null si la edición quedó vacía.
   */
  saveEdit(id: string, patch: EditPatch): Promise<ListingEdit | null>;
  /** Descarta un dato pendiente (en revisión o con cambios pedidos): la ficha sigue con lo aprobado (RPC discard_edit_field). */
  discardEditField(id: string, field: ReviewedField): Promise<void>;
  /**
   * «Cerrar la casa hasta…» del Calendario (antes «Anuncio visible»), solo con la casa activa (RPC set_listing_available). Al cerrar, `reopenAt` opcional
   * (`YYYY-MM-DD`, de mañana a hoy + 365): esa noche la base la abre sola. Abrir a mano borra la fecha; una fecha al abrir
   * se rechaza. Ninguna de las dos cosas cambia el estado de la casa.
   */
  setAvailable(id: string, available: boolean, reopenAt?: string | null): Promise<void>;
  /** Solo un borrador que nunca se revisó; si no, el error dice por qué. */
  deleteDraft(id: string): Promise<void>;
  /**
   * Visitas a la ficha (`listing_view`) y consultas de los últimos 30 días (RPC owner_listing_stats, revisión UX A2). Solo
   * el dueño (o el admin); si no, «No encontramos ese anuncio.».
   */
  stats(id: string): Promise<ListingStats>;
  /** Una fila por casa propia (cualquier estado), la más reciente primero: visitas, toques en WhatsApp y consultas de 30 días (RPC owner_activity). */
  ownerActivity(): Promise<ListingActivity[]>;
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
  /** Registra una carpeta subida como foto nueva, que va a revisión al momento (la edición se crea si no hay). Aprobadas + nuevas ≤ 15. */
  addEditPhoto(listingId: string, folder: string): Promise<Photo>;
  /** Quita (descarta) una foto nueva en cualquier estado (las demás se recompactan) y después sus objetos; si la edición queda vacía, se borra. */
  removeEditPhoto(photoId: string): Promise<void>;
  /** El orden completo de las fotos nuevas de una vez. */
  reorderEditPhotos(listingId: string, photoIds: string[]): Promise<void>;
}

/**
 * Revisión del admin (ticket 09). Solo un admin con el segundo factor (sesión aal2) ve y decide: lo exige la base (RLS y
 * review_listing). Firma decidida en el ticket 09: `queue` devuelve la cola ya separada por estado. Sin ser admin no se
 * obtiene nada (cola vacía, `get` null, `review` con el mensaje de la base, `houses` vacía); un admin en aal1 recibe
 * REVIEW_MESSAGES.mfaRequired en las cuatro.
 */
export interface AdminListingsApi {
  queue(): Promise<AdminQueue>;
  /** Una casa en cualquier estado, con su propietario; null si no existe. */
  get(id: string): Promise<QueueItem | null>;
  /** RPC review_listing. Motivo obligatorio para pedir cambios o rechazar, hasta 2000 caracteres. */
  review(id: string, decision: ReviewDecision, note: string): Promise<void>;
  /** Casas con algún dato o foto en revisión, la que más espera primero; cada una con su edición (listing.edit). Sin ser admin, []. */
  editQueue(): Promise<QueueItem[]>;
  /** La casa aprobada con su edición y las fotos de las dos; null si no hay edición o no es admin. */
  getEdit(listingId: string): Promise<QueueItem | null>;
  /**
   * Decide un dato (RPC review_edit_field): aprobar lo publica al momento; pedir cambios exige nota (editNoteRefusal).
   * `submittedAt` es el envío de ese dato que el admin abrió: si el propietario lo descartó o lo volvió a enviar,
   * EDIT_MESSAGES.changed y no se aplica nada.
   */
  reviewEditField(listingId: string, field: ReviewedField, decision: EditDecision, note: string, submittedAt: string | null): Promise<void>;
  /** Lo mismo con una foto nueva (RPC review_edit_photo): aprobada, va tras la última aprobada. */
  reviewEditPhoto(photoId: string, decision: EditDecision, note: string, submittedAt: string | null): Promise<void>;
  /**
   * Casas del admin (fase 5, ticket 07): las aprobadas alguna vez (las que tienen suscripción), en cualquier estado, con
   * propietario, zona, portada y suscripción; la aprobada más recientemente primero. Sin ser admin, lista vacía.
   */
  houses(): Promise<AdminHouses>;
  /**
   * Pausar, bloquear y eliminar una casa (spec .scratch/admin-casas-acciones). Motivo obligatorio (holdReasonRefusal);
   * todo queda en admin_actions y la ficha se purga del borde al momento. Mensajes de ADMIN_HOLD_MESSAGES.
   * - pauseListing (RPC admin_pause_listing): casa publicada (Activa, Pendiente de pago, Inactiva); sale del público y el
   *   propietario la sigue editando; la suscripción no cambia.
   * - resumeListing: quita la pausa.
   * - blockListing: igual para el público, el propietario no la edita y la suscripción se para (sin avisos ni fin de oferta).
   * - unblockListing: la deja como estaba y corre la oferta gratuita los días que duró el bloqueo.
   * - deleteListing: borrado lógico en cualquier estado; `confirm` es el `CT-####` de la casa.
   */
  pauseListing(listingId: string, reason: string): Promise<void>;
  resumeListing(listingId: string): Promise<void>;
  blockListing(listingId: string, reason: string): Promise<void>;
  unblockListing(listingId: string): Promise<void>;
  deleteListing(listingId: string, reason: string, confirm: string): Promise<void>;
}

/**
 * El admin edita las casas (ronda de Ana del 2 nov, ticket 10, versión simple de Daniel del 2026-11-03): cualquier dato de
 * cualquier casa salvo las eliminadas, borradores incluidos, al momento y sin revisión, con las mismas reglas que el
 * anfitrión (planStep al guardar una pantalla del asistente; update_listing_live, save_edit y listing_edit_check en un dato
 * de una casa publicada; las de las fotos y del calendario). RPCs admin_* con is_admin() en aal2; cada guardado deja una
 * línea en admin_actions. Si el admin cambia un dato que el anfitrión tenía en revisión, manda lo suyo y ese pendiente se
 * descarta. Sin ser admin, todo falla con REVIEW_MESSAGES.adminOnly (y `get` da null, `drafts` []); un admin en aal1
 * recibe REVIEW_MESSAGES.mfaRequired.
 */
export interface AdminEditApi {
  /** Una casa en cualquier estado (salvo eliminada), con sus fotos y la edición pendiente del anfitrión; null si no hay. */
  get(id: string): Promise<Listing | null>;
  /** Borradores sin enviar de todos los anfitriones (nunca publicados), el más reciente primero, con el nombre del anfitrión. */
  drafts(): Promise<QueueItem[]>;
  /** Una pantalla del asistente de una casa sin publicar (cualquier estado salvo publicada): planStep y admin_update_listing.
   *  Devuelve la casa guardada. Con `known` (la que ya tiene el navegador) no la relee antes de guardar. */
  saveStep(id: string, step: Step, patch: Partial<ListingDraft>, known?: Listing): Promise<Listing>;
  /** Capacidad, características o precios de una casa publicada, al momento (las reglas de update_listing_live). */
  updateLive(id: string, patch: LivePatch): Promise<void>;
  /** Nombre, tipo, descripción o ubicación de una casa publicada, al momento y sin revisión (las reglas de save_edit); el
   *  pendiente del anfitrión de ese dato se descarta. Devuelve lo que le queda en revisión al anfitrión (null si nada). */
  saveEdit(id: string, patch: EditPatch): Promise<ListingEdit | null>;
  /** Envía a revisión el borrador de otro (D1), con las comprobaciones de submit_listing (admin_submit_listing). */
  submit(id: string): Promise<void>;
  /** Registra una carpeta ya subida como foto al final, directo a la ficha (también en una casa publicada). 15 como mucho,
   *  contando las nuevas del anfitrión en revisión. */
  addPhoto(listingId: string, folder: string): Promise<Photo>;
  /** Quita una foto (una casa publicada conserva al menos una) y después sus objetos de Storage. */
  removePhoto(photoId: string): Promise<void>;
  reorderPhotos(listingId: string, photoIds: string[]): Promise<void>;
  /** El calendario de una casa ajena (hoy … hoy + 365) y su guardado, con las reglas de save_listing_days. */
  days(listingId: string): Promise<CalendarDay[]>;
  saveDays(listingId: string, change: CalendarChange): Promise<void>;
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

/**
 * Suscripción del propietario con sesión (fase 5). Una sola lectura (RPC owner_billing) y las transiciones
 * stop_subscription/resume_subscription; mensajes de SUBSCRIPTION_MESSAGES y estados de nextStatus en el fake.
 * Sin sesión, todas fallan con «Su sesión venció. Ingrese de nuevo.» (kind `session`) antes de llegar a la red.
 */
export interface OwnerBillingApi {
  /** Las casas propias con suscripción (la más reciente primero), el método de pago de la cuenta y el «hoy» de la base. */
  overview(): Promise<BillingOverview>;
  /** «Parar suscripción»: activa o pendiente de pago → inactiva. Devuelve el estado nuevo. */
  stop(listingId: string): Promise<ListingStatus>;
  /** «Reactivar»: inactiva → activa (oferta en curso o método) o pendiente de pago. Devuelve el estado nuevo. */
  resume(listingId: string): Promise<ListingStatus>;
}

/**
 * Datos de la suscripción para el worker (fase 5, tickets 03 y 04): todo con la service role salvo `setupContext`, que va
 * con el JWT del usuario para que PostgREST valide la sesión (el worker no verifica JWT). Adaptador con fetch a secas
 * (src/data/postgrest/billing-service.ts) y fake (src/data/fake/billing.ts).
 */
export interface BillingServiceApi {
  /** run_subscription_day: fin de las ofertas y avisos en cola. Sin `today`, el de Costa Rica según la base. */
  runDay(today?: string): Promise<DayRunResult>;
  /** claim_reminders: hasta `limit` avisos en cola pasan a «sending» y se devuelven (los que ya no tocan, a «skipped»). */
  claimReminders(limit: number): Promise<ReminderToSend[]>;
  /** finish_reminders: solo cambia avisos en «sending». Devuelve cuántos cambió. */
  finishReminders(results: ReminderOutcome[]): Promise<number>;
  /** payment_setup_context con el JWT de la sesión: «Su sesión venció…» o «Su cuenta está desactivada…» si no vale. */
  setupContext(userJwt: string, provider: PaymentProviderName): Promise<PaymentSetupContext>;
  savePaymentCustomer(ownerId: string, provider: PaymentProviderName, customerRef: string): Promise<void>;
  /** apply_payment_event: una sola vez por (pasarela, evento). */
  applyPaymentEvent(event: PaymentEvent): Promise<PaymentEventResult>;
  /** test_set_offer_days_left (reloj de pruebas): la casa queda con `days` días de oferta; devuelve su último día gratis.
   *  Sin el secreto de Vault (producción) falla con SUBSCRIPTION_MESSAGES.testClockOff. */
  setOfferDaysLeft(publicId: string, days: number): Promise<string>;
}

/** Ubicación por punto (spec .scratch/ubicacion-por-punto/spec.md): lugar del pin y zonas. Los polígonos no salen de la base. */
export interface PlacesApi {
  /** RPC place_at: provincia, cantón y distrito del punto (500 m de margen en la costa); null fuera de Costa Rica o mar adentro. */
  placeAt(lat: number, lng: number): Promise<Place | null>;
  /** RPC zones_near: zonas activas a ≤ km (5 por defecto), la más cercana primero. */
  zonesNear(lat: number, lng: number, km?: number): Promise<NearZone[]>;
  /** Zonas activas para el buscador del paso 2 (tabla zones: id, name, canton_code, lat, lng), Caribe primero. */
  listZones(): Promise<Zone[]>;
}

export interface ListingsApi extends PublicListingsApi, OwnerListingsApi {
  photos: PhotosApi;
  admin: AdminListingsApi;
  places: PlacesApi;
}

// ---------- Consultas y favoritos (fase 3) ----------

/**
 * Consultas por WhatsApp. Las reglas las pone la base (RPCs create_inquiry, mark_inquiry_opened y owner_inquiry_details; la
 * tabla no se escribe por REST); el fake las repite con los mismos mensajes (INQUIRY_MESSAGES). Sin sesión, todas fallan
 * con «Su sesión venció. Ingrese de nuevo.» (kind `session`) antes de llegar a la red.
 */
export interface InquiriesApi {
  /**
   * Registra (o renueva, si el mismo cliente escribió a esa casa en los últimos 7 días) la consulta y devuelve el WhatsApp
   * de la casa: es el único camino por el que un cliente obtiene ese número. Valida en la base (casa publicada y
   * disponible, no propia, fechas, personas y 20 casas distintas por día).
   */
  create(publicId: string, details: InquiryDetails): Promise<{ inquiryId: string; whatsappPhone: string }>;
  /** Las consultas (Actividad): las de las casas del propietario de la sesión, con nombre y WhatsApp del cliente; la más reciente primero. */
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

/** Ingresar (ticket 18): el WhatsApp y, solo si el número aún no tiene cuenta, el nombre para crearla. */
export type StartInput = { phone: string; name?: string };
/** «sent»: código enviado. «needs-name»: el número no tiene cuenta y no se envió nada; falta el nombre. */
export type StartResult = "sent" | "needs-name";

export interface PendingOtp {
  /** «register»: la cuenta se crea al verificar este código; «login»: ya existía. */
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
 *   la base al aprobar una casa. La interfaz del propietario sale de tener casas, no de esta marca.
 * - `onSessionChange`: la sesión puede terminar sola (refresco rechazado, cierre en otra pestaña) y la interfaz debe enterarse.
 * - `enrolMfa`/`verifyMfa` pasan a `MfaApi` (ticket 09), para que los adaptadores de este ticket no lleven métodos vacíos.
 */
export interface AuthApi {
  /**
   * Un único flujo (ticket 18). Sin nombre: si el número tiene cuenta pide el código («sent»); si no, no envía nada y
   * responde «needs-name». Con nombre: pide el código y la cuenta se crea al verificarlo. Falla si no pasaron 30 s desde
   * el último envío a ese número.
   * `captchaToken` (ticket 11): token de Turnstile para la protección de bots de Supabase Auth; sin él si no está configurada.
   */
  start(input: StartInput, captchaToken?: string): Promise<StartResult>;
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
