// Base en memoria del fake: mismas tablas que importan a la app y las mismas reglas de visibilidad que la vista
// listings_public y la función listing_link_state. Sirve a las pruebas unitarias, a la prueba HTTP del worker y a
// la suite de contrato (que lo compara con PostgREST).
import type { AdminHold } from "../../domain/admin-hold";
import { reopenIfDue, type CalendarDay } from "../../domain/calendar";
import { APPROX_MAX_METERS, APPROX_MIN_METERS, type LatLng } from "../../domain/geo";
import { FX_INITIAL, type FxRate } from "../../domain/fx";
import { costaRicaToday } from "../../domain/inquiry";
import type { EditItemState } from "../../domain/edit";
import type { EditStatus } from "../../domain/edit-label";
import type { ReviewedField } from "../../domain/edit-summary";
import { emptyDraft, type Kind, type ListingDraft, type ListingStatus } from "../../domain/listing";
import type { ZoneSource } from "../../domain/zones";
import type { PaymentProviderName, ReminderDays, ReminderStatus } from "../../domain/subscription";

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
  reopenAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  firstPublishedAt: string | null;
  whatsappPhone: string;
  createdAt: string;
  updatedAt: string;
  /** Pausada o bloqueada por el admin (admin_hold, admin_hold_reason) y desde cuándo (admin_hold_at). */
  adminHold: AdminHold | null;
  adminHoldAt: string | null;
  /** Borrado lógico del admin (deleted_at, deleted_reason): para todos es como si no existiera. */
  deletedAt: string | null;
  deletedReason: string | null;
}

/** Lo que ve el público: activa, sin retención del admin y sin borrar (la vista listings_public). */
export const isPublicListing = (l: Pick<FakeListing, "status" | "adminHold" | "deletedAt">) => l.status === "active" && l.adminHold === null && l.deletedAt === null;

export interface FakePhoto {
  id: string;
  listingId: string;
  path: string;
  position: number;
}

/** listing_edit_photos: una foto nueva con su estado (revisión por dato, A5). */
export interface FakeEditPhoto extends FakePhoto {
  status: EditStatus;
  reviewNote: string | null;
  submittedAt: string;
}

/** listing_edits y listing_edit_fields: los valores pendientes de una casa publicada (null = sin cambio en ese dato) y el
 *  estado de cada dato que cambia. */
export interface FakeEdit {
  listingId: string;
  fields: Partial<Record<ReviewedField, EditItemState>>;
  title: string | null;
  kind: Kind | null;
  bathroomShared: boolean | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  zoneId: string | null;
  zoneSource: ZoneSource | null;
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

/** subscriptions (fase 5): una por casa aprobada alguna vez. */
export interface FakeSubscription {
  listingId: string;
  plan: "promo" | "paid";
  promoSlot: number | null;
  promoMonths: number | null;
  promoEndsOn: string | null;
  paidSince: string | null;
  /** Día (Costa Rica) en que se paró. */
  stoppedOn: string | null;
  monthlyPriceCrc: number;
}

/** subscription_reminders: el outbox de los avisos; (casa, umbral) es único. */
export interface FakeReminder {
  id: string;
  listingId: string;
  daysBefore: ReminderDays;
  promoEndsOn: string;
  queuedAt: string;
  status: ReminderStatus;
  attempts: number;
  claimedAt: string | null;
  toPhone: string | null;
  body: string | null;
  providerRef: string | null;
  lastError: string | null;
  sentAt: string | null;
}

/** payment_methods: uno por propietario. */
export interface FakePaymentMethod {
  ownerId: string;
  provider: PaymentProviderName;
  customerRef: string;
  methodRef: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  addedAt: string;
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
  /** listing_edits por casa y listing_edit_photos (las fotos nuevas de la edición; `listingId` es el de la edición). */
  readonly edits = new Map<string, FakeEdit>();
  editPhotos: FakeEditPhoto[] = [];
  inquiries: FakeInquiry[] = [];
  /** Balizas `listing_view` (como la tabla events): la casa y cuándo. */
  views: { publicId: string; at: string }[] = [];
  taps: { publicId: string; at: string }[] = [];
  favorites: FakeFavorite[] = [];
  /** listing_days: por casa, solo los días que difieren del habitual, en orden. */
  readonly days = new Map<string, CalendarDay[]>();
  /** Reloj de las reglas con fecha (consultas, calendario, reapertura); «hoy» es el de Costa Rica con este reloj. */
  clock: () => number = () => Date.now();
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
  /** Suscripción (fase 5): por casa, outbox de avisos, método de pago y cliente de la pasarela por propietario, eventos. */
  readonly subscriptions = new Map<string, FakeSubscription>();
  reminders: FakeReminder[] = [];
  /** admin_actions de las acciones sobre casas (pausar, reanudar, bloquear, desbloquear, eliminar). */
  adminActions: { action: string; listingId: string; reason: string | null }[] = [];
  readonly paymentMethods = new Map<string, FakePaymentMethod>();
  /** payment_customers: `${owner}|${provider}` → referencia del cliente. */
  readonly paymentCustomers = new Map<string, string>();
  /** payment_events: `${provider}|${evento}` → resultado. */
  readonly paymentEvents = new Map<string, string>();
  /** El secreto bnbtico_test_clock de Vault (pruebas y local; nunca en producción). */
  testClock = false;
  /** fx_rates: un tipo por día, con la fila inicial de la migración. */
  readonly fxRates = new Map<string, FxRate>([[FX_INITIAL.day, { ...FX_INITIAL }]]);
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
      reopenAt: null,
      reviewNote: null,
      reviewedAt: null,
      firstPublishedAt: null,
      whatsappPhone: this.profiles.get(ownerId)?.phone ?? "",
      createdAt: at,
      updatedAt: at,
      adminHold: null,
      adminHoldAt: null,
      deletedAt: null,
      deletedReason: null,
      ...patch,
    };
    oneRoom(listing);
    this.listings.set(listing.id, listing);
    return listing;
  }

  today(): string {
    return costaRicaToday(this.clock());
  }

  /** reopen_due_listings: abre a consultas las casas cuya fecha de reapertura llegó, sin tocar su estado ni sus días. */
  reopenDue(today: string = this.today()): number {
    let n = 0;
    for (const l of this.listings.values()) {
      const next = reopenIfDue(l, today);
      if (next !== l) {
        Object.assign(l, { available: next.available, reopenAt: next.reopenAt, updatedAt: this.now() });
        n += 1;
      }
    }
    return n;
  }

  photosOf(listingId: string): FakePhoto[] {
    return this.photos.filter((p) => p.listingId === listingId).sort((a, b) => a.position - b.position);
  }

  editPhotosOf(listingId: string): FakeEditPhoto[] {
    return this.editPhotos.filter((p) => p.listingId === listingId).sort((a, b) => a.position - b.position);
  }

  profileByPhone(phone: string): FakeProfile | undefined {
    for (const p of this.profiles.values()) if (p.phone === phone) return p;
    return undefined;
  }

  byPublicId(publicId: string): FakeListing | undefined {
    for (const l of this.listings.values()) if (l.publicId === publicId) return l;
    return undefined;
  }

  /** Como el upsert del cron: un tipo por día. */
  putFxRate(rate: FxRate): void {
    this.fxRates.set(rate.day, { ...rate });
  }

  resetFxRates(): void {
    this.fxRates.clear();
    this.fxRates.set(FX_INITIAL.day, { ...FX_INITIAL });
  }

  clear(): void {
    this.listings.clear();
    this.photos = [];
    this.edits.clear();
    this.editPhotos = [];
    this.objects.clear();
    this.inquiries = [];
    this.views = [];
    this.taps = [];
    this.favorites = [];
    this.days.clear();
    this.subscriptions.clear();
    this.reminders = [];
    this.adminActions = [];
    this.paymentMethods.clear();
    this.paymentCustomers.clear();
    this.paymentEvents.clear();
  }
}

/** Trigger listings_habitacion_una: una Habitación es siempre 1 habitación y 1 baño, la escriba quien la escriba. */
export function oneRoom(l: Pick<FakeListing, "kind" | "bedrooms" | "bathrooms">): void {
  if (l.kind === "habitacion") Object.assign(l, { bedrooms: 1, bathrooms: 1 });
}

/** Como approx_point en SQL: desplazamiento determinista por casa entre 150 y 499 m (el hash no tiene que coincidir). */
export function approxPoint(lat: number, lng: number, seed: string): LatLng {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  const dist = APPROX_MIN_METERS + (h % (APPROX_MAX_METERS - APPROX_MIN_METERS + 1));
  const ang = (((h >>> 9) % 360) * Math.PI) / 180;
  return { lat: lat + (dist * Math.cos(ang)) / 111_320, lng: lng + (dist * Math.sin(ang)) / (111_320 * Math.cos((lat * Math.PI) / 180)) };
}
