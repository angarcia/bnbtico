# #6 · Exportación iCal por casa

> Ejecución por el agente en esta sesión con `superpowers:executing-plans`, siguiendo el diseño móvil ya aprobado. Ana ejecuta los comandos y las pruebas. Sin cambios en GitHub, despliegues ni interfaces de #7/#8.

**Objetivo:** generar y copiar un enlace de lectura que exporte solo noches bloqueadas manualmente en bnbtico, sin devolver a Airbnb sus propios bloqueos.

**Arquitectura:** Postgres autoriza la generación y guarda un secreto de 256 bits por casa en una tabla privada. Un endpoint del worker consulta por token, sin sesión, y serializa una proyección acotada de `listing_days`. La tarjeta móvil usa PostgREST con JWT para obtener/generar el enlace; el secreto vive en estado efímero de la tarjeta, sin Query/IndexedDB ni mutaciones persistidas.

**Stack:** PostgreSQL/RLS/RPC, TypeScript estricto, Hono, React/TanStack; Vitest, contrato fake/PostgREST y Playwright móvil.

**Spec:** historia #6 leída de GitHub el 2026-11-08; `.scratch/calendarios-externos/spec.md`, P1/P4/P5 y `diseno-v0.1.md`, apartado Exportar. Ana pidió continuar tras aceptar #5 y fusionar la PR #30 en develop. Rama inspeccionada: `codex/integracion-ical`.

## Condiciones y límites

- Ventana de 366 noches: hoy de Costa Rica…hoy +365, incluidas. Última salida exclusiva hoy +366.
- Exportar `listing_days.available=false`; nunca usar el calendario efectivo para decidir la exportación. Precios, consultas, huésped, nombre de casa y ocupación exclusiva de Airbnb quedan fuera.
- Un VEVENT por noche, fecha completa, salida al día siguiente, UID estable compuesto por namespace aleatorio de la casa y fecha. No depende de precio, hora de lectura o token; modificar noches vecinas no renumera eventos.
- Generación idempotente y serializada con revocación; token criptográfico aleatorio de 32 bytes, no derivado del identificador público. Un enlace activo por casa. Se guarda privado para poder copiarlo al regresar; ninguna tabla de tokens se puede leer directamente desde navegador, incluido admin.
- Pausa del propietario conserva exportación. Bloqueo/rechazo suspende lectura sin destruir el enlace; desbloquear lo habilita otra vez. Eliminación de casa o revocación invalidan consultas posteriores. Cuenta desactivada no sirve fechas ni permite gestionar secretos.
- Respuestas GET/HEAD sin caché en todos los resultados, sin ETag ni redirecciones, sin escritura y sin reflejar token/URL. Ruta `/ical/<token>.ics`, nombres de archivo neutros y sin cookie. Preparar RPC de revocación para #7, sin botón en esta historia.
- Workers invocation logs incluyen la URL: revisar su configuración para que el enlace secreto no se persista allí. Mantener las balizas y logs explícitos saneados. El SW debe mandar `.ics` a red; añadir una regresión.
- El enlace de pruebas real requiere HTTPS público accesible a Airbnb; Cloudflare Access global puede bloquearlo. Documentar esta condición y mantener separados build/local y validación real; esta tarea no modifica Access ni publica nada.
- Menús y cadencia de Airbnb contrastados con su ayuda oficial: `https://es.airbnb.com/help/article/99`. No equiparar generar/copiar con conexión real ni prometer aplicación inmediata.

## Riesgos que deben tener prueba

1. Una noche coincidente manual/Airbnb se exporta una sola vez; quitar manual deja Airbnb en bnbtico pero retira el evento exportado.
2. Un feed propio reimportado y después liberado no se sostiene por su copia importada: salida vacía si no quedan manuales.
3. Repetición/concurrencia no generan dos enlaces; revocar y regenerar no recupera el token anterior.
4. Bloqueo, cuenta desactivada y eliminación no dejan servir una copia vieja por caché ni permiten generar desde otra cuenta/admin.
5. Última noche, cambio de día CR, copia denegada y sesión cambiada no publican fechas fuera de ventana ni guardan/mezclan secretos.

## 1 · Frontera HTTP y contrato de exportación

Archivos: pruebas `tests/unit/ical-export-worker.test.ts`, dominio `src/domain/ical-export.ts`, renderer `src/server/ical-export.ts`, registro en `server/app.ts`/`index.ts`, ruta en `wrangler.jsonc`.

- [x] Prueba HTTP primero sobre createApp existente: token mal formado da 404/no-store; POST/PUT/PATCH/DELETE dan 405 sin efectos.
- [x] Ana observa el fallo por comportamiento ausente antes de implementar el handler.
- [x] Definir `OwnerIcalExport { generated, suspended, token, nights }`, `IcalExportSnapshot { id, nights }` e `IcalExportService.owner(jwt,id,generate)`, `.revoke(jwt,id)` y `.read(token)`. Validadores de respuestas con cotas.
- [ ] Renderer `serializeManualCalendar(snapshot, now)` con RFC 5545, CRLF, VERSION/PRODID, UID/DTSTAMP/DTSTART/DTEND, SUMMARY neutro y TRANSP:OPAQUE. Máximo 366 eventos y líneas ≤75 octetos. Validar con un parser independiente y repetir lectura sin cambiar UID.
- [ ] Handler GET/HEAD y métodos rechazados, fallos seguros, token inválido/desconocido indistinguible, sin sesión, sin cookies ni caché. No registro del token.

## 2 · Base y equivalencia con fake

Archivos: migración nueva en `supabase/migrations/`, `data/postgrest/ical-export.ts`, `data/fake/ical-export.ts`/`db.ts`, contrato `tests/contract/ical-export.contract.ts` y entradas unit/db; permisos DB. No editar migraciones anteriores ni tipos generados a mano.

- [ ] Contrato previo a SQL/UI: permisos, idempotencia, ventana, independencia de importación, liberación con solapamiento, consulta sin bloqueo, ciclo, estados y revocación.
- [ ] Tabla privada `ical_exports`, RLS/grants de servicio; RPC owner `owner_ical_export(p_listing,p_generate)`, `revoke_ical_export(p_listing)` y lectura exclusiva de servicio `read_ical_export(p_token)`.
- [ ] Implementar fake usando la capa `db.days` y no `fakeEffectiveDays`; limpiar exportaciones con reset de pruebas.
- [ ] Ana aplica migración local, regenera tipos y ejecuta contrato contra PostgREST y permisos reales. Revisar si afecta al creador de datos de prueba; no alterarlo si la nueva tabla opcional no cambia su contrato.

## 3 · Generar y copiar en el diseño móvil aprobado

Archivos: tarjeta `client/ical-export.tsx` o módulo equivalente diferido, adaptador en session-client/supabase-data; composición en `screens/airbnb.tsx`, fila `airbnb-calendar-row.tsx`, estilos compartidos existentes, pruebas e2e.

- [ ] Después del contrato de permisos en verde, incorporar tarjeta «Exportar hacia Airbnb» bajo Importar: carga, sin enlace, generando, error, URL real de solo lectura, copia confirmada o alternativa manual, vacío válido e instrucciones verificadas.
- [ ] Enlace independiente de importación; la fila de entrada reconoce también una exportación sin importación. Guardar estado sin token en el resumen persistible; no persistir URL/token en Query, mutaciones o telemetría.
- [ ] Conservar foco, selección manual del enlace, contexto casa/mes, limpieza al salir/cambiar sesión y textos de usted. Sin botones de revocación/gestión futura.
- [ ] Pruebas de generación/copia/fallo, portapapeles denegado, enlace correcto por casa y sin ampliar los presupuestos existentes. Abrir en móvil local, sin dar por verificado el JSX por lectura.

## 4 · Entrega y evidencia

- [ ] Actualizar arquitectura, telemetría/observabilidad, guía local, diseño implementado y `docs/pruebas-manuales.md`: consultar ICS sin sesión, importarlo en Airbnb, liberar manual y ausencia de ciclos. Indicar qué requiere Airbnb real y qué no puede probarse con localhost/Access.
- [ ] Ana ejecuta tipos, pruebas pertinentes y suite unitaria general; regresión de calendario/importación, DB/permisos, e2e, build/tamaño y comprobaciones de hidratación afectadas. Registrar fallos y recuperaciones sin afirmar verde total si no existe.
- [ ] Revisar diff/documentación y preparar comandos selectivos solo cuando se pida commit. No despliegue ni cambios de GitHub; #7 sigue fuera de esta entrega.

## Evidencia inicial

#5 dispone de tablas separadas `airbnb_blocks` y `listing_days`, lecturas privadas por RPC, calendario efectivo y contratos. Las pruebas y CI se aceptaron en esta conversación y la PR #30 fue fusionada por Ana. No hay tabla, endpoint, token ni tarjeta de exportación ya implementados. GitHub #4 no tiene cuerpo; #6 conserva los seis criterios de la preparación local. No hay bloqueo de reglas/diseño para empezar el backend de #6.

## Evidencia y estado al preparar el backend

- Se incorporó `origin/develop` por fast-forward de `5a27a61` a `1ecb19d`, conservando la rama `codex/integracion-ical`.
- Primer resultado observado: 11/11 pruebas de importación en verde y 5/5 pruebas nuevas HTTP fallando por recibir shell/200 en lugar de 404/405. Se implementó la frontera de lectura y se añadieron cuatro casos de feed.
- Segundo resultado observado: 5 pruebas de frontera correctas, 4 fallos esperados de feed (todavía 404 en lugar de ICS/200 o error 503). Después se escribió renderer/lector y tratamiento de errores. La implementación posterior aún no está ejecutada ni declarada verde.
- Ana reportó un fallo de #5 en `nueva.bnbtico.com`: las dos migraciones de #5 no estaban aplicadas en Supabase de pruebas. Revisó un dry-run, las aplicó explícitamente con la CLI y confirmó «ya está». No se aplicó remotamente nada de #6. La guía exige comprobar esquema antes de publicar código dependiente.
- Contrato de nueve casos escrito antes de fake y SQL; están preparados la migración, ambos adaptadores, permisos DB y proyección de metadatos sin token. Falta ejecutarlos: no se afirma un ciclo RED SQL observado. Ana se fue a dormir tras la comprobación HTTP y se preparó el backend con verificaciones pendientes; se conserva la ejecución de consola por Ana.
- Lector independiente elegido: `ical.js@2.2.1`, solo desarrollo; falta que Ana lo añada con pnpm y genere el lockfile. Script reproducible local: `comprobar-backend-06.sh`, sin --linked ni arranque/reset/stop.
- UI de #6 todavía sin implementar: debe esperar contrato y permisos de base en verde. Pendientes guía visual/e2e y pruebas generales, build/tamaño y aceptación real de Airbnb. Sin commit, push, despliegue ni modificación de GitHub de #6.
- Las nuevas suites DB usan `icalExportHarness`: limpia solo los IDs creados por su propia suite y conserva las casas manuales reservadas. El arnés general existente borra todas las casas al hacer reset; por eso el script de esta entrega no ejecuta las antiguas suites DB de #5. La regresión de origen importado, coincidencias y ciclos está cubierta en el nuevo contrato compartido; la regresión fake de #5 sigue en el script. Esta preparación también queda pendiente de ejecución.
- Validación aportada por Ana en `/tmp/bnbtico-export-backend.log`: 61/61 unitarias, migración local `20261108085000` aplicada, tipos regenerados, typecheck correcto y 10/10 pruebas DB (contrato y permisos). La puerta de backend queda satisfecha para implementar UI; ninguna migración de #6 aplicada en remoto.
- Preparada la primera prueba E2E de generación/copia real y vuelta al calendario; pendiente observar fallo con la UI de #5 antes de implementar la tarjeta aprobada.
- RED móvil observado en `/tmp/bnbtico-export-ui.log`: build correcto; E2E falla al buscar el encabezado «Exportar hacia Airbnb», ausente en la UI de #5. Después se implementa la tarjeta aprobada con generación, recuperación, copia, fallback de selección manual, estados vacío/carga/error/suspensión e instrucciones. Se añaden dos recorridos de errores de generación y portapapeles. No se declaran E2E ni revisión visual en verde aún.
- Primer intento tras implementar UI: typecheck y build correctos; primer E2E falla al localizar la etiqueta exacta del textarea, los otros dos quedan sin ejecutar por modo serial. El snapshot confirma generación real, URL y botón de copia presentes. El textarea anidado incluía su valor en la búsqueda textual de la etiqueta; se separan etiqueta/campo y se asocian mediante `htmlFor`/`id`. Pendiente repetir los tres recorridos.
- Repetición aportada por Ana: typecheck, build y los tres E2E correctos (11,9 s). Generación/copia real, retorno, recuperación al recargar, ICS sin precios, error/reintento y portapapeles denegado comprobados.
- Revisión visual del agente en localhost con cuenta de pruebas `8777 0001`, tras autorización de Ana para cambiar la sesión: pantalla de Calendario existente y tarjeta de exportación con enlace/vacío a 375×667 y 390×844. Sin solapamientos ni desbordamiento horizontal; captura `/tmp/bnbtico-exportacion-movil.jpg`. Viewport restaurado; pestaña local conservada. Pendientes suite unitaria completa, tamaño y aceptación de Airbnb real; ninguna publicación realizada.
- Regresión general: 125 archivos / 2225 pruebas correctos; `private-sheets` no arrancó por faltar `CHROMIUM_PATH`. Repetida con Chrome: 14/14 correctas (18 s), total 2239 pruebas verificadas entre ambas ejecuciones. Tamaño: JS inicial privado 153,97 kB / 160 kB correcto; grupo Airbnb 6,21 kB / 5 kB falla. La nueva tarjeta se incluye en el grupo diferido de Airbnb; no aparecen parser iCal ni `ical.js` en sus artefactos. Falta resolver el presupuesto de este grupo antes de declarar la entrega verificada; los demás límites pasan. No se modifica el límite sin acordarlo con Ana.
- Ana aprueba ampliar solo el presupuesto diferido de Airbnb a 6,5 kB para incluir #6. Actualizados `.size-limit.json` y `docs/decisiones.md`; pendiente repetir únicamente `pnpm --filter app size`, sin cambios en el código probado.
- Repetición de tamaño en `/tmp/bnbtico-export-size.log`: todos los grupos cumplen; Airbnb 6,21 kB / 6,5 kB. Validación local disponible: 2239 unitarias entre la suite general y la repetición de `private-sheets`, 10 DB, tres E2E móviles, typecheck, build, tamaño y revisión visual a 375/390 px. Queda pendiente la integración real en Airbnb con HTTPS público; no se ha aplicado #6 remotamente, hecho commit/push, modificado GitHub ni desplegado.
- Corrección durante la PR #41: el commit `ef10df1` omitió por error `20261108085000_exportar_ical.sql`, aunque incluía sus tipos generados. El log de CI muestra que su regeneración elimina únicamente la tabla/RPCs de #6. Se incorpora la migración idéntica a la ya validada en local y aplicada por Ana en Supabase de pruebas; no se retocan los tipos para ocultar la discrepancia. Pendiente confirmar el nuevo resultado de CI tras subir la corrección.
