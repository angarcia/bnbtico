Status: needs-info

# Desactivar publicación y filtro de habitaciones mediante una flag

## Historia
Como responsable de producto, quiero habilitar conjuntamente publicar y filtrar habitaciones para controlar esta oferta.

## Contexto y alcance
Flag apagada inicialmente. Retirar opción de habitación de nueva publicación y filtros de Explorar. Alojamiento completo conserva las filas antiguas casa/apartamento. Evitar reclasificar habitaciones guardadas. Definir expresamente visibilidad de publicadas, edición/reenvío de borradores y casas con cambios solicitados. La flag cubre el tipo de alojamiento Habitación; el número de dormitorios de alojamientos completos mantiene su significado.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** habitaciones apagadas, **cuando** se inicia una publicación o se abren filtros, **Entonces** no se ofrece publicar ni filtrar por Habitación.
2. **Dado** un intento directo de enviar una habitación nueva con la flag apagada, **cuando** se procesa en backend, **Entonces** se rechaza conforme al contrato aprobado y se conserva el borrador.
3. **Dado** una habitación ya guardada, **cuando** se despliega la flag apagada, **Entonces** sus datos y tipo se conservan y su visibilidad y edición siguen la regla aprobada por Ana.
4. **Dado** un enlace antiguo con tipo habitación, **cuando** se abre con la flag apagada, **Entonces** se normaliza según diseño sin dejar un filtro oculto.
5. **Dado** habitaciones activadas, **cuando** se publica y filtra, **Entonces** se recupera el comportamiento existente con baño privado o compartido.

## Dependencias y diseño
Dependencias: flags-base, flags-diseno. Diseño: Pendiente. Resultado y aprobación de flags-diseno. Incorporar el enlace final antes de tomar implementación visual.

## Decisiones pendientes
Ana debe decidir qué ocurre con habitaciones ya publicadas y suscripciones, borradores y reenvíos. Ocultar una opción no determina la visibilidad de anuncios existentes.

## Skills necesarias
Principal $ana-frontend-developer para publicar y filtrar. Apoyo $ana-backend-developer para reglas de envío y datos existentes; diseño previo $ana-ux-ui.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Implemente la historia #62 «Desactivar publicación y filtro de habitaciones mediante una flag».
Aplique $ana-frontend-developer, $ana-backend-developer y $credit-saver. Lea AGENTS.md, .scratch/feature-flags/spec.md e issues/05-flags-habitaciones.md. Requiere contrato de #58, diseño de #59 y decisión explícita de Ana sobre habitaciones ya guardadas.

Inspección dirigida
Localice kind=habitacion, la opción de publicación y baño privado/compartido, filtros ?tipo=, search_listings, borradores locales, reenvío de cambios y revisión de Admin. Compruebe las filas antiguas casa/apartamento y el cálculo de capacidad/dormitorios.

Trabajo concreto
Con flag apagada, quite la opción de publicar una habitación nueva y la opción de filtrar por Habitación. Restrinja el envío de nuevas habitaciones en backend además de la interfaz. Mantenga el tipo y los datos de anuncios existentes y aplique su política aprobada de visibilidad, edición y reenvío. Normalice los enlaces antiguos de tipo habitación con una respuesta comprensible. El número de dormitorios de un alojamiento completo mantiene su función.
Con flag encendida, restaure el recorrido existente para habitaciones con baño privado o compartido y su filtrado. Reutilice los componentes y reglas actuales.

Casos de validación
Nueva publicación sin sesión y con sesión, envío directo, borrador de habitación anterior, anuncio publicado, cambios solicitados, enlace ?tipo=, y activación posterior de la flag. Confirme que la normalización no convierte una habitación en casa completa ni mezcla las opciones con el filtro de dormitorios. Cubra lo que decida Ana sobre suscripciones de habitaciones existentes si resulta afectado.
Entregue las pantallas y reglas cambiadas, pruebas de regresión necesarias, guía manual y comandos para Ana.
```
