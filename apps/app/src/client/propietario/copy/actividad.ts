// Actividad: las consultas de los clientes (trozo diferido actividad-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

import { plural } from "../../../domain/plural";

export const title = "Consultas";
export const loading = "Cargando su actividad";
export const fresh = ({ count }: { count: number }) =>
  count === 0 ? "Sin consultas nuevas" : plural(count, { one: `${count} consulta nueva`, other: `${count} consultas nuevas` });
export const noneForHouse = "Todavía no hay consultas de esta casa.";
export const foot = "La conversación está en su WhatsApp.";
export const untitled = "Casa sin título";
export const isNew = "Nueva";
export const bySupport = "Creada por 3bstays";
export const openWhatsapp = "Abrir WhatsApp";
