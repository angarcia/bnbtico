Status: ready-for-agent

# Configurar y evaluar cinco feature flags por entorno

## Historia
Como equipo de 3bstays, quiero una configuración por entorno coherente para activar las funcionalidades acordadas.

## Contexto y alcance
Definir nombres canónicos, valores iniciales y lectura tipada en las capas necesarias. Auditar CSP, caché persistida, worker y PostgREST. Especificar qué reglas necesitan autoridad de servidor y aplicarlas también en RPCs, sin confiar en un booleano enviado por el cliente. Publicar un contrato consumible por las subtareas. Documentar cambios mediante configuración y despliegue, precedencia y alcance de cada flag.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** un entorno nuevo, **cuando** se evalúa la configuración sin valores explícitos, **Entonces** se obtienen los cinco valores iniciales de spec.md.
2. **Dado** un valor de configuración inválido, **cuando** se prepara el despliegue, **Entonces** se informa del nombre afectado y se evita desplegar con una interpretación ambigua.
3. **Dado** que fechas y noches están activadas, **cuando** se resuelve el modo efectivo de Explorar, **Entonces** prevalecen las fechas; con ambas apagadas se ofrece búsqueda sin estancia.
4. **Dado** que cambia una configuración, **cuando** un cliente actualiza la app o recupera caché, **Entonces** se aplica una versión coherente y se documenta el tratamiento de pestañas antiguas.

## Dependencias y diseño
Dependencias: ninguna. Diseño: No necesario. Referencia visual vigente en docs/diseno-v1.md para conservar los recorridos existentes.

## Decisiones pendientes
Sin decisión de producto adicional identificada. Contrastar el contrato con el código vigente antes de implementar.

## Skills necesarias
Principal $ana-backend-developer para contrato y autoridad de evaluación. Apoyo $ana-frontend-developer para consumo y caché; $ana-devops para configuración por entorno y comprobaciones de despliegue.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Implemente la historia #58 «Configurar y evaluar cinco feature flags por entorno».
Skills: $ana-backend-developer como principal, $ana-frontend-developer para consumo/caché, $ana-devops para configuración y $credit-saver durante toda la tarea.
Lea AGENTS.md, .scratch/feature-flags/spec.md y issues/01-flags-base.md dentro de esa carpeta.

Inspección inicial
Localice la configuración de Vite y del worker, la consulta search_listings en apps/app/src/data/postgrest/listings.ts, la configuración de Supabase y la persistencia de TanStack Query. Determine qué decisiones requieren evaluación en Postgres porque el navegador llama directamente a PostgREST. Distinga flags públicas de secretos. Aproveche la estructura existente.

Trabajo concreto
- Defina un contrato tipado con nombres estables para las cinco flags y los valores iniciales acordados.
- Defina cómo configura cada entorno sus valores y cómo los reciben navegador, worker y RPCs que lo necesiten. Evite que el cliente pueda habilitar una escritura restringida enviando su propio booleano.
- Implemente un resolutor del modo de búsqueda: fechas si están activadas; en su defecto noches si están activadas; en su defecto sin estancia.
- Establezca la validación de valores ausentes/incorrectos y la estrategia de versión para evitar discrepancias tras un despliegue con caché persistida o una pestaña antigua.
- Si hacen falta tablas o RPCs, use migración, permisos y contratos siguiendo AGENTS.md. Especifique el procedimiento de configuración por entorno antes de entregar el contrato a las demás subtareas.

Validación específica
Compruebe valores por defecto, configuración explícita, valor inválido y las cuatro combinaciones de flags de búsqueda. Verifique que la autoridad de servidor elegida no depende de una entrada manipulable del cliente. Documente cuándo toma efecto un cambio y cómo se restaura la configuración anterior.
Entregue el mapa de consumidores y el contrato que deben usar #60–#63, los archivos afectados y los comandos para Ana. Revise la documentación de entornos y arquitectura afectada antes de preparar un commit.
```
