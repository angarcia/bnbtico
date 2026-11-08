# Regresión antes del merge de #5

## Evidencia de 2026-11-08

Ana ejecutó localmente la partición E2E 1/2, un worker y Chrome, contra el build ya preparado: 148 correctas, 4 fallidas, 1 omitida y 25 sin ejecutar. Esta ejecución incluye archivos locales que todavía no están versionados; no se presenta como reproducción idéntica del checkout de CI.

Los dos fallos de calendario esperaban GET a `listing_days`, aunque #5 cambió la lectura privada a `owner_calendar_days` y `admin_calendar_days`. Se actualizan los predicados para comprobar POST a la RPC correspondiente y `p_listing` de la casa elegida. Se conservan los bloqueos artificiales de lista/perfil y las comprobaciones de carga anticipada: no se aumentan timeouts ni se elimina la prueba de concurrencia de lecturas.

La prueba de publicación buscaba «Más habitaciones» y la tarjeta del mapa esperaba una línea de texto contigua con «habitaciones». Las decisiones aprobadas del 2026-11-07 sustituyen ese contador por «Dormitorios» y presentan la capacidad mediante iconos. Se usa el contador vigente y se comprueban los títulos de personas, dormitorios/Estudio y baños, conservando las interacciones posteriores de mapa, WhatsApp, foco y navegación.

Tras esta primera revisión, Ana indicó que las correcciones de dormitorios ya estaban en `develop`. Se retiraron los dos ajustes locales de texto y se integraron, sin conflictos, los commits `798c658`, `c2cfa33` y `73bc940` desde `origin/develop` en `codex/integracion-ical`. También incluyen correcciones del diagnóstico E2E. El trabajo local anterior se guardó y recuperó con stash sin conflictos; el respaldo se conserva.

De esta revisión quedan solo los ajustes locales de lectura por RPC en `admin-edita-casas.spec.ts` y `calendario.spec.ts`. No se cambia la UI ni el workflow. Ana ejecutó la comprobación sobre el árbol integrado: tipos y build correctos, y **6/6 recorridos en verde (36,8 s)**: los cuatro que fallaron y las dos pruebas de Airbnb. Registro local: `/tmp/bnbtico-validar-merge.log`. La suite completa de CI sigue pendiente tras subir el merge y las dos correcciones; estos seis casos no acreditan que los 25 casos previamente sin ejecutar hayan pasado.

## Límite del diagnóstico de GitHub

El registro de `e2e (1, 2)`, ejecución 42456118748, intento 3, confirma que preparación y build finalizaron y que Playwright devolvió 1. Después, el saneador rechazó contenido con código `json` y no autorizó publicar artefactos. Ese registro no identifica qué archivo causó el rechazo ni qué pruebas fallaron; no permite atribuir el fallo remoto a los cuatro casos locales. No se debilita el saneador ni se publican registros privados para recuperar el detalle.
