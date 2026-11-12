# Skills por historia y prompts bajo pedido

Consulte las skills y reglas vigentes de `AGENTS.md`; esta tabla orienta la selección, no sustituye sus instrucciones. Compruebe que la skill seleccionada exista y cubra el trabajo. Si falta una capacidad, indíquelo sin inventar una skill ni crearla por iniciativa propia.

| Trabajo de la historia | Skill correspondiente |
| --- | --- |
| Diseñar o rediseñar pantallas y recorridos | `ana-ux-ui` |
| Implementar o revisar interfaz | `ana-frontend-developer` |
| Implementar dominio, RPCs, permisos, migraciones funcionales o worker | `ana-backend-developer` |
| Diagnosticar rendimiento de base, planes, índices o recuperación | `ana-dba` |
| CI/CD, optimizar despliegues, entornos u operación de infraestructura | `ana-devops` |
| Definir producto, alcance, BDD, prioridades o decisiones pendientes | `ana-product-owner` |
| Consultoría de IA, prompts o integración de agentes | `ana-ia-consultant` |

## Siempre en las historias

Incluya en el cuerpo una sección **Skills necesarias** con una principal y apoyos solo cuando hagan falta; explique brevemente qué aporta cada una. Clasifique por trabajo real, no solo por la etiqueta: una investigación puede ser de backend, DBA o UX/UI según su pregunta.

Distinga fases. Un diseño pendiente puede requerir `ana-ux-ui` antes de que empiece frontend; no convierte la implementación bloqueada en ejecutable. Frontend que reutiliza diseño aprobado no exige diseñar otra vez. Una migración funcional no requiere una auditoría DBA completa por defecto. Las épicas pueden resumir las skills de sus fases sin tener un prompt de implementación propio.

Al exportar el lote, conserve esta sección dentro de `body`. No añada campos al esquema JSON ni a GitHub Projects para representar skills.

## Solo cuando Ana pida prompts

Prepare un prompt por historia o fase solicitada, con las menciones `$nombre-de-la-skill` necesarias y estas partes:

1. Historia identificada por su clave y archivo local, o URL real si está importada. Use la versión vigente de su contenido.
2. Objetivo, alcance y exclusiones, referenciando la historia sin duplicar toda su documentación.
3. Condiciones de entrada: dependencias habilitantes, decisiones y diseño aprobado cuando corresponda. Si no está lista, el prompt debe comprobar o aclarar lo pendiente y no ordenar implementar lo bloqueado.
4. Entregable y validación: BDD y pruebas pertinentes de la historia, evidencia esperada y revisión de documentación antes del commit según `AGENTS.md`.

Cuando haya fases dependientes, entregue prompts separados y señale el orden. El prompt no autoriza publicar en GitHub, aplicar migraciones alojadas, enviar mensajes ni desplegar; conserve las reglas de quién ejecuta comandos.

Entregue el texto copiable. Si se pide guardarlo, use `.scratch/<epica>/prompts/<NN>-<slug>.md`, junto a la preparación local. No genere archivos de prompts ni los incluya en cada lote si no se han pedido.
