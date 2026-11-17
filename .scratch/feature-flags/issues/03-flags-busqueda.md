Status: needs-info

# Alternar búsqueda por fechas y disponibilidad o por número de noches

## Historia
Como viajero, quiero buscar por duración o fechas según el modo habilitado para comparar precios orientativos.

## Contexto y alcance
Una sola flag une entrada de fechas y filtrado por noches bloqueadas en Explorar. Desactivada inicialmente. Duración activada inicialmente: precio base × noches, sin mes ni fechas ficticias. Sin duración se muestra precio base por noche. Con fechas activadas prevalecen sobre duración y se filtra ocupación con la regla existente de todas las noches llegada-salida. Mantener coherencia en tarjetas, mapa, filtros y enlaces. search_listings filtra disponibilidad actualmente: adaptar contrato, fake y pruebas de contrato según arquitectura.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** fechas apagadas y noches encendidas, **cuando** se buscan 4 noches para una casa con base ₡45 000, **Entonces** se ve una estimación de ₡180 000 por 4 noches y los bloqueos no excluyen la casa de Explorar.
2. **Dado** fechas encendidas, **cuando** se busca una estancia que incluye una noche bloqueada, **Entonces** la casa se excluye y se usa llegada inclusiva y salida exclusiva.
3. **Dado** ambas entradas apagadas, **cuando** se abre Explorar, **Entonces** se puede buscar sin estancia y se ve el precio por noche.
4. **Dado** un enlace o estado persistido con fechas estando apagadas, **cuando** se abre Explorar, **Entonces** esas fechas no aplican un filtro oculto de disponibilidad.
5. **Dado** un valor de noches vacío o inválido, **cuando** se confirma la búsqueda, **Entonces** se aplica el comportamiento y los límites aprobados sin un total inválido.
6. **Dado** que se abre la ficha con fechas habilitadas allí, **cuando** se consulta una estancia, **Entonces** se muestran sus bloqueos y se prepara el contacto por WhatsApp conforme al flujo aprobado.

## Dependencias y diseño
Dependencias: flags-base, flags-diseno. Diseño: Pendiente. Resultado y aprobación de flags-diseno. Incorporar el enlace final antes de tomar implementación visual.

## Decisiones pendientes
Aplicar las decisiones aprobadas sobre mínimo y máximo de noches y estancias mensuales. Definir el comportamiento de la ordenación/filtro de precio si muestra un total por duración.

## Skills necesarias
Principal $ana-frontend-developer para búsqueda, mapa, ficha y URL. Apoyo $ana-backend-developer para consulta, cálculo y contrato; diseño previo $ana-ux-ui en flags-diseno.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Implemente la historia #60 «Alternar búsqueda por fechas y disponibilidad o por número de noches».
Aplique $ana-frontend-developer, $ana-backend-developer y $credit-saver. Lea AGENTS.md, .scratch/feature-flags/spec.md e issues/03-flags-busqueda.md. Compruebe el contrato entregado por #58 y el diseño/reglas aprobados en #59 antes de implementar.

Inspección dirigida
Revise apps/app/src/domain/search.ts, filters.ts, stay-label.ts y stay-price.ts, el adaptador apps/app/src/data/postgrest/listings.ts, search_listings y sus contratos, búsqueda/mapa/ficha y construcción del mensaje de WhatsApp. Identifique URL, caché y fake que dependen de llegada/salida.

Implemente tres modos efectivos
- Inicial: fechas apagadas y noches encendidas. Explorar pide número de noches y muestra precio base × noches como estimación. No genere fechas ficticias ni excluya por bloqueos. Zona, personas y otros filtros siguen participando.
- Fechas encendidas: elegir llegada/salida y excluir casas con alguna noche bloqueada del intervalo [llegada, salida). Este modo prevalece aunque noches esté encendida. El cálculo respeta el valor de la flag de precios especiales.
- Ambas apagadas: búsqueda sin estancia con precio por noche.

Integre los recorridos completos
Normalice enlaces antiguos y estado persistido para evitar filtros ocultos. Haga coherentes tarjetas, mapa, resumen, filtros de precio y vacíos. Al entrar en la ficha, conserve el contexto aprobado y permita fechas exactas con bloqueos visibles y consulta por WhatsApp. Resuelva las reglas mensuales y límites con la aprobación de #59. Si cambia el contrato SQL, actualice fake, adaptador, tipos y pruebas de contrato según AGENTS.md.

Casos de validación
Base ₡45 000 × 4 noches = estimación ₡180 000. Una casa con bloqueos aparece en modo duración y se excluye si fechas activadas coinciden con un bloqueo. Compruebe límites/entrada inválida, llegada/salida exclusiva, enlaces viejos, cambio de modo con caché y coherencia tarjeta/mapa/ficha. Actualice docs/pruebas-manuales.md y facilite comandos a Ana. Entregue un paso completo que pueda probar manualmente.
```
