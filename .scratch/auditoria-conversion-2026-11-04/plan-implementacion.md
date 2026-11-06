# Aplicación secuencial de los cambios aprobados

Fecha: 2026-11-05. Especificación: [cambios aprobados](./cambios-aprobados.md).

**Objetivo:** adaptar los acuerdos a la aplicación actual y entregar una tanda cada vez para revisión visual de Ana.

**Arquitectura:** conservar React, los componentes compartidos y la división del CSS de `apps/app`. No copiar las maquetas ni recuperar Next. Mantener los recursos de marca actuales, posteriores a las referencias con rana.

**Ejecución:** en este chat y sobre la copia que sirve la aplicación local. Ana ejecuta los comandos de terminal; no hacer instalaciones, Git ni pruebas de terminal por cuenta del agente. No hacer commit ni publicar sin la comprobación de la tanda. Las capturas se revisan en 390 × 844 y 375 × 667; una captura no acredita los flujos restantes.

## Reglas comunes

- Mantener comportamiento, cargas, errores, foco, prevención de doble envío y desactivados reales.
- Objetivos táctiles de al menos 44 × 44 px; sin desbordamientos.
- Pagos dorados, estados y errores funcionales; sin cambiar precios, promociones, facturación ni datos.
- Usar las piezas e iconos existentes, sin dependencias nuevas.
- No activar/parar suscripciones ni enviar WhatsApps para revisar el diseño.

## Tandas

1. **Botones y notas compartidos** — `01-base.css`, `06-publicar.css` y `10-ajustes.css`; sincronizar tokens, diseño y guía manual. Verde B con sombra, desactivado gris, información neutra. Comprobar en navegador móvil, con las pruebas de contraste y typecheck ejecutadas por Ana. Pendiente de su revisión antes de avanzar.
2. **Publicar casa** — retirar los dos textos redundantes, conservar progreso y la composición de Continuar; reutilizar los estilos de la tanda 1.
3. **Mis casas** — Compartir, acciones por casa solo con varias, contador real y Activar sin recortes; conservar tarjetas y estados.
4. **Consultas y selector compartido** — selector accesible reutilizado en Calendario, nombres discretos, Nueva dorada y WhatsApp ligero.
5. **Cuenta y suscripciones** — resumen con cantidades reales, acceso al listado completo y orden de activación sin tocar cobros.
6. **Detalle editable** — márgenes, fotos, estadísticas compactas y Compartir; conservar Ver ficha flotante.
7. **Mapa completo** — una salida inferior Ver lista, mantener Atrás del navegador y marcadores.
8. **Calendario** — acciones compactas y panel, reutilizando el selector de la tanda 4.
9. **Perfil** — conservar Editar junto al perfil y quitar el acceso duplicado del cliente.

Cada tanda localizará primero sus componentes vigentes y las pruebas de comportamiento que la cubren. Los cambios de comportamiento tendrán prueba previa; para cambios solo de CSS se usarán las comprobaciones existentes y revisión visual, sin pruebas que copien el CSS.

## Progreso

- Tanda 1: CSS y documentación preparados. Revisados Publicar y Filtros en 390 × 844 y 375 × 667: botones de 52/48 px, sin recorte de texto; error de tipo sin elegir conservado, sin avanzar el formulario. Capturas en `evidencias/implementacion/01-botones-*.jpg`. No se alteraron validaciones ni handlers. Comprobaciones ejecutadas por Ana: `pnpm typecheck` sin errores; en la suite general, los demás archivos pasaron y el único fallo fue la ausencia del navegador de Playwright. Reejecutado `private-sheets.test.ts` con `CHROMIUM_PATH`: 12/12 pruebas pasadas. Pendientes: estados desactivados de editores con sesión, teclado/Safari reales ; aceptación visual de Ana confirmada el 2026-11-05. Pendiente de commit, sin despliegue.
- Tandas 2–9: pendientes.
- El caso anterior del mapa con catálogo vacío queda separado de esta revisión: existe una prueba preparada, sin corrección de producción todavía.
