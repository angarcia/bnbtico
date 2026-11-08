# Diseño conjunto v0.1 · Airbnb en Calendario

Estado: **Diseño móvil y reglas de producto consultadas P1–P6 aprobados por Ana el 2026-11-07**. La [spec](spec.md) recoge el alcance aprobado y las verificaciones técnicas pendientes. La aprobación corresponde a esta especificación visual escrita, sin maquetas nuevas ni pantallas implementadas o probadas con usuarios.

Alcance confirmado por Ana el 2026-11-07: **solo móvil por ahora**. Escritorio queda pendiente porque su web aún no está lista y no bloquea estas historias.

## Objetivo y referencias

Anfitrión: conectar el calendario correcto de su casa, copiar el de bnbtico y detectar/corregir una lectura fallida. Resultado observable: completar ambas direcciones sin confundir qué plataforma lee cuál, volver al mismo mes/casa y entender qué noches permanecen ocupadas.

Referencias existentes inspeccionadas:

- `docs/diseno-v1.md`: ajustes del 6 de noviembre, selector y acciones compactas; `design/tokens/tokens.json` **0.3.3**, más reciente que el 0.2.2 de AGENTS.
- `design/pantallas/movil/propuesta-2026-11-04/README.md` y `design/pantallas/disenos-2026-11-04.md`: índice, acuerdos y variantes históricas.
- `.scratch/auditoria-conversion-2026-11-04/evidencias/42-calendario-guardar-claro.jpg`: panel y botones vigentes; imagen inspeccionada.
- `design/pantallas/escritorio/propuesta-2026-11-04/capturas/09-calendario-1280.jpg`: imagen inspeccionada durante la preparación inicial; queda fuera del alcance actual y no fija requisitos para estas entregas móviles.
- `apps/app/src/client/screens/calendario.tsx`, `HousePicker`, hojas `mark-sheet`/`close-sheet`, `MonthGrid`, avisos `toast`: patrones de implementación actuales. `design/prototype/calendar.js` conserva comportamiento histórico superado para temporadas; no importarlo a v1.

## Composición móvil

Conservar Calendario, casa elegida, selector de 52 px, meses verticales, moneda, precios y panel manual. Añadir una tercera fila compacta «Conectar con Airbnb» debajo de Marcar una reserva y Pausar la casa. Con conexión o exportación existente dice «Calendarios de Airbnb», con segunda línea breve «Última importación: hoy, 09:17» o «No se pudo actualizar». No añadir una pestaña ni introducir controles dentro de cada mes.

La fila abre una vista de flujo de una sola casa: flecha + título «Calendarios de Airbnb», nombre completo debajo. No hay selector de casa en el flujo; volver conserva casa, mes y scroll. La navegación Atrás funciona igual que la flecha. Si había selección manual sin guardar, reutilizar la protección de salida vigente; no descartarla silenciosamente para abrir conexiones.

Orden vertical, margen 16 px, separación 16 px:

```text
‹ Calendarios de Airbnb
Casa Brisa del Caribe

Importar desde Airbnb
Traiga a bnbtico las noches bloqueadas en Airbnb.
[Conectar Airbnb]

Exportar hacia Airbnb
Lleve a Airbnb las noches que marque como ocupadas en bnbtico.
[Generar enlace]

Los calendarios se actualizan periódicamente…
```

No agrupar ambas direcciones bajo un estado «Sincronizado»: copiar un enlace no prueba que Airbnb lo haya añadido. En #5 se presenta únicamente importación; en #6 aparece exportación; #7 añade gestión; #8 añade periodicidad automática.

## Conectar y sustituir

Desde «Conectar Airbnb», hoja inferior con X, título «Conectar Airbnb», explicación «En Airbnb, abra el calendario de este alojamiento y copie su enlace de exportación. Péguelo aquí.». Evitar rutas de menús Airbnb no verificadas; acompañar la entrega con instrucciones contrastadas en una cuenta real.

Campo etiquetado «Enlace de calendario de Airbnb», tipo URL, pegado permitido y sin corrección automática; ejemplo no funcional, nunca un token real. Ayuda: «Solo importamos noches bloqueadas. No copiamos precios ni datos de huéspedes.» Botones «Conectar» y «Cancelar».

- Sin valor: Conectar desactivado real. Error sintáctico bajo campo: «Revise el enlace de exportación de Airbnb.»
- En curso: «Conectando…», `aria-busy`; impedir dobles envíos. No mostrar éxito ni colorear noches hasta terminar la primera lectura válida.
- Éxito: cerrar hoja, actualizar rejilla/datos y aviso «Airbnb conectado». En tarjeta: «Última importación correcta: 7 nov 2026, 09:17», «N noches bloqueadas por Airbnb» (no eventos, y sin deducir reservas).
- Vacío válido: éxito con «No hay noches bloqueadas por Airbnb en este período.»; no es error de conexión.
- Fallo inicial: hoja permanece, enlace introducido conservado y aviso «No pudimos leer el calendario. Revise el enlace e intente de nuevo.»; no se crea conexión activa.
- Sustituir (#7): acción secundaria «Sustituir enlace», misma hoja titulada así; ayuda «El enlace actual seguirá conectado hasta que podamos leer el nuevo.»; botón «Sustituir enlace». Un fallo conserva conexión, bloqueos y fecha anteriores. Éxito: «Enlace de Airbnb sustituido».
- Si se permite cerrar durante una petición, la operación puede continuar: al volver se muestra su estado real, nunca se presenta Cancelar como garantía de abortar algo confirmado por servidor.

## Estado y actualización (#7–#8)

Tarjeta Importar: proveedor, último éxito en fecha/hora de Costa Rica, cantidad de noches y acciones «Actualizar ahora» y «Sustituir enlace»; «Desconectar Airbnb» como texto secundario destructivo al final. La URL privada no se muestra completa en el resumen.

Durante actualización conservar datos y fecha anterior; estado «Actualizando…», botón desactivado, sin otro trabajo por doble toque u otra pestaña. Al terminar: aviso «Calendario actualizado» y fecha nueva, incluso sin cambios. Error posterior separado del éxito: «No se pudo actualizar · 7 nov, 12:17. Se conservan las últimas noches importadas.»; botón «Intentar de nuevo». No usar el ocre reservado a pagos.

En #8 añadir «Actualización automática cada 3 horas». Una próxima hora solo se muestra si procede del programador real; no calcular una promesa desde la última lectura. Un error no cambia la fecha de éxito. Sin red: «Sin conexión. Puede consultar el último estado guardado.» y acciones que necesitan red desactivadas; la copia de un enlace ya disponible puede funcionar sin red, sin afirmar frescura.

## Exportar (#6)

Sin enlace: «Todavía no ha generado un enlace de exportación.» y «Generar enlace». Al crear: indicador «Generando enlace…» y, si falla, «No pudimos generar el enlace. Intente de nuevo.»; no mostrar URL inventada.

Con enlace: campo de solo lectura «Enlace de bnbtico para Airbnb», seleccionable y con ajuste sin desbordamiento; botón principal «Copiar enlace». Ayuda: «Añada este enlace como calendario importado en Airbnb. Cualquier persona que lo tenga puede consultar sus noches bloqueadas; no puede modificarlas.»

Copia correcta: aviso «Enlace copiado». Clipboard denegado: «No pudimos copiarlo. Mantenga pulsado el enlace para copiarlo.» y selección manual accesible. Nunca decir «Airbnb conectado» por copiar exportación ni mostrar última lectura de Airbnb. Exportación vacía es válida: «No hay noches bloqueadas manualmente en este período.»

## Confirmaciones (#7)

Reutilizar diálogo/hoja de confirmación existente con foco contenido, Cancelar y acción explícita; no pedir confirmación adicional para copiar o actualizar.

| Acción | Título y explicación exacta | Confirmar y resultado |
| --- | --- | --- |
| Desconectar importación | «¿Desconectar Airbnb?» · «Se retirarán las noches importadas de Airbnb y dejarán de actualizarse. Sus bloqueos manuales y precios se conservan.» | «Desconectar Airbnb»; éxito «Airbnb desconectado». Exportación no cambia. |
| Revocar exportación | «¿Revocar este enlace?» · «El enlace actual dejará de funcionar. Retírelo también de Airbnb: los bloqueos que ya leyó pueden seguir apareciendo allí.» | «Revocar enlace»; éxito «Enlace revocado» y estado sin enlace con «Generar enlace». Importación no cambia. |

Pendiente: botón «Desconectando…» / «Revocando…» y sin doble envío. Error: confirmación permanece, «No pudimos completar el cambio. Intente de nuevo.»; conservar estado real anterior. Cancelar antes del envío no cambia nada. Confirmaciones no atribuyen a bnbtico la capacidad de borrar inmediatamente datos ya leídos por Airbnb.

## Noches y edición manual

Propuesta: mantener el color/rayado de ocupado. En el panel seleccionado, añadir origen textual «Ocupado por Airbnb», «Bloqueo manual» o ambos; nombres accesibles incluyen origen, sin nombres de huéspedes. No depender de otro color.

Disponible actúa únicamente sobre la capa manual; nunca permite prometer una noche libre mientras existe Airbnb. Si está importada, nota «Esta noche sigue ocupada por Airbnb. Para liberarla, cambie el calendario en Airbnb y actualice la importación.». Si hay ambas capas, permitir quitar el bloqueo manual con botón explícito «Quitar bloqueo manual», manteniendo Airbnb. Con selección mixta, informar cuántas seguirán ocupadas y aplicar solo a manuales; precios conservan su edición independiente. Este ajuste del panel forma parte del diseño móvil aprobado.

## Escritorio aplazado

No diseñar ni implementar ahora una adaptación específica a escritorio. Cuando su web esté lista, retomar composición, navegación y diálogos desde las referencias que estén vigentes entonces, con aprobación propia. No exigir esa adaptación para aceptar #5–#8 en móvil.

## Estilo y accesibilidad móvil

Figtree, fondo crema, tarjetas radio 12, campos/botones 8, hojas 16; botones tonales de tokens 0.3.3 y notas neutras. Logo vigente de `design/logo/`, sin regenerarlo. Objetivos ≥44 px; filas 52 px; títulos de flujo 24 px. Foco visible, etiqueta de campo persistente, error asociado por descripción, `role=alert` en fallo y anuncio de éxito sin mover foco. Escape/X devuelven foco al disparador; no dos hojas superpuestas. Texto largo y URL no provocan scroll horizontal. Contraste de texto ≥4,5:1; pruebas con zoom 200 %, teclado, lector y movimiento reducido.

No se ha construido ni abierto una UI nueva; solo se inspeccionaron capturas existentes. La validación visual y de usabilidad de la implementación sigue pendiente. Ana aprobó la composición móvil, textos, estados, confirmaciones y edición por procedencia de esta especificación, así como las reglas de producto consultadas P1–P6. Comprobar las condiciones técnicas de entrada de cada historia antes de implementar el alcance afectado.
