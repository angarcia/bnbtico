// Componentes comunes del JS inicial. Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.

export const less = ({ unit }: { unit: string }) => `${unit} menos`;
export const more = ({ unit }: { unit: string }) => `${unit} más`;
export const retry = "Reintentar";
export const loadError = "No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.";
export const logo = "3bstays";
export const mainNav = "Navegación principal";
