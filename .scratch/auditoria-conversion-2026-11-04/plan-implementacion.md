# Aplicación secuencial de los cambios aprobados

Fecha: 2026-11-05. Especificación: [cambios aprobados](./cambios-aprobados.md).

**Objetivo:** adaptar los acuerdos a la aplicación actual por bloques completos de pantallas. Desde el 2026-11-06, Ana los prueba directamente en local; no enseñar ni pedir aceptación por cada ajuste.

**Arquitectura:** conservar React, los componentes compartidos y la división del CSS de `apps/app`. No copiar las maquetas ni recuperar Next. Mantener los recursos de marca actuales, posteriores a las referencias con rana.

**Ejecución:** en este chat y sobre la copia que sirve la aplicación local. Ana ejecuta los comandos de terminal; no hacer instalaciones, Git ni pruebas de terminal por cuenta del agente. Después de cada bloque completo y con pruebas en verde, preparar un commit antes de continuar (instrucción de Ana del 2026-11-06). Ana ejecuta commit y push; no publicarlos por cuenta del agente. Las capturas se revisan en 390 × 844 y 375 × 667; una captura no acredita los flujos restantes.

## Reglas comunes

- Mantener comportamiento, cargas, errores, foco, prevención de doble envío y desactivados reales.
- Objetivos táctiles de al menos 44 × 44 px; sin desbordamientos.
- Pagos dorados, estados y errores funcionales; sin cambiar precios, promociones, facturación ni datos.
- Usar las piezas e iconos existentes, sin dependencias nuevas.
- No activar/parar suscripciones ni enviar WhatsApps para revisar el diseño.

## Tandas

1. **Botones y notas compartidos** — `01-base.css`, `06-publicar.css` y `10-ajustes.css`; sincronizar tokens, diseño y guía manual. Verde B con sombra, desactivado gris, información neutra. Comprobar en navegador móvil, con las pruebas de contraste y typecheck ejecutadas por Ana. Pendiente de su revisión antes de avanzar.
2. **Publicar casa** — cabecera compartida con X a la derecha, progreso y contador debajo; retirar los dos textos redundantes, abrir las filas de capacidad con iconos y controles táctiles, unificar la barra inferior de la entrada y conservar guardado y composición de Continuar.
3. **Mis casas** — Compartir, acciones por casa solo con varias, contador real y Activar sin recortes; conservar tarjetas y estados.
4. **Consultas y selector compartido** — selector accesible reutilizado en Calendario, nombres discretos, Nueva dorada y WhatsApp ligero.
5. **Cuenta y suscripciones** — resumen con cantidades reales, acceso al listado completo y orden de activación sin tocar cobros.
6. **Detalle editable** — márgenes, fotos, estadísticas compactas y Compartir; conservar Ver ficha flotante.
7. **Mapa completo** — una salida inferior Ver lista, mantener Atrás del navegador y marcadores.
8. **Calendario** — acciones compactas y panel, reutilizando el selector de la tanda 4.
9. **Perfil** — conservar Editar junto al perfil y quitar el acceso duplicado del cliente.

Cada tanda localizará primero sus componentes vigentes y las pruebas de comportamiento que la cubren. Los cambios de comportamiento tendrán prueba previa; para cambios solo de CSS se usarán las comprobaciones existentes y revisión visual, sin pruebas que copien el CSS.

## Progreso

- Tanda 1: CSS y documentación preparados. Revisados Publicar y Filtros en 390 × 844 y 375 × 667: botones de 52/48 px, sin recorte de texto; error de tipo sin elegir conservado, sin avanzar el formulario. Capturas en `evidencias/implementacion/01-botones-*.jpg`. No se alteraron validaciones ni handlers. Comprobaciones ejecutadas por Ana: `pnpm typecheck` sin errores; en la suite general, los demás archivos pasaron y el único fallo fue la ausencia del navegador de Playwright. Reejecutado `private-sheets.test.ts` con `CHROMIUM_PATH`: 12/12 pruebas pasadas. Pendientes: estados desactivados de editores con sesión, teclado/Safari reales; aceptación visual de Ana confirmada el 2026-11-05. Incluida en el commit `dde9b1a`; integración posterior confirmada por Ana. No se verificó el despliegue desde herramientas.
- Tanda 2: implementación ampliada el 2026-11-06 conforme a la corrección de Ana. Cabecera compartida (también entrada, verificación y cargas), X a la derecha, progreso y contador debajo. Primera etapa sin «Su casa», sin nota redundante; etapas posteriores y progreso de campos incompletos conservados. Entrada sin cuenta con la misma barra inferior; capacidad sin tarjeta exterior, iconos y controles de 44 px. No se modificaron límites ni guardados. Comprobados en navegador los cinco pasos públicos (1, 2, 4, 5 y 6) en 375 × 667 y 390 × 844: sin desbordamiento ni scroll, sin solapamiento de cabecera, controles de al menos 44 px y barra inferior fija. Capturas finales `evidencias/implementacion/02-publicar-personas-final-*.jpg`; las capturas anteriores de la tanda 2 ya no representan la cabecera final. Comprobados también Cerrar → Explorar y Atrás → ubicación, sin errores de consola. Ampliada la prueba existente de disposición para verificar ambos tamaños y zonas táctiles. Pendientes: typecheck y E2E ejecutados por Ana, pasos con sesión (fotos, precio y resumen), teclado/Safari reales. Sin staging ni commit.
- Tandas 3–9: pendientes.
- El mapa con catálogo vacío se corrigió en `develop` con `bf49fdb` y se incorporó en la integración posterior. La prueba local preparada antes de esa corrección sigue separada de esta tanda.

## Corrección tras la primera ejecución de E2E (2026-11-06)

Ana ejecutó la tanda: 21 pruebas pasaron, 4 fallaron y 18 no se ejecutaron por el grupo serial de Publicar. El resumen hacía scroll (694 px frente a 667): la nueva cabecera duplicaba el título. Se conserva un solo título junto a «último paso» bajo el progreso, se ajustan los espacios del resumen a 8 px y sus filas mantienen 44 px. La comprobación existente de scroll reproduce el fallo; se añaden objetivos táctiles y oferta completa sobre la barra fija a esa misma prueba. Comprobados en navegador Fotos, Precio y Revisar y enviar con el borrador local de prueba en 375 × 667 y 390 × 844: altura de documento igual a la ventana, sin desbordamiento horizontal ni errores de consola; en 375 × 667, oferta hasta 574,09 px y barra desde 591 px. No se guardó, envió ni activó ninguna casa.

Los tres fallos de telemetría registran dos eventos en lugar de uno. La ejecución indicada por el agente apuntaba al Vite de desarrollo (5173), con StrictMode que repite los efectos de `listing_view` y el paso local `wizard_step`. La configuración y la guía del proyecto requieren build + vite preview. No se cambia la lógica ni se relajan las expectativas de telemetría; repetir la tanda sobre una compilación actual en 4173 (no el dev de 5173). Pendientes typecheck, build y repetición de los tres archivos E2E por Ana. No se afirma que la suite esté en verde.

## Resultado de repetición (2026-11-06)

Ana confirma **43 passed (2.0m)** para `publicar.spec.ts`, `publicar-v2.spec.ts` y `telemetria.spec.ts` después de la corrección y del cambio al entorno compilado. Esta ejecución sustituye el resultado fallido anterior. Tanda 2 con sus E2E en verde; teclado y Safari físicos no comprobados. Se continúa con Mis casas, según los acuerdos aprobados y la instrucción de trabajar por pantallas completas.

Ana pide preparar el commit de Publicar antes de continuar. Mis casas sigue sin cambios de implementación; solo se ha leído su código.
