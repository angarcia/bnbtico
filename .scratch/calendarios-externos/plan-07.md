# #7 · Gestión de calendarios por casa

## Alcance y referencias

Ana autoriza implementar #7 sin despliegues ni cambios en GitHub. Se aplican `ana-frontend-developer`, `ana-backend-developer` y `credit-saver`. Ana ejecuta todos los comandos, incluidos commits. Diseño móvil v0.1 aprobado, apartados Estado/Conectar y sustituir/Confirmaciones; escritorio y programación automática aplazados. Historia remota completa leída de `/tmp/bnbtico-historia-7.json`, sin comentarios.

Copia de trabajo existente: `/tmp/bnbtico-ical-merge`, limpia y en HEAD separado `b4d929a` (merge de PR #41). No cambiar su referencia Git ni usar el checkout habitual atrasado con cambios ajenos. #5 aporta motor, validación/descarga, separación de orígenes y versionado; #6 aporta feed y revocación. No reconstruirlos. Queda fuera la integración real en Airbnb hasta disponer de HTTPS accesible.

## Resultado esperado

- Estado en curso, última importación correcta y error posterior con fecha propia, sin inventar lecturas de Airbnb de nuestra exportación.
- Actualizar ahora y reintentar mediante el mismo motor; exclusión SQL por casa, petición idempotente y rechazo de respuestas antiguas.
- Sustitución: mantener URL anterior y noches hasta validar la candidata; fallo conserva también el último éxito.
- Desconexión confirmada: invalidar trabajos y retirar solo importados; conservar manual, precio y exportación.
- Revocación confirmada: usar el núcleo de #6 y reconciliar respuestas ambiguas sin revocar una generación posterior por un reintento antiguo.
- Aviso exacto de #7: «Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia». No añadir cron, próxima ejecución ni acciones de #8.

## Pasos de implementación y validación

1. Pruebas primero: dos casos HTTP que faltan (actualizar sin URL y sustitución fallida). Ana ejecuta y se observa RED antes de implementar.
2. Contrato común fake/PostgREST de gestión: autenticación/otro dueño/admin; repetición y simultaneidad; error sin perder éxito; sustitución fallida/correcta; desconectar mientras llega una lectura vieja; solapamiento manual/precio/exportación; revocación/reintento frente a regeneración. Reutilizar limpieza DB acotada de #6; no ejecutar reset global ni tocar cuentas manuales 8800.
3. Migración nueva para transiciones y metadatos necesarios; permiso del dueño en RPC y operaciones externas en worker. URLs candidatas privadas; ninguna URL/huésped en logs o caché persistida. Conservar el orden de locks de listing/conexión/intento. Revisar contratos técnicos antes de conectar UI.
4. Ana aplica migración local, regenera tipos y ejecuta contratos/permisos. No construir la parte dependiente de UI antes de verde real de la base.
5. UI según diseño aprobado: mismos componentes, confirmaciones existentes, foco, cancelación, botones en curso, error y reconciliación. Actualizar ambos estados de forma independiente y descartar resultados de otra cuenta/casa.
6. E2E móvil, revisión visual, regresión pertinente, build/tipos/tamaño; conservar presupuesto de Airbnb 6,5 kB salvo acuerdo explícito posterior. Actualizar arquitectura, documentación de recuperación y `docs/pruebas-manuales.md`.
7. Antes de cualquier futura PR/push hacia develop: comprobar migración incluida en Git, base local/tipos y proyecto Supabase de pruebas mediante dry-run revisado y aplicación autorizada por Ana. Esta tarea no autoriza ese push ni despliegue.

## Estado

Lectura inicial y dependencias comprobadas; no se observan decisiones de producto pendientes para empezar backend. Las dos primeras pruebas HTTP se ejecutaron antes de implementar: 2/2 fallan por 400/409 frente a 200/422, operaciones ausentes. Después se prepararon migración, dominio, adaptadores y fake, más contrato común de nueve casos, permisos DB y dos casos HTTP adicionales. No se han ejecutado los cambios posteriores ni aplicado la migración; tipos y UI pendientes. Contrato técnico en `contrato-tecnico-07.md`; script preparado para Ana: `comprobar-backend-07.sh`. No se han hecho commits, push, despliegues ni cambios de GitHub.

Durante la preparación, Ana probó #6 en Airbnb real: el diagnóstico sin sesión devolvía 302 a Cloudflare Access. Ana añadió una aplicación específica con Bypass para todos en `nueva.bnbtico.com/ical/*` y corrigió un espacio/`$` final de la ruta. Confirmó que Airbnb ya acepta el enlace. Esto verifica acceso/importación inicial, no acredita cuándo Airbnb aplica cambios ni retirada posterior de noches. El desarrollo de #7 continúa sin modificar infraestructura.

Ana ejecutó `comprobar-backend-07.sh`: 68/68 unitarias, migración local `20261108220000` aplicada, tipos regenerados, typecheck correcto y 20/20 pruebas DB (contratos nuevos/permisos y regresión de exportación). Se satisface la puerta de backend para la UI. Preparados los dos primeros E2E de confirmaciones reales y el script `comprobar-ui-07.sh`; falta observar el fallo por controles ausentes antes de implementar la UI dependiente. No se han ejecutado pruebas visuales nuevas ni aplicado #7 en remoto.

RED móvil observado: typecheck/build correctos; los dos E2E fallan al esperar Desconectar Airbnb y Revocar enlace, controles ausentes. Después se implementan acciones, sustitución reutilizando la hoja de conexión, error posterior y aviso exacto de #7. ConfirmSheet recibe pending/error opcionales, conservando sus consumidores actuales; el script repite sus 14 pruebas y añade regresión E2E de #5/#6. Se amplían a seis los recorridos de gestión, incluido éxito tras respuesta perdida de desconexión y conservación de una generación de exportación posterior al reintentar. El arnés manual previo añade sustitución fallida/correcta para datos reproducibles. Ninguna comprobación posterior a estas ediciones se declara ejecutada todavía.

Resultado aportado por Ana de `comprobar-ui-07.sh`: typecheck, 14 pruebas compartidas, build y 11 E2E correctos (28,4 s). Se añaden al recorrido de desconexión comprobaciones sin red y capturas a 375/390 px con token oculto, y una comprobación de IndexedDB a la exportación para acreditar presencia de metadatos sin persistir el token. Esas ampliaciones esperan ejecución; `comprobar-final-07.sh` reúne tipos, suite unitaria completa con Chrome, build, E2E y tamaño. No se ha aumentado el límite de 6,5 kB ni declarado aceptación visual sin inspeccionar las capturas.

Resultado de `comprobar-final-07.sh`: 128 archivos / 2252 unitarias, typecheck, build y 11 E2E correctos (35 s), incluidos sin red y metadatos persistidos sin token. Tamaño falla solo en Airbnb: 7,7 kB / 6,5 kB. Se revisó la captura de la pantalla a 375 px, sin solapamientos ni desbordamiento horizontal; la máscara de token tapó el diálogo en la captura de 390 px, así que se cambia solo esa captura para tomar el diálogo aislado (sin URL). Falta repetir esa captura/revisarla y resolver el presupuesto con Ana, sin aumento automático.

Ana aprueba ampliar únicamente Airbnb a 8 kB para #7; actualizados presupuesto y decisiones del 2026-11-09. El código funcional no cambia después de los resultados anteriores. `comprobar-cierre-07.sh` repite tamaño y solo el recorrido con la captura corregida; queda pendiente su resultado/revisión. Se mantienen pendientes cualquier aplicación de #7 alojada y las operaciones de Git a cargo de Ana.

Ampliación del 2026-11-09: Ana revisa y aprueba el acceso directo de actualización, título «Sincronización con Airbnb», botón verde claro a la izquierda y gris sin red, iconos de reserva/pausa sin recuadro y conservación del menú. Sin conectar, Airbnb permanece unido a las acciones en la tarjeta blanca; conectado queda sobre crema. Referencia aprobada: `diseno-v0.2-propuesta.md`.

Aprueba además que marcar una reserva reciba todos los días ocupados, compruebe Airbnb previamente y permita seguir con último calendario válido únicamente tras confirmar el aviso de fallo. Se protege el guardado en SQL con `mark_listing_reservation`, nueva migración `20261109181419_proteger_reserva_calendario.sql`; WhatsApp no descarga por consulta y #8 queda fuera. RED real: 3 fallos/3 correctos en contrato fake; después 3 E2E fallan antes de conectar la hoja. Implementación y validación de esta ampliación en `reservas-07.md`; Ana ejecuta `comprobar-reserva-07-ui.sh`. No se extienden automáticamente los presupuestos ni se atribuyen a estos cambios los resultados verdes anteriores.

Comprobación final recibida el 2026-11-09, después de simplificar y aprobar los presupuestos medidos: tipos, 2258 unitarias, 8 DB de reservas/permisos, 16 E2E de integración y 7 de regresión correctos. Tamaño correcto en todos los grupos; JS inicial 155,84/160 kB. La confirmación de desconexión de 390 px se revisó ya sin la máscara que tapaba texto. Guía manual y documentos afectados actualizados. Permanece la revisión manual por Ana y, antes de PR/push hacia develop, confirmar proyecto Supabase alojado y migraciones mediante dry-run/aplicación revisada. Sin Git, despliegue ni cambios de GitHub desde el agente; #8 no implementada.

2026-11-10: Ana vincula esta copia al proyecto de pruebas `bpxiggdzgzolcazaaboj`. El dry-run enumera únicamente `20261108220000_gestionar_calendarios.sql` y `20261109181419_proteger_reserva_calendario.sql`. Ana ejecuta `supabase db push --linked`, confirma esas dos y aporta finalización correcta de ambas. Se satisface la aplicación alojada revisada; no equivale a despliegue del worker/UI ni acredita pruebas manuales contra Airbnb real. Antes del commit se revisan estado, archivos y documentación con `revisar-entrega-07.sh`; Git y publicación continúan a cargo de Ana.
