# Feature flags de 3bstays

Decisiones de Ana del 2026-11-17, preparadas para GitHub. Configuración por entorno y despliegue. Cinco flags:

| Flag | Inicial | Alcance |
| --- | --- | --- |
| Búsqueda por fechas y disponibilidad | Apagada | Elegir fechas y excluir noches bloqueadas en Explorar, conjuntamente |
| Búsqueda por número de noches | Encendida | Duración en Explorar y estimación precio base × noches |
| Precios por fecha | Apagada | Configurar y aplicar tarifas especiales por día |
| Calendarios externos | Encendida | Importar y exportar iCal |
| Publicar y filtrar habitaciones | Apagada | Tipo Habitación al publicar y en filtros |

Los calendarios del anfitrión y de la ficha permanecen activos y muestran bloqueos manuales e importados. Elegir fechas en la ficha permite calcular el precio y preparar WhatsApp. Fechas activadas tienen prioridad sobre número de noches en Explorar. Ambas apagadas permiten buscar sin estancia. Sin mes en la búsqueda. «Pausar anuncio» conserva su comportamiento. Añadir método de pago tiene una definición pendiente y queda fuera de este lote.

## Evidencia y reglas pendientes
La consulta search_listings filtra por fechas actualmente (apps/app/src/data/postgrest/listings.ts). El código ya reconoce tipo habitacion y precios de estancia. Existe importación/exportación iCal. La selección por duración es trabajo nuevo.

Resolver y registrar con Ana antes de implementar los casos afectados: límites y mínimos de duración, alquiler mensual y prorrateo, precio especial ya guardado y comunicación al dueño, habitaciones ya publicadas/borradores/reenvíos y política de desactivar conexiones iCal existentes. Ninguna flag borra datos por sí sola. Las propuestas de tratamiento se identifican en cada tarjeta.

Este lote prepara el cambio respecto a docs/plan-implementacion.md y docs/decisiones.md. Al cerrar las decisiones, actualizar las referencias vigentes y las guías afectadas. No se cambia ahora la configuración ejecutable. docs/agents/historias-listas.md está referenciado por la skill pero no está presente en este checkout; se aplican sus condiciones conocidas de dependencias y diseño aprobado, además de las referencias actuales de la skill.

## Orden recomendado
1. flags-base y flags-diseno, independientes.
2. flags-busqueda, flags-precios, flags-habitaciones tras contrato y diseño aprobado.
3. flags-ical tras contrato y aprobación de su política.
4. flags-validacion al completar las implementaciones.

Cada subtarea contiene prompt, BDD, skills y validación. Los campos y duplicados remotos no se han consultado. Prioridad propuesta P1 por habilitar el recorrido de lanzamiento acordado; sin milestone asignado. Estado inicial Todo. Solo base y diseño están listas para comenzar; diseño exige aprobación de Ana antes de habilitar implementaciones visuales.
