# Tarjetas flotantes · tanda 2: ficha, barras de acción y calendario

Status: ready-for-agent (Daniel, 2026-11-04). La tanda 1 ya está hecha: usa su base (tokens `--float-*`, `.float-card`, `html.chrome-away` en `client/hiding-chrome.ts`, `--chrome-bottom`); no la reinventes.

Referencias: `README.md` (decisiones 1, 2, 6, 8 y las excepciones), maquetas `maquetas/3-ficha-*`, `3b-ficha-con-fechas-*`, `4-ficha-abajo-*`, `4-ficha-subiendo-*`, `7-publicar-*`, `8-filtros-*`, `9-calendario-*`, `9-calendario-panel-*` y `maqueta.css` (la franja gris entre la tarjeta de precio y el botón de la ficha es un resto de la maqueta: no va).

## Zonas (un commit por zona, en este orden)
1. **Ficha, barra de abajo (móvil):** **dos piezas flotantes separadas** (decisión 1): tarjeta clara (`--float-bg-strong`) con la cifra de la izquierda y los dólares a la derecha (lo que hoy pinta `PriceColumns`, incluido el total con fechas y «Mensual» con 30+ noches); debajo, a ~10 px y del mismo ancho, el botón verde «Contactar por WhatsApp» con sombra propia. **Fuera la nota «Precios orientativos…»** (decisión 2). **No se esconde.** La caja del botón sin hidratar (`.is-pending`) igual que hoy. **El alto total no cambia al hidratar** (ficha.spec, `useSpacerMatchingBar`); el hueco de abajo deja leer el último párrafo; iPhone SE: zona y personas visibles sin scroll. **Escritorio (≥ 1024 px) sin cambios** (sticky en la columna). La View Transition `listing-cta` puede ir en cada pieza o quitarse si estorba al desenfoque (dígalo). La vista previa del asistente (`.ficha-preview`) igual que la ficha.
2. **Ficha, botones sobre la foto** (volver, compartir, favorito): tarjetas flotantes que **se esconden al bajar y vuelven al subir** (decisión 6), también ya sobre el texto. La ficha SSR no monta `TabsFrame`: llama al escondido común tras hidratar (sin leer `window` en el render) o con un oyente sin React; sin avisos de hidratación; contador «1 / N» se queda con la foto.
3. **Barras de acción `.sticky-actions`** (asistente «Atrás / Continuar», editar «Guardar»/«Listo», Filtros «Ver N casas», Buscar «Borrar todo · Buscar», revisión del admin): tarjeta flotante (`--float-bg-strong`), separada del borde; **la del asistente no se esconde** (excepción); las demás tampoco en esta tanda (son la acción principal de su pantalla) salvo que el inventario muestre una razón; respeta el teclado del iPhone (`--kb`, `.publish-form::after`, `scroll-margin`) y que nada quede bajo la barra (ubicacion.spec, publicar.spec, buscar.spec).
4. **Calendario:** panel `.cal-panel` como tarjeta flotante (no se esconde mientras haya días elegidos); cabeceras pegajosas «L K M J V S D» y título del mes coherentes con la barra de abajo flotante.

## Fuera de alcance
Hojas y telón, descripción a pantalla completa y cabeceras de pantalla («‹ Título»: segundo paso), Explorar y barra de abajo (tanda 1).

## Comprobaciones
Prueba primero donde aplique; reescribe a propósito las e2e de posiciones exactas de estas zonas (ficha.spec 142–372, ficha-calendario.spec:226, no-disponible, fase4, publicar.spec 325/655, ubicacion.spec 30/250, buscar.spec 200, editar-casa, admin*, calendario.spec 129–131/266–305). Contraste en `contrast.test.ts`. Lighthouse: ficha en frío < 2,0 s (es la pantalla que convierte: que no empeore). Presupuesto: zona privada ~145,8 de 150 KB. Capturas 375×667 y Pixel 7 comparadas con las maquetas.
