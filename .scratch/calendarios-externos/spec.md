# Épica #4 · Calendarios Airbnb · preparación v0.1

Fecha: 2026-11-07. Estado de preparación: **Por definir técnicamente**. Diseño móvil v0.1 y las reglas de producto consultadas P1–P6: **Aprobados por Ana el 2026-11-07**. Muestra real de Airbnb inspeccionada y compatible con el alcance inicial; faltan los contratos técnicos y su validación. No es una orden de implementación ni un estado de ejecución paralelo a GitHub.

## Objetivo y alcance

Permitir al anfitrión incorporar noches bloqueadas en Airbnb y entregar a Airbnb los bloqueos manuales de bnbtico. El acuerdo de estancia sigue por WhatsApp: una consulta no es una reserva ni bloquea noches. iCal no sincroniza precios ni datos de huéspedes, ni garantiza disponibilidad en tiempo real.

Orden indicado por Ana: diseño conjunto → #5 → #6 → #7 → #8, aceptando y probando cada entrega antes de iniciar la siguiente. La épica agrupa; no se implementa directamente.

**Alcance actualizado por Ana el 2026-11-07: solo móvil por ahora.** La web de escritorio aún no está lista; su adaptación y validación quedan aplazadas y no son condiciones de entrada ni de aceptación de #5–#8. Ana aprobó el diseño móvil v0.1 y, posteriormente, las reglas P1–P6 una por una.

Las reglas P1–P6 se aprobaron después, una por una, y se recogen abajo. Preparación técnica añadida tras revisar la muestra y el código: [contrato de #5 v0.1](contrato-tecnico-05.md). No es implementación ni evidencia de pruebas ejecutadas.

Fuentes remotas leídas completas el 7 de noviembre desde GitHub, en solo lectura: [#4](https://github.com/angarcia/bnbtico/issues/4), [#5](https://github.com/angarcia/bnbtico/issues/5), [#6](https://github.com/angarcia/bnbtico/issues/6), [#7](https://github.com/angarcia/bnbtico/issues/7), [#8](https://github.com/angarcia/bnbtico/issues/8). #4 no tiene descripción; sus cuatro sub-issues fijan el alcance. No se observaron comentarios de contenido adicional ni bloqueos nativos en Relationships. La secuencia es una instrucción de Ana, no una relación remota creada por esta preparación.

**Otros proveedores iCal no están definidos en estas historias.** El título genérico de la épica no autoriza Booking, Google Calendar ni un importador universal. Tampoco se promete integración PMS.

## Evidencia local y capacidad existente

- `AGENTS.md`, `docs/agents/historias-listas.md`, `docs/plan-implementacion.md`, `docs/diseno-v1.md`, `docs/decisiones.md`: móvil primero, diseño vigente, autorización en Postgres, app y pruebas existentes.
- `apps/app/src/domain/calendar.ts`: `CalendarDay` solo tiene día, disponibilidad y precio especial; no guarda procedencia. Ventana actual inclusiva desde hoy de Costa Rica hasta hoy + 365 (366 fechas).
- `apps/app/src/data/postgrest/calendar.ts`: lee `listing_days`; guarda mediante `save_listing_days`. No sirve como representación única de importaciones: mezclar allí el origen impediría retirar solo los bloqueos de Airbnb.
- `apps/app/src/client/screens/calendario.tsx`: calendario por casa, selector compartido, meses verticales, selección múltiple, precios, guardado optimista con reversión. Hoja Marcar una reserva y pausa ya existen. No reconstruirlos.
- `apps/app/tests/contract/calendar.contract.ts`: permisos, ventana, precios conservados, salida excluida, reservas manuales, búsqueda y lectura pública ya tienen escenarios. Esto es evidencia de cobertura escrita, no de ejecución en esta tarea.
- `docs/pruebas-manuales.md`, §3.14 (A94–A107) y Cliente C50–C67: regresión vigente.
- El calendario admite casas enviadas alguna vez, excluye borradores nunca enviados y rechazadas. Una casa pausada conserva sus días y no permite edición manual. El tratamiento de conexiones en esos estados requiere acuerdo explícito, véase P5.

## Reglas ya establecidas

Se distingue requisito escrito en las issues de decisión de diseño aprobada: las issues definen el alcance solicitado, pero no prueban aprobación de una nueva maqueta.

| Regla | Fuente y estado |
| --- | --- |
| Llegada incluida, salida excluida: 10–13 ocupa 10, 11 y 12 | #5 y #6; coincide con reserva manual vigente |
| Importado y manual se conservan separados; ocupado si existe cualquiera de ambos | #5; retirar una fuente no libera la otra |
| Lectura completa válida sustituye solo los bloqueos de Airbnb, sin duplicarlos | #5 |
| Fallo de red o contenido inválido conserva el último conjunto válido y su fecha de éxito | #7 y #8 |
| Nuevo enlace sustituye al anterior únicamente tras una lectura válida | #7 |
| Desconexión confirmada retira solo importados, conserva manuales y precios | #7 |
| Exportar solo bloqueos manuales, incluso si coinciden con Airbnb | #6; evita devolver a Airbnb sus propios bloqueos |
| Consulta por WhatsApp no bloquea ni se exporta automáticamente | #6 y producto vigente |
| Exportación privada por posesión del enlace, sin sesión, solo lectura y sin datos personales ni precios | #6; enlace exclusivo de cada casa |
| Revocar invalida el enlace antiguo; hay que retirarlo también de Airbnb | #7; no implica borrado inmediato en Airbnb |
| Una sola actualización simultánea por conexión | #7; compartida entre manual y programada |
| Actualización automática cada tres horas; tras fallo, reintento en el siguiente ciclo | #8; no significa que Airbnb consulte bnbtico cada tres horas |
| Mostrar último éxito y error posterior; no afirmar cuándo Airbnb leyó/aplicó la exportación | #7 |

Texto común de #7: «Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia».

## Contradicción de #5: calendario público

No crear ni reintroducir una pantalla pública independiente. Redacción propuesta para reemplazar únicamente el criterio ambiguo, sin modificar GitHub:

> Dado que una lectura válida ha incorporado noches ocupadas, cuando un cliente busca una estancia que las incluye o consulta la disponibilidad en los componentes públicos vigentes, entonces se aplica la unión de bloqueos manuales e importados, sin mostrar procedencia ni datos privados y sin añadir una pantalla de calendario público.

La evidencia local actual conserva **Disponibilidad dentro de la ficha** (`docs/diseno-v1.md`, ficha; `shared/listing-calendar.tsx`) y la búsqueda por fechas. No se encontró una decisión que suprima esa sección. No confundir una pantalla descartada con esta sección existente. Si Ana se refiere también a retirar esa sección, hace falta identificar esa referencia más reciente; esta preparación no la elimina ni la reconstruye.

## Reglas concretadas y propuestas pendientes

P1–P6, con el alcance consultado y detallado abajo, fueron aprobadas por Ana el 2026-11-07 y registradas en `docs/decisiones.md`. Las verificaciones técnicas no se sustituyen por estas aprobaciones.

| ID | Propuesta recomendada y motivo | Afecta |
| --- | --- | --- |
| P1 · Ventana · Aprobada | Usar las noches desde hoy CR hasta hoy + 365, ambas incluidas, como el calendario actual. Recortar eventos al intersectar la ventana; un bloqueo de la última noche se exporta con fin exclusivo hoy + 366. La aprobación no amplía el selector manual actual, cuya salida máxima sigue siendo hoy + 365; alinear ese selector requeriría un cambio aparte. | #5, #6 |
| P2 · Eventos · Aprobada | Primera versión: bloqueos de días completos, con inicio y fin, sin eventos por horas ni repeticiones automáticas. Si un evento no se puede interpretar, mostrar error y conservar el último conjunto válido, sin aplicar resultados parciales. Comprobar compatibilidad con una muestra real anonimizada de Airbnb antes de implementar. | #5 |
| P3 · Vacío y reconciliación · Aprobada | Calendario completo y válido sin bloqueos es éxito: retira los bloqueos importados anteriores y conserva manuales y precios. Lectura fallida o incompleta conserva los últimos bloqueos válidos. Los detalles técnicos de duplicados y UID se concretan en el contrato del parser, sin ampliar esta aprobación. | #5, #7 |
| P4 · Cardinalidad · Aprobada | Una conexión de importación Airbnb y un enlace de exportación activo por casa; ambas direcciones independientes. Revocar no genera automáticamente otro enlace: queda «Generar enlace» y el nuevo será distinto. | #5–#7 |
| P5 · Estados y permisos · Aprobada | La pausa del anfitrión no detiene las actualizaciones de Airbnb. Si bnbtico bloquea o rechaza la casa, se suspenden importación y exportación conservando datos; no se lee Airbnb ni se sirve el feed durante la suspensión, sin desconectar ni revocar definitivamente. Al levantar el bloqueo administrativo se reactivan automáticamente las conexiones suspendidas por ese motivo: nueva lectura de Airbnb y exportación habilitada; si falla la lectura, conservar últimos bloqueos válidos y mostrar error. No reactivar conexiones desconectadas o revocadas por el anfitrión. Al eliminar definitivamente una casa, detener sus importaciones e invalidar su enlace de exportación. Solo el propietario puede conectar, sustituir, desconectar y revocar los enlaces de su casa; no añadir gestión de conexiones para administradores en esta épica. | #5–#8 |
| P6 · Ciclo · Aprobada | Ciclos fijos cada tres horas, horarios de Costa Rica. Actualizar ahora no desplaza el siguiente ciclo; si falla una actualización se reintenta en el próximo ciclo. La exclusión de trabajos simultáneos y el descarte de resultados obsoletos siguen los requisitos de #7. Elegir horario exacto y tolerancia operativa en preparación técnica, sin prometer entrega instantánea. | #7, #8 |

**Aclaración expresa de Ana al aprobar P4:** identificar qué bloqueos vienen de Airbnb y reflejar aquí sus cancelaciones. En cada lectura completa válida se reconcilia la fuente Airbnb: si desaparece una reserva, se retira su bloqueo importado; si otra reserva importada o un bloqueo manual ocupa esa noche, continúa ocupada. El calendario privado muestra la procedencia según el diseño aprobado. No se promete actualización instantánea: el botón manual llega en #7 y el ciclo automático de tres horas en #8.

Los detalles del parser (UID, DTSTART/DTEND, cancelaciones y transparencia explícitas) se validarán contra la muestra real y se documentarán en el contrato técnico; no se dan por aprobados por la respuesta de Ana al alcance de P2. Las cotas de descarga/tiempo, lista de hosts Airbnb permitidos, redirecciones seguras, protección frente a destinos internos, secretos fuera de logs y caché revocable deben concretarse antes del backend. Son condiciones técnicas de entrada, no nuevos controles visibles al anfitrión. La URL de importación y el token de exportación no pertenecen a datos públicos ni a telemetría.

**Muestra real comprobada:** tras fallar el acceso por enlace, Ana facilitó `airbnb-calendar.ics` y se inspeccionó el archivo local. Sus tres eventos usan inicio y fin de día completo con UID: dos `Reserved` y uno `Airbnb (Not available)`. Encaja con P2; no contiene cancelaciones que permitan verificar ese caso. Tiene descripciones con datos privados y líneas continuadas: descartar el contenido personal y crear fixtures sintéticos. Detalle y límites: [validación de muestra](validacion-muestra.md). No guardar el enlace privado, su token ni el archivo original en el repositorio. Contrastar también el mapa de estados vigente con el contrato técnico, conservando las restricciones existentes y sin inventar nuevos estados de producto.

## Preparación por entrega

| Historia | Entrada necesaria | Resultado comprobable para aceptar |
| --- | --- | --- |
| [#5](issues/01-importar-airbnb.md) | Diseño v0.1 aprobado; P1–P5 resueltas; muestra Airbnb; contrato/permisos definidos | Conectar y reconciliar noches sin tocar manuales/precios; búsqueda y ficha vigentes coherentes |
| [#6](issues/02-exportar-airbnb.md) | #5 probada/aceptada por orden de Ana; P1/P4 y acceso por token definidos | Generar/copiar y leer ICS sin sesión; solo manuales, sin bucles |
| [#7](issues/03-gestionar-conexiones.md) | #6 probada/aceptada; P3–P6 cerradas | Estado fiable, actualización única, sustitución segura, desconexión y revocación |
| [#8](issues/04-actualizacion-automatica.md) | #7 probada/aceptada; ciclo y operación acordados | Cambios sin tocar Actualizar, fallo conservador y siguiente ciclo |

Para probar #5 antes de #7: conectar y comprobar primera importación en UI. Cambios/cancelaciones se verifican invocando el mismo servicio de lectura mediante fixture o prueba de contrato; el botón público «Actualizar ahora» pertenece a #7. #5 ya debe conservar el último resultado válido ante errores: no aplazar integridad a #7. #6 no espera a #7 para proteger su token; la UI de revocación se entrega después. No mostrar controles ficticios de historias futuras ni «cada tres horas» hasta #8.

## Documentación al implementar

Las decisiones aprobadas están registradas con fecha y motivo en `docs/decisiones.md` y la guía visual enlaza el diseño aprobado. Actualizar `docs/pruebas-manuales.md` con cada pantalla entregada; por ahora se conserva el plan de pruebas de esta preparación sin afirmar ejecución. Revisar arquitectura, telemetría, entorno y operación de cron al implementar #8. Esta preparación no declara pruebas pasadas ni pantallas implementadas.

Referencias de entrega: [diseño v0.1](diseno-v0.1.md) y [plan manual](pruebas-manuales.md). No se preparó importación ni se modificó GitHub.
