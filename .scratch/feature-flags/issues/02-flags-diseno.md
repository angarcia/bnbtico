Status: ready-for-agent

# Diseñar búsqueda por noches y estados de las funciones desactivadas

## Historia
Como viajero y anfitrión, quiero controles y mensajes claros según las funciones disponibles para entender el precio y la disponibilidad.

## Contexto y alcance
Diseñar móvil y adaptación a laptop. Explorar con número de noches, sin fechas ni mes en la configuración inicial. Ficha con fechas, bloqueos y precio base orientativo. Anfitrión con bloqueos e iCal y sin edición de precios por día. Publicación y filtros con habitaciones desactivadas. Definir acceso directo, mensajes de error y etiquetas de estimación. Resolver con Ana los casos de datos existentes enumerados en spec.md y dejar aprobación trazable.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** el modo noches, **cuando** se revisa la propuesta, **Entonces** muestra duración, estimación base por noches y explicación de que el precio final y disponibilidad se confirman con el anfitrión.
2. **Dado** el calendario del anfitrión o la ficha, **cuando** se revisa el diseño inicial, **Entonces** las fechas bloqueadas son distinguibles y los precios por fecha quedan deshabilitados.
3. **Dado** los casos de enlaces antiguos, habitación existente y estancia mensual, **cuando** se presenta el diseño, **Entonces** cada caso tiene una regla propuesta y aprobación pendiente o explícita de Ana.

## Dependencias y diseño
Dependencias: ninguna. Diseño: Pendiente. Resultado y aprobación de flags-diseno. Incorporar el enlace final antes de tomar implementación visual.

## Decisiones pendientes
Concretar límite de noches, mínimos de estancia sin fechas, alquiler mensual, conservación de duración al navegar, tratamiento de habitaciones existentes y tarifas especiales almacenadas. No marcar diseño Listo hasta tener decisiones y aprobación.

## Skills necesarias
Principal $ana-ux-ui para diseño y accesibilidad. Apoyo $ana-product-owner para resolver reglas de producto.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Diseñe la historia #59 «Búsqueda por noches y estados de las funciones desactivadas».
Aplique $ana-ux-ui, $ana-product-owner para reglas pendientes y $credit-saver. Lea AGENTS.md, .scratch/feature-flags/spec.md e issues/02-flags-diseno.md. Consulte docs/diseno-v1.md, tokens y pantallas vigentes, y los componentes actuales antes de proponer cambios.

Prepare una propuesta concreta para móvil y laptop
1. Explorar y su búsqueda con zona, personas y número de noches. Sin mes. Muestre el control de duración, su estado vacío, errores, resumen de búsqueda y total estimado en tarjeta y mapa.
2. Ficha con selección de fechas y bloqueos visibles. Con precios especiales apagados, explique el precio base por noches y la confirmación de disponibilidad/precio final por WhatsApp.
3. Calendario del anfitrión con selección de fechas y bloquear/desbloquear, mientras la edición de tarifa diaria está apagada. iCal permanece disponible.
4. Publicación y filtros sin la opción de tipo Habitación. Distinga tipo de alojamiento de número de dormitorios.
5. Estados de enlaces antiguos, sesión/caché anterior y cambio de flags entre visitas.

Reglas que debe cerrar con Ana
Mínimo/máximo de noches, cómo afecta min_nights sin fechas, estancias de 30 noches o más y precio mensual, comparación/filtro de precio cuando se muestra total, conservación de duración al navegar, mensaje sobre tarifas especiales guardadas y destino de habitaciones existentes (publicadas, borradores y cambios solicitados).
Presente alternativas acotadas solo donde falte una decisión. Registre cada aprobación. Entregue archivos de diseño con enlace real y referencia final que puedan usar #60–#62. Muestre la propuesta en móvil y laptop siguiendo las herramientas permitidas. La implementación visual empieza tras la aprobación trazable de Ana.
Incluya una lista de pruebas manuales de comprensión, teclado/foco, lector de pantalla, móvil estrecho y laptop. Respete español de Costa Rica con usted.
```
