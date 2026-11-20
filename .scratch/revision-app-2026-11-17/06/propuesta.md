# Historia 06 · Apartados en ventanas de escritorio y editor de fotos amplio (borrador para Ana, 2026-11-20)

Estado: **aprobada por Ana el 2026-11-20 con todas las recomendaciones** de §6 (anotado en `docs/decisiones.md`) e implementada el mismo día; capturas del resultado real frente a la propuesta en [resultado/](resultado/).

- Estado actual: capturas en [antes/](antes/) (build local, Supabase local, casa sembrada con 6 fotos: 4 horizontales y 2 verticales). Medidas en `antes/medidas.json` y `antes/alturas.json`.
- Propuesta: [muestras/muestras.html](muestras/muestras.html), servida por http (`python3 -m http.server 8766 --bind 127.0.0.1` desde la raíz del repo → `http://127.0.0.1:8766/.scratch/revision-app-2026-11-17/06/muestras/muestras.html`). Los formularios son el HTML real de la app sacado de la build (`muestras/fragmentos/`), dentro del marcado real de `Dialog`, con el CSS real (`global.css`); lo nuevo lleva el prefijo `p06-` en `muestras/propuesta.css`. El detalle de detrás es la captura real. Capturas: `muestras/propuesta-<ancho>-<escena>.png` (rehacer con `muestras/capturar.mjs`).
- Comparativas antes | propuesta: [comparar-precio.png](comparar-precio.png), [comparar-descripcion.png](comparar-descripcion.png), [comparar-ubicacion.png](comparar-ubicacion.png), [comparar-fotos-1280.png](comparar-fotos-1280.png), [comparar-fotos-1440.png](comparar-fotos-1440.png), [comparar-fotos-1920.png](comparar-fotos-1920.png).

## 1. Qué hay hoy en escritorio (≥ 1024 px)

Hay **dos caminos distintos** para el mismo apartado:

1. **Desde el detalle** (`/propietario/casas/$id`), el botón «Editar» de una fila abre el editor **dentro de la lista** (`InlineHouseEditor`, `casa-editable.tsx`), sin cambiar la URL. Es «el apartado que se expande» que vio Ana (`antes/1280-1-inline-*.png`).
2. **Con la URL** `/propietario/casas/$id/editar/$campo` (enlace guardado, recarga, o el admin), el editor sale como **panel derecho** en lugar de la lista (`rightPanel` de `OwnerHouseDetail`, `editar.tsx:89`; `antes/1280-2-ruta-*.png`).

Las fotos: desde el detalle abren `Dialog size="wide" layout="photos"` (960 px); con la URL `/editar/fotos`, otra vez el panel derecho (`antes/1280-3-fotos-ruta.png`). En el teléfono todo es una pantalla por apartado (`antes/movil-*.png`), y **no cambia**.

## 2. Inventario de apartados

Datos de `domain/edit.ts` (`FIELD_ORDER`, `IMMEDIATE_FIELDS`, `REVIEWED_FIELDS`) y `editar.tsx` (`FieldInputs`). Alto = el contenido del formulario sin la barra de pie, medido a 1280 en el panel actual (`antes/alturas.json`), y el alto de la ventana propuesta a 1280 × 800 (`muestras/medidas-propuesta.json`).

| Apartado (`$campo`) | Guarda | Qué contiene | Contenido hoy | Ventana propuesta |
|---|---|---|---|---|
| Nombre (`nombre`) | **Revisión** («Enviar a revisión», `save_edit`) | `TextInput` 32 caracteres con contador «n / 32 · mínimo 5», aviso de revisión | 174 px | normal 520 × 405 (con el error) |
| Tipo (`tipo`) | Revisión | `ChoiceCards` (Alojamiento completo / Habitación) y, con Habitación, el baño (segmento). **Oculto** con la flag de habitaciones apagada (valor de hoy) | — (no se ve) | normal 520, ~300 |
| Personas, dormitorios y baños (`capacidad`) | **Al momento** («Guardar», `update_listing_live`) | 3 `CounterRow` (en una Habitación, solo Personas) | 256 px | normal 520 × 420 |
| Características (`caracteristicas`) | Al momento | 8 `ChoiceChips` en 2 columnas, ayuda; con Parqueo, «¿Se paga aparte?» | 250 px | normal 520 × 414 |
| Descripción (`descripcion`) | Revisión | `TextArea` hasta 2000 caracteres con contador, aviso de revisión | 222 px | normal 520 × 670 (área de 280 px y el error) |
| Precio (`precio`) | Al momento | `AffixInput` ₡ por noche, segmento «¿Acepta alquiler por meses?», con «Sí» el precio al mes opcional y su ayuda | 206 px (316 con «Sí») | normal 520 × 549 (con «Sí») |
| Ubicación (`ubicacion`) | Revisión | buscador flotante sobre **mapa Leaflet** (200 px de alto hoy), «Los clientes solo ven la zona…», cantón y provincia, `Select` Zona, aviso de revisión | 436 px (y más al cargar el mapa) | **ancha** 960 × 744 (mapa 280) |
| Fotos (`fotos`) | Orden y quitar las aprobadas: **al momento**. Fotos nuevas: **revisión**, una a una al subirlas | `PhotoGrid`: rejilla de 3 con la portada 2 × 2, añadir, contador «n de 15», aviso | ventana de 960 × 752 | **amplia** casi a pantalla completa (§4) |

No son apartados de edición (se quedan como están): Compartir, WhatsApp de la casa, Suscripción, Eliminar casa, y los «Descartar» de un dato pendiente (ya usan `ConfirmSheet`).

**Admin** (`/admin/casas/$id/editar/$campo`): usa la misma `EditarCampoScreen` y `EditFieldForm` con su puerto (`useEditor`: guarda al momento, sin revisión) y la misma `EditPhotos`/`PhotoGrid`; en escritorio no usa el detalle con panel (`desktop && !port.admin`), es pantalla completa. Lo que comparten es el formulario por campo y la rejilla de fotos: la propuesta los mete en una ventana solo en la ruta del anfitrión en escritorio, así que el admin no cambia; hay que comprobarlo por regresión (`admin-edita-casas.spec.ts`).

## 3. La ventana normal de un apartado

Ver `muestras/propuesta-1280-precio.png`, `-nombre-error.png`, `-descripcion-error.png`, `-capacidad.png`, `-caracteristicas.png`, `-ubicacion.png`, `-descartar.png`.

- **Componente:** `Dialog size="normal"` de 07, sin CSS nuevo salvo colocar. Ancho **`--dialog-w` (520 px)**: todos los apartados caben en una columna de 472 px (la del teléfono es 380); a esa medida la descripción sale a ~55 caracteres por línea, buena para escribir.
- **Ubicación:** `Dialog size="wide"` (**`--dialog-w-wide`, 960 px**), porque el mapa necesita anchura para apuntar con el ratón; mapa a lo ancho (910 px) con alto `clamp(240px, 100dvh − 520px, 420px)`: 280 px a 800 de alto, 380 a 900. Mismo orden que en el teléfono: buscador sobre el mapa, privacidad, cantón, Zona, aviso. Al ser ancha no se cierra con el fondo (regla de 07), lo que además evita cerrarla por soltar un arrastre del mapa fuera.
- **Alto:** el de `Dialog`: alto del contenido hasta `100dvh − 32px` (768 a 800). Cabecera y pie fijos; solo el cuerpo se desplaza (`.dialog-body`). A 1280 × 800 ningún apartado se desplaza salvo la descripción muy larga.
- **Cabecera:** el título del apartado (`fieldTitle`, «Personas» en una Habitación) y la ✕. Debajo, en el cuerpo, el nombre de la casa en gris (la línea `edit-house` que ya existe).
- **Pie:** a la derecha, «Cancelar» (`secondary`) y la acción (`primary`, tamaño `md` como la confirmación de 07): **«Guardar»** en capacidad, características y precio; **«Enviar a revisión»** en nombre, tipo, descripción y ubicación. La acción sigue desactivada hasta que hay un cambio (como hoy) y muestra «Guardando…»/`pending` mientras guarda; durante el guardado la ventana está `busy` (no se cierra).
- **Errores:**
  - Error de un campo (p. ej. «El nombre de la casa debe tener entre 5 y 32 caracteres.»): **debajo del campo**, con `role="alert"`, el campo en rojo y lo escrito intacto (regla de 07).
  - Error de guardado (p. ej. «Sin conexión. Revise su internet e intente de nuevo.»): `Notice tone="error"` **arriba del cuerpo**, bajo el nombre de la casa; el cuerpo vuelve arriba para que se vea. Lo escrito se conserva y la acción del pie sirve para reintentar.
  - El aviso de revisión («Este cambio lo revisamos…») sigue al final del cuerpo, encima del pie.
- **Al guardar:** se cierra la ventana, sale el aviso de siempre (`toast`: «Guardado. Ya se ve en su ficha.» o «Enviado a revisión…») y la fila muestra el valor nuevo o «En revisión», como hoy.
- **Detrás:** el detalle de la casa se queda como está, con su barra de navegación (hoy el editor en línea la esconde), atenuado con `--scrim` y **sin desplazarse** (la pila de 07 bloquea el scroll). La fila no se expande.

## 4. El editor de fotos amplio

Ver `muestras/propuesta-{1280,1440,1920}-fotos.png`, `-fotos-horizontal.png`, `-fotos-recorte*.png`.

### Qué tamaño tiene la foto en la ficha (medido)

En `/casa/CT-####` la foto ocupa **797 × 480 px a 1280** y **832 × 480 px a 1440 y a 1920**, con `object-fit: cover` (`antes/ficha-*.png`). O sea: en la ficha **toda foto se ve recortada a una franja de 1,73:1**; una vertical 2:3 solo enseña su tercio central. Hoy el editor recorta todavía más (celdas de 298 × 108 y portada de 604 × 224, 2,7:1: `antes/1280-3-fotos.png`).

### Composición

- Ventana casi a pantalla completa: **24 px de margen**, ancho máximo 1760, alto fijo (el visor no salta al cambiar de foto):

  | Pantalla | Ventana | Visor (caja) | Horizontal 16:9 | Horizontal 3:2 | Vertical 2:3 | Columna | Miniatura |
  |---|---|---|---|---|---|---|---|
  | 1280 × 800 | 1232 × 752 | 822 × 533 | 822 × 463 | 800 × 533 | 355 × 533 | 336 | 105 × 105 |
  | 1440 × 900 | 1392 × 852 | 958 × 633 | 958 × 539 | 950 × 633 | 422 × 633 | 360 | 113 × 113 |
  | 1920 × 1080 | 1760 × 1032 | 1246 × 813 | 1246 × 701 | 1220 × 813 | 542 × 813 | 440 | 139 × 139 |

  Las horizontales se ven **al menos tan anchas como en la ficha** (797–832) y las verticales **completas y más altas** que la franja de la ficha (480).
- **Visor** a la izquierda: la foto elegida entera (`object-fit: contain`), con su proporción, sobre `--surface-2`. Debajo, su barra: «Foto 2 de 6», «← Mover antes», «Mover después →», «Hacer portada» (no en la portada) y, a la derecha, «Quitar foto» en terracota (`TextButton tone="danger"`).
- **Columna** a la derecha: la ayuda «Arrastre una foto para cambiar el orden. La primera es la portada.» (hoy dice «Mantenga pulsada…», que es del teléfono) y la rejilla de miniaturas **cuadradas con la foto entera dentro** (sin recorte, con bandas), «Portada» en la primera, «En revisión»/«Cambios pedidos» en las nuevas, al final «Añadir». La elegida lleva el contorno verde. Se desplaza sola si hay muchas (15 fotos = 6 filas).
- **Reordenar:** arrastrando miniaturas (el mismo `usePhotoDrag`, con ratón) o con los botones del visor, que son los «Mover foto n antes/después» que hoy solo ve el lector de pantalla, ahora visibles. El foco sigue a la foto movida (como hoy). Las nuevas en revisión no se mueven (como hoy) y en su visor solo sale «Quitar foto».
- **Quitar:** solo desde el visor, no con una ✕ en cada miniatura: así nadie quita una foto aprobada sin haberla visto en grande. Ver pregunta 3 (confirmación).
- **Variantes:** miniaturas **480**; visor **1600** (una sola foto a la vez, la siguiente se precarga). A 1280 en pantalla 1× la caja mide 822 px y la de 800 se quedaría corta; en pantallas 2× hace falta 1600 en todos los tamaños. Una foto pequeña no se inventa: las variantes nunca agrandan, y el visor la escala como la escala la ficha, que es justo lo que el anfitrión tiene que juzgar.
- **Que se guarda al momento:** en el pie, a la izquierda: «El orden y las fotos que quite se guardan al momento y ya se ven en su ficha. Las fotos nuevas las revisamos antes de publicarlas, normalmente en menos de 24 horas.»; junto a «Listo», un estado (`role="status"`): «Guardando…» y luego «✓ Orden guardado» / «✓ Foto quitada». **No hay «Cancelar»**: no hay nada que deshacer y no se promete revertir nada. El único botón es «Listo».

## 5. Cierre y URL

| Cómo | Apartado (ventana normal) | Ubicación (ancha) | Fotos (amplia) |
|---|---|---|---|
| ✕ y Escape | cierra; con cambios pregunta «¿Descartar los cambios?» | igual | cierra siempre (no hay nada sin guardar) |
| Tocar el fondo | sin cambios cierra; con cambios pregunta | no cierra | no cierra |
| «Cancelar» del pie | cierra sin preguntar (regla de 07) | igual | — (no hay) |
| «Guardar» / «Enviar a revisión» / «Listo» | guarda y cierra; si falla, se queda abierta con el error | igual | cierra |
| Mientras guarda | no se cierra (`busy`) | igual | no se cierra mientras se quita o reordena (es un instante); una subida en curso sigue en su cola al cerrar, como hoy |
| Atrás del navegador | ver pregunta 1 | | |

- La pregunta es la de 07 (`DiscardConfirm`): «¿Descartar los cambios?» / «Los cambios que hizo no se guardarán.» / «Seguir editando» · «Descartar» (`muestras/propuesta-1280-descartar.png`). El «Descartar cambios» del editor en línea de hoy cierra sin preguntar.
- **Foco:** entra en la ventana al abrir, queda dentro (Tab), y al cerrar vuelve al «Editar» de esa fila (o al botón «n fotos» de la portada), sin mover la página.
- **URL (recomendado): se mantiene `/propietario/casas/$id/editar/$campo`.** En escritorio esa ruta pinta el detalle completo y encima la ventana; «Editar» y «n fotos» pasan a ser enlaces a esa ruta (como en el teléfono) y desaparecen el editor en línea y el panel derecho. Así un enlace guardado o una recarga abren lo mismo, el admin y el teléfono no cambian, y cerrar vuelve atrás en el historial (o reemplaza por el detalle si se llegó de fuera: el `useBackToFicha` de hoy).

## 6. Preguntas para Ana

1. **Atrás del navegador con un apartado abierto.** La decisión D9 dice que Atrás no cierra ventanas de escritorio, pero aquí la ventana tiene su URL: Atrás ya vuelve al detalle. **Recomendación:** que Atrás la cierre (es deshacer la URL) y que, con cambios, pregunte «¿Descartar los cambios?» antes de salir. La otra opción es abrir la ventana sin cambiar la URL, y entonces Atrás sacaría de la casa entera.
2. **¿Marcar en el visor lo que se ve en la ficha?** La ficha recorta toda foto a 1,73:1 (`muestras/propuesta-1280-fotos-recorte.png`). **Recomendación:** sí, una franja discontinua con «Lo que se ve en la ficha», siempre visible y discreta. Es lo que de verdad permite «evaluar cómo se verá». La alternativa es la foto entera sin marca.
3. **¿Confirmar «Quitar foto»?** Hoy se quita al tocar la ✕, sin preguntar, y no se puede deshacer: para recuperarla hay que subirla otra vez y pasa de nuevo por revisión. **Recomendación:** confirmar solo las aprobadas, con una ventana `danger`: «¿Quitar esta foto?» / «Deja de verse en su ficha ahora. Si la vuelve a subir, la revisamos otra vez.». Las nuevas en revisión, sin confirmación, como hoy.
4. **Visor + columna o rejilla grande.** **Recomendación:** visor + columna (las muestras). La alternativa es una rejilla de filas a la altura de la ficha (~480 px, 2 fotos por fila, sin recorte): se ve todo a escala pero cabe una fila por pantalla y ordenar 15 fotos obliga a desplazarse mucho.
5. **Descripción: ¿ventana normal (520) o ancha?** **Recomendación:** normal, con un área de 280 px que crece con el texto: el ancho del teléfono ×1,25 y líneas cómodas para escribir.

## 7. Lo que se vio raro en el estado actual

- Dos mecanismos para lo mismo en escritorio (editor en línea sin URL y panel derecho con URL), con pies distintos: en línea, la acción es un texto verde en la fila y una ✕ «Descartar cambios»; en el panel, el botón grande de abajo.
- Al abrir un apartado en línea **se esconde la barra de navegación** de arriba (`.house-details-editing` pone `--desktop-nav-height: 0` y oculta `.desktop-nav`): la página salta (comparar `antes/1280-0-detalle.png` con cualquier `1280-1-inline-*.png`).
- El editor en línea de Descripción esconde el valor actual de la fila; el de Ubicación empuja Suscripción y Eliminar fuera de la pantalla (`antes/1280-1-inline-ubicacion-completa.png`).
- La ✕ «Descartar cambios» del editor en línea cierra sin preguntar aunque haya cambios (D10 no se aplica allí).
- En la ruta `/editar/fotos` de escritorio el aviso «El orden y las fotos que quite…» queda tapado por la barra de «Listo» (`antes/1280-3-fotos-ruta.png`).
- Editor de fotos: las verticales salen recortadas a una franja (celdas 2,7:1), la ✕ de quitar está en cada miniatura y quita al momento sin confirmación, y la ayuda dice «Mantenga pulsada» en escritorio.
- La ficha de escritorio recorta todas las fotos a 832 × 480 (cover), también las verticales; y por el código, `HeroGallery` pide `sizes="100vw"`, así que en escritorio el navegador baja la de 1600 para una caja de 832 (no medido con fotos reales: el arnés siembra rutas antiguas sin `srcset`).
- En las capturas, el panel derecho y la ventana se quedan con el botón de acción gris (desactivado) aunque se vea el formulario: es la regla «sin cambios no se guarda», pero en escritorio no se explica; con «Cancelar» al lado, ya no confunde.
