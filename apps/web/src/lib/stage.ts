/** `pruebas`: la app completa (pruebas.bnbtico.com, local). Cualquier otro valor: solo «Muy pronto» (bnbtico.com hasta el lanzamiento). */
export const appEnabled = () => process.env.NEXT_PUBLIC_STAGE === "pruebas" || process.env.NODE_ENV !== "production";
