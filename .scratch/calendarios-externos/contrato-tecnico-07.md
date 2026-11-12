# Contrato técnico de #7 · Gestión de calendarios

## Ampliación aprobada · 2026-11-09

`CalendarChange.requireFree=true` identifica exclusivamente «Marcar una reserva». El adaptador exige `available=false` y ausencia de precio y usa `mark_listing_reservation(p_listing,p_days)`. La RPC autoriza al dueño con cuenta activa y teléfono verificado, bloquea la casa, comprueba todas las noches contra `effective_calendar_days` y reutiliza `listing_days_update` dentro de la misma transacción. Un conflicto aborta toda la escritura. La edición manual normal conserva `save_listing_days`, que ahora comparte el bloqueo de casa; importación y administración ya usan ese orden de exclusión. No se cambian la exportación ni las consultas WhatsApp.

El frontend prepara la selección con el motor existente, reutiliza éxito de menos de 60 segundos y espera una lectura en curso hasta 25 segundos. Después relee los días; cierre/cambio de sesión descartan respuestas antiguas antes de actualizar la caché. Ante fallo externo conserva datos y exige confirmación; ante lectura denegada de disponibilidad impide seleccionar. No se persisten datos de huéspedes ni URLs. Migración: `20261109181419_proteger_reserva_calendario.sql`; contrato común: `reservation-availability.contract.ts`; E2E: `reservation-availability.spec.ts`. La ampliación tiene evidencia final propia, recogida a continuación.

Estado final local: Ana ejecutó tipos, 2258 unitarias, 8 DB de reservas/permisos y 23 E2E, todos correctos; build/10 pruebas de arquitectura y tamaño también correctos. El backend inicial pasó 68 unitarias y 20 DB antes de la UI. Sus pruebas iniciales fallaron antes de implementar, al igual que las de reservas. La ampliación de arriba está validada por esos resultados finales. Ana ejecuta verificaciones y todos los comandos de Git. Diseño aprobado v0.2 y reglas en `reservas-07.md`/`spec.md`; cambios de decisión registrados en `docs/decisiones.md`. Quedan separados la revisión manual, Airbnb real, migraciones alojadas y Git/PR/despliegue.

## Importación

Se conserva `runAirbnbImport`, la descarga acotada, el parser y las tablas de #5. `airbnb_reserve` mantiene su firma y el orden de bloqueo listing → conexión → intento. `claim_airbnb_import` conserva su permiso exclusivo de servicio para pruebas/#8. No hay cron nuevo.

- `begin_airbnb_update(p_listing,p_request,p_url default null)`: JWT del propietario habilitado. Sin URL reclama actualización del enlace confirmado; con URL reclama sustitución. Un único intento en curso por casa durante la misma ventana de 30 segundos que #5. Repetir el requestId no crea trabajo; usarlo para otra casa u operación se rechaza.
- `airbnb_import_attempts.operation` identifica conexión, actualización, sustitución o desconexión. `candidate_url` conserva temporalmente el enlace a leer; se elimina al finalizar u obsoletar el intento. Nunca se entrega al navegador. En caso de fallo, `private_url`, importados y último éxito permanecen intactos. Solo `finish_airbnb_import` válido publica candidata + nueva instantánea en la misma transacción.
- `last_error_at` registra el momento de un fallo nuevo, independientemente de `last_success_at`. Ambos se conservan durante el reintento; un éxito limpia código/fecha de error. No se inventa hora para los errores anteriores a la migración.
- `disconnect_airbnb(p_listing,p_request)`: propietario habilitado, incluso si la casa está suspendida administrativamente. Invalida intentos y versión, elimina URL/importados, limpia los metadatos de la conexión y conserva la capa manual, precios y exportación. Guarda la petición como operación terminada para que un reintento antiguo no desconecte una reconexión posterior.
- Toda respuesta tardía con versión antigua, cuenta desactivada, casa eliminada/bloqueada/rechazada o intento expirado queda sin efecto.

El endpoint de #5 acepta `action` omitida o `connect` para compatibilidad; #7 añade `refresh` y `replace`. Actualizar no admite URL enviada por cliente; sustituir exige una candidata válida. Se conservan Origin/JWT, tamaño máximo y mensajes saneados. Si existe error anterior y el intento sigue en curso, la respuesta comunica progreso en lugar de anunciar el error anterior como resultado del nuevo intento.

El navegador obtiene estado y desconecta directamente por PostgREST; solo las dos operaciones que leen una URL externa pasan por el worker. Ninguna URL privada entra en Query/IndexedDB, variables de mutación persistidas o registros.

## Exportación

Se reutiliza `revoke_ical_export` de #6. `ical_exports.generation` aumenta únicamente al generar un nuevo token; el namespace del UID permanece. `owner_ical_export` añade generación al DTO efímero (0 si nunca hubo enlace). El lector acepta ausencia del campo por compatibilidad, pero la interfaz futura debe exigir una generación conocida antes de revocar.

`revoke_ical_export_generation(p_listing,p_generation)` comprueba dueño/cuenta y bloquea listing/exportación como #6. Repetir la revocación de la misma generación es inocuo; si ya hay una generación posterior, rechaza el intento antiguo sin retirarla. El navegador debe reconciliar una respuesta desconocida con `overview`, sin anunciar éxito ni repetir contra una generación distinta. La revocación no cambia importación ni bloqueos manuales.

## Permisos y migración

`20261108220000_gestionar_calendarios.sql` altera tablas privadas existentes; conserva RLS, prohíbe grants directos a anon/authenticated/admin y mantiene RPCs de servicio fuera del navegador. `airbnb_check_owner` es auxiliar privada, sin permiso de ejecución cliente. Los tres nuevos puntos de gestión se conceden solo a authenticated y comprueban propiedad/cuenta en SQL.

No requiere cambios en `casas-de-prueba.mjs`: las nuevas columnas tienen valores por defecto o son nulas y no cambian la publicación de casas. Ana aplicó la migración local y regeneró tipos con el script; no se ha aplicado #7 en el proyecto alojado.

## Verificación pendiente

`comprobar-backend-07.sh`: unidades nuevas y regresión, base local al día, tipos, typecheck y contratos/permisos DB. Las suites nuevas reutilizan el arnés acotado de #6, sin reset global. Cubre exclusión, reintentos, sustitución fallida/correcta, desconexión en vuelo con solapamiento y revocación frente a regeneración. No declara RED/verde SQL observado.

Tras contratos/permisos en verde, dos E2E fallaron por controles Desconectar/Revocar ausentes. Se implementó la UI según diseño aprobado y se ampliaron los recorridos a error/actualización/doble pulsación, sustitución y respuestas perdidas en desconexión/revocación. Falta ejecutar `comprobar-ui-07.sh`, revisar móvil y comprobar tamaño/regresión. No realizar push/PR hasta comprobar esquema/tipos local y migraciones en el proyecto de pruebas correcto, mediante dry-run revisado y aplicación separada autorizada.
