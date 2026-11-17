# Operación de la importación automática de Airbnb

El Worker lee los calendarios cada `AIRBNB_SYNC_MINUTES` minutos, uno de 5, 10, 15, 30, 60, 120, 180, 240, 360, 720 o 1440. El valor sale de la variable de GitHub del entorno (desde el 2026-11-17; ver «Cambiar el intervalo»). Sin variable, cada 180 minutos con `17 */3 * * *` (horas en UTC), como antes. Menos de una hora usa `*/N * * * *`. Una hora o más usa el minuto 17 de cada N horas, y un día, `17 0 * * *`. Con 60 minutos el ciclo comparte el cron horario. La base solo acepta ciclos en minuto exacto, múltiplo de 5 o el minuto 17, y nunca lee una casa dos veces en menos de 5 minutos. El ciclo se identifica por el minuto de `scheduledTime` de Cloudflare, con los segundos a cero, aunque la ejecución empiece unos minutos después. Cloudflare no entrega ese valor exacto (en pruebas llegó como 06:17:54.627 el 2026-11-14); hasta ese día el Worker exigía el milisegundo exacto y omitía todos los ciclos sin dejar log. Se acepta un retraso inferior a una hora o al intervalo, si es más corto. Un ciclo más antiguo se omite y las casas quedan disponibles para el siguiente. Actualizar manualmente conserva el horario. Si ya hay una lectura manual en curso al reservar, esa casa espera al siguiente ciclo.

Cada invocación atiende hasta 12 casas, empezando por las que llevan más tiempo sin ciclo automático. El máximo teórico es 49 subsolicitudes externas, una de selección y hasta cuatro por casa, dentro del [límite de Workers Free](https://developers.cloudflare.com/workers/platform/limits/#subrequests). Si quedan casas pendientes, `backlog: true` indica que hay que revisar la capacidad. Con más de 12 conexiones elegibles, algunas pasan al siguiente ciclo y su intervalo efectivo puede superar el configurado. Antes de superar esa capacidad de forma habitual, medir CPU, duración y cola para dimensionar el procesamiento. El cron horario de mantenimiento y avisos tiene su propia invocación.

La base reserva el ciclo bajo el mismo bloqueo por casa que la actualización manual. El último ciclo automático se registra al reservar. Repetir el ciclo u observar uno anterior no vuelve a importar esa casa. La finalización verifica la versión del intento, por lo que desconectar o sustituir un enlace invalida resultados antiguos. Una lectura fallida conserva los bloqueos y la última importación válida. La pausa del anfitrión permite actualizar. El bloqueo administrativo, rechazo, baja de cuenta y eliminación excluyen la casa.

## Lecturas manuales

Desde el 2026-11-17, para que Airbnb no nos bloquee, la base (`airbnb_manual_gate`) limita las lecturas que pide el anfitrión:
- **Espera:** «Actualizar ahora» espera 15 minutos desde la última lectura de la casa, manual o automática.
- **Tope:** cada casa tiene 10 lecturas manuales al día de Costa Rica. Conectar y cambiar el enlace no esperan, pero cuentan.
- **Excepciones:** repetir la misma petición (mismo `request_id`) no choca con el límite. Las lecturas automáticas llevan `origin = 'auto'` y no cuentan en el tope.
- **Resumen:** `airbnb_overview` devuelve `manualAvailableAt` y `manualLeftToday`, con los que la pantalla desactiva los botones y escribe el texto. «Marcar una reserva» no lee durante la espera y usa la última lectura.

## Cambiar el intervalo

El intervalo forma parte del despliegue: el cron de Cloudflare es configuración del Worker. Para cambiarlo:

1. En GitHub → Settings → Secrets and variables → Actions → Variables, ponga `AIRBNB_SYNC_MINUTES_PRUEBAS` (pruebas.3bstays.com) o `AIRBNB_SYNC_MINUTES_PRODUCCION` (3bstays.com). Valores: 5, 10, 15, 30, 60, 120, 180, 240, 360, 720 o 1440 minutos. En pruebas, de 5 a 1440; en producción, de 60 a 1440. Vacía o sin crear: 180.
2. Abra la última ejecución de `app` en `develop` (o en `main` para producción), entre en el trabajo `deploy` y pulse «Re-run this job». Tarda unos 2 minutos, sin repetir las pruebas, y lee el valor nuevo. Solo vale si no hay un commit más reciente; si lo hay, el siguiente push ya lo recoge.
3. En el paso «Intervalo de Airbnb» del registro sale «Airbnb cada N minutos: <cron>». Un valor fuera de la lista o del rango hace fallar ese paso, con un mensaje que nombra la variable, y no se publica nada.
4. En Workers Logs, los eventos `airbnb_cycle` llegan con el ritmo nuevo desde el siguiente ciclo.

## Simulación local

La prueba `airbnb-cycle-postgrest.test.ts` usa horas programadas inyectadas, una casa sintética y respuestas iCal en memoria contra PostgREST local. No hay endpoint ni cambio del reloj del Worker. Después de aplicar las migraciones locales y generar tipos, ejecute desde la raíz:

```bash
pnpm --filter app test:db tests/db/airbnb-cycle-postgrest.test.ts tests/db/airbnb-permissions.test.ts
```

La prueba comprueba la conservación de bloqueos y fecha al fallar, la recuperación en el siguiente ciclo y la exclusión de intentos repetidos o simultáneos. Las pruebas de #7 cubren también la sustitución de un enlace y el descarte de versiones antiguas.

## Evidencia del programador real

Tras un despliegue autorizado, confirmar el SHA, el Worker de destino y sus triggers: dos, o uno solo con 60 minutos. `refactor` conserva cero triggers y producción en modo portada omite la importación. En pruebas, usar una casa desechable, modificar un bloqueo en un calendario de Airbnb autorizado y cerrar la app. Observar dos horarios consecutivos en Workers Logs y abrir la casa después para verificar el cambio de disponibilidad y la fecha de última importación correcta.

Cada evento `airbnb_cycle` registra hora prevista, retraso, duración y conteos `readOk`, `readError`, `skipped`, `serviceError` y `backlog`. `readOk` cuenta lecturas válidas cuya llamada de finalización respondió. Si hubo un cambio concurrente, Postgres puede descartar el resultado. La fecha de éxito de la casa y sus bloqueos confirman la escritura. Los eventos no incluyen identificadores, URL, tokens ni errores remotos. Un fallo de infraestructura marca el trigger como fallido y un error de lectura queda en el estado de la casa. La simulación local no acredita la entrega, el retraso ni el consumo del trigger alojado.

## Detención y reversión

En un cambio autorizado, configurar `AIRBNB_AUTO_SYNC=off` en el entorno del Worker para omitir nuevas invocaciones automáticas. Si se necesita revertir el código, volver a la versión anterior del Worker y a su configuración horaria, retirando solo el cron de Airbnb. Mantener la migración aditiva, las conexiones y los bloqueos existentes. Las lecturas ya iniciadas pueden terminar durante su reserva de 30 segundos y siguen sujetas al control de versión. Verificar el mantenimiento horario, la actualización manual y la ausencia de nuevas lecturas automáticas. Para reanudar, restaurar la versión y el trigger y retirar el valor `off`. Se retoma en el siguiente ciclo programado.
