Status: needs-info

# [Épica] Controlar funcionalidades de 3bstays con feature flags

## Historia
Como responsable de producto, quiero activar funcionalidades por entorno para ofrecer el recorrido acordado y probar alternativas de forma controlada.

## Contexto y alcance
Cinco flags por entorno. Búsqueda por fechas y disponibilidad desactivada; número de noches activada; precios por fecha desactivada; calendarios externos activada; publicar y filtrar habitaciones desactivada. Gestión inicial mediante configuración y despliegue. El calendario del anfitrión y el de la ficha continúan activos. La propuesta de selección por cuenta queda fuera de este lote.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** un entorno con la configuración inicial, **cuando** se recorren búsqueda, ficha, publicación y calendario, **Entonces** se observa el comportamiento de las cinco flags definido en spec.md.
2. **Dado** el cambio de una flag, **cuando** se despliega la configuración, **Entonces** los recorridos afectados y los accesos directos respetan el valor y los datos conservan su integridad.

## Dependencias y diseño
Dependencias: ninguna. Diseño: No necesario. Referencia visual vigente en docs/diseno-v1.md para conservar los recorridos existentes.

## Decisiones pendientes
Sin decisión de producto adicional identificada. Contrastar el contrato con el código vigente antes de implementar.

## Skills necesarias
Principal $ana-product-owner para alcance y coordinación. Las subtareas asignan $ana-ux-ui, $ana-frontend-developer, $ana-backend-developer y $ana-devops según su trabajo.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Coordine la épica #57 de feature flags de 3bstays como Product Owner.
Aplique $ana-product-owner y $credit-saver. Lea AGENTS.md y .scratch/feature-flags/spec.md.

Objetivo aprobado
Configurar por entorno estas cinco flags: fechas y disponibilidad en Explorar apagada; número de noches encendida; precios por fecha apagada; iCal encendida; publicación y filtro de habitaciones apagada. El calendario del anfitrión y de la ficha conserva los bloqueos manuales e importados. Fechas exactas en Explorar prevalece sobre número de noches.

Orden y condiciones
1. #58 define el contrato técnico. #59 define y obtiene aprobación de diseño y reglas pendientes. Pueden avanzar de forma independiente.
2. #60, #61 y #62 requieren contrato y diseño aprobado. #63 requiere contrato y aprobación del comportamiento al apagar iCal.
3. #64 verifica el conjunto después de las implementaciones.

Revise con Ana las decisiones sobre tarifas especiales existentes, precio mensual, límites de duración, habitaciones ya publicadas y conexiones iCal anteriores. Registre las aprobaciones y vincule sus referencias en las historias. Compruebe que cada dependencia resuelve la condición requerida antes de dar una implementación por preparada.
Entregue el siguiente paso ejecutable, sus bloqueos reales y la prueba manual prevista. Use el prompt específico de cada subtarea para su ejecución.
```
