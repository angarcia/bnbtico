// Favoritos. Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.

import { plural } from "../../../domain/plural";

export const title = "Favoritos";
export const count = ({ count, signedIn }: { count: number; signedIn: boolean }) =>
    signedIn
      ? plural(count, { one: `${count} casa guardada`, other: `${count} casas guardadas` })
      : plural(count, { one: `${count} casa · guardada en este teléfono`, other: `${count} casas · guardadas en este teléfono` });
export const emptyTouch = "Toque el corazón de una casa para guardarla aquí.";
export const emptyClick = "Pulse el corazón de una casa para guardarla aquí.";
export const explore = "Explorar casas";
export const noticeTitle = "Compare y escriba directo";
export const noticeText = "Escriba directo desde aquí. Guardar casas no necesita cuenta; para escribir solo verifica su WhatsApp con un código.";
