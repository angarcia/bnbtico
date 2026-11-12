# Contrato técnico #6 · Exportación iCal

Preparado el 2026-11-08, pendiente de ejecutar las comprobaciones locales. Referencias de producto: #6, P1/P4/P5 de `spec.md` y diseño móvil aprobado `diseno-v0.1.md`. No incorpora UI de revocación ni programación de #7/#8.

## Origen y archivo

`listing_days` sigue siendo la única capa manual/precios. El feed filtra `available=false` en hoy CR…hoy+365. No consulta `effective_calendar_days` para decidir ocupación: un importado exclusivo nunca se devuelve, y retirar un manual coincidente lo retira de la exportación aunque Airbnb mantenga ocupada la noche aquí. Registrar una consulta no escribe en esa capa.

El worker genera RFC 5545 con CRLF, VERSION:2.0, PRODID fijo y eventos de día completo, sin METHOD, recurrencias ni zonas horarias para fechas completas. Un evento por noche: DTSTART incluido, DTEND al día siguiente excluido; la última noche admite DTEND hoy+366. UID estable por namespace aleatorio de exportación y fecha, independiente de token/hora/precio/vecinos. DTSTAMP UTC de la lectura. SUMMARY genérico «Ocupado» y TRANSP:OPAQUE; sin título de casa, huésped, precios, teléfonos ni URL en el archivo. Proyección y serialización acotadas a 366 noches; lector independiente de pruebas `ical.js` 2.2.1, solo dependencia de desarrollo.

## Modelo privado y transiciones

`ical_exports`: PK `listing_id`, `id` aleatorio para UID, `token` único de 64 caracteres hexadecimales (32 bytes de pgcrypto), fechas de generación/revocación. El token se conserva privado para que el dueño pueda volver a copiarlo; al revocar se elimina el valor y se conserva el namespace. Tabla con RLS y sin grants de lectura/escritura para anon o authenticated, incluido admin aal2.

- `owner_ical_export(p_listing uuid,p_generate boolean default false) → {generated,suspended,token,nights}`: solo dueño con cuenta activa/WhatsApp verificado. Generar exige casa enviada alguna vez y sin rechazo/bloqueo administrativo. Lock de listing antes de exportación, creación/reintento idempotentes, un enlace activo por casa. Obtener sin generar nunca inventa un token. Durante suspensión retorna presencia y token null.
- `revoke_ical_export(p_listing uuid) → void`: mismo dueño y cuenta habilitada, mismos locks; elimina token y marca revocación. Sin interfaz todavía. Regenerar crea otro token, conserva UID y no revalida el viejo.
- `read_ical_export(p_token text) → {id,nights} | null`: solo service_role. Token y estado se comprueban en cada lectura; consulta anónima pasa únicamente por el worker, no por esta RPC con una sesión de usuario.
- `airbnb_overview` añade únicamente `exportGenerated:boolean`: el resumen que se persiste no lleva token ni URL. El lector de #5 admite ausencia de ese campo para transición de versiones.

Pausa del propietario conserva el feed. Bloqueo/rechazo administrativo lo suspende y desbloquear lo habilita, sin regenerar. Cuenta inactiva no sirve fechas ni gestiona secretos. Eliminación lógica invalida el token mediante trigger y física elimina la fila por FK. Revocación no promete retirar datos que Airbnb ya haya leído ni bytes de una respuesta anterior ya enviada.

## HTTP y observabilidad

GET/HEAD `/ical/<token>.ics`, sin JWT/cookies. Ruta marcada `run_worker_first`, nunca SPA ni caché del SW. GET devuelve `text/calendar; charset=utf-8`; HEAD valida el mismo acceso sin cuerpo. Métodos de escritura 405 con Allow: GET, HEAD. Token inválido/desconocido/revocado/no habilitado da 404 neutro; fallo interno 503, nunca calendario vacío de éxito. Producción cerrada al lanzamiento sigue sin servir fechas; su rechazo iCal tampoco se cachea.

Todos los resultados del endpoint: Cache-Control/CDN-Cache-Control/Cloudflare-CDN-Cache-Control no-store, sin ETag, Referrer-Policy no-referrer, nosniff y noindex/nofollow/noarchive. No redirecciones ni respuestas que reflejen token/URL/error remoto. El cliente no debe persistir el secreto en Query, mutaciones, IndexedDB o eventos; la tarjeta lo mantiene solo en memoria y lo descarta al cambiar de casa/sesión o desmontarse.

`observability.logs.invocation_logs=false` evita guardar automáticamente la URL-capacidad en Workers Logs; los logs explícitos saneados permanecen habilitados. Antes de probar fuera de local, revisar también que Access, reglas de caché o logs de la infraestructura no registren/obstruyan la ruta. No se modifica Access en esta entrega. Ayuda oficial sobre los registros de invocación: https://developers.cloudflare.com/workers/observability/logs/workers-logs/.

## Validación y despliegue pendiente

Contrato común contra fake y PostgREST: generación por casa, sesiones ajenas, repetición/concurrencia, 366 noches, consulta sin bloqueo, precio sin bloqueo, manual/Airbnb/ambos, liberación, reimportación de un propio sin ciclo, revocación/regeneración y estados. Prueba DB separada con anon/dueño/otro/admin aal2 para ACL de tabla y lectura de servicio. Las suites nuevas rechazan una URL Supabase que no sea local antes de sembrar datos.

Ana ejecutó `comprobar-backend-06.sh`, sin start/reset/stop: 61 unitarias, migración local, tipos y 10 DB correctos. La migración opcional por casa no requiere cambiar `scripts/casas-de-prueba.mjs`: no modifica sus inputs ni crea conexiones por defecto. Tipos generados por la CLI, no a mano. La tarjeta móvil se implementó después de superar permisos y contratos reales; supera tres E2E, tipos/build y revisión visual a 375/390 px. Regresión completa: 2239 unitarias entre la ejecución general y la repetición de `private-sheets` con Chrome. Tamaño correcto tras aprobación de Ana: Airbnb 6,21 kB / 6,5 kB, JS inicial privado 153,97 kB / 160 kB.

No confundir despliegue del worker con actualización de la base: la migración #6 debe revisarse/aplicarse en pruebas mediante un paso autorizado aparte antes de publicar la UI que la necesita. #5 evidenció este requisito: sus dos migraciones estaban en GitHub pero faltaban en Supabase alojado; Ana las aplicó y confirmó la pantalla recuperada. No aplicar la nueva migración remotamente como parte de estas comprobaciones locales.

Prueba real de Airbnb pendiente: requiere un enlace HTTPS accesible sin cookies ni Cloudflare Access; localhost no sirve. Copiar/generar no acredita conexión, primera consulta ni retirada de un bloqueo en Airbnb. Instrucciones contrastadas con https://es.airbnb.com/help/article/99, sin promesa de actualización inmediata. RFC: https://www.rfc-editor.org/rfc/rfc5545.
