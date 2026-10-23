// Base en memoria del fake: mismas tablas que importan a la app y las mismas reglas de visibilidad que la vista
// listings_public y la función listing_link_state. Sirve a las pruebas unitarias, a la prueba HTTP del worker y a
// la suite de contrato (que lo compara con PostgREST).
import { APPROX_MAX_METERS, APPROX_MIN_METERS, type LatLng } from "../../domain/geo";
import { emptyDraft, type ListingDraft, type ListingStatus } from "../../domain/listing";

export interface FakeProfile {
  id: string;
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  email: string | null;
  description: string | null;
  /** profiles.is_active: el admin puede desactivar una cuenta. */
  isActive: boolean;
}

type NewProfile = Omit<FakeProfile, "id" | "isOwner" | "email" | "description" | "isActive"> &
  Partial<Pick<FakeProfile, "id" | "isOwner" | "email" | "description" | "isActive">>;

export interface FakeListing extends Omit<ListingDraft, "photoCount"> {
  id: string;
  publicId: string;
  ownerId: string;
  status: ListingStatus;
  available: boolean;
  reviewNote: string | null;
  reviewedAt: string | null;
  whatsappPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface FakePhoto {
  id: string;
  listingId: string;
  path: string;
  position: number;
}

export interface FakeInquiry {
  id: string;
  listingId: string;
  clientId: string;
  ownerId: string;
  arrival: string | null;
  departure: string | null;
  people: number | null;
  message: string;
  /** El WhatsApp de la casa entregado al cliente (copia; nunca se lee por REST). */
  whatsappPhone: string;
  createdAt: string;
  updatedAt: string;
  ownerOpenedAt: string | null;
  source: "listing" | "bnbtico";
}

export interface FakeFavorite {
  userId: string;
  listingId: string;
  createdAt: string;
}

export interface FakeObject {
  cacheControl: string;
  contentType: string;
  size: number;
}

export class FakeDb {
  readonly profiles = new Map<string, FakeProfile>();
  readonly listings = new Map<string, FakeListing>();
  photos: FakePhoto[] = [];
  inquiries: FakeInquiry[] = [];
  favorites: FakeFavorite[] = [];
  /** Storage en memoria: bucket `listings`, nombre del objeto → metadatos. */
  readonly objects = new Map<string, FakeObject>();
  /** Sesiones abiertas (token → usuario), como auth.sessions: cerrar sesión las borra. */
  readonly authSessions = new Map<string, string>();
  /** Sesiones que pasaron el segundo factor (token → aal2). */
  readonly aal2Sessions = new Set<string>();
  /** Factor de teléfono por usuario y retos abiertos (reto → factor). */
  /** Factores TOTP por usuario (GoTrue admite varios; el fake guarda el último inscrito). */
  readonly mfaFactors = new Map<string, { id: string; secret: string; verified: boolean }>();
  /** Último código pedido por número (reloj del adaptador), para el límite de un código por segundo de Supabase. */
  readonly otpSentAt = new Map<string, number>();
  private tick = Date.parse("2026-10-01T12:00:00Z");
  private seq = 1000;
  private ids = 0;

  now(): string {
    this.tick += 1000;
    return new Date(this.tick).toISOString();
  }

  newId(): string {
    this.ids += 1;
    return `00000000-0000-4000-8000-${String(this.ids).padStart(12, "0")}`;
  }

  addProfile(p: NewProfile): FakeProfile {
    const profile: FakeProfile = { isOwner: false, email: null, description: null, isActive: true, ...p, id: p.id ?? this.newId() };
    this.profiles.set(profile.id, profile);
    return profile;
  }

  insertListing(ownerId: string, patch: Partial<FakeListing> = {}): FakeListing {
    const at = this.now();
    const { photoCount: _ignored, ...draft } = emptyDraft();
    const listing: FakeListing = {
      ...draft,
      id: this.newId(),
      publicId: `CT-${this.seq++}`,
      ownerId,
      status: "draft",
      available: true,
      reviewNote: null,
      reviewedAt: null,
      whatsappPhone: this.profiles.get(ownerId)?.phone ?? "",
      createdAt: at,
      updatedAt: at,
      ...patch,
    };
    this.listings.set(listing.id, listing);
    return listing;
  }

  photosOf(listingId: string): FakePhoto[] {
    return this.photos.filter((p) => p.listingId === listingId).sort((a, b) => a.position - b.position);
  }

  profileByPhone(phone: string): FakeProfile | undefined {
    for (const p of this.profiles.values()) if (p.phone === phone) return p;
    return undefined;
  }

  byPublicId(publicId: string): FakeListing | undefined {
    for (const l of this.listings.values()) if (l.publicId === publicId) return l;
    return undefined;
  }

  clear(): void {
    this.listings.clear();
    this.photos = [];
    this.objects.clear();
    this.inquiries = [];
    this.favorites = [];
  }
}

/** Como approx_point en SQL: desplazamiento determinista por casa entre 150 y 499 m (el hash no tiene que coincidir). */
export function approxPoint(lat: number, lng: number, seed: string): LatLng {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  const dist = APPROX_MIN_METERS + (h % (APPROX_MAX_METERS - APPROX_MIN_METERS + 1));
  const ang = (((h >>> 9) % 360) * Math.PI) / 180;
  return { lat: lat + (dist * Math.cos(ang)) / 111_320, lng: lng + (dist * Math.sin(ang)) / (111_320 * Math.cos((lat * Math.PI) / 180)) };
}
