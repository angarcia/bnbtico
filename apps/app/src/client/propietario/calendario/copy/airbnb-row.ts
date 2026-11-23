// La fila de Airbnb del Calendario, su leyenda y los días importados (grupo de trozo airbnb).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

import { plural } from "../../../../domain/plural";

export const legend = "Bloqueado por Airbnb";
export const state = ({ manual, imported, total }: { manual: number; imported: number; total: number }) =>
  imported === total && manual === total
    ? "Bloqueo manual y Airbnb"
    : imported === total && manual === 0
      ? "Ocupado por Airbnb · sin bloqueo manual"
      : `${manual} con bloqueo manual · ${imported} con bloqueo de Airbnb`;
export const manualAvailability = "Disponibilidad manual";
export const freeOption = ({ manual }: { manual: boolean }) => (manual ? "Quitar bloqueo manual" : "Sin bloqueo manual");
export const busy = "Ocupado";
export const stillBusy = ({ count }: { count: number }) =>
  plural(count, {
    one: "Esta noche sigue ocupada por Airbnb. Para liberarla, cambie el calendario en Airbnb y actualice la importación. Sus precios se conservan.",
    other: `${count} noches siguen ocupadas por Airbnb. Para liberarlas, cambie el calendario en Airbnb y actualice la importación. Sus precios se conservan.`,
  });
export const updateLabel = ({ running, failed }: { running: boolean; failed: boolean }) =>
  running ? "Actualizando importación de Airbnb" : failed ? "Reintentar importación de Airbnb" : "Actualizar importación de Airbnb";
export const rowTitle = ({ connected }: { connected: boolean }) => (connected ? "Sincronización con Airbnb" : "Conectar con Airbnb");
export const updating = "Actualizando…";
export const offline = "Sin conexión";
export const failed = "No se pudo actualizar";
export const lastImport = ({ at }: { at: string }) => `Última importación: ${at}`;
export const exportReady = "Enlace de exportación disponible";
export const saveFirst = "Guarde o cancele los días seleccionados antes de abrir la conexión.";
