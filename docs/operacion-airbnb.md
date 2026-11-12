# Operación de la importación automática de Airbnb

El Worker ejecuta `17 */3 * * *`, a las 00:17, 03:17, 06:17, 09:17, 12:17, 15:17, 18:17 y 21:17 de Costa Rica. El ciclo se identifica por `scheduledTime` de Cloudflare, aunque la ejecución empiece unos minutos después. Se acepta un retraso inferior a una hora. Un ciclo más antiguo se omite y las casas quedan disponibles para el siguiente. Actualizar manualmente conserva el horario. Si ya hay una lectura manual en curso al reservar, esa casa espera al siguiente ciclo.

Cada invocación atiende hasta 12 casas, empezando por las que llevan más tiempo sin ciclo automático. El máximo teórico es 49 subsolicitudes externas, una de selección y hasta cuatro por casa, dentro del [límite de Workers Free](https://developers.cloudflare.com/workers/platform/limits/#subrequests). Si quedan casas pendientes, `backlog: true` indica que hay que revisar la capacidad. Con más de 12 conexiones elegibles, algunas pasan al siguiente ciclo y su intervalo efectivo puede superar tres horas. Antes de superar esa capacidad de forma habitual, medir CPU, duración y cola para dimensionar el procesamiento. El cron horario de mantenimiento y avisos tiene su propia invocación.

La base reserva el ciclo bajo el mismo bloqueo por casa que la actualización manual. El último ciclo automático se registra al reservar. Repetir el ciclo u observar uno anterior no vuelve a importar esa casa. La finalización verifica la versión del intento, por lo que desconectar o sustituir un enlace invalida resultados antiguos. Una lectura fallida conserva los bloqueos y la última importación válida. La pausa del anfitrión permite actualizar. El bloqueo administrativo, rechazo, baja de cuenta y eliminación excluyen la casa.

## Simulación local

La prueba `airbnb-cycle-postgrest.test.ts` usa horas programadas inyectadas, una casa sintética y respuestas iCal en memoria contra PostgREST local. No hay endpoint ni cambio del reloj del Worker. Después de aplicar las migraciones locales y generar tipos, ejecute desde la raíz:

```bash
pnpm --filter app test:db tests/db/airbnb-cycle-postgrest.test.ts tests/db/airbnb-permissions.test.ts
```

La prueba comprueba la conservación de bloqueos y fecha al fallar, la recuperación en el siguiente ciclo y la exclusión de intentos repetidos o simultáneos. Las pruebas de #7 cubren también la sustitución de un enlace y el descarte de versiones antiguas.

## Evidencia del programador real

Tras un despliegue autorizado, confirmar el SHA, el Worker de destino y sus dos triggers. `refactor` conserva cero triggers y producción en modo portada omite la importación. En pruebas, usar una casa desechable, modificar un bloqueo en un calendario de Airbnb autorizado y cerrar la app. Observar dos horarios consecutivos en Workers Logs y abrir la casa después para verificar el cambio de disponibilidad y la fecha de última importación correcta.

Cada evento `airbnb_cycle` registra hora prevista, retraso, duración y conteos `readOk`, `readError`, `skipped`, `serviceError` y `backlog`. `readOk` cuenta lecturas válidas cuya llamada de finalización respondió. Si hubo un cambio concurrente, Postgres puede descartar el resultado. La fecha de éxito de la casa y sus bloqueos confirman la escritura. Los eventos no incluyen identificadores, URL, tokens ni errores remotos. Un fallo de infraestructura marca el trigger como fallido y un error de lectura queda en el estado de la casa. La simulación local no acredita la entrega, el retraso ni el consumo del trigger alojado.

## Detención y reversión

En un cambio autorizado, configurar `AIRBNB_AUTO_SYNC=off` en el entorno del Worker para omitir nuevas invocaciones automáticas. Si se necesita revertir el código, volver a la versión anterior del Worker y a su configuración horaria, retirando solo `17 */3 * * *`. Mantener la migración aditiva, las conexiones y los bloqueos existentes. Las lecturas ya iniciadas pueden terminar durante su reserva de 30 segundos y siguen sujetas al control de versión. Verificar el mantenimiento horario, la actualización manual y la ausencia de nuevas lecturas automáticas. Para reanudar, restaurar la versión y el trigger y retirar el valor `off`. Se retoma en el siguiente ciclo programado.
