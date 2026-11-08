# Historias listas para trabajar y flujo de importación a GitHub

Regla acordada con Ana el 2026-11-05. Aplica a los nuevos lotes de historias preparados por el PO. No implementa funciones ni cambia por sí sola decisiones de producto.

## Fuente de verdad y publicación

- GitHub Issues/Projects contiene el estado de ejecución, prioridades y relaciones una vez importado el lote. `.scratch/<feature>/` conserva la preparación local y el contexto de las historias; no mantener un estado de ejecución paralelo desactualizado.
- Cuando Ana pide añadir historias, entregar un JSON y el comando de importación para que lo ejecute ella. No publicar ni modificar tarjetas remotas salvo petición explícita de Ana para ese caso.
- Un archivo `spec.md` por épica y un Markdown por tarjeta en `issues/`. El lote exporta las descripciones a JSON. Una clave `key` identifica cada tarjeta permanentemente; nunca cambiarla para reintentar una importación.
- Prioridad solo en el campo `Prioridad`; no generar etiquetas P0/P1/P2. Etiquetas `epic:*` para filtrar por épica. `Tipo de trabajo` distingue Frontend, Backend y Frontend y backend; no volver a mostrar Área como clasificación duplicada.

## Estado y preparación son distintos

Todas las tarjetas nuevas entran en **Todo**. Esto no significa que estén listas para implementarse.

El campo **Preparación** admite:

- **Por definir:** faltan decisiones, alcance o criterios. Las épicas agrupan trabajo y no se ejecutan directamente.
- **Bloqueada:** depende de una investigación, decisión, diseño o implementación anterior.
- **Lista para trabajar:** un agente puede ejecutar el alcance indicado sin inventar requisitos.

El importador solo establece la preparación inicial. No desbloquea automáticamente tareas al cerrar una dependencia. Un agente o el PO debe comprobar el resultado real y actualizar el campo. Una dependencia cerrada como `wontfix`, rechazada o incompleta no satisface la condición de entrada.

## Antes de empezar una implementación

1. Leer la historia completa, su épica, dependencias, diseño y decisiones vigentes. Contrastar con el código: no reconstruir una capacidad ya existente.
2. Confirmar objetivo, usuario, alcance, exclusiones y criterios BDD observables, con errores y casos límite relevantes.
3. Comprobar que las dependencias están resueltas y su resultado aprobado habilita esta implementación. Respetar las relaciones nativas `blocked by` de GitHub; la jerarquía padre/hijo no sustituye un bloqueo.
4. Si modifica UI, exigir enlace a la tarea de diseño, y dentro de ella una maqueta/prototipo o especificación visual final con versión y aprobación de Ana. Tener solo una tarea de diseño abierta **no** significa disponer del diseño. `Diseño` debe ser **Listo**. Si no necesita diseño nuevo, justificar **No necesario** y citar la referencia vigente.
5. Resolver reglas de negocio que condicionan el trabajo. Una propuesta de precio, país de empresa, promoción o canal de pago no equivale a una decisión aprobada.
6. Definir validación, impacto de datos, permisos y errores. En pagos: entorno sandbox, verificación en servidor, idempotencia y ausencia de cobros duplicados. En acceso: teléfono verificado, recuperación y TOTP administrativo sin debilitarlos.
7. Registrar `Preparación: Lista para trabajar` y el estado local de triage adecuado (`ready-for-agent` o `ready-for-human`). Mover a En Desarrollo solo al iniciar efectivamente el trabajo. No resolver decisiones comerciales por cuenta propia.

Si falta un requisito, no empezar el código afectado: registrar qué falta, enlazar la dependencia y dejar **Bloqueada** o **Por definir**. Continuar solo trabajo independiente autorizado.

## Investigación y diseño sí pueden empezar antes

Una investigación está lista si tiene preguntas concretas, límites, fuentes/evidencias esperadas y entregable verificable; no necesita que la respuesta investigada exista de antemano. No autoriza activar proveedores, hacer cargos, introducir datos personales ni desplegar.

Una tarea de diseño puede empezar cuando el flujo y las reglas de negocio necesarios están definidos. Su cierre exige referencias accesibles, estados de carga/error/éxito, móvil primero, adaptación desktop, accesibilidad y aprobación de Ana. Enlazar cada implementación dependiente y actualizar su campo Diseño solo tras esa aprobación.

## Enlaces y relaciones

- Épica → historias mediante sub-issues nativas.
- Historia → requisitos previos mediante `blocked by`; evitar ciclos.
- Historia de UI → tarea de diseño mediante `design_ref` en JSON; el importador genera su URL real en la descripción y un bloqueo nativo. Una tarea de diseño debe adjuntar después la maqueta o prototipo final; no inventar enlaces a archivos aún sin publicar.
- Evitar una cadena lineal artificial: investigaciones independientes pueden empezar a la vez. El cierre de una épica requiere aceptar sus historias o justificar explícitamente las excluidas.

## Skills necesarias y prompts

Cada historia preparada por el PO identifica en su cuerpo una skill principal y los apoyos necesarios, con su motivo y orden cuando haya fases. Las skills se eligen por el trabajo real y las reglas vigentes de `AGENTS.md`; asignarlas no resuelve dependencias ni aprueba el diseño.

Los prompts de ejecución se entregan **solo cuando Ana los pide**. Deben referenciar la historia vigente, seleccionar sus skills y conservar alcance, validación y condiciones de entrada. Una historia bloqueada no se convierte en una orden de implementar. La asignación se exporta dentro de `body`, sin crear campos nuevos en el lote o en GitHub Projects.

## Terminada no significa solo código escrito

Cerrar una implementación requiere criterios aceptados, comprobaciones relevantes con evidencia, diseño aprobado cuando aplique, documentación y pruebas manuales actualizadas, y límites conocidos declarados. No afirmar pruebas ejecutadas si no se han ejecutado. Cambios de proveedores y cobros reales necesitan la autorización y condiciones operativas vigentes; crear una historia no las concede.
