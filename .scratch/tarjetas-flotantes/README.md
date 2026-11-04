# Tarjetas flotantes en toda la app

Status: needs-info (inventario y diseño antes de tickets)

Petición de Daniel (2026-11-04), con una captura de referencia de Explorar: en vez de cabeceras y barras fijas, **tarjetas flotantes translúcidas** (fondo claro semitransparente con desenfoque, sombra suave, esquinas redondeadas, separadas del borde), que **se esconden al bajar y vuelven al subir**, como hoy la barra de pestañas.

Decidido (Daniel, 2026-11-04):
- **Excepciones que flotan pero no se esconden:** la barra de la ficha con «Contactar por WhatsApp» y la barra «Atrás / Continuar» del asistente de publicar.
- Proceso: inventario → propuesta visual con el agente de diseño → tickets por zona, uno a uno, desplegados y probados.

## Inventario (2026-11-04, resumen)
- Hoy no hay `backdrop-filter`. Todas las barras son planas, opacas (`--bg`), pegadas al borde con línea de 2 px. Solo la barra de pestañas y «Mapa» se esconden (`client/hiding-tabbar.ts`, `html.tabbar-away`).
- Elementos: barra de pestañas (`chrome.tsx:60`), topbar de Favoritos, cabecera de Explorar (`.explore-top`, sticky), «Mapa» (`.map-label`), mapa a pantalla completa (`.map-full-top`, `.map-card`), cabeceras de flujo (`FlowHeader`, no fijas, 28 usos), barra de la ficha (`.cta-bar`, fija; sticky en escritorio), botones sobre la foto, barras `.sticky-actions` (asistente, editar, Filtros «Ver N casas», Buscar, revisión del admin), «Ver ficha» (`.float-btn`), panel del calendario (`.cal-panel`), toasts, banner de actualización, hojas y telón, descripción a pantalla completa, vista previa del asistente.
- Decisiones que se revertirían: 2026-10-30 «Solo la barra de abajo; las cabeceras se quedan»; 2026-10-29 «lo que flota sobre mapas o fotos, opaco»; token `bottomNav` «plana, sin píldora».
- Riesgos: CLS/hidratación y alto de la barra de la ficha (ficha.spec), teclado del iPhone en el asistente (`--kb`), Safari (`-webkit-backdrop-filter`, `transform` del centrado rompe el desenfoque, barra del navegador), contraste sobre fotos/mapa (opacidad ≥ 0,8), tema oscuro, foco (`:focus-within`), reduced motion, toasts/banner con `--nav-h` fijo (usar `--chrome-bottom`), presupuesto JS (la ficha SSR no monta TabsFrame).
- Tickets propuestos: T0 base (tokens `--float-*`, `.float-card`, `html.chrome-away`); T1 barra de pestañas; T2 Explorar; T3 ficha; T4 barras de formularios; T5 panel del calendario; T6 flotantes sueltos (Ver ficha, toast, banner); T7 hojas y cabeceras de flujo; T8 verificación Safari y presupuestos.
