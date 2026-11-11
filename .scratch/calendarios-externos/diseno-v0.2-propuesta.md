# Diseño móvil v0.2 · Actualizar Airbnb desde Calendario

Estado: composición revisada y aprobada por Ana en el chat el 2026-11-09; ampliación de v0.1 para el acceso directo del Calendario. Skills: ana-ux-ui y ana-frontend-developer. Se conserva el alcance móvil, sin adaptación específica a escritorio. Implementación validada localmente con 23 E2E y capturas a 375/390 px; la revisión manual y las comprobaciones de Airbnb real siguen sus pasos separados.

## Objetivo

Actualizar la importación desde la pantalla donde se comprueban las noches, conservando el acceso de gestión vigente. Reducir una navegación para esa acción; no se atribuyen mejoras de uso o conversión sin observarlas.

## Composición aprobada · Actualizar a la izquierda

La fila pasa a «Sincronización con Airbnb», con resumen y chevrón. Añadir a su izquierda un botón independiente de 44×44 px con icono de actualizar, sin anidar botones. Título y chevrón abren la gestión vigente. Sin importación ni exportación: «Conectar con Airbnb» unido a las otras filas en la misma tarjeta blanca, sin espacio ni esquinas interiores. Tras conectar: sincronización sobre el fondo crema, sin tarjeta blanca. El menú de edición mantiene sus acciones y estructura; los iconos de «Marcar una reserva» y «Pausar la casa» pierden únicamente su recuadro para distinguirlos del botón independiente de actualizar. Selector, moneda, precios, meses y navegación se conservan.

El botón usa un fondo verde claro derivado del verde primario vigente y un icono de contorno de 20–24 px. Ana confirma ese tratamiento para reconocerlo como botón independiente; sin red queda gris y deshabilitado. Nombre accesible: «Actualizar importación de Airbnb»; el resumen permanente identifica la plataforma y la última lectura. Con texto largo, permitir que la fila crezca sin reducir letra ni objetivos táctiles.

## Estados y copy

- Sin conexión de importación ni exportación: «Conectar con Airbnb», sin botón de actualizar.
- Con importación conectada: «Sincronización con Airbnb», «Última importación: hoy, 10:30» y el botón independiente. Fecha/hora reales de Costa Rica en la implementación, no valores calculados ni promesas.
- En curso: «Actualizando…», control desactivado y nombre accesible de progreso. Conservar noches y última fecha correcta; al confirmar, «Calendario actualizado». Reutilizar el motor y la exclusión de #7, sin otra vía de escritura.
- Error: «No se pudo actualizar» y «Última correcta: hoy, 10:30. Se conservan las noches importadas.». El mismo icono permite reintentar, con nombre «Reintentar importación de Airbnb». No alterar el éxito anterior.
- Sin red: «Sin conexión», actualizar desactivado; gestión permite consultar el estado guardado con sus restricciones actuales.
- Solo exportación: «Sincronización con Airbnb», «Enlace de exportación disponible», sin icono de actualizar. No se puede forzar ni conocer la lectura de Airbnb.
- Días sin guardar: gestión y actualización desactivadas, conservando la protección existente; «Guarde o cancele los días seleccionados antes de actualizar.»
- Casa suspendida administrativamente: actualizar desactivado; gestión conserva explicación y operaciones autorizadas de #7. Sin cron ni próxima hora de #8.

## Comprobación pendiente

Comprobar a 375 y 390 px, nombres/fechas largos y zoom; nombres accesibles, foco y objetivos de 44 px. El icono actualiza sin navegar; tocar el título/chevrón sigue abriendo gestión de esa casa, conservando mes y scroll. Mantener las garantías de una sola petición, red ambigua y cambio de cuenta de #7.

La maqueta inicial usa datos sintéticos y estados simulados; no acredita una sincronización real. La ampliación de disponibilidad de «Marcar una reserva» se especifica en `reservas-07.md`; Ana la aprueba en el mismo bloque. La actualización automática de #8 sigue fuera.
