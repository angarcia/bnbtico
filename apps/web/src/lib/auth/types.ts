export type Role = "guest" | "owner";

export interface Account {
  id: string;
  name: string;
  phone: string; // E.164
  phoneVerified: boolean;
  email?: string;
  description?: string;
  isOwner: boolean;
  /** Revisa anuncios en /admin. Lo marca `seed_admin` (local/pruebas) o una sentencia SQL; nunca la app. */
  isAdmin: boolean;
}

export type StartInput = { mode: "register"; name: string; phone: string } | { mode: "login"; phone: string };

export interface Pending {
  mode: "register" | "login";
  name?: string;
  phone: string;
  /** Momento del último envío (ms), para el enfriamiento de 30 s. */
  sentAt: number;
}

export interface Result {
  ok: boolean;
  error?: string;
}

export interface AuthProvider {
  /** Pide un código para el número. Deja la verificación pendiente. */
  start(input: StartInput): Promise<Result>;
  /** Número y modo pendientes de verificar, si los hay. */
  pending(): Promise<Pending | null>;
  /** Comprueba el código y abre sesión. */
  verify(code: string): Promise<Result>;
  /** Vuelve a pedir el código del número pendiente. */
  resend(): Promise<Result>;
  cancel(): Promise<void>;
  current(): Promise<Account | null>;
  updateProfile(patch: Partial<Pick<Account, "name" | "email" | "description" | "isOwner">>): Promise<Result>;
  logout(): Promise<void>;
  /** true cuando no se envían WhatsApp reales (código de ejemplo). */
  readonly demo: boolean;
}

/** Almacén de cookies mínimo, para no depender de Next en las pruebas. */
export interface CookieJar {
  get(name: string): string | null;
  set(name: string, value: string, options?: { maxAge?: number }): void;
  delete(name: string): void;
}
