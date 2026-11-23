// Textos de la ficha pública, que pinta el worker y la SPA (estructura por áreas, paso 3: catálogos a mano, decisión del
// 2026-11-23). Mensajes completos, con los datos como parámetros con nombre. Donde la frase lleva marcado en medio (el
// nombre en negrita), la función recibe esa pieza y devuelve la frase entera en trozos, sin partirla en el componente.

export const LISTING_COPY = {
  back: "Volver a Explorar",
  unavailable: "No disponible por ahora",
  contact: "Contactar por WhatsApp",
  loadingContact: "Cargando contacto…",
  availability: "Disponibilidad",
  calendarUnavailable: "Calendario no disponible",
  host: ({ verified }: { verified: boolean }) => (verified ? "Anfitrión · WhatsApp verificado" : "Anfitrión"),
  hostVerifiedHint: "Confirmamos que este número recibe mensajes de WhatsApp",
  negotiable: "A negociar",
  negotiableInline: "a negociar",
  perMonth: ({ amount }: { amount: string }) => `${amount} / mes`,
  perMonthSuffix: "/ mes",
  parking: ({ paid }: { paid: boolean }) => (paid ? "Parqueo de pago" : "Parqueo gratis"),
  approxArea: "Zona aproximada",
  fxHint: ({ rate, day }: { rate: string; day: string }) => `Orientativo: ≈ ${rate} por US$1, tipo de referencia del ${day}`,
  publishedBy: <T,>({ owner, verified }: { owner: T; verified: boolean }) =>
    ["Publicada por ", owner, `${verified ? " · WhatsApp verificado" : ""}. Sin comisiones: fechas, precio y pago los acuerda directamente con el anfitrión. 3bstays no procesa pagos.`] as const,
  priceNote: "Precios orientativos: el precio final lo acuerda con el anfitrión.",
} as const;
