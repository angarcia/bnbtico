# Historia 07 · Inventario de campos y formularios (2026-11-19)

Fase de inventario, solo lectura del código. Fuentes: `docs/diseno-v1.md` (sobre todo «Formas», «Colores», «Tipografía», § 2 Filtros, § 11 Publicar, ajustes del 2026-11-05 y 2026-11-06), `design/tokens/tokens.json` 0.3.4 y CSS `apps/app/src/styles/01-base.css` … `13-escritorio.css`.

Convenciones: rutas relativas a `apps/app/src/`. CSS como `archivo:línea`. «No comprobado» = deducido del código, sin abrir la app ni medir en el navegador. Ningún alto se ha medido en pantalla: son los `min-height`/`height` declarados.

Reglas de referencia del diseño:

- «botones, campos, chips y selectores 8 px … inputs 16 px con borde `#E6DCC6`» (diseno-v1 l. 77). Es contradictorio: 8 px de radio y «inputs 16 px», que parece el tamaño de letra. El CSS usa `--r-input: 8px` y letra de 18 px. Hay que aclararlo con Ana.
- Etiquetas de 14 px, texto pequeño de 15 px, base de 17 px (l. 76).
- Controles −/+ de 44 × 44 px; X de 44 px; filas de lista de 52 px o más (ajustes del 2026-11-06).
- Desactivado real: fondo `#F2F1ED`, texto `#898D88`, sin opacidad (ajuste del 2026-11-05). Tokens: `component.button.disabled`.
- Tokens: `component.chip.height = 40` y `radius.input = radius.chip = 8`. **No hay token de campo** (alto, borde, letra ni foco).

---

## 1. Tabla de variantes

### 1.1 Campos de texto

| Variante | CSS | TSX (usos) | Aspecto | Estados | Accesibilidad |
|---|---|---|---|---|---|
| Campo base (`input`, `select`, `textarea` globales) | `01-base.css:171-173`; foco `:64` (contorno sol de 2 px) y `:66` (borde verde) | Publicar: `publish/fields.tsx:119` (select de parqueo), `:262` (nombre), `:291` (descripción). Editar: los mismos (vía `FieldInputs`, `screens/editar.tsx:327-346`). Cuenta: `screens/cuenta-profile.tsx:293,297,301`, `client/sign-in.tsx:172` (nombre), `screens/publicar-entrada.tsx:260` (correo), `screens/cuenta-ayuda.tsx:16` (desactivado). Filtros: `screens/filtros.tsx:232-256` (precio mínimo y máximo). Admin: `screens/admin-revision.tsx:177`. Calendario externo: `screens/airbnb.tsx:182` (URL), `screens/ical-export-card.tsx:132` (solo lectura) | 52 px de alto mínimo, relleno 0 16, borde de 1 px `--line`, radio `--r-input` (8), fondo `--surface`, letra de 18 px. El textarea tiene 96 px de mínimo y relleno 12 16. El select lleva un chevrón SVG con el trazo `#5C6B69` fijo | Foco: sí (contorno + borde). Error: borde `--bad` si `aria-invalid` (`10-ajustes.css:32`, solo en input y textarea; **no en select**). **Desactivado y solo lectura: sin estilo** (no hay reglas `:disabled` ni `[readonly]` para campos). Placeholder: sin estilo propio | Etiqueta con `htmlFor` en casi todos. Excepciones en 1.5 |
| Campo de la hoja (`.sheet input/textarea`) | `07-contacto.css:27-29` | `client/close-sheet.tsx:35` (fecha nativa). Puede afectar a `airbnb.tsx:182` si su ventana es una `.sheet` (no comprobado) | 48 px, relleno 0 12, 18 px. La etiqueta de la hoja es de 14 px y envuelve el campo en columna | Error: `07-contacto.css:55`, que duplica `10-ajustes.css:32` | `close-sheet`: etiqueta implícita, `aria-invalid` y `aria-describedby` al texto de ayuda |
| Precio con símbolo (`.input-money`) | `01-base.css:176-178`; repetido en `06-publicar.css:54` (parche de especificidad) | Publicar y editar: `publish/fields.tsx:196` (al mes) y `:231` (por noche) | 56 px, borde `--line`, radio 8, «₡» de 20 px en `--muted`, cifra de 24 px Figtree 500 | Foco con `:focus-within` (`01-base:66`). **Sin estado de error** (no hay `aria-invalid`) | Por noche: etiqueta sí, sin `aria-describedby` hacia la nota «En colones…». Al mes: `aria-describedby` hacia la ayuda, que cambia a ocre (`sun-ink strong`) con `aria-live` |
| Precio del calendario (`.cal-price`) | `09-calendario.css:139-142` | `screens/calendario.tsx:595-607` | 44 px, borde de 1,5 px transparente, fondo `--surface`, «₡» de 15 px, cifra de 18 px 600, placeholder de 16 px | Foco con borde verde (`01-base:66`). Error en el panel: `.field-error` (`calendario.tsx:637`), sin enlazar | Solo `aria-label` (la etiqueta envuelve el campo, pero su texto es «₡», con `aria-hidden`). `inputMode=numeric` y `enterKeyHint=done` |
| Teléfono con prefijo (`.input-prefix` + `.prefix-select`) | `01-base.css:174-175`, `10-ajustes.css:28-31` | `client/sign-in.tsx:194-229` (Ingresar, también al publicar y al contactar sin sesión) | Prefijo de 52 px, fondo `--surface-2`, borde de 1,5 px transparente (el campo tiene 1 px de `--line`). El select es invisible y cubre la caja | Foco del prefijo: contorno sol en `:focus-within` | Lo mejor resuelto: `aria-invalid` + `aria-describedby` (error y ayuda). `type=tel`, `inputMode=tel`, `autoComplete` según el país |
| Código de 6 casillas (`.code-boxes` + `.code-input`) | `01-base.css:193-196`, `05-cuenta-propietario.css:7-9,34` | `screens/cuenta-codigo.tsx:100-121`, `screens/admin-codigo.tsx:94-115` (**marcado copiado**) | 6 casillas de 60 px, radio 8, cifras de 26 px; la activa con 2 px verde y fondo `--state-soft`. El campo real es casi invisible encima | Activa y llena. Error: `.field-error` debajo, **sin `aria-invalid` ni `aria-describedby`** | `htmlFor` correcto, `inputMode=numeric`, `autoComplete=one-time-code`, `pattern` |
| Persona en la hoja de contacto (`input.people` dentro de `.people-stepper`) | `07-contacto.css:51`, `13-escritorio.css:721` | `shared/contact-sheet.tsx:312-333` | 48 px (regla de `.sheet`), 72 px de ancho, centrado | `aria-invalid` sí. Error en la nota general de la hoja (`:355`), **sin `aria-describedby`** | `type=number`, `inputMode=numeric`, etiqueta con `htmlFor` |

### 1.2 Buscadores y listas desplegables

| Variante | CSS | TSX | Aspecto | Estados | Accesibilidad |
|---|---|---|---|---|---|
| `.search-field` (admin) | `06-publicar.css:61-64` | `screens/admin-casas.tsx:46-58` | 48 px, fondo `--surface`, **borde transparente en reposo**, radio `8px` escrito a mano, lupa SVG en `--muted` | Foco: borde + sombra de 1 px verde; la regla global le quita el contorno sol (`outline:none`) | Solo `aria-label`; `type=search`, `enterKeyHint=search` |
| `.zone-input` + `.zone-list` (¿Dónde? de Explorar) | `04-explorar.css:90-100` | `screens/buscar.tsx:140-170` | 52 px, fondo `--bg` (crema), borde `--line`, lupa verde, opciones de 52 px o más; la elegida en `--sun-soft` con check (como pide diseno-v1 l. 25) | Foco: borde + sombra interior de 1 px. Opción activa con teclado en `--line-soft` | Combobox ARIA completo y `enterKeyHint=search` |
| `.place-search` + `.zone-pop/.zone-options` (mapa del paso 2 y «Otra…») | `10-ajustes.css:4-25`; sobre el mapa `:16-17` | `publish/place-search.tsx:123-160`, usado en `publish/location-step.tsx:93,107` (publicar y editar ubicación) | Campo base de 52 px con la **lupa como imagen de fondo de trazo `#6B7280`** (gris que no es de la paleta y no cambia en modo oscuro). Sobre el mapa, radio 12 y sombra flotante. Opciones con relleno 10 12, **sin alto mínimo**; la activa en `--surface-2` | Foco del campo base | Combobox ARIA completo; **sin `enterKeyHint`** (lo pone `step-form` según la posición, solo en el asistente) |
| `HousePicker` en modo zona (`.picker-pill` + hoja o `.desktop-dropdown`) | `09-calendario.css:66-78`, `13-escritorio.css:26-41` | `publish/zone-select.tsx:23-29` (Zona en publicar y editar); también Consultas y Calendario (fuera de esta familia) | 52 px, fondo `--bg`, borde `--line`, radio 8; elegida en `--sun-soft` con check | `aria-expanded` gira la flecha | La etiqueta visible «Zona» es un `span.label-plain` sin asociar; el nombre lo da `aria-label="Zona, …"` en el botón |
| `.search-fold` (secciones cerradas de la búsqueda) | `04-explorar.css:82-86` | `screens/buscar.tsx` (`Fold`) | 52 px, borde `--line`, fondo `--bg`, valor a la derecha | — | No revisado en detalle |

### 1.3 Elecciones: chips, tarjetas, segmentos y casillas

| Variante | CSS | TSX | Aspecto | Estados | Accesibilidad |
|---|---|---|---|---|---|
| `.chip` base | `01-base.css:146-152`; `04-explorar.css:129-130`; movimiento `08-movimiento.css:7-8` | Publicar y editar: baño `publish/fields.tsx:143`, «¿Acepta alquiler por meses?» `:175` (label + radio). Admin: filtros de navegación `admin-casas.tsx:61`, `admin-anuncios.tsx:79` (`chip-sm`, enlaces con `aria-current`) | 40 px (token), `chip-sm` 36 px, relleno 0 16, **radio `8px` a mano**, fondo `--beige-soft`, 16 px. Elegido: `--chosen` (verde al 26 %) con «✓ » delante | Pulsado y actual. Foco: **ninguno visible** cuando el control real es un `input.sr-input` dentro de un `label.chip` (fuera de `.feature-choices`) | `aria-pressed` **sobre un `<label>`** (no válido en ARIA; el lector ya anuncia el radio) |
| `.feature-choices .chip` (características, atajos de noches) | `01-base.css:198-208`; atajos `04-explorar.css:122`; escritorio `13-escritorio.css:508-529` | **Componente compartido** `shared/feature-choices.tsx` (`FeatureChoiceContent`): publicar y editar `publish/fields.tsx:107-113` (label + checkbox), Filtros `screens/filtros.tsx:212-226` (botón `aria-pressed`), Explorar en escritorio `screens/explorar.tsx:186-195`. Atajos: `shared/nights-picker.tsx:37-45` | 44 px, 2 columnas, icono de 16 px (el componente lo pide de 18 y el CSS lo baja a 16), check fijo a la derecha. En escritorio, 36 px y 14 px | Foco: contorno **verde** (`:203`) en vez del sol global | Botón con `aria-pressed` y `aria-label` del nombre largo (Filtros); checkbox con `aria-label` (publicar) |
| `.kind-filter .chip` (tipo de alojamiento) | `04-explorar.css:140-145` | `screens/filtros.tsx:167-187` (solo con la flag de habitaciones) | 72 px, 3 columnas, icono de 24 px encima, check arriba | Pulsado | Botón con `aria-pressed` |
| `.choice` (tarjetas de elección) | `01-base.css:181-185`, `06-publicar.css:5-6`; compacta en escritorio `13-escritorio.css:173-188` | `publish/wizard-parts.tsx:36-88` (`ChoiceCards`): paso 1 (`KindChoice`) y editar tipo (`screens/editar.tsx:313-324`) | 84 px, borde de 2 px transparente (sin elegir, 1 px `--line` en `.publish-kind`), radio `--r-tile` 12, título de 18 px | Pulsado con `--chosen`. **Sin foco visible** (el radio es `sr-input` con opacidad 0) | `aria-pressed` sobre `<label>`; radio nativo dentro |
| `.seg` (segmento) | `09-calendario.css:136-138` | `screens/calendario.tsx:620-627` (Disponible/Ocupado), `client/airbnb-calendar-row.tsx:42-45`, `shared/contact-sheet.tsx:254-261` (Fechas/Número de noches) | Pista `--beige-soft`, botones de **38 px**, 15 px, radios `8px`/`6px` a mano | Pulsado `--chosen` | `role=group` + `aria-label`, botones con `aria-pressed` |
| `.currency-switch` (segmento de moneda) | `04-explorar.css:132-134`; variantes `:12-14`, `03-casas.css:83`, `13-escritorio.css:690-692,826` | **Componente** `shared/currency-switch.tsx`: Explorar `explorar.tsx:221`, Favoritos `favoritos.tsx:71`, Calendario `calendario.tsx:271`, barras de escritorio `chrome.tsx:120`, `site-top-bar.tsx:51` | Botones de **36 px** (38 en Explorar, 44 en Favoritos), 18 px; mismo patrón que `.seg` con otras medidas | Pulsado `--chosen` (en Explorar, verde al 18 %) | `role=group` + `aria-label`, `aria-pressed` |
| `.check` (casilla) | `01-base.css:179-180` | `screens/admin-review-details.tsx:77-85` (lista de comprobación del admin) | Casilla nativa de 20 px con `accent-color` verde; fila de **28 px** | Nativos | Etiqueta implícita |

### 1.4 Contadores −/+ y fechas

| Variante | CSS | TSX | Aspecto | Estados | Accesibilidad |
|---|---|---|---|---|---|
| `CounterRow` (`.counter`) | Base `01-base.css:186-192` (botones de 40 px con fondos); publicar y filtros `06-publicar.css:20-27` (44 px); signo sin fondo `10-ajustes.css:99-101` (radio 999 al tocar); escritorio `13-escritorio.css:193-223` | **Componente** `shared/counter-row.tsx`. Publicar y editar: `publish/fields.tsx:83-99` (`Counter` con campo oculto). Filtros: `screens/filtros.tsx:153-159,191-202` | Fila de 56 px (78 px en publicar), signos «−»/«+» como texto de 26 px | Desactivado: `--muted` al 35 % (`10-ajustes:101`) | `aria-label` «Menos/Más {etiqueta}», valor con `aria-live` |
| `.people-stepper` | **Tres bloques**: `04-explorar.css:118-124`, `10-ajustes.css:34-39`, `10-ajustes.css:99-101`; escritorio `13-escritorio.css:574-576` | `screens/buscar.tsx:296-306` (iconos SVG), `shared/nights-picker.tsx:22-34` (SVG del «−» copiado en línea), `shared/contact-sheet.tsx:312-333` (texto «−»/«+» y campo editable en medio), `screens/explorar.tsx:139-146` (escritorio, texto) | 44 × 44 px, separación de 14 u 8 px según el bloque que gane | Desactivado: `#A3ADA6` (`04:120`) o `--muted` al 35 % (`10:101`) | `aria-label` «Una persona menos/más»: **otra fórmula que `CounterRow`** |
| `RangeCalendar` (`.range-*`) | `04-explorar.css:101-117`, `07-contacto.css:36-39,47` | **Componente** `shared/range-calendar.tsx`: `buscar.tsx:263`, `explorar.tsx:125`, `contact-sheet.tsx:277`, `client/mark-sheet.tsx:69` | Días de 44 px, círculo de 42, banda `--when-band` | Desactivado al 45 % de opacidad | Botón por día con `aria-label` de fecha larga y `aria-pressed` en los extremos |
| `DateBox` (`.date-box`) | `07-contacto.css:31-35` | `shared/contact-sheet.tsx:387-394` | 56 px, borde `--line`, etiqueta de 14 px y valor de 17 px | Abierta (borde verde) y error (`aria-invalid` en un botón) | `aria-expanded`; `aria-invalid` en `button` (no admitido en ARIA 1.2) |
| Fecha nativa | `07-contacto.css:28` | `client/close-sheet.tsx:35-47` (Pausar la casa) | `input type=date` de 48 px | `aria-invalid` | Etiqueta implícita + `aria-describedby` |
| `MonthGrid` | `09-calendario.css:1-60` | `shared/month-grid.tsx`, `calendario.tsx:303`, `shared/listing-calendar.tsx:104` | Casillas de 92 px | — | Fuera de esta familia (es un calendario de consulta y selección múltiple); no revisado a fondo |

### 1.5 Etiquetas, ayudas, errores y barras de pie

| Variante | CSS | Usos | Nota |
|---|---|---|---|
| `label` global | `01-base.css:169` | Todos los `.field` | **15 px**, `--muted`, 500. El diseño pide etiquetas de 14 px |
| `.label-plain` | `06-publicar.css:4` | `fields.tsx:135,163`, `zone-select.tsx:25`, `admin-revision.tsx:175` | 14 px. Cumple la función de etiqueta de grupo o de rótulo secundario |
| `.sheet label`, `.sheet .field-label`, `.date-box-label` | `07-contacto.css:27,32,41` | Hojas | 14 px, cada una definida aparte |
| `.field-title` | `05-cuenta-propietario.css:135` | Ficha editable | 15 px |
| `.review-label` | `10-ajustes.css:55` | Paso 9 | 14 px |
| `.eyebrow` | `01-base.css:76` | Secciones de Filtros (`filtros.tsx:134,163,207,228`) | 13 px en mayúsculas, como etiqueta de grupo |
| Ayuda | `.xs.muted` (14 px), `.small.muted` (15 px), `.hint` (14 px, **solo definida dentro de `.sheet` y `.cal-airbnb`**: `07-contacto.css:52`, `09-calendario.css:114`) | `fields.tsx:115,200,237`; `sign-in.tsx:233`; `filtros.tsx:258`; `publicar-entrada.tsx:268` (`.small`); `airbnb.tsx:183`; `ical-export-card.tsx:136,139` | Tres tamaños y tres clases para lo mismo. Si `airbnb.tsx` e `ical-export-card.tsx` no están dentro de una `.sheet`, su `.hint` no tiene estilo (no comprobado) |
| Error de campo `.field-error` | `01-base.css:81` | Enlazado con `id`, `aria-invalid` y `aria-describedby`: `sign-in.tsx:184,230`, `airbnb.tsx:184`, `ical-export-card.tsx:135`. **Sin enlazar**: `filtros.tsx:261`, `cuenta-codigo.tsx:122`, `admin-codigo.tsx:117`, `admin-revision.tsx:188`, `admin-edicion.tsx:239`, `calendario.tsx:495,637`, `publish/fields.tsx:59`, `photo-grid.tsx:220` | 15 px en `--bad` |
| Error del formulario `.note[role=alert]` | `01-base.css:102` | `publish/step-form.tsx:323` (todos los pasos), `editar.tsx:216`, `cuenta-profile.tsx:305`, `contact-sheet.tsx:286,355`, `publicar-entrada.tsx:273` (este sí con `id` en `aria-describedby`), calendario y admin | Caja `--bad-soft` arriba o debajo del formulario; el campo culpable no se marca |
| Avisos en ocre | `.sun-ink` (`05-cuenta-propietario.css:114`), `.description-short` (`10-ajustes.css:68`), `.place-off` (`02-app.css:57`), `.review-row.is-warn` (`10-ajustes.css:123-124`) | Precio al mes, descripción corta, punto fuera de Costa Rica y resumen del paso 9 | Coherente con la regla del 2026-10-30 (ocre = aviso que no bloquea) |
| Contador de caracteres | `.counter-out` (`01-base.css:82`) | `fields.tsx:243-251` (nombre y descripción) | Rojo fuera del rango; la descripción usa ocre por debajo del mínimo |
| `.sticky-actions` | `02-app.css:33-36`; espaciadores `.sticky-spacer` (76 px), `.review-spacer` (124 px), `.publish-form::after` | Publicar `step-form.tsx:295`, Editar `editar.tsx:226,289`, Filtros `filtros.tsx:267`, Buscar `buscar.tsx:311`, Admin revisar `admin-revision.tsx:157` | Botones de 48 px y 18 px Figtree. «Atrás» como cuadrado de 56 px (`10-ajustes.css:119`). En admin revisar, columna con `btn-ghost` a 44 px y 16 px (`06-publicar.css:74-75`) |
| `.cal-panel` | `09-calendario.css:121-127` | `calendario.tsx:609-645` | Barra propia: «Guardar cambios» de 44 px y 16 px; desactivado con `color-mix(--fg 8 %, --surface)` (`:126`), no con el token `#F2F1ED` |

### 1.6 Teclado del móvil

| Pantalla | `inputMode` | `enterKeyHint` | Subida del campo sobre el teclado |
|---|---|---|---|
| Publicar (asistente) | `numeric` en precios | Automático, «Siguiente» o «Listo» según la posición (`step-form.tsx:178-193`, `enter-next.ts`) | `useFormKeyboard` (`form-keyboard.ts`) + `--kb` |
| Editar un dato | `numeric` (los mismos campos) | **Ninguno**: `editar.tsx` usa `useFormKeyboard`, pero no `useEnterKeyHints`, que es privado de `step-form.tsx` | Sí, salvo en el editor en línea de escritorio |
| Filtros | `decimal` (admite dólares con decimales) | Ninguno | No |
| Contacto | `numeric` (personas) | Ninguno | `.sheet.kb` |
| Calendario | `numeric` | `done` | `.cal-panel.kb` |
| Ingresar y códigos | `tel` y `numeric` + `one-time-code` | Ninguno (un solo campo) | — |
| Correo | `email` en `publicar-entrada.tsx:264`; solo `type=email` en `cuenta-profile.tsx:301` | Ninguno | — |
| Buscadores | — | `search` en `buscar.tsx:152` y `admin-casas.tsx:54`; ninguno en `place-search` | — |

---

## 2. Divergencias

### 2.1 A CORREGIR

1. **Dos contadores −/+ distintos.** `CounterRow` (`shared/counter-row.tsx`) frente a `.people-stepper`, escrito a mano en cuatro sitios (`buscar.tsx:296`, `nights-picker.tsx:22`, `contact-sheet.tsx:312`, `explorar.tsx:139`). Cambian el signo (texto o SVG), la separación (14 u 8 px), el gris desactivado (`#A3ADA6` en `04-explorar.css:120` o `--muted` al 35 % en `10-ajustes.css:101`) y el nombre accesible («Menos personas» o «Una persona menos»). El CSS de `.people-stepper` está en tres bloques que se pisan (`04-explorar.css:118-124`, `10-ajustes.css:35-39`, `10-ajustes.css:99-101`): los fondos de `04:119` y `10:37-38` ya no se ven. También están muertos los fondos de `.counter .ctl .minus/.plus` (`01-base.css:190-191`), que tapa `10-ajustes:99`, y el `border-color` de `04:120`, en un botón sin borde.
2. **Segmentos con medidas distintas y áreas de menos de 44 px.** `.seg` tiene botones de 38 px (`09-calendario.css:137`) y se usa en el calendario, en Airbnb y en la hoja de contacto. `.currency-switch` tiene botones de 36 px (`04-explorar.css:133`; 38 en `:13`, 44 solo en Favoritos `03-casas.css:83`). Es el mismo patrón con dos CSS.
3. **Elecciones binarias con tres patrones.** «Privado/Compartido» y «No/Sí» del precio mensual son chips con «✓ » delante, que desplaza el texto al elegir (`fields.tsx:143,175`). Las de Filtros y las de noches llevan el check en un hueco fijo (`.feature-check`). Calendario y contacto usan `.seg`. Hay que decidir con Ana cuál es el patrón de una elección única entre dos opciones.
4. **`aria-pressed` sobre `<label>`** en `ChoiceCards` (`wizard-parts.tsx:65`), características (`fields.tsx:109`), baño (`:143`) y precio mensual (`:175`). No es ARIA válido. El estado ya lo da el input nativo; el estilo puede usar `:has(input:checked)`.
5. **Foco invisible con el teclado** en las tarjetas `.choice` y en los `label.chip` fuera de `.feature-choices`: el input es `.sr-input` con opacidad 0 (`01-base.css:197`) y solo `.feature-choices` tiene la regla `:has(input:focus-visible)` (`:203`). Pasa lo mismo con «Añadir fotos» (`.photos-grid .add`, `photo-grid.tsx:211`). Y donde sí hay foco, es verde (`:203`) en vez del contorno sol global (`:64`).
6. **Errores mostrados de tres maneras.** (a) `.field-error` enlazado con `aria-invalid` y `aria-describedby` (solo en Ingresar y Airbnb). (b) `.field-error` suelto: Filtros, códigos, admin y calendario. (c) La nota general `.note[role=alert]`, que no marca el campo: todo el asistente, editar, perfil y contacto. En publicar y editar ningún campo recibe `aria-invalid` (por ejemplo, el precio por noche que falta). Los errores de Filtros (`filtros.tsx:239,252,261`) marcan `aria-invalid`, pero no enlazan el mensaje. El correo sale como `.note` en `publicar-entrada.tsx:273` y como `.field-error` en Ingresar.
7. **Campos sin estilo desactivado ni de solo lectura**: no hay ninguna regla `:disabled` ni `[readonly]` para `input`, `select` ni `textarea`. Se ven en `cuenta-ayuda.tsx:16`, en `airbnb.tsx:182` mientras guarda y en `ical-export-card.tsx:132`. El token de desactivado (`#F2F1ED`/`#898D88`) solo se aplica a `.btn` (`01-base.css:140`, con los hex escritos a mano). `.cal-action:disabled` y `.cal-airbnb-update:disabled` usan `var(--disabled-bg,#F2F1ED)` y esa variable no está definida (`09-calendario.css:107,112`). `.cal-save:disabled` usa otro gris (`:126`).
8. **Letra de menos de 16 px en un campo** (el iPhone amplía la página al enfocarlo): `.decide textarea{font-size:15px}` (`05-cuenta-propietario.css:134`), en la revisión de ediciones del admin (`admin-edicion.tsx:229`).
9. **Áreas táctiles de menos de 44 px** en el teléfono: `.check` de 28 px (`01-base.css:179`, lista del admin), `.chip-sm` de 36 px (chips de navegación del admin), `.seg` de 38, `.currency-switch` de 36, y `.cal-cancel` y `.cal-base` de 32 (`09-calendario.css:135,143`). `.chip` de 40 px sigue el token `component.chip.height = 40`, pero no la regla de 44 px: hay que decidir con Ana si sube.
10. **Tres listas de sugerencias.** `.zone-pop/.zone-options` (`10-ajustes.css:20-25`: opciones sin alto mínimo, activa en `--surface-2`), `.zone-list/.zone-option` (`04-explorar.css:94-100`: 52 px, activa en `--line-soft`, elegida en `--sun-soft` con check) y la lista de `HousePicker` (`09-calendario.css:76`). El combobox ARIA está escrito dos veces (`place-search.tsx` y `buscar.tsx`).
11. **Tres buscadores con aspecto distinto**: `.search-field` (48 px, borde transparente, fondo blanco y foco con sombra exterior), `.zone-input` (52 px, borde `--line`, fondo crema y sombra interior) y `.place-search` (52 px, lupa como imagen de fondo en `#6B7280`, `10-ajustes.css:7`).
12. **Regla de error duplicada**: `10-ajustes.css:32` y `07-contacto.css:55`. Además, `select[aria-invalid]` no está cubierto.
13. **Etiquetas de 15 px frente a 14 px**: el `label` global mide 15 (`01-base.css:169`) y el resto de etiquetas 14 (`.label-plain`, `.sheet label`, `.review-label`, `.date-box-label`). El diseño dice 14. En el paso 2, «Zona» va a 14 y los demás campos a 15.
14. **Ayudas en tres tamaños** (`.xs` de 14, `.small` de 15 y `.hint` de 14, esta última solo dentro de `.sheet`). En el mismo campo de correo, la ayuda va en `.small` en `publicar-entrada.tsx:268` y en `.xs` en `cuenta-profile.tsx:302`.
15. **Valores sueltos en vez de tokens**: radio `8px` escrito a mano en `.chip`, `.btn-sm`, `.icon-btn`, `.search-field`, `.seg`, `.currency-switch`, `.cal-price`, `.counter .ctl button` y `.zone-option` (sería `--r-input`); `6px` en `.seg button` y `.currency-switch button`; `#A3ADA6` en `04-explorar.css:120` y en `01-base.css:116`; los trazos de los SVG `#5C6B69` y `#6B7280` en `data:` (`01-base.css:173`, `10-ajustes.css:7`), que no cambian en modo oscuro (no comprobado en pantalla); y bordes de 1,5 px transparentes (`.prefix`, `.cal-price`, `.code-boxes`) frente al 1 px de `--line` del campo.
16. **Reinicio del campo interior copiado**: el selector largo `input:not([type=checkbox]):not([type=file]):not([type=radio]){border:0;background:transparent;min-height:0;padding:0}` se repite en `.input-money` (`06-publicar.css:54`), `.search-field` (`:62`), `.zone-input` (`04-explorar.css:93`), `.cal-price` (`09-calendario.css:141`), `.code-input` (`05-cuenta-propietario.css:9`) y `.sheet .people-stepper input.people` (`07-contacto.css:51`).
17. **El código de 6 casillas está copiado** en `cuenta-codigo.tsx:100-121` y `admin-codigo.tsx:94-115`. En los dos falta enlazar el error.
18. **Editar no da «Siguiente» ni «Listo» al teclado** (sección 1.6): el precio por noche y el precio al mes, en el mismo formulario, no se encadenan con Enter como en el asistente (no comprobado en el dispositivo).
19. **«Mensaje para el anfitrión» escrito dos veces**: `admin-revision.tsx:170-193` (con etiqueta visible y ayuda) y `admin-edicion.tsx:228-241` (solo `aria-label` y el placeholder como etiqueta, 2 filas y 15 px).
20. **El precio cambia de aspecto entre publicar, filtros y calendario**: en publicar, `.input-money` de 56 px con la cifra a 24 px; en Filtros, el campo base de 52 px con «₡» dentro del placeholder; en el calendario, `.cal-price` de 44 px. El calendario puede estar justificado (panel compacto); Filtros no tiene motivo escrito.

### 2.2 JUSTIFICADAS

- **El tipo cambia entre publicar y filtros.** Publicar usa tarjetas `.choice` con explicación y Filtros, chips con icono y check: el diseño las pide así (diseno-v1 § 2 y § 11).
- **Características con distinto control y mismo aspecto.** En publicar son checkbox dentro de un label (formulario sin controlar, `FormData`); en Filtros y Explorar, botones con `aria-pressed` (estado en la URL). Comparten `FeatureChoiceContent`.
- **La capacidad sin iconos al editar** (`editar.tsx:340`, `CapacityCounters` sin `icons`): el diseño pide «la edición de casas publicadas mantiene su presentación anterior» (2026-11-06).
- **Filtros con `inputMode=decimal`**: se escribe en dólares cuando la moneda es USD.
- **`.cal-price` compacto, de 44 px**: es un panel fijo con el teclado abierto; el comentario de `09-calendario.css:140` explica la letra de 16 px o más.
- **Chips de Explorar en escritorio de 36 px y 14 px** (`13-escritorio.css:521-527`): solo se usan con puntero.
- **`.sheet input` de 48 px**: la hoja ahorra alto (`.sheet.kb`). Es aceptable, pero conviene escribirlo como variante «compacta» y no como sobrescritura de contexto.
- **Fecha nativa en «Pausar la casa»**: es una sola fecha opcional; el calendario de rango sobra. Se puede revisar con Ana por coherencia con `DateBox`.
- **La zona del paso 2 con `HousePicker`**: reutiliza el selector aprobado de Consultas y Calendario.

---

## 3. Componentes que ya existen y lo que los esquiva

| Componente | Reutilizado en | Lo esquivan |
|---|---|---|
| `CounterRow` (`shared/counter-row.tsx`) | Publicar, editar y Filtros | `buscar.tsx:296`, `nights-picker.tsx:22`, `contact-sheet.tsx:312` y `explorar.tsx:139` escriben su propio `.people-stepper` |
| `FeatureChoiceContent` (`shared/feature-choices.tsx`) | Publicar, editar, Filtros y Explorar en escritorio | Los atajos de noches (`nights-picker.tsx:39-43`) y el tipo de Filtros (`filtros.tsx:182-184`) copian a mano el `span.feature-check` |
| `CurrencySwitch` (`shared/currency-switch.tsx`) | 5 pantallas | `.seg` es el mismo patrón sin componente (3 usos) |
| `ChoiceCards` / `KindChoice` (`publish/wizard-parts.tsx`) | Paso 1, editar tipo, `/publicar` | El baño y el precio mensual (`fields.tsx:131-207`) son elecciones únicas con otro marcado (`label.chip` + radio) |
| `TitleField`, `DescriptionField`, `PriceFields`, `FeatureChips`, `CapacityCounters`, `BathroomChoice` (`publish/fields.tsx`) | Asistente y editar (`editar.tsx:327-346`): reutilización correcta | El perfil (`cuenta-profile.tsx:290-316`) repite nombre y descripción sin contador ni ayuda (`maxLength` 1000 sin avisar) |
| `PlaceSearch` (`publish/place-search.tsx`) | Mapa del paso 2 y «Otra…» | `buscar.tsx:140-170` repite el combobox con otro CSS |
| `HousePicker` (`client/house-picker.tsx`) | Consultas, Calendario y Zona | — |
| `RangeCalendar` | Buscar, Explorar en escritorio, contacto y marcar reserva | `close-sheet.tsx` usa la fecha nativa (justificado) |
| `.field` + `label` + `.field-error` (solo CSS) | La mayoría de campos | Sin componente: cada pantalla decide si enlaza `id`, `aria-invalid` y `aria-describedby`; solo `sign-in.tsx` y `airbnb.tsx` lo hacen completo |
| Barra de pie `.sticky-actions` (solo CSS) | 6 pantallas | `.cal-panel` tiene la suya; los espaciadores van a mano (`.sticky-spacer`, `.review-spacer`, `::after`) |

---

## 4. Propuesta de destino

Variantes tipadas pequeñas, sin una abstracción universal de formulario. Se mantienen los formularios sin controlar (`FormData`) de publicar y editar.

1. **`<Field id label hint? error? count? labelHidden?>`** (envoltorio): pinta `label htmlFor`, la ayuda con `id`, el error `.field-error` con `role=alert` e `id`, y pasa al hijo `aria-describedby` (ayuda + error + contador) y `aria-invalid`. Cubre los 4 casos «sin enlazar» y corrige los puntos 6 y 13 (etiqueta de 14 px, un solo tamaño de ayuda). El contador `CharCount` se convierte en la opción `count`.
2. **`<TextInput>` / `<TextArea>` / `<Select>`**: los campos base, con estados desactivado y solo lectura según el token, y un `size="compact"` para la hoja (48 px), en lugar de `.sheet input`.
3. **`<AffixInput prefix="₡" size="lg|md|sm">`**: une `.input-money` (lg), el precio de Filtros (md) y `.cal-price` (sm) con un solo reinicio del campo interior (punto 16). El prefijo de país (`.input-prefix`) sigue aparte: es un select, no un texto.
4. **`<SearchInput variant="field|combobox">` + `useCombobox`**: un buscador con la lupa como componente de icono (no como imagen de fondo) y una lista de sugerencias (`.suggestion-list`) de 52 px, activa en `--line-soft` y elegida en `--sun-soft` con check. La usan `buscar.tsx` y `place-search.tsx` (puntos 10 y 11).
5. **`<ChoiceChips type="checkbox|radio" name options layout="grid-2|row|grid-3-icon">`**: label + input nativo, estilo con `:has(input:checked)` y `:has(input:focus-visible)` (puntos 4 y 5) y check en el hueco fijo `.feature-check`. Absorbe características, baño, precio mensual, atajos de noches y tipo de Filtros. Para los botones con estado en la URL (Filtros y Explorar), la misma pieza visual con `as="button"` y `aria-pressed`.
6. **`<ChoiceCards>`**: se conserva; solo se le quita `aria-pressed` del label y se le añade el foco visible.
7. **`<Segmented label options value onChange>`**: une `.seg` y `.currency-switch` (con `CurrencySwitch` encima) con botones de 44 px (punto 2). Ana decide si «No/Sí» y «Privado/Compartido» pasan a `Segmented` o a `ChoiceChips type="radio"` (punto 3).
8. **`<Stepper value min max onChange label unit editable?>`**: un solo −/+ de 44 px, con un nombre accesible único («Una persona menos») y la opción de campo editable (contacto). `CounterRow` pasa a ser su fila (etiqueta + icono + `Stepper`) y deja de existir `.people-stepper` (punto 1).
9. **`<CodeInput length=6>`**: une `cuenta-codigo` y `admin-codigo`, con el error enlazado (punto 17).
10. **`<Checkbox>`**: `.check` con una fila de 44 px (punto 9).
11. **Barra de pie**: un `<StickyActions>` que también pone el espaciador. `.cal-panel` puede seguir aparte (es un panel, no una barra), pero con el desactivado del token.
12. **Teclado**: sacar `useEnterKeyHints` de `step-form.tsx` a `form-keyboard.ts` y aplicarlo también en editar (punto 18).
13. **Tokens**: añadir al JSON `component.input` (alto 52 y compacto 48, borde `--line` de 1 px, radio 8, letra de 18 px y mínimo de 16 en el iPhone, foco y error) y `component.control.minTarget = 44`, y aclarar la línea 77 de diseno-v1.

Excepciones que se conservan: `.cal-price` en el panel del calendario (variante sm), los chips de escritorio de 36 px solo con puntero, la fecha nativa de Pausar, el buscador flotante sobre el mapa (radio 12 y sombra) como variante de `SearchInput`, el paso 1 con tarjetas y el editar capacidad sin iconos.

Desfase de documentación (no es de código): `tokens.json` dice que el chip elegido es salvia (`#7FA98A`) y diseno-v1 l. 75 lo repite, pero el CSS usa `--chosen` (verde al 26 %), de la decisión del 2026-10-29 «sin salvia». Hay que aclararlo antes de fijar los tokens de `ChoiceChips`.

---

## 5. Cobertura

Revisado leyendo el código:

- **Publicar**: `step-form.tsx`, `fields.tsx` (pasos 1–9), `wizard-parts.tsx`, `zone-select.tsx`, `place-search.tsx`, `location-step.tsx`, `location-picker.tsx`, `photo-grid.tsx` (solo los controles), `form-keyboard.ts`, `enter-next.ts` y `publicar-entrada.tsx` (correo).
- **Editar un dato**: `editar.tsx`. La ficha editable `casa-editable.tsx` solo se ha mirado por encima.
- **Explorar**: `filtros.tsx`, `buscar.tsx` y `explorar.tsx` (búsqueda de escritorio); `nights-picker.tsx`, `range-calendar.tsx` y `currency-switch.tsx`.
- **Contacto**: `contact-sheet.tsx`.
- **Cuenta**: `sign-in.tsx`, `cuenta-codigo.tsx`, `cuenta-profile.tsx` y `cuenta-ayuda.tsx`.
- **Admin**: `admin-casas.tsx`, `admin-anuncios.tsx`, `admin-revision.tsx`, `admin-review-details.tsx`, `admin-edicion.tsx` y `admin-codigo.tsx`.
- **Calendario**: `calendario.tsx` (panel de días), `airbnb-calendar-row.tsx`, `airbnb.tsx` (formulario de enlace), `ical-export-card.tsx`, `close-sheet.tsx`, `mark-sheet.tsx` y `house-picker.tsx`.
- **CSS**: los 13 archivos; en `13-escritorio.css`, solo las reglas de controles.

No comprobado o fuera del alcance:

- No se ha abierto la app: ningún alto, contraste, modo oscuro ni foco está medido en pantalla.
- No se han comprobado en el dispositivo el comportamiento del teclado en editar, el `.hint` de Airbnb fuera de una `.sheet` ni el alto real de `.zone-options li`.
- No revisados: `suscripcion.tsx` (sin campos de texto según la búsqueda), `actividad.tsx`, `propietario.tsx`, `asistir.tsx` (reutiliza el asistente, no abierto), `month-grid.tsx` a fondo, `que-es-3bstays.css` y la portada.
- `.edit-fieldset` (`02-app.css:47`) no aparece en ningún TSX: puede ser CSS muerto (no se ha buscado en los `.ts`).
