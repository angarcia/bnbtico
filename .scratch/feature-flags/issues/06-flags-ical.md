Status: needs-info

# Controlar calendarios externos sin perder disponibilidad guardada

## Historia
Como anfitrión, quiero conservar la importación y exportación iCal activadas y que una desactivación tenga un comportamiento conocido.

## Contexto y alcance
Calendarios externos activados inicialmente. Reutilizar interfaz de conexión y contratos existentes en apps/app/src/client/airbnb-calendar-row.tsx y screens/ical-export-card.tsx. Auditar importaciones programadas/manuales, endpoints de descarga y enlaces emitidos. Propuesta al desactivar: impedir nuevas conexiones y nuevas exportaciones; mantener conexiones, sincronizaciones y enlaces existentes y permitir desconectar/revocar. Esta propuesta requiere aprobación de Ana. La flag por entorno no ofrece apagado inmediato sin despliegue.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** iCal activado y precios por fecha apagados, **cuando** se importa un calendario válido, **Entonces** sus noches ocupadas aparecen en el calendario del anfitrión y de la ficha.
2. **Dado** búsqueda por fechas apagada, **cuando** una casa tiene bloqueos importados, **Entonces** se conserva la sincronización y no se excluye de Explorar por fechas.
3. **Dado** un fallo de importación, **cuando** termina el intento, **Entonces** se conserva la última disponibilidad válida conforme a las reglas actuales.
4. **Dado** que se apaga iCal, **cuando** se intentan nuevas conexiones o se usan conexiones y enlaces anteriores, **Entonces** se aplica en UI, servidor y trabajos la política aprobada sin borrar bloqueos.

## Dependencias y diseño
Dependencias: flags-base. Diseño: No necesario. Referencia visual vigente en docs/diseno-v1.md para conservar los recorridos existentes.

## Decisiones pendientes
Aprobar política al desactivar iCal. La propuesta mantiene conexiones existentes, pero no constituye un interruptor de emergencia para detener todo el servicio.

## Skills necesarias
Principal $ana-backend-developer para importación, exportación y jobs. Apoyo $ana-frontend-developer para conexiones; $ana-devops para configuración y operación.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Implemente la historia #63 «Controlar calendarios externos sin perder disponibilidad guardada».
Aplique $ana-backend-developer, $ana-frontend-developer, $ana-devops y $credit-saver. Lea AGENTS.md, .scratch/feature-flags/spec.md e issues/06-flags-ical.md. Requiere el contrato de #58 y aprobación de Ana de la política al apagar iCal.

Inspección dirigida
Revise apps/app/src/client/airbnb-calendar-row.tsx, screens/ical-export-card.tsx, importaciones manuales/programadas, descarga/exportación del worker, RPCs, tokens y reglas de desconexión/revocación. Consulte las decisiones vigentes de calendarios externos, conciliación y conservación de última lectura válida.

Configuración inicial
iCal encendido. Permita importar/exportar y sincronizar como ahora. Los bloqueos importados aparecen en calendarios de anfitrión y ficha aunque la búsqueda por fechas esté apagada y los precios por día estén apagados. La flag de búsqueda decide si Explorar filtra esas noches.

Apagado que necesita aprobación
La propuesta de la historia impide nuevas conexiones y generación de nuevos enlaces, conserva sincronizaciones y enlaces existentes y permite desconectar/revocar. Confirme esta política con Ana antes de codificarla. Si aprueba otra, actualice historia y escenarios antes de implementar. Aplique la política coherentemente en UI, RPCs, endpoints y jobs, incluyendo peticiones ya iniciadas. Informe del plazo efectivo del cambio por entorno/despliegue.

Validación concreta
Importación válida, repetida, vacía y fallida según contratos vigentes; fallo conserva última lectura válida. Exportación sin duplicar eventos importados según reglas actuales. Desactivación con y sin conexión existente, enlace ya compartido, revocación y reactivación. Verifique que cambiar una flag no borra bloqueos manuales ni confunde procedencias. Use fixtures anonimizados y datos de prueba.
Entregue comportamiento por operación, evidencia/limitaciones, pasos manuales y comandos de configuración para Ana. Revise documentación operativa afectada.
```
