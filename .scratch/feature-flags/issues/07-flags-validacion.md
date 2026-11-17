Status: needs-info

# Validar las combinaciones de flags y documentar su operación

## Historia
Como equipo de 3bstays, quiero comprobar las configuraciones y disponer de un procedimiento de activación para operar las funciones con confianza.

## Contexto y alcance
Matriz focalizada: configuración inicial; fechas activadas; ambas búsquedas activadas; ambas apagadas; precios activados; habitaciones activadas; iCal apagado según política aprobada. Cubrir móvil/laptop, anónimo/propietario, estado persistido y datos previos. Actualizar docs/pruebas-manuales.md, documentación de configuración y plan/decisiones aprobadas. Presentar comandos de comprobación a Ana. El despliegue y su autorización siguen el procedimiento del repositorio.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** cada configuración de la matriz, **cuando** Ana recorre las pruebas manuales, **Entonces** los resultados esperados y los observados quedan registrados con su entorno.
2. **Dado** una flag con efecto en backend, **cuando** se intenta el acceso directo, **Entonces** se respeta el contrato aprobado con los mismos resultados que desde la app.
3. **Dado** la restauración de una configuración anterior, **cuando** se repiten sus recorridos, **Entonces** los datos conservados y las conexiones siguen la política documentada.

## Dependencias y diseño
Dependencias: flags-busqueda, flags-precios, flags-habitaciones, flags-ical. Diseño: No necesario. Referencia visual vigente en docs/diseno-v1.md para conservar los recorridos existentes.

## Decisiones pendientes
Sin decisión de producto adicional identificada. Contrastar el contrato con el código vigente antes de implementar.

## Skills necesarias
Principal $ana-frontend-developer para recorridos y accesibilidad. Apoyo $ana-backend-developer para contratos y $ana-devops para configuración/reversión.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Valide la historia #64 «Combinaciones de flags y operación».
Aplique $ana-frontend-developer, $ana-backend-developer, $ana-devops y $credit-saver. Lea AGENTS.md, .scratch/feature-flags/spec.md e issues/07-flags-validacion.md. Requiere #60–#63 completadas y resultados disponibles de #58–#59.

Prepare una matriz ejecutable por Ana
A. Inicial: fechas OFF, noches ON, precios OFF, iCal ON y habitaciones OFF.
B. Fechas ON con noches OFF, y fechas ON con noches ON para comprobar precedencia.
C. Ambas búsquedas OFF.
D. Precios ON con tarifas guardadas y después OFF/ON para comprobar conservación.
E. Habitaciones ON y OFF con datos anteriores, conforme a política aprobada.
F. iCal OFF/ON con conexiones y enlaces anteriores, según política aprobada.

Para cada caso concrete cuenta, datos, configuración, acción y resultado esperado. Cubra móvil/laptop, visitante anónimo y anfitrión. En A compruebe cálculo base por noches y ausencia de filtro por ocupación en Explorar, mientras la ficha y el calendario muestran bloqueos. En B pruebe que una noche bloqueada excluye la casa. Verifique que URLs y caché anteriores no reintroducen filtros desactivados.
Compruebe las restricciones directas de backend para precios y nuevas habitaciones y los efectos en importación/exportación. Incluya respuesta ante configuración inválida y cambio de configuración con app abierta. Use los procedimientos aprobados para datos y entorno.

Facilite comandos de los checks relevantes a Ana y espere sus resultados. Registre lo verificado y lo pendiente. Actualice docs/pruebas-manuales.md, las instrucciones de configuración/reversión y las referencias de plan/decisiones que sigan pendientes. Entregue un resultado por escenario y los fallos con reproducción. La validación local y los resultados de despliegue deben identificar su entorno conforme a AGENTS.md.
```
