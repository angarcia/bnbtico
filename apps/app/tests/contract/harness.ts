// Arnés de la suite de contrato: el mismo archivo de pruebas corre contra el fake (unitarias) y contra PostgREST
// (proyecto de base). Cada arnés sabe sembrar casas en un estado concreto siguiendo el camino real de ese adaptador.
import type { AdminListingsApi, OwnerListingsApi, PhotosApi, PublicListingsApi } from "../../src/domain/api";
import type { LatLng } from "../../src/domain/geo";
import type { ListingDraft } from "../../src/domain/listing";

export type SeedStatus = "draft" | "review" | "active" | "changes" | "rejected" | "reopened";
export type SeedOwner = "owner" | "other";

export interface SeedSpec {
  status: SeedStatus;
  as?: SeedOwner;
  draft?: Partial<ListingDraft>;
  /** Número de fotos; se registran en orden inverso de posición para comprobar el orden. */
  photos?: number;
}

export interface Seeded {
  id: string;
  publicId: string;
  exact: LatLng;
  photoPaths: string[];
}

export interface ListingsHarness {
  /** API vista por un visitante sin sesión. */
  anon: PublicListingsApi;
  /** Casas propias vistas con la sesión de ese propietario. */
  owner(who: SeedOwner): OwnerListingsApi;
  reset(): Promise<void>;
  seed(spec: SeedSpec): Promise<Seeded>;
  /** Registra `n` fotos más al final de una casa del propietario (la subida real llega en el ticket 08). */
  addPhotos(listingId: string, n: number, as?: SeedOwner): Promise<string[]>;
  ownerName(who: SeedOwner): string;
  /** Fotos con la sesión de ese propietario (subida directa a Storage y RPCs). */
  photos(who: SeedOwner): PhotosApi;
  /** Objetos de Storage bajo la carpeta de una casa, ordenados por nombre, con su cabecera de caché. */
  objects(listingId: string): Promise<{ name: string; cacheControl: string | null }[]>;
  /** Revisión vista por el admin de prueba con el segundo factor (aal2), sin él (aal1) o por un usuario que no es admin. */
  admin(as: "aal2" | "aal1" | SeedOwner): AdminListingsApi;
  /** Quita la última foto de una casa saltándose las reglas (como el servicio), para aprobar con menos de 5. */
  dropPhoto(listingId: string): Promise<void>;
}

/** Borrador completo y válido (Cahuita, Limón), base de cada siembra. */
export const COMPLETE: Partial<ListingDraft> = {
  kind: "completo",
  acceptsNightly: true,
  acceptsMonthly: false,
  title: "Cabina Cahuita",
  description: "Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho.",
  province: "Limón",
  canton: "Talamanca",
  zone: "Cahuita",
  lat: 9.7366,
  lng: -82.8431,
  capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  features: ["wifi"],
  nightlyPriceCrc: 42000,
};

// ---------- Cuenta ----------
import type { AuthApi, MfaApi } from "../../src/domain/api";

export interface AuthHarness {
  /** Instancia recién abierta, sin sesión. */
  auth: AuthApi & MfaApi;
  /** La app se cierra y se vuelve a abrir: instancia nueva sobre el mismo almacenamiento del dispositivo. */
  restart(): AuthApi & MfaApi;
  /** Marca como admin la cuenta del número de prueba (seed_admin). */
  makeAdmin(): Promise<void>;
  /** El código que mostraría ahora la app de autenticación con ese secreto (TOTP con el reloj del servidor). */
  mfaCode(secret: string): string;
  /** Adelanta el reloj del adaptador (el enfriamiento y la caducidad del número pendiente se miden con él). */
  advance(ms: number): Promise<void>;
  /** Código válido para los números de prueba. */
  code: string;
  /** Número de prueba sin cuenta al empezar cada prueba. */
  phone: string;
  /** Número de prueba de otro país (Estados Unidos), también sin cuenta al empezar. */
  intlPhone: string;
  /** Guarda la sesión actual del dispositivo; la función dice si el servidor todavía la acepta. */
  captureSession(): Promise<() => Promise<boolean>>;
}

// ---------- Consultas y favoritos (fase 3) ----------
import type { FavoritesApi, InquiriesApi } from "../../src/domain/api";

export type Persona = SeedOwner | "anon";

export interface InquiriesHarness extends ListingsHarness {
  /** Consultas con la sesión de esa persona (o sin sesión). */
  inquiries(who: Persona): InquiriesApi;
  favorites(who: Persona): FavoritesApi;
  /** El WhatsApp de la cuenta de esa persona (el que se copia a sus casas). */
  phone(who: SeedOwner): string;
  /** Lleva una consulta `days` días atrás (created_at y updated_at), saltándose las reglas como el servicio. */
  backdateInquiry(id: string, days: number): Promise<void>;
  /** `n` consultas de `who` hechas en las últimas horas a `n` casas activas nuevas del otro propietario (como el servicio). */
  seedContacts(who: SeedOwner, n: number): Promise<void>;
  /** `n` aperturas de ficha (`listing_view`) de esa casa, hace `daysAgo` días (como el worker al recibir la baliza). */
  recordViews(publicId: string, n: number, daysAgo?: number): Promise<void>;
  /** `n` toques en «Contactar por WhatsApp» (`whatsapp_tap`) de esa casa, hace `daysAgo` días. */
  recordTaps(publicId: string, n: number, daysAgo?: number): Promise<void>;
}

// ---------- Calendario (fase 4) ----------
import type { OwnerCalendarApi } from "../../src/domain/api";
import type { CalendarDay } from "../../src/domain/calendar";

export interface CalendarHarness extends InquiriesHarness {
  /** Calendario con la sesión de esa persona (o sin sesión). */
  calendar(who: Persona): OwnerCalendarApi;
  /** La reapertura nocturna (reopen_due_listings) con ese «hoy»; devuelve cuántas casas abrió (en toda la base). */
  reopenDue(today: string): Promise<number>;
  /** Escribe una fila de listing_days saltándose las reglas (como el servicio), p. ej. fuera de la ventana. */
  putDay(listingId: string, day: CalendarDay): Promise<void>;
}

// ---------- Suscripción (fase 5) ----------
import type { BillingServiceApi, OwnerBillingApi } from "../../src/domain/api";
import type { ReminderStatus } from "../../src/domain/subscription";

export interface StoredReminder {
  daysBefore: number;
  status: ReminderStatus;
  attempts: number;
  toPhone: string | null;
  body: string | null;
  providerRef: string | null;
  sentAt: string | null;
}

export interface SubscriptionHarness extends CalendarHarness {
  /** Suscripción con la sesión de esa persona (o sin sesión). */
  billing(who: Persona): OwnerBillingApi;
  /** Lo que usa el worker con la service role (y payment_setup_context con el JWT del usuario). */
  service: BillingServiceApi;
  ownerId(who: SeedOwner): string;
  /** El JWT de la sesión de esa persona, como lo recibe el worker en `Authorization`. */
  jwt(who: SeedOwner): Promise<string>;
  /** Ocupa las plazas 1..n de la oferta con casas de relleno paradas de la cuenta admin (como el servicio). */
  takeSlots(n: number): Promise<void>;
  /** Deja el último día gratis de la casa a `days` días de hoy (Costa Rica), como el servicio, sin el reloj de pruebas. */
  setDaysLeft(listingId: string, days: number): Promise<void>;
  /** profiles.is_active de esa cuenta (como el admin al desactivarla). */
  setAccountActive(who: SeedOwner, active: boolean): Promise<void>;
  /** Avisos de una casa tal como están en la base, del umbral más alto al más bajo (como el servicio). */
  reminders(listingId: string): Promise<StoredReminder[]>;
  /** Los ids de la pasarela guardados para esa cuenta (como el servicio); null sin método. */
  storedMethod(who: SeedOwner): Promise<{ customerRef: string; methodRef: string } | null>;
  /** Crea o borra el secreto bnbtico_test_clock de Vault; devuelve si estaba. */
  setTestClock(on: boolean): Promise<boolean>;
}
