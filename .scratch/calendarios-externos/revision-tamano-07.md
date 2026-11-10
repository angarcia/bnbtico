# Revisión de tamaño de #7 · 2026-11-09

Ana pide revisar el crecimiento antes de decidir si amplía presupuestos. No se modifica ningún límite ni comportamiento en esta revisión. Se aplican ana-frontend-developer y ana-devops; Ana ejecuta el diagnóstico.

## Evidencia disponible

Salida de size-limit aportada por Ana: Calendario 9,06 kB / 8,5 kB (+559 B); Airbnb 8,23 kB / 8 kB (+228 B); Marcar una reserva 1,59 kB / 1,5 kB (+90 B); Campos del asistente 11,51 kB / 11,5 kB (+7 B). Son grupos distintos; la salida no mide latencia ni prueba por sí sola una regresión de experiencia. El traslado del icono no eliminó esos 7 bytes: la atribución inicial al icono fue incorrecta.

## Hallazgos al leer código y artefactos

1. La actualización directa de `airbnb-calendar-row.tsx` repite el flujo de `screens/airbnb.tsx`: requestId, exclusión local, respuesta obsoleta, publicación en Query, validación del resultado, invalidación, aviso y reconciliación. Es una oportunidad concreta de reutilización. No se elimina ninguna garantía para ahorrar bytes.
2. El calendario añade una segunda importación dinámica para `reservation-calendar.ts`. La tabla de precarga generada de `calendario-*.js` enumera también dependencias de integración/gestión. Tiene coste de nombres y código generado, además del código de preparación. Debe medirse su contribución; no es correcto atribuir todo el exceso a las reglas de disponibilidad.
3. El grupo manual de Vite `airbnb` reúne `airbnb.ts`, la fila y la pantalla de gestión, con dependencias recursivas desactivadas. Esto acopla piezas usadas desde el calendario con la pantalla completa. Dividir grupos solo se justificará si mejora el coste real y conserva una contabilidad completa; renombrar un archivo para dejar de medirlo no sería una optimización.
4. `reservation-calendar-*.js` no tiene presupuesto propio y no está excluido del grupo inicial: su peso se carga conservadoramente al JS inicial de 160 kB, pese a ser diferido. Hay que tenerlo en cuenta al comparar totales y evitar trasladar código fuera de un grupo para aparentar una reducción.
5. El archivo de navegador `ical-*.js` inspeccionado contiene errores y validación de URL, no el parser de eventos ni `ical.js`. No hay evidencia de que se haya llevado el parser al navegador.
6. La hoja añade carga, error, confirmación y ocupación existente; parte de su crecimiento es trabajo solicitado. Todavía no se ha demostrado que necesite un límite mayor: primero hay que revisar la duplicación y medir el resultado.
7. El asistente no fue modificado por esta ampliación. Su código generado contiene nombres hash de otras dependencias; variaciones de compresión son una hipótesis para sus 7 bytes. Hace falta comparar la fuente con una referencia y separar fuente de artefacto generado, sin afirmar una causa confirmada.

## Diagnóstico preparado

`node .scratch/calendarios-externos/auditar-tamano-07.mjs` lee el build actual, reproduce la suma gzip nivel 9 de @size-limit/file y detalla archivos, importaciones y tablas de precarga. Compara fuentes relevantes mediante `git show b4d929a:<ruta>`: solo lectura y sin cambiar ramas, commits o archivos. Esa referencia es #6 completo; no existe aquí un commit intermedio del #7 inicial, por lo que no permite atribuir byte a byte toda la ampliación posterior.

## Resultado del diagnóstico ejecutado por Ana

Leído `/tmp/bnbtico-auditoria-tamano-07.json`. Reproduce exactamente los excesos comunicados: 11507 B para Campos, 9059 B para Calendario (2301 + 5657 + 1101), 8228 B para Airbnb (2842 + 5386) y 1590 B para Marcar una reserva. El grupo inicial conserva margen: 155798 B frente a 160000 B; incluye los 1066 B de `reservation-calendar-*.js`, por lo que esa preparación no está fuera de la contabilidad.

Las fuentes de Campos, LocationStep y LocationPicker son idénticas byte a byte a `b4d929a`. La configuración de Vite también es idéntica. Esto descarta una ampliación de esas fuentes como explicación de los 7 B; todavía no identifica qué cambio concreto del artefacto generado los ocasiona. No se recomienda tocar el formulario ajeno para compensarlos.

La tabla actual de precarga de Calendario enumera 44 dependencias, ocupa 1459 B sin comprimir y quitarla hipotéticamente del archivo reduce 441 B gzip. Airbnb tiene dos tablas iguales de 26 dependencias, de 874 B sin comprimir cada una; sus diferencias orientativas de compresión son 350 y 319 B. Estos valores NO son ahorro implementado, no son el incremento frente a #6 y no se suman como si las dependencias pudieran eliminarse: las tablas cumplen una función de carga y su compresión depende del contexto.

## Conclusión y recomendación

No está justificado aprobar todavía los cuatro aumentos propuestos. Primero conviene unificar la lógica de actualización duplicada entre fila y gestión, conservando idempotencia, permisos, exclusión, errores, reconciliación y aislamiento de cuenta. Después revisar si se puede evitar el salto dinámico adicional de preparación desde Calendario sin cargar código en pantallas que no lo usan. Una nueva medida debe comparar grupos y total inicial con las mismas reglas; no basta cambiar nombres, excluir archivos o eliminar tablas de precarga para que un grupo aparezca menor.

La interfaz y las validaciones solicitadas se conservan. Si tras esa simplificación queda crecimiento funcional necesario, se puede proponer un ajuste localizado con tamaños nuevos y margen explícito. El caso de Campos se debe volver a observar después del build: fuente inalterada y artefacto 7 B por encima no justifican una refactorización de publicar/editar.

## Simplificación autorizada después de la revisión

Ana acepta proceder. Se unifica actualización/reintento en `updateAirbnbCalendar`, reutilizada desde fila y gestión. Cada componente mantiene su exclusión local y estado visual; la operación común conserva requestId ante resultado desconocido, descarta respuestas obsoletas, reconcilia, invalida y confirma éxito. La hoja usa una única salida accesible para error o conflicto de fechas, sin retirar la validación de ocupación ni la comprobación SQL.

Se separa el grupo manual de Vite en API/fila (`airbnb`), gestión (`airbnb-management`) y tarjeta de exportación (`airbnb-export`). Los tres conservan el prefijo `airbnb-` y cuentan en el MISMO presupuesto existente de 8 kB. No se excluye ningún grupo del total ni se modifica el presupuesto de JS inicial. Objetivo: que el calendario no arrastre la pantalla de gestión y exportación por pertenecer al mismo grupo forzado. Se mantiene la carga diferida de preparación de reserva, porque eliminarla adelantando sus 1066 B no sería un ahorro de transferencia.

Script para Ana: `comprobar-optimizacion-07.sh`; ejecuta tipos/build y genera `/tmp/bnbtico-auditoria-tamano-07-despues.json` antes de comprobar tamaño. Sigue pendiente observar el efecto: no se promete una reducción medida ni se afirma que los límites pasen. Ningún límite se ha ampliado, ni se han ejecutado builds/pruebas/Git desde el agente. Tras medir, repetir los E2E afectados por la operación común y por la carga de trozos diferidos.

## Medición después de simplificar

Ana ejecuta el script; typecheck, 10 pruebas de arquitectura y build correctos. Tamaño sigue fallando, con esta comparación reproducida por gzip nivel 9:

| Grupo | Antes (B gzip) | Después (B gzip) | Límite (B) |
| --- | ---: | ---: | ---: |
| Inicial privado | 155798 | 155840 | 160000 |
| Calendario | 9059 | 8864 | 8500 |
| Airbnb completo | 8228 | 9322 | 8000 |
| Marcar una reserva | 1590 | 1589 | 1500 |
| Campos del asistente | 11507 | 11504 | 11500 |

No hay un ahorro global acreditado: Calendario baja 195 B, pero el conjunto Airbnb aumenta 1094 B al comprimir por separado cuatro archivos en vez de dos. La mejora relevante de la separación es la dependencia estática del Calendario: antes el archivo de API/fila también contenía gestión y dependía circularmente de la tarjeta de exportación (5386 + 2842 = 8228 B). Ahora `airbnb-Czl5y6kf.js` de 2907 B no importa gestión ni exportación, ni por imports con `from` ni por efectos laterales; preparación de reserva también importa solo esa entrada. Así el código específico de Airbnb requerido estáticamente por Calendario baja 5321 B. Esto es evidencia del grafo de archivos, no una medición de latencia, descarga real o caché. La precarga del calendario baja de 44 a 31 dependencias y de 1459 a 1065 B sin comprimir.

Campos mantiene 31922 B sin comprimir, la fuente idéntica a #6 y una diferencia comprimida de −3 B tras cambiar otros módulos: el exceso restante de 4 B corresponde a la representación generada, sin nueva lógica del asistente en esta tarea. No conviene alterar su comportamiento para compensarlo. La hoja conserva sus validaciones y estados solicitados; su simplificación reduce código de 3427 a 3370 B sin comprimir, pero solo 1 B comprimido.

Recomendación pendiente de aprobación: conservar el aislamiento de pantallas por la menor dependencia estática del calendario y la actualización común por evitar duplicación; ajustar solo los presupuestos que ahora cubren el alcance aprobado: Calendario 9,1 kB, Airbnb total 9,5 kB, Marcar una reserva 1,65 kB y Campos 11,6 kB. Inicial privado permanece en 160 kB y los demás límites intactos. No se implementa esa propuesta sin respuesta de Ana. Los E2E deben repetirse sobre el código simplificado antes de cerrar #7.

Ana aprueba la propuesta en el chat el 2026-11-09. Se aplican exactamente esos cuatro límites y se registra la decisión. Solo se añaden comprobaciones de permisos por RPC directa y el script de cierre; no cambia el código de la aplicación después del build medido. `comprobar-cierre-reserva-07.sh` reutiliza ese build y comprueba tipos, suite unitaria completa, contrato SQL de reserva/permisos, E2E afectados y los límites aprobados. Sus resultados siguen pendientes.

Resultado final aportado por Ana y leído del registro: tipos, 2258 unitarias, 8 DB y 23 E2E correctos. Size-limit pasa todos los grupos, incluido inicial de 155,84/160 kB, Calendario 8,864/9,1 kB, Airbnb 9,322/9,5 kB, Marcar una reserva 1,589/1,65 kB y Campos 11,504/11,6 kB. Se satisface la comprobación funcional de la simplificación y el aislamiento de las pantallas; no se han medido tiempos de usuario ni se afirma una mejora de latencia.
