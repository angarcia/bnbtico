// La barra de escritorio de la app.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

import { plural } from "../../../domain/plural";

export const brand = ({ about }: { about: boolean }) => (about ? "Qué es 3bstays" : "3bstays, inicio");
export const signIn = "Ingresar";
export const inquiries = "Consultas";
export const inquiriesFresh = ({ count }: { count: number }) => plural(count, { one: `Consultas, ${count} nueva`, other: `Consultas, ${count} nuevas` });
export const help = "Ayuda por WhatsApp";
