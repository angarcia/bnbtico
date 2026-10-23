// Interfaces de datos de la app. Dos implementaciones: el adaptador PostgREST (único módulo que importa supabase-js)
// y un fake en memoria que aplica las mismas reglas de propiedad y estado. Una suite de contrato corre contra las dos.
// Todas las operaciones fallan con DomainError (mensaje en español).
import type { Filters } from "./filters";
import type { LinkState, Listing, ListingDraft, Photo, PublicListing, SitemapEntry, Step } from "./listing";

export interface PublicListingsApi {
  /** Catálogo con filtros; más recientes primero, como mucho 60. */
  searchPublic(filters: Filters): Promise<PublicListing[]>;
  /** Ficha pública por `CT-####`; null si no está activa. */
  getPublic(publicId: string): Promise<PublicListing | null>;
  linkState(publicId: string): Promise<LinkState>;
  /** Provincias con al menos una casa activa. */
  provincesWithListings(): Promise<string[]>;
  /** Casas activas para el sitemap, la más reciente primero. */
  sitemap(): Promise<SitemapEntry[]>;
  /** Cuántas casas hay activas (plazas ocupadas de la oferta de lanzamiento). */
  countActive(): Promise<number>;
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
  /** Solo con la casa activa. */
  setAvailable(id: string, available: boolean): Promise<void>;
  /** Solo un borrador que nunca se revisó; si no, el error dice por qué. */
  deleteDraft(id: string): Promise<void>;
}

export interface PhotosApi {
  upload(listingId: string, file: Blob): Promise<string>;
  add(listingId: string, path: string): Promise<Photo>;
  remove(photoId: string): Promise<void>;
  reorder(listingId: string, photoIds: string[]): Promise<void>;
}

export type ReviewDecision = "approve" | "changes" | "reject";
export interface QueueItem {
  listing: Listing;
  ownerName: string;
}

export interface AdminListingsApi {
  queue(): Promise<QueueItem[]>;
  get(id: string): Promise<QueueItem | null>;
  review(id: string, decision: ReviewDecision, note: string): Promise<void>;
}

export interface ListingsApi extends PublicListingsApi, OwnerListingsApi {
  photos: PhotosApi;
  admin: AdminListingsApi;
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
  /** Valida nombre y número y pide el código por WhatsApp. Falla si no pasaron 30 s desde el último envío a ese número. */
  start(input: StartInput): Promise<void>;
  pending(): PendingOtp | null;
  /** Comprueba el código del número pendiente y abre sesión. */
  verify(code: string): Promise<Account>;
  resend(): Promise<void>;
  cancel(): void;
  session(): Promise<Session | null>;
  onSessionChange(listener: (session: Session | null) => void): () => void;
  profile(): Promise<Account | null>;
  updateProfile(patch: ProfilePatch): Promise<Account>;
  logout(): Promise<void>;
}

/** Segundo factor del admin (ticket 09). */
export interface MfaApi {
  enrolMfa(): Promise<{ factorId: string }>;
  verifyMfa(factorId: string, code: string): Promise<void>;
}
