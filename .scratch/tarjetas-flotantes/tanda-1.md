# Tarjetas flotantes · tanda 1: base, barra de abajo, Explorar y botones sueltos

Status: ready-for-agent (Daniel, 2026-11-04)

Referencia obligatoria: `README.md` de esta carpeta (petición, inventario, decisiones 1–9) y las maquetas `maquetas/` con su CSS `maqueta.css` (punto de partida, no copia ciega: está escrito como parche inyectado).

## Zonas (un commit por zona, en este orden)
1. **Base común.** Tokens en `global.css` y `design/tokens/tokens.json` (subir versión): `--float-bg` (crema ~80 %), `--float-bg-strong` (~90 %), `--float-blur`, `--float-edge`, `--float-shadow`, radios 12/16, separación 12 px + área segura; tema oscuro incluido. Clase/patrón de tarjeta flotante con `@supports (backdrop-filter)` y `-webkit-backdrop-filter` (respaldo opaco). Generalizar el escondido: `html.tabbar-away` → un mecanismo común (p. ej. `html.chrome-away`) que usen todas las piezas que se esconden, con `:focus-within` (lo enfocado no se esconde), `prefers-reduced-motion` (sin desplazamiento) y sin `transform` de centrado en piezas con desenfoque (centrar con `left/right` + `margin:auto` o `inset`). Variable `--chrome-bottom` para lo que se apoya sobre la barra de abajo.
2. **Barra de abajo:** píldora flotante con iconos **y etiquetas** (decisión 3), pestaña activa con pastilla terracota suave; se esconde al bajar y vuelve al subir (como hoy). Contador de consultas como hoy.
3. **Explorar:** mapa arriba a todo el ancho (decisión 4); el buscador, el botón de filtros y «₡ | $» flotan encima como tarjetas y se esconden al bajar / vuelven al subir; los precios del mapa no quedan debajo de las tarjetas (`fitBounds`/`padding` del mapa); la lista debajo. Topbar de Favoritos como tarjeta flotante. Mapa a pantalla completa coherente (sus controles como tarjetas).
4. **Botones sueltos:** «Mapa» y «Ver ficha» en la **variante B clara** (decisión 8); toasts y banner de actualización apoyados en `--chrome-bottom` (siguen a la barra si está, o al borde si no).

## Fuera de esta tanda (tanda 2)
Ficha (barra de precio/WhatsApp, botones sobre la foto), `.sticky-actions` (asistente, editar, Filtros, Buscar, revisión del admin), panel y cabeceras del calendario, hojas, cabeceras de pantalla («‹ Título»: segundo paso).

## Decisiones que se revierten (anotar en `docs/decisiones.md` al cerrar la tanda; lo hace el orquestador)
«Solo la barra de abajo; las cabeceras se quedan» (2026-10-30), «lo que flota sobre mapas o fotos, opaco» (2026-10-29), token `bottomNav` «plana, sin píldora».

## Comprobaciones
Prueba primero donde aplique. Reescribir a propósito las e2e con valores exactos de estas zonas (inventario: navegacion.spec topbar/iconos, explorar.spec `.explore-top`, explorar-mapa, calendario.spec de la tabbar, propietario.spec del «Ver ficha», shell.spec, hiding-tabbar.test). `tests/unit/contrast.test.ts`: añadir la variante translúcida (peor caso sobre blanco y sobre foto oscura ≥ 4,5:1). Presupuesto: zona privada ~145 de 150 KB. Lighthouse: shell instalado < 2,5 s; mirar que Explorar no empeore el LCP. Capturas 375×667 y Pixel 7 de cada zona, comparadas con las maquetas.
