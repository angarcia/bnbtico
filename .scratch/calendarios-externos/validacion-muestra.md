# Comprobación de muestra real de Airbnb · 2026-11-07

Fuente: archivo `airbnb-calendar.ics` facilitado por Ana. Inspección directa del archivo local; no se conectó ninguna casa, no se ejecutó un importador y no se copió el archivo privado al repositorio. Este documento omite fechas reales de estancias, UID, enlaces de reserva y datos parciales de teléfono.

## Resultado observado

- Un `VCALENDAR` versión 2.0, identificado como Hosting Calendar de Airbnb, con inicio y cierre presentes.
- Tres `VEVENT` con `UID`, `DTSTAMP`, `DTSTART;VALUE=DATE` y `DTEND;VALUE=DATE`; fin posterior al inicio.
- Dos eventos con `SUMMARY:Reserved` y uno con `SUMMARY:Airbnb (Not available)`.
- Todos usan fechas sin horas para el período bloqueado. No hay recurrencias en esta muestra. `DTSTAMP` sí contiene fecha/hora: no confundir metadatos de generación con fechas del evento y no rechazar por ello un evento de día completo.
- Dos eventos incluyen `DESCRIPTION` con enlace de reserva y últimos cuatro dígitos de un teléfono. Es contenido que se debe descartar por completo, sin persistirlo, exportarlo ni enviarlo a logs o telemetría.
- Existen líneas continuadas: una línea de descripción continúa en la siguiente, que empieza con espacio. El lector debe manejar la estructura del archivo sin tratar esa continuación como un evento nuevo o un campo independiente.

**Conclusión limitada:** esta muestra encaja con P2, bloques de días completos con inicio y fin. Permite continuar la definición del contrato técnico de #5; no demuestra compatibilidad con todas las exportaciones de Airbnb ni verifica todavía el parser o la integración.

## Consecuencias para el contrato de #5

1. Importar ocupación tanto de `Reserved` como de `Airbnb (Not available)`: ambos son bloqueos de la fuente Airbnb, sin inventar datos de reserva ni distinguirlos como reservas confirmadas dentro de bnbtico. No basar la aceptación en que el título sea exactamente `Reserved`.
2. Aplicar la salida excluida acordada; conservar `UID` únicamente como identificador privado de origen necesario para reconciliar, sin exponerlo en componentes públicos. Un `DTSTAMP` con hora no vuelve horario el bloqueo.
3. Extraer solo la información necesaria para fechas, procedencia e identidad técnica del evento; ignorar `DESCRIPTION` y demás contenido personal. Mantener límites de lectura y manejo seguro del contenido no confiable.
4. Crear fixtures sintéticos con la misma estructura, identificadores inventados y fechas de prueba; no versionar esta muestra privada. Incluir continuación de líneas y descripciones sintéticas para comprobar que no se filtran datos.
5. La muestra no contiene eventos cancelados ni una secuencia anterior/posterior de una cancelación. El requisito de reflejar cancelaciones sigue vigente: una lectura completa válida que retire un evento debe retirar solo su bloqueo importado; si falla la lectura, conservar el conjunto anterior. Verificarlo con fixtures y después, si es posible, con dos exportaciones reales de prueba.

## Entrada aún pendiente

Definir el contrato técnico del parser y de reconciliación, permisos efectivos, descarga segura y límites, modelo de procedencia, cachés y pruebas fake/PostgREST. La comprobación de esta muestra no marca #5 como lista para implementar ni acredita pruebas de funcionamiento. El diseño móvil y las reglas de producto consultadas ya están aprobados.
