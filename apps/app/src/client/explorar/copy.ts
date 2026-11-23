// Textos de las pantallas de Explorar (estructura por áreas, paso 3: catálogos a mano, decisión del 2026-11-23). Mensajes
// completos, con los datos como parámetros con nombre; plurales con domain/plural.

import { plural } from "../../domain/plural";

export const FAVORITES_COPY = {
  title: "Favoritos",
  count: ({ count, signedIn }: { count: number; signedIn: boolean }) =>
    signedIn
      ? plural(count, { one: `${count} casa guardada`, other: `${count} casas guardadas` })
      : plural(count, { one: `${count} casa · guardada en este teléfono`, other: `${count} casas · guardadas en este teléfono` }),
  emptyTouch: "Toque el corazón de una casa para guardarla aquí.",
  emptyClick: "Pulse el corazón de una casa para guardarla aquí.",
  explore: "Explorar casas",
  noticeTitle: "Compare y escriba directo",
  noticeText: "Escriba directo desde aquí. Guardar casas no necesita cuenta; para escribir solo verifica su WhatsApp con un código.",
} as const;
