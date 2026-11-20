# Historia 07 · Inventario de botones, enlaces de acción y controles de acción

Fecha: 2026-11-19. Solo lectura del código (sin builds, pruebas ni navegador). Referencias: `docs/diseno-v1.md` (§ «Ajuste compartido de botones y notas», 2026-11-05) y `design/tokens/tokens.json` 0.3.4 (`components.button.*`, `radius.*`, `color.overlayButton`, `color.whatsapp`).

Abreviaturas de rutas (todas bajo `apps/app/src/`):
`st/` = `styles/` · `sc/` = `client/screens/` · `pu/` = `client/publish/` · `cl/` = `client/` · `sh/` = `shared/`.
Los números de línea de CSS son los de la regla; los de TSX, los de la etiqueta o del `className`.

Lo que dicen las normas vigentes:
- Principal y secundario: fondo `--state-soft`, texto `--primary`, sombra `0 2px 5px` verde al 14 %, sin borde, 44 px, radio 8.
- WhatsApp: `--wa` con texto `--wa-ink`, 56 px, ancho completo. El token dice «Solo botón Contactar por WhatsApp».
- Desactivado: `#F2F1ED` / `#898D88`, sin sombra ni borde y **sin bajar la opacidad**.
- Radios 8 en botones; todo cuadrado salvo avatares y puntos de estado (comentario de `st/01-base.css:24`).

---

## 1. Variantes encontradas

### 1.1 Botón de texto `.btn` y sus modificadores

Base `.btn` (`st/01-base.css:126`): inline-flex, `min-height:44px`, `padding:0 18px`, `--r-input` (8), 17 px, 500. Pulsado: `scale(.97)` (`st/08-movimiento.css:8`); sin transform con movimiento reducido (`st/09-calendario.css:147-148`). Foco: el global de `st/01-base.css:73` (contorno `--sun` de 2 px). **Ninguna variante tiene :hover.** Desactivado común: `st/01-base.css:138`, ver 2.4.

| Variante | Definición CSS | Aspecto | Usos (TSX) | Estados |
|---|---|---|---|---|
| `.btn-primary` | `st/01-base.css:128`; peso 600 en `st/10-ajustes.css:130` | `--state-soft`, `--primary`, sombra 14 %, sin borde | **45**: `sc/admin-casas:264,269,318` `admin-codigo:121` `admin-edicion:244` `admin-revision:158` `airbnb:128,130,185` `buscar:315` `calendario:137,141,641` `cuenta-ayuda:18` `cuenta-codigo:123` `cuenta-lista:34` `cuenta-profile:314` `editar:227,290,291` `explorar:119,129` `filtros:269` `ical-export-card:127,134` `propietario:205,336,351,450` `publicar-entrada:79,176,190,212,278` `publicar:99,135` `suscripcion:221`; `cl/close-sheet:57` `mark-sheet:75` `owner-ui:127` `sign-in:246` `update-banner:16`; `pu/fields:402` `step-form:306`; `sh/status-pages:60` | active, disabled, foco global |
| `.btn-soft` | `st/01-base.css:128` (igual que primary) | idéntico a primary | **9**: `sc/admin-casas:274,279` `favoritos:80`; `cl/editor-status:17` `shell:77`; `sh/listing-description:38,42` `status-pages:36,46` | igual |
| `.btn-outline` | `st/01-base.css:128` (igual que primary, **sin contorno**) | idéntico a primary | **4**: `sc/buscar:276` `explorar:264,395`; `cl/search-help:18` | igual; `aria-busy` en `explorar:264` |
| `.btn-ghost` (móvil) | `st/01-base.css:129` | verde al 14 % **transparente**, `--primary-ink`, sin sombra, 500 | **38**: `sc/admin-casas:89,321` `admin-edicion:247` `admin-revision:162` `admin-shared:29` `airbnb:132,139,186` `calendario:435,500` `casa-editable:172` `cuenta-lista:39` `cuenta-profile:181` `ical-export-card:123,149,152` `propietario:50,211,267` `publicar-entrada:76,196,281` `publicar:99` `suscripcion:83,221`; `cl/chrome:122` `close-sheet:60` `delete-house:91` `mark-sheet:66,78` `owner-ui:91`; `pu/fields:64,368` `location-step:33` `step-form:298,302`; `sh/site-top-bar:53` `status-pages:61` | active, disabled |
| `.btn-ghost` (escritorio) | `st/13-escritorio.css:671-676` | transparente, borde de 1 px verde al 45 %, `--primary-ink` | los mismos, ≥1024 px | igual |
| `.btn-secondary` | **no existe en CSS** | queda como `.btn` desnudo: sin fondo, color heredado | 1: `cl/mark-sheet:65` («Continuar con el último calendario») | solo los de `.btn` |
| `.btn-sun` (pago) | `st/01-base.css:134`; peso 600 en `st/10-ajustes.css:130` | `--sun` al 70 %, texto `--fg`, sin sombra | **5**: `cl/owner-ui:43,52` (PayButton, ActivateButton) `publish-promo:19`; `sc/suscripcion:83,187` | active, disabled («Abriendo la página de pago…» en `suscripcion:83`) |
| `.btn-wa` | `st/01-base.css:135`; peso 600 en `st/10-ajustes.css:130` (pisa el 500 de la propia regla) | `--wa` / `--wa-ink`, 56 px, `--r-cta`, display 18, 100 % | **10**: `sh/listing-page:90,99,116,395` `contact-sheet:360`; `sc/cuenta-ayuda:26,48,55` `admin-shared:39`; `cl/owner-ui:91` | `.is-pending` opacidad .6 (`st/07-contacto.css:4`), `.is-sending` .8 + `cursor:progress` (`:6`), disabled gris |
| `.btn-danger` | `st/01-base.css:133` | `--bad` lleno, texto `--bg` | **4**: `sc/admin-casas:318` `airbnb:139` `ical-export-card:146,152` | active, disabled; texto «Revocando…» / «Desconectando…» |
| `.btn-danger-outline` | `st/01-base.css:132` | transparente, borde de 1,5 px `--bad` | 1: `sc/admin-casas:287` | active |
| `.btn-outline-bad` | `st/01-base.css:130` | **terracota** (`--brand` al 12 %, texto `--brand-ink`), no rojo | **5**: `sc/casa-editable:171` `propietario:49,366` `suscripcion:220`; `cl/delete-house:90` | active, disabled |
| `.btn-lg` | `st/01-base.css:136` | 52 px, 18, display | 38 usos (los confirmar y cancelar de las hojas y las acciones principales de las pantallas) | — |
| `.btn-xl` | `st/01-base.css:137` | 56 px, 18, display, `--r-cta` | 4: `cl/sign-in:246`; `sc/cuenta-codigo:123` `admin-codigo:121` `cuenta-lista:34` | — |
| `.btn-sm` | `st/01-base.css:138` | 44 × 44 como mínimo, `padding:0 14px`, 15, radio `8px` escrito a mano | 10: `sc/admin-edicion:244,247` `calendario:435,500` `filtros:116` `suscripcion:83`; `pu/fields:64,402` `location-step:33`; `cl/update-banner:16` | — |
| `.btn-block` | `st/01-base.css:139` | 100 % | 42 usos; corrección en tarjeta: `st/05-cuenta-propietario.css:95` | — |
| `.btn-back` | `st/10-ajustes.css:119` | cuadrado de 56, solo la flecha | 3: `pu/step-form:298,302`; `sc/publicar-entrada:76` | `.is-disabled` |
| `.btn-more` | `st/03-casas.css:153-154` | 100 %, 48 | 2: `sh/listing-description:38,42` | `.is-pending` sin eventos (antes de hidratar) |
| Ajustes por contexto | `.sticky-actions .btn` 48/18 (`st/02-app.css:34`); `.cal-panel .btn-lg` 48/17 (`st/09-calendario.css:144`); `.cal-save` 44/16 (`:125`); `.review-actions .btn-ghost` 44/16 (`st/06-publicar.css:75`); `.cal-action.is-paused .btn` (`st/09-calendario.css:117`); `.page-header-actions .btn` (`st/13-escritorio.css:667`); `.desktop-filters-actions .btn` (`:448`); `.publish-top-actions .btn` (`:158`); `.edit-photos-dialog .sticky-actions .btn` (`:95`) | cambian alto o tamaño según dónde esté el botón | — | — |
| Sin uso en TSX | `.btn-header` (`st/04-explorar.css:4`, `st/05-cuenta-propietario.css:39`), `.btn-round` (`st/05-cuenta-propietario.css:105`, `st/09-calendario.css:61`), `.btn-note` (`st/03-casas.css:164`) | CSS muerto (grep en `.ts`/`.tsx`/`.css`) | 0 | — |

### 1.2 Enlaces y botones de texto

| Variante | CSS | Aspecto | Usos | Estados |
|---|---|---|---|---|
| `.link` | `st/01-base.css:84` | `--primary`, 500, sin subrayado, **sin alto mínimo** | 13 (`<Link>`/`<a>`): `sc/admin-revision:42,46` `asistir:95` (con `.header-action`, `st/05-cuenta-propietario.css:118`, 44 px), `cuenta-lista:48`, `cuenta-profile:109,113`, `cuenta-codigo:143`, `suscripcion:413`, `admin-edicion:139` (summary); `cl/sign-in:257` | active: opacidad .6 (`st/08-movimiento.css:10-11`) |
| `.btn-link` | `st/01-base.css:85-86` | `--primary`, 500, `min-height:44px`, `padding:6px 0`; `.muted` | 19: `sc/actividad:193` (`inquiry-wa`), `calendario:632` (`cal-base`), `casa-editable:109,353`, `cuenta-codigo:133,146`, `cuenta-profile:167,182,240`, `editar:238`, `propietario:217,453`, `publicar-entrada:37`, `publicar:167`; `cl/delete-house:76`, `search-help:29`, `shell:160,181`, `sign-in:252` | active .6; desactivado solo en escritorio (`st/13-escritorio.css:342`, opacidad .65) |
| `.btn-text` | `st/04-explorar.css:77` | `--muted`, subrayado, 44 px, `padding:0 8px` | 14: `sc/airbnb:133` `buscar:171,190,253,283,312` `casa-editable:159` `explorar:118,128` `ical-export-card:141` `suscripcion:211`; `sh/contact-sheet:294,302` `listing-calendar:124` | **sin active ni disabled propios** |
| `.sub-stop` (sobre `.btn-text`) | `st/10-ajustes.css:112` | centrado | 3: «Parar suscripción» `sc/suscripcion:211`, «Desconectar Airbnb» `airbnb:133`, «Revocar enlace» `ical-export-card:141` | disabled nativo sin estilo propio |
| `.btn-link.delete-house` | `st/05-cuenta-propietario.css:185` | `--bad`, 600, 100 % | 1: `cl/delete-house:76` («Eliminar casa» del propietario) | active .6 |
| `.inquiry-wa` | `st/05-cuenta-propietario.css:59` | texto `--primary` con el icono de WA, 44 px | 1: `sc/actividad:193` | active .6 |
| `.sent-link`, `.logout-link`, `.logout-cancel` | `st/05-cuenta-propietario.css:150,29,30` | colocación de `.btn-link` | `sc/propietario:453`, `cuenta-profile:167,182` | — |
| `.sub-summary-link` | `st/05-cuenta-propietario.css:162` | fila enlace verde, 52 px | `sc/suscripcion:487` | sin active |
| `.cal-cancel` | `st/09-calendario.css:135` | `--muted` 15, **32 px** | 1: `sc/calendario:613` («Cancelar») | sin active ni foco propio |
| `.cal-base` (sobre `.btn-link`) | `st/09-calendario.css:143` | **32 px**, sin padding | 1: `sc/calendario:632` | — |
| `.popup-cancel` | **solo en escritorio** `st/13-escritorio.css:19-25` | dentro de un diálogo: transparente, `--brand-ink`, sin sombra | 7: `cl/confirm-sheet:51` (siempre que no sea `cancelFirst`), `close-sheet:60`, `mark-sheet:78`; `sc/admin-casas:321`, `airbnb:186`, `ical-export-card:149`, `suscripcion:220` (usado como **confirmar** en escritorio) | disabled con opacidad .55 |

### 1.3 Botones de icono

| Variante | CSS | Aspecto | Usos | Estados |
|---|---|---|---|---|
| `.icon-btn` | `st/01-base.css:140` | 44 × 44, radio `8px` escrito a mano, `--fg`, sin fondo | 27 en total. Cerrar (X): `sh/contact-sheet:248`; `cl/whatsapp-dialog:31`, `house-picker:112`, `explore-map-full:101` (`map-card-close`, `st/13-escritorio.css:469`); `sc/actividad:58`, `admin-casas:204`, `airbnb:173`, `editar:114,239`, `filtros:103`, `buscar:230` (`search-close`, `st/04-explorar.css:80`). Volver (flecha): `cl/chrome:266` (FlowHeader), `whatsapp-dialog:25`; `sc/filtros:108`; `sh/status-pages:15` (`status-back`, `st/02-app.css:10` y `st/13-escritorio.css:647`); `sh/listing-description:89` (etiqueta «Cerrar» con flecha). Otros: `sh/listing-calendar:140,144` (`cal-arrow`), `pu/wizard-parts:78` (ayuda) | active .97; disabled solo en `cal-arrow` |
| `.icon-btn.overlay` | `st/01-base.css:142` | `--overlay-btn` = crema al 70 % | `sh/listing-page:290` (volver), `sh/share-button:39` (compartir); `pu/location-picker:52` (`map-locate`, `st/06-publicar.css:33`) | — |
| `.icon-btn.float-card` | `st/11-flotantes.css:6-7`; escritorio `st/13-escritorio.css:482` | tarjeta flotante translúcida | `cl/explore-map:148` (ampliar, `aria-pressed`), `:153,154` (acercar y alejar) | disabled hasta que el mapa está listo, sin estilo propio |
| `.sheet-head .icon-btn` | `st/07-contacto.css:16,25`; `st/09-calendario.css:73` (`--muted`) | margen negativo; color fg o muted según la hoja | hojas | — |
| `.header-close` (+`.btn-link`) | `st/02-app.css:15-16`; publicar: `st/06-publicar.css:12` (44 × 44, `--muted`) | X de 20 px | 4: `cl/shell:160,181`; `sc/publicar-entrada:37`, `publicar:167` | disabled con opacidad .6; `aria-busy` en `publicar:167` |
| `.heart` + `.heart-card` / `.heart-hero` (`FavoriteButton`) | `st/03-casas.css:70-76` | 44 × 44; sobre la tarjeta, corazón blanco con sombra; en la ficha, fondo `--overlay-btn` y radio `8px` | `cl/listing-card:82`, `explore-map-full:105` (`heart-card`, `st/04-explorar.css:74`); `sh/listing-page:306` (`heart-hero`) | `aria-pressed` (relleno `--brand`), active .9 |
| `.card-wa` (`card-whatsapp.tsx`) | `st/03-casas.css:39-42`; mapa `st/04-explorar.css:75` | 44 px redondo al 50 %; en la tarjeta 50 × 50 con `--r-cta`; fondo `--surface`, borde, icono `--wa-icon` | `cl/card-whatsapp:34` | active .92; `aria-expanded` |
| `.filters-btn` (sobre `.chip`) | `st/04-explorar.css:127-128` (44); flotante 48 (`:11`); mapa 52 (`:58`); escritorio 52 de alto (`st/13-escritorio.css:431`) | chip cuadrado con contador | `sc/explorar:169` (Link), `:211` (button) | active de `.chip` |
| `.house-tool` | `st/05-cuenta-propietario.css:91-92`; escritorio con etiqueta en `::after` (`st/13-escritorio.css:753-756`) | 44 × 44, `--primary` | `sc/propietario:193,196` | **único con :hover** (y active) |
| `.new-house` («+») | `st/10-ajustes.css:107-108`; escritorio `st/13-escritorio.css:733-745` | 56 px, borde de línea, `--primary`; en escritorio copia el aspecto de `.btn-primary` y pone el texto «Añadir casa» con `::after` | `sc/propietario:88` | active .97 |
| `.cal-airbnb-update` | `st/09-calendario.css:107-108` | 44 × 44, `color-mix(primary 14%, bg)` (= `--state-soft` escrito de nuevo) | `cl/airbnb-calendar-row:81` | disabled con `var(--disabled-bg,#F2F1ED)` |
| `.photos-grid .remove` / `.add` | `st/03-casas.css:107-108`, `st/06-publicar.css:35` | quitar: **36 × 36** sobre la foto; añadir: celda discontinua | `pu/photo-grid:170,188` | active .97; disabled |
| `.sr-move` | `st/06-publicar.css:51-52` | oculto hasta tener el foco del teclado | `pu/photo-grid:173,176` | focus-visible |
| `.photo-pill` | `st/05-cuenta-propietario.css:175-177` | píldora 44, `--bg`, `--primary` | `sc/casa-editable:320,324` | — |

### 1.4 Flotantes, segmentos y pasos (− / +)

| Variante | CSS | Aspecto | Usos | Estados |
|---|---|---|---|---|
| `.float-btn`, `.map-label`, `.map-count` | `st/04-explorar.css:39-47` | 44, `padding:0 18px`, borde `--float-edge`, `--float-r`, `--float-bg`, desenfoque, 15/500 | `sc/propietario:267` (`float-btn` «Ver ficha» en móvil; `btn-ghost` en escritorio); `cl/explore-map:185` (`map-label`), `explore-map-full:69` (`map-count`) | **sin active**; se esconden con `html.chrome-away` |
| `.float-card` | `st/11-flotantes.css:6-7` | la misma superficie flotante, como clase suelta | `sc/explorar:95,159` (`search-pill`), `:169,191,211` (chips), `cl/explore-map:148-154` | — |
| `.seg button` | `st/09-calendario.css:136-138` | fondo `--beige-soft`, 3 px de relleno, botón de **38 px**, radio 6, 15/500; pulsado `--chosen` | `sc/calendario:621,624`; `cl/airbnb-calendar-row:43,44`; `sh/contact-sheet:255,258` | `aria-pressed`; sin active |
| `.currency-switch button` (`CurrencySwitch`) | `st/04-explorar.css:132-134`; flotante (`:12-14`: 38 px y otro color al pulsar); Favoritos 44 (`st/03-casas.css:83`); escritorio (`st/13-escritorio.css:690-694`: blanco con sombra) | **36 px**, 18 | `sh/currency-switch:12,15` | `aria-pressed` |
| `.people-stepper button` | `st/04-explorar.css:119-120`, `st/10-ajustes.css:36-39`, `st/10-ajustes.css:99-101` (las tres se pisan) | al final: 44, transparente, `--primary`, 26 px, **radio 999px** | 4 a mano: `sc/explorar:140,143`, `buscar:297,303`; `sh/nights-picker:23,31`, `contact-sheet:313,331` | disabled con opacidad .35 (antes .4 y `#A3ADA6`) |
| `.counter .ctl button` (`CounterRow`) | `st/01-base.css:192-195` (40); 44 en `st/06-publicar.css:26`; `st/10-ajustes.css:99-101` | igual que el paso de personas | `sh/counter-row:16,19` (Filtros y Publicar) | disabled con opacidad .35; active `--chosen` |
| Chips como botón (`.chip`, `.choice`) | `st/01-base.css:146-153`, `:185-190` | pertenecen a la familia de chips; aquí solo se cuentan como botones con `aria-pressed` | `sc/filtros:169,214`, `sh/nights-picker:39`, `sc/explorar:191` | `aria-pressed` con ✓ |

### 1.5 Portada estática (solo inventario)

| Variante | Definición | Aspecto | Uso |
|---|---|---|---|
| `.soon-cta` | `apps/app/public/portada/portada.css:33` | **verde `#2F5D45` lleno**, texto `#FFFBF2`, 52 px, **radio 999px**, peso 800, valores escritos a mano (tokens 0.2.0) | Lo pone el worker: `src/domain/portada.ts:13` («Escríbanos por WhatsApp», que es un enlace de WhatsApp pero **no lleva el verde de WhatsApp**) y `:18` («Publicar mi casa») |

---

## 2. Duplicaciones y divergencias

### 2.1 Variantes y nombres

| # | Hallazgo | Dónde | Veredicto |
|---|---|---|---|
| V1 | Tres nombres para el mismo aspecto: `btn-primary`, `btn-soft` y `btn-outline` (58 usos), y `btn-outline` no tiene contorno | `st/01-base.css:128` | **A CORREGIR**: el nombre engaña y obliga a elegir entre tres clases iguales. |
| V2 | `btn-secondary` no está definido: el botón sale sin fondo | `cl/mark-sheet:65` | **A CORREGIR**: es un error; queda distinto de su vecino `btn-ghost` (`:66`). |
| V3 | Con fondo crema, `btn-ghost` (verde al 14 % transparente) y `btn-primary` (verde al 14 % mezclado con el crema) casi no se distinguen en móvil; solo cambian la sombra y el peso (500 frente a 600). En escritorio, ghost pasa a tener contorno | `st/01-base.css:128-129`, `st/13-escritorio.css:671-676` | **A CORREGIR** (decisión de diseño pendiente): o la jerarquía secundaria se define igual en las dos vistas, o la diferencia se escribe en la variante y no como un parche por ancho. |
| V4 | El peso tipográfico se fija en dos sitios: `.btn-wa` dice 500 en su regla y `st/10-ajustes.css:130` lo cambia a 600 para primary, soft, outline, wa y sun. Ghost, danger y outline-bad quedan en 500 | `st/01-base.css:126,135`; `st/10-ajustes.css:130` | **A CORREGIR**: cada variante debería llevar su peso en un solo sitio. |
| V5 | CSS muerto: `.btn-header`, `.btn-round`, `.btn-note` | `st/04-explorar.css:4`, `st/05-cuenta-propietario.css:39,105`, `st/09-calendario.css:61`, `st/03-casas.css:164` | **A CORREGIR**: quitarlo. |
| V6 | En escritorio, `.new-house` repite las declaraciones de `.btn-primary`, y tanto `.new-house` como `.house-tool` ponen el texto con `::after` (en `.house-tool`, eligiendo por `href*=`) | `st/13-escritorio.css:733-745,753-756` | **A CORREGIR**: el texto de la interfaz no debería vivir en el CSS, y el selector por `href` se rompe con facilidad. |
| V7 | La superficie flotante está escrita dos veces: `.float-btn,.map-label,.map-count` repiten el fondo, el borde, la sombra y el bloque `@supports` de `.float-card` | `st/04-explorar.css:39-40` frente a `st/11-flotantes.css:6-7` | **A CORREGIR**: es la misma superficie; debería salir de un solo sitio. |
| V8 | Dos controles segmentados con CSS propio y casi igual: `.seg` (38 px, 15) y `.currency-switch` (36 px, 18; 38 en la cabecera flotante; 44 en Favoritos; blanco en escritorio) | `st/09-calendario.css:136-138`; `st/04-explorar.css:12-14,132-134`; `st/03-casas.css:83`; `st/13-escritorio.css:690-694` | **A CORREGIR**: el papel es el mismo. La moneda con su propio aspecto en la barra de escritorio sí está JUSTIFICADA. |
| V9 | El paso − / + se define tres veces y cada regla pisa la anterior (de 8 px a 999 px de radio; de `#A3ADA6` a .4 y a .35 de opacidad). `CounterRow` lo encapsula, pero `people-stepper` se escribe a mano en 4 sitios | `st/04-explorar.css:119-120`, `st/10-ajustes.css:36-39,99-101`, `st/01-base.css:192-195`; `sc/explorar:140`, `sc/buscar:297`, `sh/nights-picker:23`, `sh/contact-sheet:313` | **A CORREGIR**: dejar una sola regla y un solo componente. |
| V10 | `.btn btn-link muted` mezcla dos sistemas: el `padding` de `.btn` lo pisa `.btn-link`, y con `disabled` le aplicaría el fondo gris de `.btn` | `sc/propietario:217` | **A CORREGIR**. |

### 2.2 El mismo papel con estilos distintos

| # | Papel | Variantes que conviven | Veredicto |
|---|---|---|---|
| R1 | **Cancelar en una hoja** | `btn btn-ghost btn-lg` + `popup-cancel` (52 px): `ConfirmSheet`, `close-sheet:60`, `mark-sheet:78`, `airbnb:186`.<br>`btn btn-ghost btn-block` + `popup-cancel` (**44 px**): `sc/admin-casas:321`.<br>`btn btn-ghost` (44, en línea): `sc/ical-export-card:149`.<br>`btn-link muted` (texto): `sc/cuenta-profile:182`, en la hoja de cerrar sesión.<br>`.cal-cancel` (texto gris de **32 px**): `sc/calendario:613`.<br>En escritorio, `popup-cancel` pasa a texto **terracota** (`st/13-escritorio.css:19-24`) | **A CORREGIR**: cuatro alturas y tres aspectos para «Cancelar». El terracota en escritorio coincide con el de la acción destructiva (`btn-outline-bad`), y eso confunde. Cerrar sesión como texto puede estar JUSTIFICADO (allí la acción que confirma tampoco es la principal). |
| R2 | **Confirmar una acción destructiva** | `btn-outline-bad`, en terracota: descartar borrador (`propietario:49`), eliminar casa del propietario (`delete-house:90`), descartar cambio (`casa-editable:171`), parar suscripción en móvil (`suscripcion:220`).<br>`btn-danger`, rojo lleno: desconectar Airbnb (`airbnb:139`), revocar enlace (`ical-export-card:146,152`), eliminar casa como admin (`admin-casas:318`).<br>En escritorio, parar suscripción usa `btn btn-lg popup-cancel` (texto terracota) y deja «Mantener» como principal (`suscripcion:220-223`) | **A CORREGIR**: «Eliminar casa» se confirma en terracota si lo hace el propietario y en rojo si lo hace el admin. Hacen falta un `danger` y, como mucho, un `danger-strong`. Lo de escritorio, que destaca «Mantener», está JUSTIFICADO por retención si es una decisión tomada; no consta en `docs/diseno-v1.md`. |
| R3 | **Abrir una acción destructiva** | Texto rojo en 600 (`delete-house:76`); texto gris subrayado (`sub-stop`: parar, desconectar, revocar); `btn btn-link muted` (`propietario:217`); bloque terracota «Descartar borrador» (`propietario:366`); contorno rojo (`admin-casas:287`) | **A CORREGIR**: cinco aspectos. El texto gris para lo reversible frente al rojo para lo que no se deshace sería JUSTIFICADO si se pone por escrito. |
| R4 | **Cerrar (X) y volver** | `icon-btn` (en `--fg`) en 12 sitios; `btn-link header-close` (44, `--muted` en publicar) en 4; en la hoja del selector de casa, X en `--muted` (`st/09-calendario.css:73`); `listing-description:89` lleva la flecha con la etiqueta «Cerrar». Volver: `icon-btn` de 44; el «Atrás» del asistente es `btn-back`, de 56 (48 en la barra fija), con fondo ghost | **A CORREGIR**: la X debería ser un solo componente. El «Atrás» grande del asistente está JUSTIFICADO, porque comparte fila con «Continuar». |
| R5 | **WhatsApp** | `btn-wa` para contactar (`listing-page`, `contact-sheet`), que es lo que pide el token; también para la ayuda (`cuenta-ayuda:26,48,55`), el admin (`admin-shared:39`) y una casa bloqueada (`owner-ui:91`). `inquiry-wa` es un texto verde. `card-wa` es un icono blanco. `.soon-cta` en la portada no usa el verde de WhatsApp | El token dice «solo Contactar por WhatsApp»: los usos de apoyo y admin son **A CORREGIR o hay que ampliar el token** (cuestión de Ana). `inquiry-wa` y `card-wa` están JUSTIFICADOS por el contexto (respuesta del anfitrión y tarjeta). En la portada, A CORREGIR si se toca la portada. |
| R6 | **Pagar** | Siempre `btn-sun` (5). `suscripcion:83` pasa a `btn-ghost btn-sm` cuando la etiqueta es «Cambiar» | JUSTIFICADO: el método ya existe y ahí no hay aviso de pago. |
| R7 | **Ver más / Cargar más** | `btn-outline btn-block` (`explorar:264,395`) frente a `btn-soft btn-more` (`listing-description:38`) | Coherente en lo visual (V1), pero con dos nombres. **A CORREGIR** junto con V1. |

### 2.3 Valores escritos a mano en vez de tokens

| Valor | Dónde | Veredicto |
|---|---|---|
| `#f2f1ed` / `#898d88` (desactivado) | `st/01-base.css:139` | **A CORREGIR**: son los valores del token, pero falta la variable. `var(--disabled-bg,#F2F1ED)` se usa en `st/09-calendario.css:108,112` y **nunca se define**. |
| `#A3ADA6` (desactivado) | `st/01-base.css` (`.list-item[aria-disabled]`), `st/05-cuenta-propietario.css:141`, `st/04-explorar.css:120` | **A CORREGIR**: es el `--muted` del modo oscuro usado en modo claro. |
| Radio `8px` escrito a mano | `.btn-sm` `st/01-base.css:138`, `.icon-btn` `:140`, `.heart-hero` `st/03-casas.css:76`, `.house-tool` `st/05-cuenta-propietario.css:91`, `.cal-airbnb-update` `st/09-calendario.css:107`, `.seg` y `.currency-switch` (8 y 6) | **A CORREGIR**: debería ser `--r-input` o un `--r-button` (el token `radius.button` existe pero no tiene variable CSS). |
| Radio 999px y 50 % | pasos − / + (`st/10-ajustes.css:99`); `.card-wa` (`st/03-casas.css:39`, que siempre se pisa: valor muerto); `.soon-cta` | **A CORREGIR**: va contra la norma de «todo cuadrado». Los pasos redondos solo estarían JUSTIFICADOS si hubo una decisión (no la encontré). |
| `color-mix(primary 14%, bg)` | `.cal-airbnb-update` (`st/09-calendario.css:107`) | **A CORREGIR**: es `--state-soft`. |
| `color-mix(primary 14%, transparent)` | `.btn-ghost` y los pasos `.minus` (`st/01-base.css:129,194`, `st/10-ajustes.css:37`) | Hace falta un token propio para el ghost. |
| `--overlay-btn` = crema al 70 % | `st/01-base.css:13` | El token `color.overlayButton` dice `#FFFBF2` opaco: **hay que poner al día el token** (la decisión del 2026-10-29 es la del CSS). |
| `#FFFFFF` y `#FFFBF2` escritos a mano | `.heart-card` (`st/03-casas.css:73`), `.sr-move` (`st/06-publicar.css:52`) | Menor. JUSTIFICADO sobre foto, pero debería usar `--primary-on`. |

### 2.4 Estados que faltan o divergen

| Estado | Hallazgo | Veredicto |
|---|---|---|
| Desactivado | Siete tratamientos: gris del token (`.btn`); gris neutro en escritorio (`st/13-escritorio.css:677-681`, decisión de la revisión del 2026-11-13 que **el token no recoge**); `.cal-save` con `color-mix(fg 8%, surface)` (`st/09-calendario.css:126`); `--disabled-bg` sin definir; opacidad .6 (`header-close`), .55 (`popup-cancel`), .3 (`cal-arrow`), .35 (pasos), .65 (`btn-link` en escritorio) | **A CORREGIR**: la norma dice «sin bajar la opacidad». |
| Cargando o enviando | No hay un patrón común. Lo más habitual es cambiar el texto y poner `disabled` («Generando enlace…», «Cargando casas…»). `aria-busy` solo en `explorar:264` y `publicar:167`. Clases sueltas: `.btn-wa.is-sending`, `.btn-wa.is-pending`, `.btn-more.is-pending`. El `<span>` sin hidratar se ve igual que el botón | **A CORREGIR**: un `pending` en el componente que ponga `aria-busy` y `disabled` y deje el texto en manos de quien lo usa. |
| Hover | Solo lo tienen `.house-tool`, la barra de escritorio, el menú desplegable, `.zone-option` y la fila de detalle. **`.btn` no tiene hover** ni en escritorio | **A CORREGIR** para la vista web; en móvil no hace falta. |
| Pulsado | Sin respuesta al toque: `.btn-text`, `.float-btn`, `.map-label`, `.map-count`, `.seg`, `.currency-switch`, `.cal-action`, `.cal-cancel`, `.sub-summary-link`. Con movimiento reducido, `.new-house` sigue escalando (`st/10-ajustes.css:108`, fuera de `st/09-calendario.css:147-150`) | **A CORREGIR**. |
| Foco | El global (`st/01-base.css:73`) cubre `button` y `a`, pero **no `summary`** («¿Cómo funciona el cobro?», `sc/suscripcion:368`, `admin-edicion:139,158`). En escritorio, la barra usa `--primary` (`st/13-escritorio.css:402`) y los chips de características también (`st/01-base.css:206`) | `summary`: A CORREGIR. Los colores de foco distintos: A CORREGIR (debería haber uno solo). |
| `aria-pressed` | Bien usado en 22 sitios (corazón, chips, seg, moneda, ampliar mapa) | Correcto. |

### 2.5 Áreas táctiles por debajo de 44 px

| Elemento | Medida | Dónde | Veredicto |
|---|---|---|---|
| `.cal-cancel` | 32 de alto | `st/09-calendario.css:135` | **A CORREGIR** |
| `.cal-base` | 32 (pisa los 44 de `.btn-link`) | `st/09-calendario.css:143` | **A CORREGIR** |
| `.cal-arrow` | 40 × 40 (pisa los 44 de `.icon-btn`) | `st/09-calendario.css:80` | **A CORREGIR** |
| `.seg button` | 38 de alto | `st/09-calendario.css:137` | **A CORREGIR**: es ancho, pero va contra la norma de 44 de la casa. |
| `.currency-switch button` | 36 (38 en la cabecera flotante) | `st/04-explorar.css:133,13` | **A CORREGIR**: en Favoritos ya se subió a 44 (`st/03-casas.css:83`). |
| `.photos-grid .remove` | 36 × 36 | `st/03-casas.css:108` | **A CORREGIR**: se puede ampliar el área de toque sin agrandar el dibujo. |
| `.counter .ctl button` (base) | 40 | `st/01-base.css:193` | Hoy no se ve, porque Filtros y Publicar lo suben a 44. JUSTIFICADO de hecho; conviene dejar 44 en la base. |
| `.chip` como botón | 40 (`components.chip.height`) | `st/01-base.css:146` | JUSTIFICADO por el token; es de la familia de chips. |
| `.link` sin alto mínimo | variable | `st/01-base.css:84` | Revisar los usos en línea (`cuenta-profile:109,113`, `suscripcion:413`). |

---

## 3. Componentes React existentes

| Componente | Archivo | Qué encapsula | Usos |
|---|---|---|---|
| `ConfirmSheet` | `cl/confirm-sheet.tsx:8` | La hoja de confirmar y cancelar, el foco, `pending` y `disabled`. **El estilo lo recibe como texto** (`confirmClassName` y `cancelClassName`), así que cada llamada elige sus clases (ver R1 y R2) | 7: `cl/delete-house:80`; `sc/cuenta-profile:177`, `airbnb:138`, `propietario:45`, `suscripcion:216`, `casa-editable:167`, `ical-export-card:151` |
| `FavoriteButton` | `sh/favorite-button.tsx:5` | El corazón con `aria-pressed` | 3 |
| `ShareButton` / `ShareButtonInline` | `sh/share-button.tsx:36`, `cl/owner-ui.tsx:123` | Compartir sobre la foto o como `btn btn-primary` | 1 y 2 |
| `PayButton`, `ActivateButton`, `SubscriptionLink` | `cl/owner-ui.tsx:29-56` | `btn btn-sun btn-block` | 4 + 2. `sc/suscripcion.tsx:83` tiene **otro `PayButton` local** con `ghost` y `label` |
| `PublishPromoButton` | `cl/publish-promo.tsx:18` | `btn btn-sun btn-block` | 2 |
| `NoticeLink` | `sc/admin-shared.tsx:37` | `btn btn-wa btn-block` | 3 |
| `CardWhatsApp` | `cl/card-whatsapp.tsx` | `.card-wa` | 1 |
| `CounterRow` | `sh/counter-row.tsx` | Los pasos − / + | 3. **Lo esquivan 4** `people-stepper` escritos a mano |
| `CurrencySwitch` | `sh/currency-switch.tsx` | El segmento ₡ / $ | varias. **Lo esquivan 3** `.seg` escritos a mano |
| `FlowHeader` (volver) | `cl/chrome.tsx:266` | El `icon-btn` de volver | — |

**No existe ningún `<Button>` genérico.** De unas **117 líneas** que usan la clase `.btn`, solo **11** llegan como `confirmClassName`/`cancelClassName`; el resto son `<button className=…>`, `<Link className=…>` o `<a className=…>` directos. Los 27 `icon-btn`, 19 `btn-link` y 14 `btn-text` también van directos. Hay 167 `<button>`, 74 `<Link>` y 21 `<a>` en los TSX.

---

## 4. Propuesta de destino (breve)

Unos pocos componentes con tipos cerrados, sin abstracción universal:

1. **`<Button>` y `<ButtonLink>`** (mismo aspecto, sobre `button`, `Link` y `a`):
   - `variant: "primary" | "secondary" | "pay" | "whatsapp" | "danger"`.
     - `primary` reúne `btn-primary`, `btn-soft` y `btn-outline`.
     - `secondary` es el ghost actual; decidir cómo se ve igual en móvil y en escritorio (V3).
     - `danger` sustituye a `btn-outline-bad` y `btn-danger-outline`. `danger-strong` sustituye a `btn-danger`, solo si Ana quiere mantener dos niveles (R2).
   - `size: "md" (44) | "lg" (52) | "xl" (56)`. Se quitan los 48 contextuales de `.sticky-actions` y `.cal-panel`, o se convierte el 48 en el tamaño de las barras fijas.
   - `block?: boolean`.
   - `pending?: boolean`: pone `aria-busy` y `disabled`; el texto lo da quien lo usa.
   - `disabled`: un solo aspecto, con `--disabled-bg` y `--disabled-fg` como variables nuevas, igual en móvil y en escritorio, o con el cambio de escritorio pasado al token.
   - `icon?`: icono a la izquierda, de 20 px.
   - Añadir `:hover` solo dentro de `13-escritorio.css`.
2. **`<TextButton tone="link" | "quiet" | "danger">`**: une `.btn-link`, `.btn-text`/`.sub-stop` y `.delete-house`. Siempre con 44 px de alto y respuesta al toque. Sustituye a `.cal-cancel`, `.cal-base` y a `btn btn-link muted`.
3. **`<IconButton label icon tone="plain" | "overlay" | "float">`**: 44 × 44 y `aria-label` obligatorio. Absorbe `icon-btn`, `header-close`, `cal-arrow` (a 44), `.photos-grid .remove` (área de 44) y los botones del mapa. Tiene dos usos fijos, `<CloseButton>` (X) y `<BackButton>` (flecha), para que la X y la flecha dejen de mezclarse (R4).
4. **`<Segmented>`**: une `.seg` y `CurrencySwitch`, con 44 px de alto. El aspecto de la barra de escritorio queda como modificador.
5. **`<Stepper>`**: `CounterRow` y el `people-stepper` en un solo componente, con una sola regla CSS (V9).
6. **`ConfirmSheet`** recibe `tone: "neutral" | "danger"` en vez de clases sueltas. «Cancelar» lo pinta siempre como `secondary lg`.

**Excepciones que se conservan** (con su CSS propio y sin pasar por `<Button>`):
- `FavoriteButton`, porque es un estado sobre una foto.
- `card-wa`, el icono de WhatsApp de la tarjeta.
- `inquiry-wa`, el texto de respuesta del anfitrión.
- `float-btn` y `map-label`, como `<FloatButton>`, apoyados en `.float-card` (V7).
- `btn-back` del asistente, que puede ser `<Button size="lg" iconOnly>`.
- `house-tool` y `new-house`: su etiqueta de escritorio debe ir en JSX, no en `::after` (V6).
- Los chips, que se tratan en su propia familia.
- La portada estática: solo se anotan sus diferencias (`.soon-cta` con verde lleno, 999px y peso 800). No se propone React allí.

---

## 5. Rutas y pantallas revisadas

Rutas tomadas de `cl/shell.tsx`. Para cada pantalla leí el TSX y el CSS que le corresponde.

| Zona | Archivos revisados |
|---|---|
| Ficha `/casa/$publicId` (SSR y estados) | `sh/listing-page.tsx`, `contact-sheet.tsx`, `listing-description.tsx`, `listing-calendar.tsx`, `share-button.tsx`, `favorite-button.tsx`, `status-pages.tsx`, `site-top-bar.tsx`, `nights-picker.tsx`; `st/02-app.css` (cta-bar), `07-contacto.css` |
| Explorar, mapa y tarjeta | `sc/explorar.tsx`; `cl/explore-map.tsx`, `explore-map-full.tsx`, `listing-card.tsx`, `card-whatsapp.tsx`, `search-help.tsx`, `publish-promo.tsx`; `st/03-casas.css`, `04-explorar.css`, `11-flotantes.css` |
| Filtros `/explorar/filtros` | `sc/filtros.tsx`, `sh/counter-row.tsx` |
| Buscar `/explorar/buscar` | `sc/buscar.tsx` |
| Favoritos | `sc/favoritos.tsx` |
| Cuenta, acceso y código (`/cuenta`, `/cuenta/codigo`, `/cuenta/lista`, `/cuenta/recuperar`, `/ayuda`) | `sc/cuenta*.tsx`; `cl/sign-in.tsx`, `whatsapp-dialog.tsx`; `st/05-cuenta-propietario.css` |
| Publicar (`/publicar`, `/publicar/$id/$paso`, `/publicar/verificar`, `/publicar/continuar`, `/propietario/publicar…`) | `sc/publicar.tsx`, `publicar-entrada.tsx`; `pu/step-form.tsx`, `fields.tsx`, `wizard-parts.tsx`, `photo-grid.tsx`, `location-step.tsx`, `location-picker.tsx`, `place-search.tsx`; `st/06-publicar.css` |
| Propietario: casas, detalle, editar campo, calendario, actividad y consultas, Airbnb, suscripción, enviada | `sc/propietario.tsx`, `casa-editable.tsx`, `editar.tsx`, `calendario.tsx`, `actividad.tsx`, `airbnb.tsx`, `ical-export-card.tsx`, `suscripcion.tsx`; `cl/owner-ui.tsx`, `delete-house.tsx`, `close-sheet.tsx`, `mark-sheet.tsx`, `house-picker.tsx`, `airbnb-calendar-row.tsx`, `confirm-sheet.tsx`, `editor-status.tsx`; `st/09-calendario.css`, `10-ajustes.css` |
| Admin (`/admin`, casas, borradores, usuarios, código, anuncios, ediciones, casa y sus subrutas) | `sc/admin*.tsx`, `asistir.tsx`. En `admin.tsx` y `admin-review-details.tsx` no hay botones de esta familia (grep) |
| Qué es 3bstays | `sc/que-es-3bstays.tsx` y `.css` (solo enlaces de marca e invitado; la acción es `PublishPromoButton`) |
| Barra, cabeceras y aviso de versión | `cl/chrome.tsx`, `shell.tsx`, `update-banner.tsx`; `st/02-app.css`, `08-movimiento.css`, `12-orientacion.css` (sin botones) |
| Portada | `apps/app/public/portada.html`, `public/portada/portada.css`, `src/domain/portada.ts` |
| Escritorio | `st/13-escritorio.css`, leído entero en lo que toca a botones, barra, diálogos, mapa, Mis casas y revisión |

Sin comprobar: el aspecto real en el navegador (no se abrió la app), el contraste de cada variante, y las reglas que pueda añadir el CSS de Leaflet a los controles del mapa.
