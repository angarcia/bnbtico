# Historia 07 · Inventario de estructura y contenido (2026-11-19)

Familia: navegación, cabeceras, tarjetas, listas y filas, etiquetas de estado, avisos, estados vacíos, de carga y de error, tipografía, espacios, superficies, iconos, foco y escritorio.

**Método.** Solo se ha leído el código. No se han ejecutado builds, pruebas ni servidores, y no se ha abierto ninguna pantalla en el navegador. Los recuentos salen de expresiones regulares sobre `apps/app/src/styles/01…13-*.css` y `client/screens/que-es-3bstays.css` (sin `global.css`, que solo importa). Los usos en TSX salen de `grep` sobre `className`. Las clases que se montan dinámicamente (p. ej. `state ${cls}`) se han buscado aparte en `domain/*.ts`. Lo marcado **(no comprobado)** se ha deducido del código y hay que confirmarlo en la vista Móvil o en escritorio.

Fuentes de referencia: `docs/diseno-v1.md`, `design/tokens/tokens.json` y `docs/decisiones.md` (2026-10-29 y 2026-11-13). Hay una incoherencia de versión: el `meta.version` de `tokens.json` es **0.3.4** (y `meta.name` sigue en «bnbtico»), pero `docs/diseno-v1.md:23` y `01-base.css:1` dicen 0.3.3, y `CLAUDE.md` dice 0.2.2.

---

## 1. Variantes por subfamilia

### 1.1 Navegación

| Clase / componente | Dónde (CSS · TSX) | Usos por pantalla | Aspecto |
|---|---|---|---|
| `TabsFrame` → `nav.tabbar` (móvil) | `02-app.css:18-30` · `client/chrome.tsx:45-161` | Pestañas: Explorar, Filtros, Favoritos, Qué es, Mis casas, Calendario, Consultas, Cuenta (con sesión), admin (`/admin`, `/admin/casas`, `/admin/borradores`, `/admin/usuarios`) y la página «no encontrada» (`shell.tsx:69-83`) | Plana, 84 px + área segura (`--nav-h`), fondo `--bg`, línea superior 2 px `--line-nav`, iconos de 26 px (`chrome.tsx:103`), etiqueta de 13 px (14 px con `.three`). La activa lleva el icono en `--brand` con trazo 2.4 y el texto en `--brand-ink`. Coincide con `tokens.components.bottomNav` |
| Etiqueta de pestaña en «Coming Soon» | `02-app.css:29-30` | Todas las pestañas móviles | Usa una segunda familia tipográfica (`@font-face` en `02-app.css`), que no está en `tokens.font` ni en `diseno-v1.md` → ver §3 |
| `nav-wordmark` (logo en la pestaña 3Btico) | `02-app.css:27-28` · `chrome.tsx:104-108` | Pestaña «Qué es 3bstays» sin sesión | 20 px de alto; en gris (`filter:grayscale`) si no es la activa |
| `.nav-count` (contador de la pestaña) | `06-publicar.css:83` · `chrome.tsx:111,131` | Anuncios (admin) y Consultas | 18 px, radio 6, `--brand`, 13 px. **Duplica** `.count-badge` (`01-base.css:165`, `--brand-ink`) y `.house-inquiries-count` (`05-cuenta-propietario.css:93`, 12 px) → §3 |
| `desktop-nav` (barra superior de escritorio, SPA) | `13-escritorio.css:356-418, 598-600, 684-698, 800` · `chrome.tsx:72-140` | Todas las pantallas con `TabsFrame` a ≥1024 px; desde `FlowFrame` también ayuda, cuenta, admin, suscripción, publicar y detalle de casa (`chrome.tsx:184-190`) | 72 px (`--desktop-nav-height`), línea inferior 1 px `--line-nav`. La pestaña activa lleva arena `--surface-2` y texto `--brand-ink`. Logo de 34 px de alto (`13:685`) y moneda neutra (`13:690-696`) |
| `SiteTopBar` (barra de escritorio de la ficha SSR y de sus páginas de estado) | `13-escritorio.css:610-642` · `shared/site-top-bar.tsx` | `/casa/CT-####` y las páginas de estado | Repite `desktop-nav` con `<a>` y sin router. Consultas va sin contador e «Ingresar» es un enlace, no un botón. Se monta tras hidratar en una caja de alto fijo. z-index 10 |
| `sticky-actions` / `cta-bar` (barras fijas de abajo) | `02-app.css:33-36, 60-64` | Publicar, Filtros, Revisar (admin) y la ficha | Las dos van fijas, con `--bg` y z 6. **`sticky-actions` lleva la línea en `--line-nav` y `cta-bar` en `--line-soft`** → §3 |
| `FlowFrame` (sin barra) | `chrome.tsx:168-196` | Ingresar, código, lista, recuperar, ayuda, publicar, buscar, detalle de casa, editar, suscripción, admin (flujos) | `main.view.no-nav` |
| Barras flotantes (`float-card`, `chrome-hide`) | `11-flotantes.css:6-15` · `04-explorar.css:8-14, 39-47` | Cabecera de Explorar, «Mapa», «N casas», «Ver ficha» y el mapa completo | Coinciden con `tokens.float`. El token `--float-r-bar` (16) está definido y **no se usa** |

### 1.2 Cabeceras de pantalla y títulos

| Variante | Dónde | Usos | Aspecto |
|---|---|---|---|
| `RootHeader` → `.header-root` | `02-app.css:6,11,12` · `chrome.tsx:200-233` | Mis casas, Mi casa (una sola casa), Calendario, Consultas, Favoritos, Cuenta (perfil), admin (Anuncios, Casas, Borradores), `Placeholder` («no encontrada», admin «Usuarios») | En móvil, bajo una pestaña sin barra (`BARE_PATHS`, `chrome.tsx:40`), el h1 es `sr-only` (`chrome.tsx:228`). Solo admin y «no encontrada» muestran el logo de 38 px y el h1 de **34 px** (`01-base.css:60`). En escritorio se convierte en `.page-header` con un h1 de **30 px** (`13:653-667`) |
| `FlowHeader` → `.header-flow` | `02-app.css:13-17` · `chrome.tsx:240-273` | 16 archivos de pantallas (cuenta, código, lista, ayuda, perfil, suscripción, airbnb, editar, detalle de casa, publicar, publicar-entrada, admin-codigo, admin-revision, admin-edicion, asistir) | Flecha `icon-btn` de 44 px más h1 de **24 px** con elipsis. En escritorio, 30 px (`13:663-664`) |
| `.header-flow` escrita a mano | `shell.tsx:159,180` (esqueletos de publicar), `filtros.tsx:101`, `publicar-entrada.tsx:253`, `publish/wizard-parts.tsx:13` | Publicar (cargando), Filtros, correo de publicar, asistente | Hay tres formas: (a) X + «Cerrar» a la izquierda y título (`shell.tsx`); (b) título solo (`publicar-entrada.tsx`); (c) título a la izquierda y X de 44 px a la derecha (`wizard-parts.tsx`, la que pide `diseno-v1.md:33`) |
| `WizardHeader` (`.wizard-heading`, `.publish-header`) | `06-publicar.css:9-16`, `10-ajustes.css:44-46` · `publish/wizard-parts.tsx:9-30` | Los 8 pasos de publicar, la entrada sin cuenta y la verificación | h1 sin elipsis, progreso de 8 tramos y `stage-label` de 14/15 px. El h2 de la etapa es de 23 px (`06:15`) |
| Cabecera de la página de estado (`.status-header`) | `02-app.css:10`, `13:643-651` · `shared/status-pages.tsx:13-28` | Ficha que no existe, bloqueada o con error | En móvil, el logo; en escritorio, la flecha y el h1 `.status-title` de 24 px (30 px en escritorio, `13:664`) |
| Cabecera de la ficha (`.listing-head`, `.listing-title`) | `03-casas.css:146-147`, `10-ajustes.css:70-76` | `/casa/CT-####` | h1 de 28 px (24 px si es largo) |
| h1 o h2 de un solo uso | `05:5` `.flow-title` 32 px (código, lista, admin-codigo, sign-in); `05:147` `.sent-title` 30 px; `04:89` `.search-card-title` 26 px; `que-es-3bstays.css:45` h1 25 px; `09:63` h1 del Calendario 28 px; `09:72` hoja de casa 23 px; `03:159` descripción 28 px | Varios | Tamaños fuera de la escala, sobre todo 23, 25, 26, 28 y 32 → §2 |
| Títulos de bloque | `.card-title` 20 px (`05:107`); `.offer-title` 18 px (`05:65`; 7 usos en 5 archivos); `.house-card-title` 20 px (`05:74`); `.sub-house-title` 19 px (`05:111`); `.listing-card h2` 20 px (`03:14`); `.map-card h2` 19 px (`04:69`); `.inquiry-name` 19 px (`05:56`); `.queue-title` 19 px (`06:59`); `.featured-title` 20 px (`05:62`); `.account-name` 21 px (`05:24`); h3 base 19 px (`01:62`) | — | Hay seis clases para «título de tarjeta» en 19–21 px. `.activity-h2` (`05:49`) **no se usa** |

### 1.3 Tarjetas

| Clase / componente | Dónde | Usos | Aspecto |
|---|---|---|---|
| `.card` | `01-base.css:95` | 58 usos en 37 archivos (la base de casi todo) | `--surface-soft` (blanco al 70 %), radio `--r` 12, `--shadow` plana, padding 14 |
| `.card-arena` | `01:96` | 4 usos (HoldNotice `owner-ui.tsx:111`, entre otros) | **Blanco opaco** (`--surface`), padding 16. El nombre dice «arena» pero el color no lo es → §3 |
| `.card-soft` | `01:97` | 1 uso (`admin-review-details.tsx`) | Verde tonal, radio `--r-tile` |
| `.card-sun` | `01:98` | 3 usos (PayNotice `owner-ui.tsx:71`, `.offer-card`, entre otros) | Ocre claro, texto `--sun-ink` |
| `ListingCard` (`.listing-card`) | `03-casas.css:11-47, 54-57`, `13:495-507` · `client/listing-card.tsx:63-86` | Explorar, Favoritos y el mapa (variante `.map-card`, `04:64-75`) | Superficie y sombra de `.card` repetidas a mano (no usa la clase), foto 4:3 (3:2 de borde a borde en <900 px) y padding 12/14/8 |
| `HouseCardTop` + `article.card.house-card` | `05:69-96` · `client/house-card.tsx`, `screens/propietario.tsx:183` | Mis casas y Actividad | La foto lleva radio **8 px** (`05:71`) en Actividad (1:1) y 0 en Mis casas. Etiqueta de estado `.state` |
| `.inquiry-card` | `05:50-60` · `actividad.tsx:173` | Consultas | `.card` con padding 14 |
| `.queue-card` | `06:57-60` · `admin-anuncios.tsx:142` | Admin, Anuncios | `.card row` |
| `.feature-tiles div` | `03:98-103` | La ficha | `--surface-soft`, sombra y radio de tile. En escritorio se quitan las cajas (`13:707-718`) |
| `.steps-list` | `03:118-122` | 1 uso («Enviada», `propietario.tsx`) | Lista con el mismo aspecto que `.list` |
| `.offer-line` | `10:60` | Paso 9 de publicar | Blanco opaco, sombra y texto ocre |
| `.listing-stats` | `05:178` | Detalle de casa | Fondo `color-mix(--sun 14%, --bg)` |
| `.sub-house`, `.subscription-offer`, `.sub-house-inactive` | `05:108-166` | Suscripción y Cuenta | Bloques dentro de `.card`; `.is-target` con radio 10 y anillo verde |
| `.placeholder-card` | `chrome.tsx:282` · `13:649` | «No encontrada» y admin «Usuarios» | `.card`; en escritorio va sin caja |
| `.about-guest` / `.about-price` | `que-es-3bstays.css:39-85` | Qué es 3bstays | Arena `--surface-2` con radio `--r`; blanco con borde `--line` **sin radio** (`:80-84`) |

### 1.4 Listas y filas

| Clase | Dónde | Usos | Aspecto |
|---|---|---|---|
| `.list` + `.list-item` | `01:111-120` | 9 contenedores y 19 filas en 9 archivos: Cuenta (`cuenta-profile.tsx:133-218`), los datos del detalle de casa (`casa-editable.tsx:121-125, 342` `data-testid="field-rows"`), la hoja de casa del admin (`admin-casas.tsx:82-249`), borradores (`asistir.tsx:107-215`), Filtros (`filtros.tsx:143`) y el WhatsApp de la casa (`owner-ui.tsx:139`) | Mínimo 56 px, padding 10/16, divisor `--line-soft`. El estado desactivado va en **`#A3ADA6` literal** (`01:116`, `05:141`) |
| `.list-item-sun` | `01:119-120` | 2 usos: el método de pago (`suscripcion.tsx:524`) y «Publicar mi casa» (`publish-promo.tsx:51`) | `color-mix(--sun 70%)`, radio 8 |
| `FieldRow` (fila de dato con `.field-title`, `.tag-rev` y `.pending-foot`) | `05:122-135` · `casa-editable.tsx:68-…` | Detalle de casa (propietario y admin) | Contiene la etiqueta `.tag-rev` → 1.5 |
| `.review-row` | `10:49-59, 120-124` | Paso 9 de publicar | Rejilla 96 px / 1fr / auto, mínimo 44 px. Los estados `is-missing` (terracota) y `is-warn` (ocre) son una tercera forma de «fila con aviso» |
| `.counter` (filas con +/−) | `01:186-192`, `06:21-27`, `10:99-101` | Publicar (capacidad) y Filtros | Mínimo 56 px (78 px en publicar) |
| `.zone-option`, `.zone-options li`, `.house-picker-list [role=option]` | `04:96-100`, `10:22-25`, `09:75` | ¿Dónde?, la búsqueda del paso 2 y el selector de casa | Tres opciones de lista emergente parecidas: 52 px de mínimo, radio 8, y la elegida en `--sun-soft`, en `--surface-2` o en dorado según el caso |
| `.search-fold`, `.picker-pill`, `.date-box` | `04:82-86`, `09:66`, `07:31-35` | Buscar, el selector de casa (Calendario y Consultas) y las fechas de la hoja de contacto | Tres «campos cerrados que abren algo», todos con borde `--line` y radio 8. `diseno-v1.md:27,45` pide que sean iguales |
| `.sub-row-link`, `.sub-summary-link` | `05:162-166` | Cuenta y suscripciones | Filas con enlace |
| `.divider` | `01:122` | 4 usos en 3 archivos | 1 px `--line-soft` |

### 1.5 Etiquetas y pastillas de estado

| Clase | Dónde | Quién la elige | Aspecto |
|---|---|---|---|
| `.badge` + `badge-ok/sun/review/mute/bad/admin/new/tight/count` | `01:156-161`, `05:57`, `04:128,131` | `domain/listing.ts:78` (`STATUS_LABELS`), `domain/admin-houses.ts:55-66` (`HOUSE_BADGES`), `admin-anuncios.tsx:139`, `suscripcion.tsx:469`, `casa-editable.tsx:232`, `actividad.tsx:185,190`, `listing-page.tsx:313`, `admin-revision.tsx:105` | **Radio 999 px**, 14 px, padding 4/10. Sin uso: `badge-warn` (alias de `badge-sun`) y `badge-sel` (`04:78`) |
| `.state` + `state-ok/draft/review/pay/off/bad` | `05:98-104` | `domain/navigation.ts:45-59` (`CardLabelClass`) y `domain/edit-label.ts:20` | **Radio 999 px**, 15 px, padding 7/12 y sombra `0 2px 10px rgba(28,43,42,.22)`, sobre la foto. El comentario de `05:97` habla de un «punto» que no se pinta (no existe `.state::before`) |
| `.tag-rev` (`is-pending`, `is-changes`) | `05:122-125` | `casa-editable.tsx:87` | Radio 999 px, 13 px. `05:124` tiene una regla vacía (`.note .tag-rev{}`) |
| `.photos-grid .tag` (`tag-pending`) | `03:109`, `06:36-39` | Las fotos de publicar y editar | Radio 6 px, `--overlay` |
| `.pill` / `.pill-sm` / `.photo-pill` (sobre la foto) | `01:162-164`, `05:121,175-177` | Tarjetas, ficha y detalle | `.pill` con radio 999; `.photo-pill` con radio 8 y en el detalle crema `--bg` |
| `.count-badge`, `.nav-count`, `.house-inquiries-count`, `.filters-btn .badge-count` | `01:165`, `06:83`, `05:93`, `04:128` | Pestañas, Mis casas y Filtros | Cuatro contadores: 3 terracota con radio 6 (13, 13 y 12 px; `--brand-ink` frente a `--brand`) y uno verde redondo con borde |

Hay **tres tablas de etiquetas** en `domain/`, con textos distintos para el mismo estado: `STATUS_LABELS` dice «Pendiente de pago» y «Borrador»; `HOUSE_BADGES` dice «Por pagar» y «En edición»; `STATUS_CARD_LABELS` dice «Pendiente de pago». Además hay **dos familias visuales**: `.badge` para las filas y `.state` sobre la foto. Las tres tablas guardan nombres de clases CSS en `domain/`. No es una importación de un framework, pero ata el dominio a la hoja de estilos.

### 1.6 Avisos

| Variante | Dónde | Usos | Aspecto |
|---|---|---|---|
| `.note` (informativa) | `01:99` | 72 apariciones en 31 archivos | `--surface-soft`, borde `--line-soft`, radio 8, **16 px** |
| `.note[role="alert"]` | `01:102` | Errores (`airbnb.tsx:125`, `explorar.tsx:260`, …) | `--bad-soft` / `--bad`. Gana a `.note-arena` por especificidad |
| `.note-arena` | `01:101` | 11 usos en 9 archivos (errores de carga de Explorar y Favoritos, `HoldNotice` corto, admin) | Blanco opaco |
| `.note-plain` | `03:89` | 3 usos | Es igual que `.note` (blanco al 70 %): la clase sobra |
| `.note-sun` | `01:100` | 2 usos (`suscripcion.tsx`, `casa-editable.tsx:186`) | Ocre |
| `.note-review` | `10:110` | 3 usos | `--review-soft` |
| `.note-col` | `03:84-85` | 4 usos | Modificador de columna |
| `PayNotice` (`.card-sun`) | `owner-ui.tsx:59-78` | Mis casas (por `NoticeCard`, `propietario.tsx:64`) y el detalle | Tarjeta ocre con `offer-title` y `btn-sun` |
| `HoldNotice` | `owner-ui.tsx:84-120` | Mis casas (`card`, que usa `note-arena`) y el detalle (`card-arena`) | Dos formas para el mismo aviso |
| `.field-error` | `01:81` | 19 usos | Texto `--bad`, 15 px |
| `.toast` | `03:90` | Global | `--overlay`, radio `--float-r`, z 20, `color:#FFFBF2` literal |
| `.update-banner` | `06:86` | Global (`shell.tsx:67`) | `--fg` / `--bg`, z 7 |
| `.preview-bar` | `10:64` | Vista previa de la ficha | Ocre, z 31 |
| `.sheet .safety` | `07:54` | Hoja de contacto | `--ochre` (#A85A00, que no está en los tokens); en escritorio, `--fg` (`13:722`) |

### 1.7 Estados vacíos, de carga y de error

| Variante | Dónde | Aspecto |
|---|---|---|
| Esqueleto `.skeleton .sk` | `01:210-212`; 17 contenedores y 24 bloques en 15–16 archivos | Bloques arena con brillo; se para con movimiento reducido |
| `SkeletonCard` | `client/editor-status.tsx:3-10`; copiado a mano en `shell.tsx:165-168, 186-189` | `card skeleton owner-skeleton` con `sk thumb` y `sk sk-line` |
| `SkeletonActivity` | `actividad.tsx:200-207` | La misma forma con `inquiry-avatar` |
| `SkeletonGrid` / `SkeletonCards` | `explorar.tsx:241-252`, `favoritos.tsx:28-39` | Dos funciones casi iguales (3 tarjetas frente a n ≤ 4) |
| `.account-skeleton`, `.sub-skeleton` | `05:26-27, 112` | Alturas fijas |
| Vacío en tarjeta: `section.card > p.muted` | `admin-casas.tsx:77`, `admin-anuncios.tsx:119`, `asistir.tsx:205`, `explorar.tsx:501` | Sin título ni acción |
| Vacío sin tarjeta: `.fav-empty` (texto y botón `btn-soft btn-lg`) | `favoritos.tsx:77-83`, `03:80` | — |
| Vacío en línea: `p.small.muted` | `actividad.tsx:119`, `buscar.tsx:191` (este con `role="status"`) | — |
| Error de carga | `explorar.tsx:260` (`note-arena` con `role="alert"`, que se ve **rojo**), `explorar.tsx:400` y `:490`, `favoritos.tsx:85` (`note-arena` sin `role`, que se ve **blanco**) | El mismo texto («No pudimos cargar… Revise su conexión…») sale con dos aspectos y dos semánticas → §3 |
| `NotFoundCard`, `NotAdmin`, `Placeholder` | `editor-status.tsx:12-22`, `admin-shared.tsx:24-34`, `chrome.tsx:276-288` | `card` con h3 o h1, texto y botón. Botones distintos: `btn-soft`, `btn-ghost btn-lg` y `btn-soft` |
| Páginas de estado de la ficha (SSR, sin JS) | `shared/status-pages.tsx:8-68` | `card stack` con `h1.status-title`. Botones `btn-soft`, `btn-primary` y `btn-ghost` |

---

## 2. Valores sueltos frente a tokens y variables

### 2.1 Variables que hay hoy (`01-base.css:8-54`) y si cuadran con `tokens.json`

En total hay 82 propiedades personalizadas en los CSS de la app. Las del sistema están en `01-base.css:8-47` (claro) y `:48-54` (oscuro). Las de escritorio están en `13:103,118,596`.

| Variable | Valor | Token | ¿Cuadra? |
|---|---|---|---|
| `--bg`, `--surface`, `--surface-2`, `--fg`, `--muted`, `--line`, `--line-nav`, `--line-soft` | #FFFBF2, #FFF, #F6E7C8, #1C2B2A, #5C6B69, #E6DCC6, #EADFC8, #F0E6D2 | `color.bg/surface/surface2/fg/muted/line/lineNav/lineSoft` | Sí, en claro y en oscuro |
| `--brand`, `--brand-ink` | #B44C30 / #B44C30 | `color.brand` y `brandInk` 0.3.4 | Sí con los tokens. **No** con `diseno-v1.md:75,80`, que todavía dice terracota `#D65C3C` para el corazón y la pestaña activa |
| `--primary`, `--primary-on`, `--selection`, `--state-soft`, `--state-ink`, `--sun*`, `--review-soft`, `--overlay`, `--wa`, `--wa-ink`, `--bad`, `--bad-soft` | — | Los del mismo nombre | Sí |
| `--ok`, `--warn` | #2F5D45 / #C97A12 | `color.ok` y `warn` | Cuadran en claro, pero **no se usan** (0 apariciones) y no se redefinen en oscuro |
| `--selection-ink`, `--cal-free`, `--float-r-bar` | — | — | Definidas y **sin uso** |
| `--overlay-btn` | `rgba(255,251,242,.7)` | `overlayButton` #FFFBF2 (opaco) | **No**: el CSS sigue la decisión del 2026-10-29 (70 %) y el token no se actualizó |
| `--busy` / `--busy-ink` | #F5DDD4 / #9E3D22 | `calendarDay.busy` #F7E3D3 / #9A4B2A | **No** (las usan `badge-bad` y `state-bad`) |
| `--when-pick`, `--when-band`, `--cal-busy` | `color-mix` del terracota | `calendarDay.search.*` en hex | Son mezclas, no los hex de los tokens. Probablemente se cambiaron a propósito (changelog 0.2.2: «terracota del logo con mezclas») y el token se quedó en hex |
| `--chosen` (primario al 26 %) | — | `components.chip.active` = `selection` (salvia) | **No**: según la decisión del 2026-10-29 el tonal sustituye a la salvia; `chip.active` no se actualizó |
| `--beige-soft` (arena al 55 %) | — | `components.chip.inactive` = `surface2` | **No**, por el mismo motivo |
| Sin token: `--fg-title` #3E4A48, `--primary-ink` #1F4231, `--wa-icon` #1A9C55, `--ochre` #A85A00, `--surface-soft`, `--beige-soft`, `--chosen`, `--stay-band*` | — | — | Les falta el token |
| Radios `--r` 12, `--r-thumb` 10, `--r-tile` 12, `--r-input` 8, `--r-cta` 8, `--r-sheet` 16, `--float-r` 12 | — | `radius.*` | Sí. **No hay variable** para `radius.pill`/`buttonSmall` (6) ni para `chip`/`button` (8: se escribe `8px` 27 veces) |
| `--shadow`, `--shadow-float`, `--float-shadow` | — | `shadow.card`, `shadow.float`, `float.shadow` | Sí |
| `--gutter` 16 | — | `spacing.gutter` 16 | Sí. Pero `space.viewPaddingMobile` = 20 en el mismo archivo de tokens contradice `spacing.gutter` |
| `--w-strong` 600, `--w-medium` 500 | — | `font.display.weights` [600] | Sí. No hay variable para 400 (`--w-regular` se usa con respaldo en `13:722` y no está definida) |
| Usadas y **sin definir** | `--disabled-bg` (`09:108,112`), `--shadow-lift` (`06:49`), `--w-regular` (`13:722`) | — | Funcionan solo por el valor de respaldo. `--fill` y `--kb` las pone el JS (correcto) |
| Puntos de corte | 360, 399, 439, 760, 899/900, 1024, 1200 px y `max-height:700` | `breakpoints` 640 / 800 / 1000 | **No cuadran**: los tokens están desfasados respecto a `desktop.ts` (1024) y a los cortes de 900 |
| Ancho máximo de escritorio | `--page-max:1232px` más 2×16 de margen = 1264 (`13:596, 604`) | Decisión del 2026-11-13: «1280 px con márgenes» | Probablemente no cuadra (1264 frente a 1280) **(no comprobado)** |

### 2.2 Colores fuera de variables

Fuera de `:root` hay **26 hex (11 valores distintos)** y **26 rgb/rgba (19 distintos)**, sin contar los SVG en `data:`.

- `#FFFBF2` ×10, en lugar de `--primary-on` o `--bg`: `01:162` (`.pill`), `01:165`, `03:90` (`.toast`), `03:117`, `03:125`, `03:131`, `06:52`, `05:131`, `04:35`, entre otros.
- `#A3ADA6` ×3 (desactivado): `01:116`, `04:120`, `05:141`. Es el `--muted` del modo oscuro escrito a mano en claro.
- `#F2F1ED` ×3 y `#898D88` ×1 (desactivado del token): `01:140`, `09:108`, `09:112`.
- `#FFFFFF`/`#fff` ×3: `03:51`, `03:73`, `05:13` (el QR, justificado).
- `#000` ×2: `03:151` (máscara, justificado).
- `#25D366`: `03:29` (es un comentario).
- `#E9EFE4`: `03:115` (fondo de `.map-box`, que no es un token).
- `#1C2B2A`: `03:125`.
- `#B44C30`: `04:21` (comentario).
- En los SVG en `data:`: `%236B7280` (`10-ajustes.css:7`, un gris de Tailwind que no es de la paleta y no cambia en oscuro) y `%235C6B69` (`01:173`, el chevrón del select, que tampoco cambia en oscuro).
- rgba con la tinta `rgba(28,43,42,α)` con α = .10, .22 ×2, .25, .28, .35, .4, .45 ×2, .5, .55, .70, .82 y .92: en `03:74,128,138`, `04:31`, `05:98,131`, `06:49`, `07:9,12`, `09:121`.
- `rgba(0,0,0,.35)` ×5 (`03:50,117,131` y otros) y `rgb(0 0 0 / 32%)` ×2 (`13:80,444`). Hay **tres fondos de capa distintos**: `rgba(28,43,42,.35)` en `07:9` y el 32 % negro en `13:80,444`.
- `rgba(180,76,48,.6)`: `04:35` (el terracota en rgba).
- `rgba(255,251,242,.92/.7)`: `03:132-133`.

### 2.3 Tamaños de fuente

Hay **193 declaraciones con 21 tamaños distintos** y 5 más en `font:` abreviado (13, 15 y 16 px). La escala de los tokens tiene 13, 14, 15, 17, 18, 21, 24, 30, 34 y 50.

| px | Usos | ¿En la escala? | Ejemplos |
|---|---|---|---|
| 14 | 37 | sí (xs) | `01:75,105,115` |
| 16 | 26 (+4 en `font:`) | **no** | `01:99` (`.note`), `01:146` (`.chip`), `01:179` |
| 15 | 24 | sí (small) | `01:75,81,138` |
| 18 | 22 | sí (md) | `01:135-137` |
| 13 | 12 | sí (eyebrow) | `01:76,165`, `02:21` |
| 17 | 11 | sí (base) | `01:58,125`, `02:15` |
| 24 | 10 | sí (h2) | `01:61,104,178` |
| 20 | 10 | **no** | `01:177`, `02:75`, `03:14` |
| 19 | 8 | **no** | `01:62` (h3), `04:69,106` |
| 22 | 7 | **no** | `01:189`, `03:113`, `05:43` |
| 26, 23, 12, 30, 28, 11 | 3 cada uno | 30 sí, los demás **no** | `01:194`, `02:45`, `02:83`, `03:131`, `03:146`, `04:28` |
| 40, 21, 25 | 2 cada uno | 21 sí | `05:46`, `05:24`, `05:158` |
| 34, 32 | 1 cada uno | 34 sí (heroMobile) | `01:60`, `05:5` |

Pesos: `var(--w-medium)` ×83, `var(--w-strong)` ×24, `400` literal ×10, `500` literal ×4 (`01:163,179`, `09:14`) e `inherit` ×1. La segunda familia tipográfica, «Coming Soon» (`02:29-30`), solo se usa en las etiquetas de la barra de abajo.

### 2.4 Radios

Hay **150 declaraciones con 23 valores distintos**:

- `8px` literal ×27 (`01:138,141,146`, …).
- Con variable: `var(--r-input)` ×25, `var(--float-r)` ×13, `var(--r)` ×11, `var(--r-tile)` ×9, `var(--r-sheet)` ×7 (más 2 compuestos), `var(--r-cta)` ×4 y `var(--r-thumb)` ×1.
- `6px` literal ×12 (`01:165`, `03:109,121`).
- `0` ×11.
- `999px` ×9 (`01:156` `.badge`, `01:162` `.pill`, `03:113` `.avatar`, `05:98` `.state`, `05:122` `.tag-rev`, `10:99` contadores, `13:730,818` pastillas de cifras).
- `12px` literal ×4 (`05:146`, `09:13,41`) y 2 compuestos.
- `10px` ×3 (`03:7`, `05:110`, `06:66`; tendría que ser `--r-thumb`).
- `2px` ×3, `50%` ×2, `16px` ×1 (`05:145`), `3px` ×1 (`09:44`), `50% 50% 50% 0` ×1 (el pin).

### 2.5 Sombras

Hay **53 declaraciones con 23 valores distintos**:

- `none` ×13.
- Con variable: `var(--shadow)` ×9, `var(--shadow-float)` ×6 y `var(--float-shadow)` ×3.
- La sombra verde de las acciones, `0 2px 5px color-mix(--primary 14%)`, está **escrita dos veces** (`01:128`, `13:741`).
- El resto son de un solo uso:
  - `04:31`, `04:35` (precios del mapa).
  - `05:98` (`.state`).
  - `06:49` (foto levantada).
  - `07:12` (hoja).
  - `09:121` (panel del calendario).
  - `03:50`, `03:117` (puntos y pin).
  - `13:695` (moneda de escritorio).
  - Los anillos de foco hechos con sombra: `04:91`, `05:110`, `06:64`.

### 2.6 z-index

Hay **40 declaraciones con 18 valores distintos** y ninguna escala con nombre:

| Valor | Usos | Ejemplos |
|---|---|---|
| -1 | 2 | `13:373,624` |
| 0 | 1 | `03:126` |
| 1 | 10 | `03:129`, `04:56,62` |
| 2 | 4 | `06:49`, `09:91`, `13:478` |
| 3 | 1 | `09:87` |
| 4 | 1 | `04:8` (cabecera de Explorar) |
| 5 | 4 | `04:43,46,51` (`float-btn`, `map-label`, `map-full`) |
| 6 | 3 | `02:18,33,60` (tabbar, `sticky-actions`, `cta-bar`) |
| 7 | 1 | `06:86` (`update-banner`) |
| 9 | 1 | `09:121` (`cal-panel`) |
| 10 | 1 | `13:614` (`site-top-bar`) |
| 20 | 1 | `03:90` (toast) |
| 30 | 2 | `07:9`, `10:63` (capa y vista previa) |
| 31 | 3 | `03:156`, `07:10`, `10:64` (hoja, descripción y barra de la vista previa) |
| 500 | 2 | `06:32-33` (controles sobre Leaflet) |
| 600 | 1 | `10:5` |
| 1000 | 1 | `10:16` |
| 2147483647 | 1 | `12:11` (aviso de girar el teléfono) |

---

## 3. Divergencias concretas

| # | Dónde | Qué | Marca |
|---|---|---|---|
| D1 | `01-base.css:64` | El foco global es un `outline` de 2 px en `--sun` (#F2B544). He calculado el contraste con la fórmula WCAG: **1,77:1 sobre la crema** y 1,83:1 sobre el blanco, por debajo del 3:1 que pide un indicador de foco (1.4.11). Además hay anillos locales en verde (`01:203`, `04:30` de 3 px, `13:402`) y anillos con borde o sombra (`04:91`, `06:64`, `05:110`), así que hay **dos colores de foco** | **A CORREGIR** (sin medir en el navegador) |
| D2 | `01:156`, `01:162`, `05:98`, `05:122` | Las etiquetas (`.badge`, `.pill`, `.state`, `.tag-rev`) tienen radio 999 px. La decisión del 2026-10-29 (`decisiones.md:969`) y `tokens.radius.pill` dicen 6 px | **A CORREGIR**, o anotar en `decisiones.md` si Ana quiere píldora |
| D3 | `domain/listing.ts:78`, `domain/admin-houses.ts:59-66`, `domain/navigation.ts:52-59` | Tres tablas de etiquetas con textos distintos para el mismo estado («Pendiente de pago» frente a «Por pagar»; «Borrador» frente a «En edición») y dos familias de clases (`badge-*`, `state-*`) | **A CORREGIR** la estructura. Lo de admin («Por pagar», `admin-houses.ts:58`) puede estar JUSTIFICADO por el diseño 23, según su comentario |
| D4 | `explorar.tsx:260` frente a `explorar.tsx:400,490` y `favoritos.tsx:85` | El mismo error de carga sale rojo y con `role="alert"` en un sitio, y blanco y sin rol en los otros | **A CORREGIR** |
| D5 | `01:165`, `06:83`, `05:93`, `04:128` | Cuatro contadores con tamaños 13, 13, 12 y 13 px, colores `--brand-ink` y `--brand`, y posiciones distintas | **A CORREGIR** (unificarlos en uno) |
| D6 | `02:33` frente a `02:60` | La línea superior de `sticky-actions` va en `--line-nav` y la de `cta-bar` en `--line-soft` | **A CORREGIR** (salvo que fuera a propósito; no hay comentario) |
| D7 | `shell.tsx:159-168, 180-189` frente a `publish/wizard-parts.tsx:13-16` | Mientras carga, la cabecera de publicar es «X Cerrar + título»; la real es «título + X de 44 px», como pide `diseno-v1.md:33`. El esqueleto copia `SkeletonCard` en vez de usarlo | **A CORREGIR** |
| D8 | `filtros.tsx:101`, `publicar-entrada.tsx:253` | `.header-flow` escrita a mano en lugar de `FlowHeader`. Filtros necesita la X o la flecha y «Limpiar» | Filtros, **JUSTIFICADA** (`FlowHeader` no admite cerrar con un botón). `publicar-entrada.tsx:253`, sin flecha: **A CORREGIR** o usar `WizardHeader` |
| D9 | `01:96` | `.card-arena` pinta blanco opaco; el nombre engaña | **A CORREGIR** (renombrarla al migrar) |
| D10 | `03:89` | `.note-plain` repite lo que ya hace `.note` | **A CORREGIR** (sobra) |
| D11 | `01:116`, `04:120`, `05:141`, `09:108,112` | Desactivados con hex literal (`#A3ADA6`, `#F2F1ED`) y `--disabled-bg` sin definir | **A CORREGIR** (crear `--disabled-bg` y `--disabled-fg` desde `tokens.components.button.disabled`) |
| D12 | `13:677-682` | En escritorio, el desactivado es `color-mix(--muted 14%)` y no `#F2F1ED` | **JUSTIFICADA** (decisión del 2026-11-13, «el desactivado pasa a gris claro, también en modo oscuro»). El token `button.disabled` no está al día |
| D13 | `13:671-676` | En escritorio, `.btn-ghost` lleva contorno; en móvil va con fondo tonal | **JUSTIFICADA** (decisión del 2026-11-13) |
| D14 | `13:745`, `13:755-756` | Textos visibles generados por CSS: «Añadir casa» (el enlace se llama «Nueva casa», `propietario.tsx` `NewHouseLink`) y «Calendario» / «Consultas» según `href*=`. El nombre accesible no coincide con el texto visible (WCAG 2.5.3) y depende de la URL | **A CORREGIR** |
| D15 | `02:29-30` | La fuente «Coming Soon» en las etiquetas de la barra de abajo no está en los tokens ni en `diseno-v1.md` | **(no comprobado)**: buscar la decisión. Si existe, anotar el token; si no, **A CORREGIR** |
| D16 | `09:63` | El h1 de 28 px del Calendario (decisión de `decisiones.md:1314`) parece no tener efecto: en móvil el h1 es `sr-only` y en escritorio gana `13:662` (30 px) por especificidad | **(no comprobado)**. Probablemente es una regla muerta |
| D17 | `03:124-138` (`.soon*`) | Los estilos de la portada «Muy pronto» siguen en el CSS de la app, pero la portada carga `/portada/portada.css`, que define sus propias `.soon*`. No hay ningún `className` con `soon` en TSX | **A CORREGIR** (código muerto que pesa en el CSS de la app; confirmar que ninguna plantilla del worker lo usa) |
| D18 | Clases sin uso | `badge-warn`, `badge-sel`, `tile-arena`, `activity-h2`, `chip-strong`, `--cal-free`, `--ok`, `--warn`, `--selection-ink`, `--float-r-bar` y la regla vacía `05:124` | **A CORREGIR** (limpiar) |
| D19 | `shared/site-top-bar.tsx:9`, `shared/listing-page.tsx:33` | `shared/` importa `../client/desktop`. Hoy ese módulo solo importa `react` (`client/desktop.ts:1`), así que no arrastra nada privado a la ficha SSR | **JUSTIFICADA** por ahora. Moverlo a `shared/` deja clara la frontera |
| D20 | `site-top-bar.tsx` frente a `chrome.tsx:72-140` | La barra de escritorio está escrita dos veces | **JUSTIFICADA** (la ficha SSR no tiene router; comentario en `site-top-bar.tsx:1-5`), pero las dos copias pueden separarse con el tiempo → compartir la parte de presentación |
| D21 | `05:16-23`, `06:87-94`, `07:14-17`, `que-es-3bstays.css:13-17` | El margen lateral baja a 12 px (publicar, editar fotos, Ingresar, código, Consultas, hoja de contacto, Qué es) o a **3 px** (Cuenta con sesión, detalle de casa). `diseno-v1.md:55` pide 12 px exteriores en el detalle | Los 12 px, **JUSTIFICADOS** por las rondas de Ana. Los 3 px **(no comprobados)** frente al diseño: puede que cuadren con el padding interno de las tarjetas |
| D22 | `01:99` (`.note` 16 px), `01:146` (`.chip` 16 px) y otros 24 usos de 16 px | 16 px no está en `tokens.font.scale` | **A CORREGIR** en los tokens (añadir el 16 si es intencionado) o en el CSS |
| D23 | Títulos 19/20/21/22/23/25/26/28/32 px (§2.3) | Fuera de la escala | En parte **JUSTIFICADA** (`03:144-146`: 28 px para que quepa a 320 px; `decisiones.md:1314`). El resto, **A CORREGIR** al unificar |
| D24 | `03:7`, `05:110`, `06:66` (10 px literal); `05:71` (foto a 8 px); `que-es-3bstays.css:80` (sin radio) | Radios sueltos | **A CORREGIR** |
| D25 | `05:131` `rgba(28,43,42,.82)` frente a `--overlay` (.86); `03:90` `.toast` con `box-shadow:var(--shadow)` sobre fondo oscuro | Píldoras y avisos sobre foto con valores propios | **A CORREGIR** (usar `--overlay`) |
| D26 | `10:7`, `01:173` | Iconos SVG en `data:` con colores fijos (#6B7280 fuera de la paleta) que no cambian en modo oscuro | **JUSTIFICADA** en parte (CSP `img-src data:`, comentario en `10:6`). Cambiar `#6B7280` por `#5C6B69` **A CORREGIR** |
| D27 | `07:9` frente a `13:80,444` | Capa de la hoja en tinta al 35 % y diálogos de escritorio en negro al 32 % | **A CORREGIR** (un solo `--scrim`) |
| D28 | `docs/diseno-v1.md:75-80` frente a `tokens.json` 0.3.4 | La guía dice terracota #D65C3C para el corazón y la pestaña; los tokens y el CSS usan #B44C30. La guía dice tarjetas de 24 px en «Formas» (`:77`) y en la misma línea dice 12 px | **A CORREGIR** en la documentación |
| D29 | `05:97` | El comentario de `.state` menciona un punto que no existe | **A CORREGIR** (el comentario o el punto) |
| D30 | `.sheet:focus`, `.description-screen:focus` (`07:13`, `03:157`) con `outline:none` | Son contenedores que reciben el foco por programa (gestión de foco del diálogo) | **JUSTIFICADA** |
| D31 | `05:108` `.sub-house{outline:none}` | La casa resaltada con `#pago=` recibe el foco y se marca con un anillo verde solo si tiene `.is-target` | **(no comprobado)**: si se enfoca sin `.is-target`, no se ve el foco |

---

## 4. Propuesta de destino

Criterio: hacer componentes pequeños y tipados donde hoy hay copias o clases que hay que elegir a mano. No se propone un sistema de diseño universal. Las variantes son enumeraciones cerradas, nunca `className` libre. Todo se puede pintar en el servidor y sin estado salvo lo indicado, así que cabe en `shared/` y la ficha SSR lo puede usar sin traerse módulos privados.

### 4.1 Componentes y patrones

| Componente | Sustituye | Props tipadas (borrador) | Dónde |
|---|---|---|---|
| `<ScreenHeader kind="root" \| "flow" \| "wizard">` | `RootHeader`, `FlowHeader`, las `.header-flow` a mano y los esqueletos de `shell.tsx` | `title`, `back?: { to, search?, onBack?, historyBack? }`, `close?: { to \| onClick, label }`, `action?: ReactNode`, `aside?` | `client/chrome.tsx`. Es una sola cabecera de flujo con flecha **o** X; `WizardHeader` la compone. Resuelve D7 y D8 |
| `<Card tone="plain" \| "solid" \| "soft" \| "sun">` + `as` | `.card`, `.card-arena`, `.card-soft`, `.card-sun`, y la superficie copiada de `.listing-card` y `.steps-list` | `tone`, `padding?: "md" \| "lg"`, `as?: "section" \| "article"` | `shared/`. Renombra `card-arena` a `solid` (D9) |
| `<StatusTag status={…} placement="row" \| "photo">` | `.badge-*`, `.state-*`, `.tag-rev` y las tres tablas de `domain/` | `status: ListingStatus \| EditStatus \| Hold`; el texto sale de **una** tabla de dominio sin clases CSS (`domain/status-label.ts` → `{ text, tone: "ok" \| "pay" \| "review" \| "draft" \| "off" \| "bad" }`) | La tabla va en `domain/` (solo texto y tono) y el componente en `shared/`. Resuelve D2, D3 y D29 |
| `<Notice tone="info" \| "sun" \| "review" \| "error">` | `.note`, `note-*`, `note[role=alert]` | `tone`, `title?`, `children`, `action?`. `error` pone `role="alert"` sin que haya que elegirlo | `shared/`. Resuelve D4 y D10 |
| `<LoadError onRetry?>` | Las 4 copias del mensaje de error de carga | — | `client/`. Usa `<Notice tone="error">` |
| `<EmptyState title? text action?>` | `card > p.muted` (admin), `.fav-empty`, `p.small.muted`, `NotFoundCard`, `NotAdmin`, `Placeholder` | `framed?: boolean` (con tarjeta o sin ella) | `shared/`, porque las páginas de estado SSR también son estados vacíos o de error |
| `<Skeleton shape="row" \| "grid" \| "account">` | `SkeletonCard`, `SkeletonActivity`, `SkeletonGrid`, `SkeletonCards` y las copias de `shell.tsx` | `count?`, `label` (para `aria-label`) | `client/` |
| `<CountBadge n>` | `.count-badge`, `.nav-count`, `.house-inquiries-count`, `.badge-count` | `n`, `tone?: "brand" \| "primary"` | `shared/`. Resuelve D5 |
| `<ListRow>` dentro de `<List>` | `.list` / `.list-item` sueltos, `WhatsAppItem` | `icon?`, `title`, `detail?`, `to? \| onClick?`, `tone?: "sun"`, `disabled?` | `client/`. `FieldRow` y `.review-row` se quedan como composiciones específicas que usan `ListRow` por dentro |
| `<ClosedField>` (selector cerrado que abre algo) | `.search-fold`, `.picker-pill`, `.date-box` | `icon`, `label`, `value`, `expanded` | `client/`, tal como piden `diseno-v1.md:27,45` |
| `NavBar` (presentación pura) compartida por `TabsFrame` y `SiteTopBar` | Las dos barras de escritorio | `tabs`, `renderLink` (router o `<a>`), `counts?` | `shared/`. La lógica de sesión y de router se queda en cada lado (D20) |

### 4.2 Tokens y variables que faltan

- **Radios**: `--r-pill: 6px` (etiquetas) y `--r-control: 8px` (botones, chips y selectores; hoy hay 27 `8px` literales). Usar `--r-thumb` donde hay 10 px literales.
- **Color**:
  - Crear `--disabled-bg` y `--disabled-fg` (D11).
  - Crear `--scrim` (D27) y `--focus-ring` (D1).
  - Añadir a `tokens.json` las variables que hoy no tienen token: `--fg-title`, `--primary-ink`, `--wa-icon`, `--ochre`, `--surface-soft`, `--beige-soft` y `--chosen`.
  - Actualizar `overlayButton` (70 %), `chip.active` e `inactive` (tonal) y `calendarDay.busy`, o al revés.
  - Retirar `--ok`, `--warn`, `--cal-free` y `--selection-ink` si no se usan.
- **Foco**: un solo anillo global, `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`, con ≥3:1 sobre la crema y sobre el blanco. `--primary` (#2F5D45) da 7,33:1 sobre la crema (calculado). Los anillos locales (`04:30`, `01:203`, `13:402`) heredarían de ahí.
- **Tipografía**: una escala con nombre que el CSS use como variables (`--fs-xs` 14, `--fs-sm` 15, `--fs-note` 16 si se acepta, `--fs-base` 17, `--fs-md` 18, `--fs-title` 20 para el título de tarjeta, `--fs-h2` 24, `--fs-h1` 34 o 30 en escritorio). Cambiar `tokens.font.scale.h1` (30) para que cuadre con el h1 móvil de 34, o documentar que 30 es el de escritorio. Añadir `--w-regular: 400`.
- **z-index**: una escala con nombre, p. ej. `--z-raised` 1, `--z-float` 4–5, `--z-bar` 6, `--z-banner` 7, `--z-panel` 9, `--z-topbar` 10, `--z-toast` 20, `--z-scrim` 30, `--z-sheet` 31. Los 500, 600 y 1000 de Leaflet se quedan como excepción documentada.
- **Puntos de corte**: cambiar `tokens.breakpoints` por los reales (900 para la lista, 1024 para el marco de escritorio, que es el corte de `desktop.ts`, y 1200).
- **Espacios**: `--gutter-tight: 12px`, para no redefinir `--gutter` en cada pantalla. Resolver la contradicción `space.viewPaddingMobile` 20 frente a `spacing.gutter` 16.
- **Sombra de acción**: `--shadow-action`, porque el valor está escrito dos veces (`01:128`, `13:741`).

### 4.3 Excepciones

- **Ficha SSR (`shared/listing-page.tsx`, `shared/status-pages.tsx`)**: solo puede usar componentes de `shared/` sin estado, sin router y sin consultas privadas (`Card`, `Notice`, `StatusTag`, `EmptyState`, `CountBadge`, `NavBar` de presentación). `ScreenHeader` usa `Link` del router, así que **no** entra en la ficha; las páginas de estado siguen con enlaces `<a>` y sin JS.
- **Portada (`public/portada.html` + `public/portada/portada.css`)**: es HTML estático, sin JS (solo lleva JSON-LD), con sus propias variables (`--bg`, `--fg`, `--muted`, `--sun-soft`, `--sun-ink`, Outfit como `--display`; 18 hex, 10 `font-size`, radios 999 y 24, **sin estilo de foco propio**). No se proponen componentes. Como mucho, generar sus variables desde `tokens.json` en el build, y retirar del CSS de la app las `.soon*` que no se usan (D17).
- **Leaflet** (z 500/600/1000, `.leaflet-*`) y el aviso de girar el teléfono (z máximo): excepciones de capa documentadas.
- **Escritorio**: la mayoría de `13-escritorio.css` son reglas de composición (rejillas, `sticky`) y no tienen que ser componentes. Las que inventan aspecto (pastillas de cifras `13:730,818`, textos con `content:` `13:745,755-756`) se pasan a los componentes de arriba con una variante `layout="inline"`.

---

## 5. Cobertura

Leído: los CSS completos `01`–`08`, `10`–`13` y `que-es-3bstays.css`; `09-calendario.css` solo en los valores (radio, sombra, fuente, z y color). Los TSX: `chrome.tsx`, `shell.tsx` (rutas y esqueletos), `site-top-bar.tsx`, `status-pages.tsx`, `icons.tsx`, `listing-card.tsx`, `house-card.tsx`, `owner-ui.tsx`, `admin-shared.tsx`, `editor-status.tsx`, y fragmentos de `propietario.tsx`, `casa-editable.tsx`, `explorar.tsx`, `favoritos.tsx`, `actividad.tsx`, `filtros.tsx`, `publicar-entrada.tsx`, `publish/wizard-parts.tsx`, `suscripcion.tsx` y `admin-anuncios.tsx`. Ninguna pantalla se ha abierto en el navegador.

| Ruta (shell.tsx) | Marco | Revisión |
|---|---|---|
| `/` (redirección), `/propietario`, `/propietario/consultas` (redirecciones) | — | Sin interfaz |
| `/que-es-3bstays` | Tabs | CSS completo; TSX solo el h1 |
| `/explorar` | Tabs, cabecera propia | CSS completo; TSX: esqueleto, errores y vacíos |
| `/explorar/filtros` | Tabs | Cabecera y filas |
| `/explorar/buscar` | Flow | CSS completo; TSX: vacíos (`buscar.tsx:190-191`) |
| `/favoritos` | Tabs (sin barra) | Cabecera, vacío, error y esqueleto |
| `/propietario/casas` (lista y una casa) | Tabs | `NoticeCard`, `HouseCard`, `NewHouseLink`, cabeceras |
| `/propietario/calendario` | Tabs | Solo el CSS de valores; TSX: el uso de `RootHeader` |
| `/propietario/actividad` | Tabs | Tarjeta de consulta, esqueleto y vacío |
| `/cuenta` (con y sin sesión) | Tabs o Flow (`cuenta.tsx:27-49`) | Filas de la lista; perfil sin leer a fondo |
| `/cuenta/codigo`, `/cuenta/lista`, `/cuenta/recuperar`, `/ayuda` | Flow | Solo el uso de `FlowHeader` y `.flow-title`; **recuperar y ayuda no revisados a fondo** |
| `/publicar`, `/publicar/$id/$paso`, `/publicar/verificar`, `/publicar/continuar`, `/propietario/publicar(/…)` | Flow | `WizardHeader`, esqueletos y CSS completo; los pasos uno a uno **no revisados** |
| `/propietario/casas/$id` (detalle editable) | Flow (Tabs en escritorio) | `FieldRow`, avisos y CSS |
| `/propietario/casas/$id/airbnb`, `/enviada`, `/correo`, `/editar/$campo` | Flow | Avisos de `airbnb.tsx:116-126`; enviada por el CSS; correo con su cabecera; **editar no revisado a fondo** |
| `/propietario/suscripcion` | Flow | Etiquetas y filas (`suscripcion.tsx:466-524`) |
| `/admin`, `/admin/casas`, `/admin/borradores`, `/admin/usuarios` | Tabs | Cabeceras, `QueueCard`, filas, vacíos y la variante `adminSoon` |
| `/admin/codigo`, `/admin/anuncios/$id`, `/admin/ediciones/$id`, `/admin/casas/$id(/editar, /publicar, /calendario)` | Flow | Cabeceras y etiquetas; el contenido de revisión **no revisado a fondo** |
| `/casa/$publicId` (SSR) | Propio (`listing-page.tsx`) | Importaciones, cabecera, etiquetas y CSS de la ficha (`03`, `10:70-96`, `13:700-722`) |
| Páginas de estado de la ficha | Propio | Completo (`status-pages.tsx`) |
| «No encontrada» (`notFoundComponent`) | Tabs | Completo |
| Portada estática | — | `portada.html` y recuento de `portada.css` (36 líneas) |
| Escritorio (≥1024) | `desktop-app` / `site-top-bar` | `13-escritorio.css` completo |

Quedan por comprobar en el navegador, en la vista Móvil y en escritorio: D1 (medir el foco de verdad), D15, D16, D21, D31 y el aspecto final de D4 y D14.
