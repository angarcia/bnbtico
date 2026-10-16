/** `pruebas`: la app completa (pruebas.bnbtico.com, local). Cualquier otro valor en producción: solo «Muy pronto» (bnbtico.com hasta el lanzamiento). */
export const appEnabled = (env: { NEXT_PUBLIC_STAGE?: string; NODE_ENV?: string } = { NEXT_PUBLIC_STAGE: process.env.NEXT_PUBLIC_STAGE, NODE_ENV: process.env.NODE_ENV }) =>
  env.NEXT_PUBLIC_STAGE === "pruebas" || env.NODE_ENV !== "production";
