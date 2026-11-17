Status: needs-info

# Controlar precios por fecha conservando bloqueos del calendario

## Historia
Como anfitrión, quiero usar el calendario para bloquear noches aunque la edición de tarifas diarias esté desactivada.

## Contexto y alcance
Flag de precios por fecha apagada inicialmente. Separar controles de precio y bloqueos en calendario del anfitrión, ficha y cálculos. Con flag apagada se usa base por noche para las estancias a las que aplique el modelo nocturno aprobado. Conservar tarifas especiales almacenadas y acordar qué se informa al dueño antes de ignorarlas. Auditar cálculo SQL, frontend, SSR y contacto para que muestren el mismo importe. El precio mensual requiere resolución explícita.

Referencia común: .scratch/feature-flags/spec.md. La preparación se basa en archivos locales y decisiones de Ana del 2026-11-17. Duplicados y opciones remotas del proyecto pendientes de comprobar.

## Criterios de aceptación BDD
1. **Dado** precios por fecha apagados, **cuando** el anfitrión abre su calendario, **Entonces** puede bloquear y desbloquear noches y no se ofrece cambiar su tarifa diaria.
2. **Dado** una estancia de 3 noches con base ₡50 000 y una tarifa especial almacenada, **cuando** se calcula con la flag apagada bajo la regla nocturna aprobada, **Entonces** el total orientativo es ₡150 000 y se conserva la tarifa especial almacenada.
3. **Dado** que se reactiva la flag, **cuando** se calcula una estancia que incluye una tarifa especial conservada, **Entonces** vuelve a aplicarse esa tarifa con la regla vigente.
4. **Dado** un intento directo de guardar un precio especial con la función apagada, **cuando** llega al backend, **Entonces** se aplica el contrato de desactivación también fuera de la interfaz.
5. **Dado** noches bloqueadas con precios apagados, **cuando** se consulta la ficha, **Entonces** siguen mostrándose como bloqueadas.

## Dependencias y diseño
Dependencias: flags-base, flags-diseno. Diseño: Pendiente. Resultado y aprobación de flags-diseno. Incorporar el enlace final antes de tomar implementación visual.

## Decisiones pendientes
Aprobar comunicación de tarifas almacenadas, tratamiento mensual y confirmación de alcance del precio base antes de implementar.

## Skills necesarias
Principal $ana-backend-developer para cálculo, escritura y datos existentes. Apoyo $ana-frontend-developer para controles y presentación; diseño previo $ana-ux-ui.

## Validación
Verificar los escenarios de esta historia con los valores iniciales y sus alternativas. Usar cuentas y datos de prueba existentes. Incorporar pruebas de regresión del comportamiento afectado y los pasos manuales correspondientes, conforme a AGENTS.md. Ana ejecuta los comandos. No se han ejecutado pruebas de implementación al preparar este lote.

## Prompt para trabajar la historia
```text
Implemente la historia #61 «Controlar precios por fecha conservando bloqueos del calendario».
Aplique $ana-backend-developer, $ana-frontend-developer y $credit-saver. Lea AGENTS.md, .scratch/feature-flags/spec.md e issues/04-flags-precios.md. Requiere el contrato de #58 y las reglas/diseño aprobados en #59, particularmente tarifas guardadas y alquiler mensual.

Inspección dirigida
Localice almacenamiento y escritura de tarifas por día, selección y acciones del calendario del anfitrión, apps/app/src/domain/stay-price.ts, cálculo SQL de search_listings, ficha SSR/cliente y mensaje de contacto. Identifique dónde se mezclan bloqueo y precio en una misma operación.

Trabajo concreto
Con precios por fecha apagados, retire las acciones de editar tarifa diaria y aplique el precio base al cálculo nocturno según la regla aprobada. Mantenga seleccionar fechas, bloquear/desbloquear, ver bloqueos manuales/importados y conectar iCal. Aplique la restricción de escritura también en backend. Preserve las tarifas almacenadas para su posible reactivación y comunique al anfitrión su efecto según el diseño aprobado.
Con la flag encendida, permita gestionar y aplicar tarifas especiales con las reglas vigentes. Haga coherentes consulta SQL, tarjeta/mapa cuando corresponda, ficha SSR y cliente y contacto. Aplique el tratamiento mensual aprobado sin deducir una política nueva.

Validación concreta
Prepare una casa de prueba con base ₡50 000, una tarifa especial y una noche bloqueada. Con flag apagada, una estancia nocturna válida de tres noches cuesta aproximadamente ₡150 000; el bloqueo se conserva. Intente una escritura directa de precio especial y compruebe la restricción. Reactive la flag y confirme que la tarifa conservada vuelve a aplicarse. Compruebe que desactivar precios no altera bloqueos ni eventos iCal, y que todas las superficies muestran el mismo cálculo.
Entregue migraciones/contratos y pruebas pertinentes si cambian, más la guía manual actualizada y comandos para Ana.
```
