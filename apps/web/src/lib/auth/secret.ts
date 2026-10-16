// Clave HMAC de las cookies firmadas. En producción es obligatoria (y larga); en local y pruebas hay un valor por defecto.
const DEV_SECRET = "bnbtico-dev-secret-solo-local";

export function sessionSecret(env: { SESSION_SECRET?: string; NODE_ENV?: string } = process.env): string {
  const value = env.SESSION_SECRET?.trim();
  if (value && value.length >= 32) return value;
  if (env.NODE_ENV === "production") throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres) en las variables de entorno.");
  return value || DEV_SECRET;
}
