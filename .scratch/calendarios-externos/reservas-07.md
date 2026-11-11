# Ampliación aprobada de #7 · 2026-11-09

Ana aprueba incorporar a este bloque la protección de «Marcar una reserva» y la actualización previa de Airbnb. No se modifica GitHub ni se despliega.

## Comportamiento aprobado

- La hoja recibe la disponibilidad efectiva del calendario de la casa: bloqueos manuales e importados. No admite noches ocupadas ni intervalos que las atraviesen. La salida queda excluida y puede coincidir con el inicio de una ocupación.
- Antes de habilitar la selección se consulta Airbnb si está conectado; se reutiliza una lectura reciente o una importación en curso. Se utiliza el mismo motor, permisos y límites de #5/#7. No se programa #8.
- Si falla la actualización, se conservan los datos válidos y se exige confirmar expresamente el aviso antes de continuar. Un fallo al leer la disponibilidad local no equivale a un calendario vacío.
- Al guardar se comprueba en la base que las noches sigan libres, con exclusión por casa frente a otra reserva o importación. Rechazar una noche rechaza toda la operación. Se conservan precios y separación de orígenes.
- El editor general mantiene su comportamiento: puede cambiar bloqueos manuales y precios. Esta protección corresponde exclusivamente a «Marcar una reserva».
- WhatsApp mantiene la comprobación de disponibilidad en la base; no fuerza una descarga por consulta. No se crean bloqueos al contactar.

## Secuencia de trabajo

1. Observar las pruebas de contrato fallar ante ocupación manual, importación posterior a la lectura y dos reservas simultáneas. Ana ejecuta `comprobar-reserva-07-red.sh`.
2. Implementar operación protegida en migración, adaptador y fake; reutilizar la escritura manual vigente sin cambiar el editor general.
3. Conectar la hoja al calendario efectivo y añadir preparación previa, carga, recuperación y confirmación tras fallo. Descartar respuestas al cerrar o cambiar de cuenta/casa.
4. Probar selección/salida/intervalos, actualización previa/repetición/error, guardado concurrente y permisos en unitarias, PostgREST y móvil. Actualizar la guía manual y entregar comandos de migración/tipos y comprobación.

## Evidencia

Ana ejecutó la primera suite: 3 fallos y 3 casos correctos. Los fallos corresponden a ocupación manual, importación posterior y dos guardados simultáneos aceptados. Preparados protección en fake/adaptador y SQL de migración (el script la crea mediante Supabase CLI), con ejecución pendiente de `comprobar-reserva-07-backend.sh`. Preparados tres E2E de selección, actualización previa/reutilización y confirmación tras fallo, pendientes de observar en rojo con `comprobar-reserva-07-ui-red.sh` antes de conectar la hoja. La presentación de la fila se ajusta al diseño móvil v0.2 aprobado; su verificación visual sigue pendiente.

Ana comunica 3/3 fallos de los E2E iniciales, antes de conectar la hoja. La CLI ha creado `supabase/migrations/20261109181419_proteger_reserva_calendario.sql`; los tipos locales incluyen la RPC. No se dispone aquí de los recuentos finales de backend. Se implementa la preparación con éxito reutilizable de menos de 60 segundos, espera acotada a 25 segundos para una lectura en curso y cancelación/guardas de cuenta al cerrar. Siempre se releen los días después de importar; solo se ofrece caché anterior tras fallo de red y confirmación, nunca ante permisos denegados o sin datos conocidos.

La fila de sincronización incorpora actualizar a la izquierda, fondo verde claro y estado gris sin red; sin conectar queda unida a reserva/pausa dentro de la misma tarjeta blanca. Se añaden casos móviles de actualización directa y lectura de días denegada, capturas sin datos privados y regresión del menú existente. Script para Ana: `comprobar-reserva-07-ui.sh`. Ningún resultado posterior se da por verificado hasta recibirlo.

## Cierre de comprobaciones locales · 2026-11-09

Leído el resultado ejecutado por Ana en `/tmp/bnbtico-cierre-reserva-07.log`: tipos correctos; 129 archivos / 2258 unitarias correctas; 6 contratos PostgREST de reserva y 2 pruebas de permisos por RPC directa correctas; 16 E2E de integración y 7 de regresión del calendario correctos. Base local al día hasta `20261109181419`. Tamaño cumple todos los límites revisados y aprobados, con inicial 155,84/160 kB. El build anterior válido pasó 10 pruebas de arquitectura; desde entonces solo cambiaron pruebas/documentación/límites. Capturas de estados conectado/sin conectar y confirmación de desconexión revisadas. No se declara una prueba real de latencia o de frescura de Airbnb a partir de esas comprobaciones.

La guía manual única y las referencias de diseño/arquitectura/entorno quedan actualizadas. No se ha hecho commit, push, PR, despliegue ni cambio de GitHub. Migraciones alojadas pendientes de confirmar en el proyecto de pruebas mediante dry-run y aplicación revisada por Ana antes de cualquier PR hacia develop. #8 permanece fuera.
