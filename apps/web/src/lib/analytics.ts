// Google Analytics (gtag.js). Se carga en el layout raíz, así cubre todas las páginas: «Muy pronto», la app y las fichas.
// NEXT_PUBLIC_GA_ID: sin definir → el de bnbtico; un `G-…` → ese; cualquier otro valor (p. ej. `off`) → desactivado.
// Vercel no admite variables vacías, por eso `off` es la forma de apagarlo en pruebas.
const DEFAULT_GA_ID = "G-PZ17LLFS6S";

export function gaId(env: { NEXT_PUBLIC_GA_ID?: string } = { NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID }): string | null {
  const value = env.NEXT_PUBLIC_GA_ID;
  if (value === undefined) return DEFAULT_GA_ID;
  return /^G-[A-Z0-9]+$/.test(value) ? value : null;
}

export const GA_ID = gaId();
