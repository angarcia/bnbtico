# Bloques restantes aprobados · 2026-11-06

**Spec:** cambios-aprobados.md, apartados 5–9; no se reinterpretan las tarifas provisionales de las capturas.
**Ejecución:** en este chat y checkout local. React/TypeScript, componentes y CSS existentes. Sin cambios de datos ni servicios. Sin instalaciones ni dependencias nuevas.
**Ruling:** Ana pide preparar todos los cambios ahora, separar un commit por bloque y ejecutar las pruebas conjuntamente mañana. Los tests se actualizan pero no se ejecutan hoy; no se presentan como verificados. El agente no ejecuta commits ni push.
**Commits:** parches incrementales propios en commits-pendientes, aplicables al índice en orden 05–09; dejan fuera los cambios ajenos del checkout, incluso en documentación compartida.

- [x] 05 Preparado, pendiente de pruebas. Cuenta/suscripciones: resumen real sin ocultar avisos ni bloqueos; listado completo, inactivas primero, tarifa actual y oferta dorada. Pruebas: subscription-presentation, suscripcion, cuenta-y-actividad y estados-suscripcion.
- [x] 06 Preparado, pendiente de pruebas. Detalle: margen12, fotos accesibles crema44, cifras centradas y compactas, nota breve; conservar flotante. Pruebas: propietario, editar-casa y navegación.
- [x] 07 Preparado, pendiente de pruebas. Mapa: una salida inferior Ver lista con recuento; foco y Atrás intactos. Pruebas: explorar-mapa, explorar y navegación.
- [x] 08 Preparado, pendiente de pruebas. Calendario: filas compactas y explicaciones en hojas; conservar estado, mes, moneda y panel. Pruebas: calendario y private-sheets.
- [ ] 09 Perfil: conservar Editar y quitar la fila duplicada del cliente; formulario intacto. Pruebas: cuenta-y-actividad y navegación.

**Revisión:** comprobar código y disposición móvil 375×667/390×844 sin activar/parar suscripciones ni enviar mensajes. Revisar nombres largos, muchas casas, bloqueadas, URL directa, errores, foco, y guardados sin cambios. Una revisión visual no equivale a ejecutar las suites.

05: resumen con contadores reales de todas las suscripciones; pagos/avisos y bloqueos visibles, listado sin límite, tarjetas independientes y tarifa actual/promocional diferenciada. Incluidos casos unitarios de orden, recordatorios, bloqueo y 12 casas, y caso E2E de cinco casas. No se ejecutaron las pruebas.

06: referencias35/36 leídas completas; margen y acceso de fotos solo del propietario, cuenta de fotos pendientes conservada, admin sin cambio de aviso, cifras con min-height138 y misma consulta. Se adaptan localizadores y se comprueban en las pruebas preparadas el objetivo táctil, margen y altura. Pruebas no ejecutadas.

07: leída la referencia38; reutilizado el cierre existente, foco inicial en el contador renombrado Ver lista. Las pruebas conservan historial, vuelta a la posición de la lista, marcador y contacto; solo se elimina la expectativa de flecha y se actualiza el nombre del contador. Pruebas no ejecutadas.

08: referencias40/42 leídas. No se tocó el panel de días ni su guardado: ya aplica el estilo global y la validación de cambios. Se retiran solo dos explicaciones permanentes; reserva se explica en su hoja y pausa ya se explicaba en close-hint. Selector común ya entregado en el bloque4. Pruebas no ejecutadas.
