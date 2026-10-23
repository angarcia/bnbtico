// Error del dominio: siempre con un mensaje en español listo para mostrar.
// Los mensajes que lanzan las RPC y el trigger de la base ya están en español y pasan tal cual (código P0001);
// los códigos de PostgREST, Postgres y GoTrue se traducen; cualquier otra cosa recibe un mensaje genérico.

export type DomainErrorKind = "validation" | "forbidden" | "not_found" | "conflict" | "session" | "rate_limit" | "network" | "unknown";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly kind: DomainErrorKind,
    /** Solo en el límite de códigos de GoTrue: los segundos que pide esperar («after N seconds»). */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const GENERIC_MESSAGE = "Algo salió mal. Intente de nuevo en un momento.";
/** Turnstile no dio token o la protección de bots de Supabase Auth lo rechazó. */
export const CAPTCHA_FAILED = "No pudimos comprobar que usted es una persona. Recargue la página e intente de nuevo.";

const BY_CODE: Record<string, [DomainErrorKind, string]> = {
  // Postgres
  "42501": ["forbidden", "No tiene permiso para hacer esto."],
  "23505": ["conflict", "Ese dato ya existe."],
  "23503": ["conflict", "Lo que intenta usar ya no existe."],
  "23514": ["validation", "Algún dato no es válido. Revise el formulario."],
  "23502": ["validation", "Falta un dato obligatorio."],
  "22P02": ["validation", "Algún dato no tiene el formato correcto."],
  // PostgREST
  PGRST116: ["not_found", "No encontramos lo que busca."],
  PGRST301: ["session", "Su sesión venció. Ingrese de nuevo."],
  PGRST303: ["session", "Su sesión venció. Ingrese de nuevo."],
  // GoTrue
  otp_expired: ["validation", "Ese código no es correcto o caducó."],
  invalid_credentials: ["validation", "Ese código no es correcto o caducó."],
  over_sms_send_rate_limit: ["rate_limit", "Espere un momento antes de pedir otro código."],
  over_request_rate_limit: ["rate_limit", "Demasiados intentos. Espere un momento y vuelva a intentarlo."],
  signup_disabled: ["not_found", "No hay una cuenta con ese WhatsApp. Cree una cuenta."],
  otp_disabled: ["not_found", "No hay una cuenta con ese WhatsApp. Cree una cuenta."],
  sms_send_failed: ["unknown", "No pudimos enviar el código. Revise el número e intente de nuevo."],
  validation_failed: ["validation", "Revise el número e intente de nuevo."],
  captcha_failed: ["validation", CAPTCHA_FAILED],
  session_not_found: ["session", "Su sesión venció. Ingrese de nuevo."],
  session_expired: ["session", "Su sesión venció. Ingrese de nuevo."],
  refresh_token_not_found: ["session", "Su sesión venció. Ingrese de nuevo."],
  insufficient_aal: ["forbidden", "Confirme el segundo código para continuar."],
  mfa_verification_failed: ["validation", "Ese código no es correcto o caducó."],
  mfa_challenge_expired: ["validation", "Ese código caducó. Pida otro."],
  mfa_factor_not_found: ["validation", "Ese código caducó. Pida otro."],
  mfa_phone_enroll_not_enabled: ["unknown", "El segundo código no está disponible ahora. Escríbale a bnbtico por WhatsApp."],
  mfa_phone_verify_not_enabled: ["unknown", "El segundo código no está disponible ahora. Escríbale a bnbtico por WhatsApp."],
};

type RawError = { code?: unknown; message?: unknown; name?: unknown };

/** Convierte cualquier error de supabase-js (PostgREST, GoTrue, red) en un DomainError. */
export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const e = (error ?? {}) as RawError;
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  if (code === "P0001" && message) return new DomainError(message, "validation");
  if (code === "over_sms_send_rate_limit") {
    const after = /after (\d+) seconds/i.exec(message)?.[1];
    const seconds = after === undefined ? undefined : Number(after);
    const text = seconds !== undefined && seconds > 1 ? `Espere ${seconds} segundos antes de pedir otro código.` : BY_CODE[code]![1];
    return new DomainError(text, "rate_limit", seconds);
  }
  const known = BY_CODE[code];
  if (known) return new DomainError(known[1], known[0]);
  if (e.name === "TypeError" || e.name === "AuthRetryableFetchError" || /fetch failed|failed to fetch|network|load failed/i.test(message)) {
    return new DomainError("Sin conexión. Revise su internet e intente de nuevo.", "network");
  }
  return new DomainError(GENERIC_MESSAGE, "unknown");
}
