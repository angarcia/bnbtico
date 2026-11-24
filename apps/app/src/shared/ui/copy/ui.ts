// Componentes comunes del JS inicial. Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.
import type { StepperUnit } from "../stepper";

/** Lo que cuenta el contador, en singular con su artículo. */
const unitName = (unit: StepperUnit) => (unit === "people" ? "Una persona" : unit === "bedrooms" ? "Un dormitorio" : unit === "bathrooms" ? "Un baño" : "Una noche");
export const less = ({ unit }: { unit: StepperUnit }) => `${unitName(unit)} menos`;
export const more = ({ unit }: { unit: StepperUnit }) => `${unitName(unit)} más`;
export const retry = "Reintentar";
export const loadError = "No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.";
export const logo = "3bstays";
export const mainNav = "Navegación principal";
