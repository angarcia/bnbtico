// Arnés de la suite de contrato: el mismo archivo de pruebas corre contra el fake (unitarias) y contra PostgREST
// (proyecto de base). Cada arnés sabe sembrar casas en un estado concreto siguiendo el camino real de ese adaptador.
import type { PublicListingsApi } from "../../src/domain/api";
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
  reset(): Promise<void>;
  seed(spec: SeedSpec): Promise<Seeded>;
  ownerName(who: SeedOwner): string;
}

/** Borrador completo y válido (Cahuita, Limón), base de cada siembra. */
export const COMPLETE: Partial<ListingDraft> = {
  kind: "completo",
  acceptsNightly: true,
  acceptsMonthly: false,
  title: "Cabina Cahuita",
  description: "Cabina frente al parque.",
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
import type { AuthApi } from "../../src/domain/api";

export interface AuthHarness {
  /** Instancia recién abierta, sin sesión. */
  auth: AuthApi;
  /** La app se cierra y se vuelve a abrir: instancia nueva sobre el mismo almacenamiento del dispositivo. */
  restart(): AuthApi;
  /** Adelanta el reloj del adaptador (el enfriamiento y la caducidad del número pendiente se miden con él). */
  advance(ms: number): Promise<void>;
  /** Código válido para los números de prueba. */
  code: string;
  /** Número de prueba sin cuenta al empezar cada prueba. */
  phone: string;
  /** Guarda la sesión actual del dispositivo; la función dice si el servidor todavía la acepta. */
  captureSession(): Promise<() => Promise<boolean>>;
}
