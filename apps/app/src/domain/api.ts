// Interfaces de datos de la app. Dos implementaciones: el adaptador PostgREST (único módulo que importa supabase-js)
// y un fake en memoria que aplica las mismas reglas de propiedad y estado. Una suite de contrato corre contra las dos.
// Todas las operaciones fallan con DomainError (mensaje en español).
import type { Filters } from "./filters";
import type { LinkState, Listing, ListingDraft, Photo, PublicListing, SitemapEntry } from "./listing";

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
}

export interface OwnerListingsApi {
  listOwn(): Promise<Listing[]>;
  getOwn(id: string): Promise<Listing | null>;
  createDraft(): Promise<{ id: string; publicId: string }>;
  saveStep(id: string, patch: Partial<ListingDraft>): Promise<Listing>;
  submit(id: string): Promise<void>;
  reopenForEdit(id: string): Promise<void>;
  setAvailable(id: string, available: boolean): Promise<void>;
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
  isOwner: boolean;
  /** Lo marca `seed_admin` (local/pruebas) o una sentencia SQL; nunca la app. */
  isAdmin: boolean;
}

export type StartInput = { mode: "register"; name: string; phone: string } | { mode: "login"; phone: string };

export interface PendingOtp {
  mode: "register" | "login";
  name?: string;
  phone: string;
  /** Momento del último envío (ms), para el enfriamiento de 30 s. */
  sentAt: number;
}

export interface Session {
  userId: string;
  /** Nivel de autenticación del JWT: aal2 tras el segundo código del admin. */
  aal: "aal1" | "aal2";
}

export type ProfilePatch = Partial<Pick<Account, "name" | "email" | "description" | "isOwner">>;

export interface AuthApi {
  start(input: StartInput): Promise<void>;
  pending(): PendingOtp | null;
  verify(code: string): Promise<Account>;
  resend(): Promise<void>;
  cancel(): void;
  session(): Promise<Session | null>;
  profile(): Promise<Account | null>;
  updateProfile(patch: ProfilePatch): Promise<Account>;
  logout(): Promise<void>;
  enrolMfa(): Promise<{ factorId: string }>;
  verifyMfa(factorId: string, code: string): Promise<void>;
}
