// La tarjeta de una casa (Explorar, Favoritos y el mapa a pantalla completa).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

import { plural } from "../../../domain/plural";

export const contactHost = ({ name }: { name: string }) => `Contactar por WhatsApp a ${name}`;
export const studio = "Estudio";
export const bathrooms = ({ count }: { count: number }) => plural(count, { one: `${count} baño`, other: `${count} baños` });
