# Historia 07 · Inventario: superficies superpuestas

Fecha: 2026-11-19. Solo lectura del código de `apps/app/src` (rama `mapa-sin-resultados`). No he ejecutado la app, ni pruebas, ni builds. Lo marcado **[no comprobado]** sale de leer el código y hay que verlo en el navegador.

Referencias: `docs/diseno-v1.md` (hoja inferior: línea 77; hoja de contacto: 92; selector de casa: 45; Eliminar casa: 111), `design/tokens/tokens.json` (`radius.sheet` = 16, `shadow.float`, bloque `float`). Corte de escritorio: `(min-width: 1024px)` en `client/desktop.ts:4` y en `styles/13-escritorio.css:2`.

## 0. Hoy hay cinco mecanismos

| Mecanismo | Dónde está | Qué da |
|---|---|---|
| **A. `usePrivateSheet`** (`client/private-sheet.ts:4-50`) encima de **`useModal`** (`shared/modal.ts:5-16`) + `createPortal` a `<body>` + `.sheet-backdrop` + `<section class="sheet" role="dialog" aria-modal="true">` | ConfirmSheet, CloseSheet, MarkSheet, ContactSheet, HousePickerSheet, ConnectSheet (Airbnb), HouseSheet (admin) | Añade `html.sheet-open` (bloquea el scroll, `07-contacto.css:8`), pone `#root.inert`, enfoca la hoja al abrir, Escape, trampa de Tab y una función opcional `returnFocus`. Clic en el fondo: cada componente lo cablea a mano. |
| **B. `<dialog>` nativo con `showModal()`** | WhatsAppDialog (Ingresar/Verificar), InquiriesDialog, EditPhotosDialog, DesktopFilters | Capa superior, inercia nativa, Escape con `cancel`, `::backdrop` propio. No bloquea el scroll del fondo, no anima. El clic en el fondo solo cierra en DesktopFilters. |
| **C. Pantalla completa a mano** | DescriptionScreen (`shared/listing-description.tsx:60-104`), FichaPreview (`client/publish/fields.tsx:388-409`), MapScreen (`client/explore-map-full.tsx:20-75`) | Cada una a su manera (ver la tabla). |
| **D. Paneles y desplegables no modales** | PickerPopover (`client/house-picker.tsx:120-176`, API `popover="manual"`), paneles Lugar/Fechas/Noches de `DesktopSearch` (`client/screens/explorar.tsx:49-149`), combobox de zona (`client/screens/buscar.tsx:144-176`, `client/publish/place-search.tsx:130-147`) | Cierran con Escape y con un clic fuera (pointerdown), cada uno con su propio código. |
| **E. Avisos sin React** | `toast()` (`shared/toast.ts:2-9`), UpdateBanner (`client/update-banner.tsx:9-21`) | `role="status"` y posición fija sobre `--chrome-bottom`. |

## 1. Tabla de superficies

Abreviaturas: Esc = Escape; Fondo = clic en el fondo; X = botón cerrar; Atrás = botón Atrás del navegador o del teléfono.

| # | Superficie | TSX | CSS | Usos (pantallas) | Mecanismo | Cierre | Foco | aria | Tamaño móvil / escritorio | Animación |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **ConfirmSheet** (confirmación genérica) | `client/confirm-sheet.tsx:8-80` | `07-contacto.css:9-22`; escritorio `13-escritorio.css:19-25,43-56`; `.sheet-line` `05-cuenta-propietario.css:186-187` | Eliminar casa (`delete-house.tsx:80`), Descartar borrador (`propietario.tsx:45`), Descartar cambio en revisión (`casa-editable.tsx:167`), Parar suscripción (`suscripcion.tsx:216`), Cerrar sesión (`cuenta-profile.tsx:177`), Desconectar Airbnb (`airbnb.tsx:138`), Revocar enlace iCal (`ical-export-card.tsx:151`) | A | Esc, Fondo, botón Cancelar. Mientras `pending` no cierra (`:38,57`). Atrás: no la cierra (sale de la pantalla) | Enfoca la hoja; Tab queda entre los botones (`trapEmpty`). Al cerrar vuelve a quien la abrió; tras confirmar, o si ese botón ya no existe o está desactivado, va a `returnFocus` o a `main h1` (`:41-48`) | `role=dialog`, `aria-modal`, `aria-labelledby` y `aria-describedby` con `useId`, `aria-busy`, error con `role=alert` | Móvil: hoja inferior al 100 %, máx. 560 px y `100dvh-24px`, esquinas 16 arriba. Escritorio: centrada, `min(520px,100%-32px)`, padding 24, borde, `--shadow-float`, sin asa | Entra con `sheet-in` en 280 ms `--ease-drawer` (sube desde abajo); con movimiento reducido o en escritorio, `fade-in`. Fondo con `fade-in` 200 ms. Sin animación de salida |
| 2 | **CloseSheet** («Pausar la casa») | `client/close-sheet.tsx:13-68` | igual que 1 | Calendario (`calendario.tsx:456`) | A | Esc, Fondo, Cancelar (`popup-cancel`) | Trampa entre botones e inputs. **No pasa `returnFocus`**: el foco lo devuelve el que la abre (`calendario.tsx:395`) | `aria-labelledby="close-title"` con id fijo | igual que 1 | igual que 1 |
| 3 | **MarkSheet** («Marcar una reserva») | `client/mark-sheet.tsx:20-86` | igual que 1 y `.mark-calendar` `07-contacto.css:47` | Calendario (`calendario.tsx:369`, dentro de `SheetBoundary` `:483` con un `Suspense` cuyo fallback es `.sheet-backdrop`) | A | Esc, Fondo, Cancelar | Como 2; lo devuelve `calendario.tsx:335-344` | `aria-labelledby="mark-title"` y `aria-describedby="mark-hint"`, ids fijos | igual que 1 | igual que 1 |
| 4 | **ContactSheet** (hoja de contacto) | `shared/contact-sheet.tsx:139,226-384` | `07-contacto.css:8-56`; en línea en escritorio `13-escritorio.css:7-18,721` | Ficha SSR y SPA `/casa/$publicId` (`listing-page.tsx:130`); botón WhatsApp de las tarjetas de Explorar, Favoritos y el mapa (`card-whatsapp.tsx:55`) | A. En escritorio, en la ficha, **no es modal**: `inline` va dentro de la barra lateral (`listing-page.tsx:107`) | Esc, Fondo, X. Al cerrar guarda lo escrito (`:134-137`). Atrás no la cierra **[no comprobado: en la ficha SSR, Atrás sale de la ficha]** | Trampa (`FOCUSABLE` `:47`). El foco lo devuelve el padre después de desmontar (`listing-page.tsx:79`, `card-whatsapp.tsx:26-31`) | `aria-labelledby="contact-title"`, id fijo | Móvil: hoja; con teclado añade `.kb`, 320 px abajo (`07-contacto.css:19`). Escritorio desde tarjetas: centrada a 520 px (regla 1). En la ficha de escritorio: estática en la barra | Igual que 1. Mientras carga el trozo, el fallback ya es un `.sheet-backdrop` |
| 5 | **HousePickerSheet / PickerPopover** (selector de casa o zona) | `client/house-picker.tsx:13-176` | `09-calendario.css:69-73`; desplegable `13-escritorio.css:26-41` | Consultas (`actividad.tsx:113`), Calendario (`calendario.tsx:154`), zona del paso Ubicación (`publish/zone-select.tsx:26`) | Móvil: A. Escritorio: D (`popover="manual"`). La zona usa la hoja **también en escritorio** (`desktop = useDesktop() && !zone`, `:23`) | Hoja: Esc, Fondo, X. Desplegable: Esc, clic fuera (captura), perder el foco (`:164-166`) | Hoja: trampa; el foco vuelve solo si quedó en `body` (`:96-98`). Desplegable: enfoca la opción elegida; vuelve al disparador con Esc o al elegir | Disparador: `aria-haspopup` listbox o dialog, `aria-expanded`, `aria-controls`. Lista `role=listbox/option`, flechas, Inicio y Fin | Hoja: la de 1, pero **excluida del centrado de escritorio** (`13-escritorio.css:43`) → el selector de zona en escritorio queda como hoja inferior **[no comprobado]**. Desplegable: ancho del disparador, alto ≤ 320 | Hoja: `sheet-in`. Desplegable: ninguna |
| 6 | **ConnectSheet** (Conectar o sustituir Airbnb; en escritorio, ventana «Calendarios de Airbnb») | `client/screens/airbnb.tsx:144-200` | Ventana ancha `13-escritorio.css:57-67` | `/propietario/casas/$id/airbnb`; en escritorio, ventana desde la fila del Calendario (`airbnb-calendar-row.tsx:70,98`) | A | Esc, Fondo y X, salvo mientras `saving`; Cancelar solo en la hoja normal | Trampa; vuelve a quien la abrió (`:150`) | `aria-labelledby="airbnb-connect-title"` | Escritorio, ventana: `min(920px,100%-48px)` con dos columnas | Igual que 1 |
| 7 | **HouseSheet** (admin, acciones de una casa) | `client/screens/admin-casas.tsx:143-...` (portal `:194`) | igual que 1 | `/admin/casas` (`admin-casas.tsx:94`) | A, con modos internos (detalle, pausar, bloquear, eliminar) dentro de la misma hoja | Esc, Fondo, X | Trampa con enlaces y textarea; vuelve a la fila | **`aria-label`** con el título, aunque hay un `<h2>` visible (`:197`) | Igual que 1 | Igual que 1 |
| 8 | **WhatsAppDialog** (Ingresar o Verificar en escritorio) | `client/whatsapp-dialog.tsx:8-42` | `13-escritorio.css:69-81,817` (**solo dentro de la media query de escritorio**) | Barra de escritorio «Ingresar» (`chrome.tsx:122,156`); asistente de escritorio antes de las fotos (`publish/step-form.tsx:275,327`, solo si `groupSteps`, es decir escritorio) | B | Esc (`onCancel`) y X. **Sin Fondo**. Atrás: no | Inercia y foco nativos del `<dialog>`. `onClose` desmonta sin llamar antes a `close()` (`:21,31`) → el foco vuelve a «Ingresar» solo si el navegador lo hace al quitar el elemento **[no comprobado]** | `aria-label` («Ingresar» o «Verificar WhatsApp») | `min(520px,100%-32px)`, padding `16 24 24` | Ninguna |
| 9 | **InquiriesDialog** (Consultas en escritorio) | `client/screens/actividad.tsx:39-64` | `13-escritorio.css:412` + `.whatsapp-dialog` | Barra de escritorio (`chrome.tsx:128,151`) | B | Esc y X (`close()` y después `onClose`). Sin Fondo | Nativo; `close()` devuelve el foco | **`aria-label="Consultas"`** con un `<h2>` visible al lado | 520 px (hereda `.whatsapp-dialog`) | Ninguna |
| 10 | **EditPhotosDialog** (fotos de una casa publicada, escritorio) | `client/screens/editar.tsx:95-121` | `13-escritorio.css:82-95` | Ficha editable de escritorio, píldora «N fotos» (`casa-editable.tsx:320,369`) | B + `createPortal` | Esc, X y «Listo» (`editar.tsx:290`). Sin Fondo | Nativo; `close()` | `aria-labelledby` con `useId` | `min(960px,100%-48px)` × `100dvh-48px`; pie fijo abajo a la derecha | Ninguna |
| 11 | **DesktopFilters** (Filtros en escritorio) | `client/screens/filtros.tsx:304-323` | `13-escritorio.css:432-448` | Explorar de escritorio con zona elegida (`explorar.tsx:211,225-229`) | B | Esc (`close` nativo), **Fondo** (`:316`) y las acciones del formulario | Nativo | `aria-label="Filtros"` | `min(640px,100%-32px)`, padding 0 y el contenido con 20 | Ninguna |
| 12 | **DescriptionScreen** («Ver más» de la descripción) | `shared/listing-description.tsx:60-104` | `03-casas.css:156-162` | Ficha `/casa` (SSR y SPA) | C: portal y `useModal` sin hook de foco; **añade una entrada al historial** | Esc, flecha y **Atrás** (`pushState` + `popstate`, `:66-73`) | Enfoca la pantalla; Tab siempre a la flecha. Vuelve a «Ver más» desde el padre (`:28-32`) | `aria-labelledby="description-title"`; disparador `aria-haspopup="dialog"` y `aria-expanded` | Pantalla completa; desde 760 px, columna de 640 | `screen-in` 280 ms (sube); con movimiento reducido, `fade-in` |
| 13 | **FichaPreview** (vista previa en el asistente) | `client/publish/fields.tsx:388-409` | `10-ajustes.css:63-64` | Asistente de publicar (`fields.tsx:382`) | C: portal y `html.sheet-open` a mano, **sin `inert` ni trampa** | Esc (listener en `document`) y «Cerrar» | `autoFocus` en «Cerrar». Sin trampa ni retorno del foco | `role=dialog`, `aria-modal`, `aria-label` | Pantalla completa (z 30) | Ninguna |
| 14 | **MapScreen** (mapa a pantalla completa, solo móvil) | `client/explore-map-full.tsx:20-75` | `04-explorar.css:51-64`; escritorio `13-escritorio.css:582-583` | Explorar con `?mapa=1` (`explorar.tsx:286,330-341,436`) | C: `inert` en los hermanos y `html.map-open`. **No es `role=dialog`** | «Ver lista · N casas» y **Atrás** (la URL es el estado). **Sin Esc** | Enfoca «Ver lista» al abrir; vuelve a «Mapa» o a la caja (`explorar.tsx:292-301`) | Ninguno | `inset:0` menos la barra de pestañas | Ninguna (la tarjeta del marcador entra con `fade-in`) |
| 15 | **MapCard** (tarjeta del marcador) | `client/explore-map-full.tsx:80-109` | `04-explorar.css:64` | Mapa móvil; en el mapa de escritorio, con X (`explorar.tsx:364`) | Tarjeta flotante, no modal | X (`onClose`) en escritorio, tocar el mapa en móvil | Ninguno | El X lleva `aria-label` | ancho del mapa, máx. 536 | `fade-in` 160 ms |
| 16 | **Paneles de DesktopSearch** (Lugar, Fechas, Noches) | `client/screens/explorar.tsx:66-140` | `13-escritorio.css:544-578` | Explorar de escritorio | D | Esc (vuelve al disparador), pointerdown fuera, «Aplicar» o «Quitar» | Al aplicar o con Esc, al disparador; con clic fuera, no | Disparador `aria-expanded` y `aria-controls`; panel `section aria-label` | Lugar 400 px; Fechas al ancho del grupo; Noches 360 | Ninguna |
| 17 | **Editor de un dato en línea** (escritorio) | `client/screens/casa-editable.tsx:343-358`; `client/screens/editar.tsx:91-93,233-246` | `.house-inline-editor` / `.owner-detail-panel` en 13-escritorio **[no localizado línea a línea]** | Ficha editable de escritorio | Fila que se abre en su sitio, **no es una superficie superpuesta** (la 06 la convertirá en popup) | X «Descartar cambios» (`editar.tsx:239`) o Guardar. Abrir otra fila sustituye la abierta (`casa-editable.tsx:348`) | Ninguno | Botón de la fila `aria-expanded={false}` fijo (`casa-editable.tsx:109`) | Columna derecha | Ninguna |
| 18 | **toast** | `shared/toast.ts:2-9` | `03-casas.css:90` | ~15 llamadas: favoritos, Airbnb, eliminar casa, guardar un dato, calendario, admin, iCal… | E: `div` en `body`, se quita a los 4 s | Solo con el tiempo | Ninguno | `role=status` creado ya con el texto **[no comprobado que el lector lo anuncie]** | `fit-content`, máx. 420, sobre `--chrome-bottom` | `fade-in` 160 ms; sin salida |
| 19 | **UpdateBanner** | `client/update-banner.tsx:9-21` | `06-publicar.css:86`; `08-movimiento.css:18-19`; `09-calendario.css:149` | Toda la app menos el asistente (`shell.tsx:67`) | E | No se cierra: «Actualizar» o nada | Ninguno | `role=status` | `100%-32px`, máx. 528 | Entrada con `@starting-style` (sube 8 px y se funde) |
| — | **Galería del hero** | `shared/hero-gallery.tsx:10-58` | — | Ficha | **No es una superficie**: carrusel en la página. **No existe visor de fotos a pantalla completa** en la app | — | — | — | — | — |

## 2. Divergencias

### Cierre

1. **El clic en el fondo cierra unas sí y otras no.** Las hojas A sí cierran (`confirm-sheet.tsx:57`, `close-sheet.tsx:28`, `contact-sheet.tsx:379`…) y DesktopFilters también (`filtros.tsx:316`). WhatsAppDialog, InquiriesDialog y EditPhotosDialog no (`whatsapp-dialog.tsx:19`, `actividad.tsx:52`, `editar.tsx:108`). **A CORREGIR**: una regla por variante. Propuesta: no cerrar con el fondo cuando puede perderse trabajo (Ingresar a mitad del código, fotos subiendo).
2. **Atrás del navegador.** Solo DescriptionScreen (`listing-description.tsx:66-73`) y el mapa (`explorar.tsx:330-341`, por URL) lo atienden. En las hojas móviles (contacto, confirmaciones, Pausar, Marcar) Atrás deja la pantalla con la hoja abierta. **A CORREGIR** en móvil, al menos en la hoja de contacto y en los selectores. **[no comprobado en el teléfono]**
3. **El mapa a pantalla completa no cierra con Escape** (`explore-map-full.tsx`: no escucha teclas). **JUSTIFICADA** en parte: solo existe en móvil, aunque un teclado Bluetooth lo echaría en falta. Prioridad baja.
4. **FichaPreview escucha Escape en `document`** (`fields.tsx:390`), no en su elemento. Si hubiera otra superficie abierta encima, las dos se cerrarían. **A CORREGIR** al adoptar el sistema común.
5. **Cerrar mientras se guarda.** ConfirmSheet (`:38`) y ConnectSheet (`airbnb.tsx:148`) lo bloquean. HouseSheet no lo bloquea durante `act.isPending` (`admin-casas.tsx:149-150`, `onClose` directo) **[no comprobado]**. EditPhotosDialog no lo bloquea mientras sube fotos **[no comprobado; la cola de fotos puede seguir sola]**. **A CORREGIR**: la opción `busy` debe ser común.

### Foco

6. **Hay tres formas de devolver el foco**: `returnFocus` del hook (ConfirmSheet, ConnectSheet, HouseSheet, HousePickerSheet, con tres variantes distintas: `confirm-sheet.tsx:41-48`, `airbnb.tsx:150`, `admin-casas.tsx:153-155`, `house-picker.tsx:96-98`); un efecto en el padre tras desmontar (`listing-page.tsx:79`, `card-whatsapp.tsx:26-31`, `listing-description.tsx:28-32`, `calendario.tsx:335-344,395`); o el `<dialog>` nativo. **A CORREGIR**: un solo punto, en el sistema común, que vuelva al disparador después de quitar `inert`. El comentario de `card-whatsapp.tsx:26` explica por qué hay que hacerlo tras desmontar, y esa es la razón para centralizarlo.
7. **WhatsAppDialog no llama a `close()` antes de desmontar** (`whatsapp-dialog.tsx:21,31`; compárese con `actividad.tsx:42-45`). Que el foco vuelva a «Ingresar» depende del navegador. **A CORREGIR [no comprobado]**.
8. **FichaPreview no atrapa el foco y no pone `#root` inerte** (`fields.tsx:388-409`): con Tab se llega al asistente que queda debajo, aunque se lea como `aria-modal`. **A CORREGIR**.
9. **MapScreen pone `inert` en sus hermanos** (`explore-map-full.tsx:53-58`), no en `#root`, y no es `role=dialog`. **JUSTIFICADA**: está dentro de `#root` porque la lista sigue montada debajo y conserva su posición. Aun así le faltaría `aria-label` o un rol de región **[a decidir]**.
10. **ContactSheet, CloseSheet y MarkSheet no pasan `returnFocus`** y dependen del padre (ver 6). Hoy funciona, pero cada nuevo usuario tiene que acordarse. **A CORREGIR** con 6.
11. **La trampa de Tab se escribe a mano en cada sitio con un selector distinto** (`"button"`, `'button:not([disabled]), input:not([disabled])'`, `'button:not(:disabled), a[href], textarea, input'`, `…:not([tabindex="-1"])`, y `'…textarea'` sin `:not([disabled])`). **A CORREGIR**: un selector común de enfocables y `trapEmpty` como valor por defecto.

### Aria

12. **`aria-label` donde hay un título visible**: HouseSheet (`admin-casas.tsx:197`), InquiriesDialog (`actividad.tsx:52`), WhatsAppDialog (`:19`). Las demás usan `aria-labelledby`. **A CORREGIR**: siempre `aria-labelledby` al título del slot de cabecera.
13. **Ids fijos** (`close-title`, `mark-title`, `contact-title`, `airbnb-connect-title`, `description-title`) frente a `useId` (ConfirmSheet, HousePicker, EditPhotos). Dos hojas de contacto a la vez son imposibles, pero `contact-title` también vive en la ficha de escritorio en línea **y** en la hoja que se abre desde una tarjeta **[no comprobado si coinciden en la misma página]**. Además, `07-contacto.css:15-16` selecciona por `[aria-labelledby="contact-title"]`. **A CORREGIR**: `useId` y una clase de variante en vez de un selector por atributo aria.
14. **`aria-expanded={false}` fijo** en el botón de editar un dato (`casa-editable.tsx:109`). **A CORREGIR** en la 06 (pasará a `aria-haspopup="dialog"`).

### Estilos copiados y z-index

15. **Dos sistemas visuales de ventana en escritorio**: `.sheet[aria-modal]` centrada (`13-escritorio.css:43-56`: 520, padding 24, `--shadow-float`, `fade-in`) frente a `.whatsapp-dialog`/`.desktop-filters-dialog` (`:69-80`, `:432-444`: 520 o 640, padding 16/24 o 0, **sin sombra**, sin animación). Hay **dos colores de fondo**: `.sheet-backdrop` `rgba(28,43,42,.35)` (`07-contacto.css:9`) y `::backdrop` `rgb(0 0 0 / 32%)` (`13-escritorio.css:80,444`). **A CORREGIR**: un token `--scrim` y una sola clase de ventana.
16. **`.whatsapp-dialog` hace de clase base** de Consultas y Fotos (`actividad.tsx:52`, `editar.tsx:108`) aunque no tienen que ver con WhatsApp. **A CORREGIR**: renombrar a `.dialog` con modificadores.
17. **Anchos sueltos**: 560 (hoja móvil), 520 (ventana), 640 (filtros), 920 (Airbnb), 960 (fotos), 400/360 (paneles), 420 (toast), 528 (banner), 536 (tarjeta del mapa). **A CORREGIR**, en parte: dos tamaños de ventana (`normal` ≈ 520–560 y `wide` ≈ 920–960) y cada panel con el suyo.
18. **z-index sueltos sin escala**: `.explore-top` 4, `.float-btn`/`.map-label`/`.map-full` 5, `.update-banner` 7, `.cal-panel` 9, `.site-top-bar` 10, `.toast` 20, `.sheet-backdrop` y `.ficha-preview` 30, `.sheet`/`.description-screen`/`.preview-bar` 31, Leaflet 500/600/1000 (`06-publicar.css:32-33`, `10-ajustes.css:5,16`), `.rotate-notice` 2147483647. **A CORREGIR**: variables `--z-float`, `--z-bar`, `--z-toast`, `--z-overlay`. Leaflet y `.rotate-notice` **JUSTIFICADOS**.
19. **El toast (z 20) queda debajo de cualquier hoja (30/31) y de la capa superior del `<dialog>`.** Pasa cuando se avisa con la hoja abierta: HouseSheet tras pausar o bloquear sigue abierta y lanza toast (`admin-casas.tsx:174-176`); en la ventana de Airbnb en escritorio, el aviso «Airbnb conectado» sale sin cerrar la ventana (`airbnb.tsx:106-108`). **A CORREGIR [no comprobado en pantalla]**: o bien el toast va por encima de la capa de superposición (con una capa superior o un popover), o bien se avisa dentro de la hoja.
20. **El radio de la hoja** está en 16 en tokens y CSS (`tokens.json` `radius.sheet`, `--r-sheet` en `01-base.css:26`), y en `docs/diseno-v1.md:77` sigue diciendo «28 px arriba». **JUSTIFICADA**: manda el token más reciente (0.2.2). El documento está desactualizado; habría que corregirlo en la propia historia.
21. **`.listing-contact-inline.sheet`** (`13-escritorio.css:7-18`) reutiliza la clase `.sheet` y anula su posición para ponerla en la barra. **JUSTIFICADA** porque comparte los estilos internos de `.sheet …` (`07-contacto.css:20-55`). Con el sistema común convendría separar el cuerpo de la hoja de contacto de su contenedor.
22. **Reglas de escritorio para `.map-full`** (`13-escritorio.css:582-583`), aunque `mapOpen` exige `!desktop` (`explorar.tsx:286`). **Posible CSS muerto [no comprobado]**.
23. **Sin animación de salida** en ninguna superficie: se desmontan de golpe. Los `<dialog>` tampoco tienen entrada. **A CORREGIR** solo la entrada de los `<dialog>`, por coherencia. La salida, **JUSTIFICADA** por los presupuestos (toque < 50 ms) **[a decidir con Ana]**.

### Botones del pie

24. **Los botones destructivos no siguen una regla**: `btn-outline-bad` en Eliminar casa, Descartar borrador y Descartar cambio (`delete-house.tsx:90`, `propietario.tsx:49`, `casa-editable.tsx:171`); `btn-danger` lleno en Desconectar Airbnb y Revocar enlace (`airbnb.tsx:139`, `ical-export-card.tsx:152`); `btn-ghost` en Cerrar sesión (`cuenta-profile.tsx:181`); y en escritorio, Parar suscripción usa el estilo de **texto** de Cancelar mientras «Mantener suscripción» va primero y relleno (`suscripcion.tsx:219-222`). **A CORREGIR**: una variante `tone="destructive"` con una sola clase. Que la acción segura vaya primero en Parar suscripción puede estar **JUSTIFICADO** (retención), pero tiene que ser una opción explícita y no un juego de clases.
25. **«Cancelar» cambia según la superficie**: `.popup-cancel` (en escritorio pasa a texto, `13-escritorio.css:19-25`) en ConfirmSheet, CloseSheet, MarkSheet, Connect e iCal en línea; `btn-link muted logout-cancel` en Cerrar sesión; sin Cancelar (solo X) en contacto, selector, HouseSheet y los `<dialog>`. Además, ConfirmSheet omite `popup-cancel` cuando `cancelFirst` (`confirm-sheet.tsx:51`). **A CORREGIR**: el pie del sistema decide el aspecto de Cancelar por variante.
26. **Confirmación anidada evitada a mano**: dentro de la ventana de Airbnb, Revocar se confirma en línea (`ical-export-card.tsx:143-150`) porque `useModal` no admite superposiciones apiladas (al cerrar la interior quitaría `sheet-open` e `inert` a la exterior, `modal.ts:11-14`). **JUSTIFICADA** hoy. El sistema común debería **contar** las superficies abiertas (pila) para poder apilar una confirmación dentro de un popup de la 06.
27. **Eliminar en el admin** se confirma dentro de la HouseSheet, cambiando de modo, con motivo y texto de confirmación (`admin-casas.tsx:145-190`), no con ConfirmSheet. **JUSTIFICADA**: necesita formulario.

### Cambios sin guardar

28. **No hay protección contra cambios sin guardar en ningún sitio** (ni `beforeunload` ni `useBlocker`). En escritorio, abrir otra fila o tocar X descarta lo escrito sin preguntar (`casa-editable.tsx:345-348`, `editar.tsx:239`). La hoja de contacto sí guarda el borrador (`contact-sheet.tsx:134-137`). **JUSTIFICADA por la regla vigente** («Volver sin guardar no guarda nada», `editar.tsx:6`), pero **es una decisión pendiente para la 06**: en un popup, Esc o un clic en el fondo hacen fácil perder lo escrito. Propuesta en el §3.

## 3. Propuesta de destino

Sin abstracción universal: **un hook de comportamiento**, **dos contenedores** y **unas pocas variantes con nombre**. Los desplegables (D) y los avisos (E) quedan fuera del componente modal.

### 3.1 Comportamiento: `useOverlay` (sustituye a `useModal` y `usePrivateSheet`)

```ts
type OverlayOptions = {
  onClose(reason: "escape" | "backdrop" | "button" | "back"): void;
  busy?: boolean;                 // bloquea todos los cierres (hoy: pending/saving)
  dismissible?: { escape?: boolean; backdrop?: boolean; back?: boolean }; // valores por defecto según la variante
  confirmDiscard?: () => boolean; // true = hay cambios: pide confirmación antes de cerrar
  initialFocus?: RefObject<HTMLElement | null>;      // por defecto, el contenedor
  returnFocus?: RefObject<HTMLElement | null> | "opener"; // por defecto "opener", con respaldo en main h1
};
```

Reglas comunes:
- **Pila** de superficies abiertas en un módulo: `html.sheet-open` y `#root.inert` se quitan solo cuando la pila queda vacía (resuelve 26). Escape actúa solo sobre la de arriba (resuelve 4).
- **Foco**: al abrir, `initialFocus` o el contenedor. Trampa con un selector común (`button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])` sin desactivados). Al cerrar, devuelve el foco **después** de quitar `inert` (microtarea o efecto de la pila), al que abrió o al respaldo. Resuelve 6, 7, 10 y 11.
- **Atrás**: en móvil, opcional por variante, con el patrón de `listing-description.tsx:66-73` (un `pushState` con clave y `popstate`). Por defecto activo en `sheet`, inactivo en `dialog` de escritorio **[a decidir]**.
- **Cambios sin guardar**: si `confirmDiscard()` devuelve true, Escape, el fondo y Atrás abren una confirmación apilada («¿Descartar los cambios?») en lugar de cerrar. Para los popups de la 06.
- **`aria`**: siempre `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (con `useId`) al título del slot de cabecera, y `aria-describedby` opcional.

### 3.2 Contenedores

```tsx
<Sheet>    // móvil: hoja inferior (asa, 16 arriba, sheet-in). En escritorio pasa a <Dialog size="normal"> salvo `stayBottom`
<Dialog size="normal" | "wide">   // escritorio: centrada; normal = 520, wide = min(960px, 100% - 48px)
  <Overlay.Header title="…" subtitle? close?="x" | "back" />
  <Overlay.Body>…</Overlay.Body>          // con scroll propio; el pie queda fijo
  <Overlay.Footer primary={…} secondary={…} cancel? />
</…>
```

- Un solo elemento base. **Recomendación: mantener `<section>` con portal y la pila propia** (mecanismo A) en lugar de `<dialog>`, porque A ya resuelve bloqueo del scroll, fondo animado y retorno del foco, y el toast puede quedar por encima con `--z-toast` mayor que `--z-overlay`. Con `<dialog>` el toast queda siempre por debajo de la capa superior (19) **[a decidir; la alternativa es pasar el toast a `popover`]**.
- Tokens nuevos: `--scrim` (uno solo, 15), escala `--z-*` (18), `--dialog-w` y `--dialog-w-wide` (17). Sombra `--shadow-float` en todas las ventanas de escritorio.
- Animación: entrada `sheet-in` en móvil y `fade-in` en escritorio, `fade-in` con movimiento reducido. Sin salida (23).

### 3.3 Variantes que se conservan

| Variante | Base | Particular |
|---|---|---|
| **ConfirmDialog** (hoy ConfirmSheet) | `Sheet` + Footer | `tone: "default" \| "destructive"` (una sola clase destructiva, 24); `safeFirst?: boolean` explícito (Parar suscripción); `busy`; error en el cuerpo. Cancelar lo pinta el pie (25) |
| **Hoja de formulario** (Pausar, Marcar, Conectar Airbnb) | `Sheet` + Footer con `type="submit"` | `busy` mientras guarda; `confirmDiscard` cuando haya campos |
| **Hoja de contacto** | `Sheet`; en la ficha de escritorio, el **cuerpo** sin contenedor (en línea) | Guarda el borrador al cerrar (ya lo hace); separar `ContactBody` del contenedor para no reutilizar `.sheet` en línea (21) |
| **Selector** (casa o zona) | `Sheet` en móvil; en escritorio, el desplegable `popover` de hoy (no modal) | Mantener `listbox`, flechas, Inicio y Fin. Decidir si la zona en escritorio pasa también a desplegable (fila 5) |
| **Ventana de escritorio normal** (Ingresar, Consultas, Filtros, **popups de un dato de la 06**) | `Dialog size="normal"` | Header con «Volver» opcional (Ingresar); Filtros cierra con el fondo; Ingresar no |
| **Ventana ancha** (Fotos, **ventana de fotos de la 06**, Calendarios de Airbnb) | `Dialog size="wide"` | Pie fijo abajo a la derecha (`13-escritorio.css:87-95`); `busy` mientras suben fotos; nunca cierra con el fondo |
| **Pantalla completa** (Descripción, Vista previa) | Contenedor propio `FullScreen` con el mismo `useOverlay` | Atrás activo; Vista previa gana trampa e `inert` (8) |
| **Mapa a pantalla completa** | Se queda como está (estado en la URL, `inert` en hermanos) | Fuera del sistema modal (9); como mucho, `aria-label` |
| **Visor de fotos** | **No existe** | Si se crea (la ficha de escritorio no lo tiene), sería `Dialog size="wide"` o `FullScreen` con flechas; fuera del alcance de la 07 **[a decidir]** |

Fuera del sistema modal: los desplegables y paneles (D) comparten **un** hook `useDismiss({ onClose, trigger })` (Esc, pointerdown fuera, perder el foco), que sustituye a los tres de `house-picker.tsx:150-173`, `explorar.tsx:66-73,87-92` y los combobox. `toast()` y `UpdateBanner` siguen sin React; solo cambia su z-index.

### 3.4 Para la 06

- Cada editor de un dato en escritorio → `Dialog size="normal"` con `Header title={fieldTitle}`, el formulario actual de `EditFieldForm` en `Body`, `Footer primary="Guardar | Enviar a revisión"` y `confirmDiscard={() => hasChanges}` (el estado ya existe en `editar.tsx:153-187`).
- Fotos → `Dialog size="wide"` (ya existe como EditPhotosDialog; solo migrarlo).
- El disparador de la fila pasa a `aria-haspopup="dialog"` (14).

## 4. Cobertura

| Zona | Rutas o pantallas (`client/shell.tsx`) | Superficies encontradas |
|---|---|---|
| Ficha SSR y SPA | `/casa/$publicId` (`shell.tsx:320`; `shared/listing-page.tsx`, `client/hydrate-listing.tsx` no leído a fondo) | ContactSheet (hoja en móvil, en línea en escritorio), DescriptionScreen, toast (compartir usa un cambio de texto, no toast: `share-button.tsx:39`), hero sin visor |
| Explorar | `/explorar`, `/explorar/filtros`, `/explorar/buscar` (`:230-231,289`) | MapScreen y MapCard, ContactSheet desde las tarjetas, DesktopFilters, paneles DesktopSearch, combobox de zona (`buscar.tsx`). En móvil, Filtros y Buscar son **rutas**, no superposiciones |
| Favoritos | `/favoritos` (`:232`) | ContactSheet desde las tarjetas, toast de error de favoritos (`favorites-store.ts:98`) |
| Cuenta | `/cuenta`, `/cuenta/codigo`, `/cuenta/lista`, `/cuenta/recuperar`, `/ayuda` (`:248-253`) | ConfirmSheet «¿Cerrar sesión?». En móvil, Ingresar es una **ruta**; en escritorio, WhatsAppDialog |
| Publicar | `/publicar…`, `/propietario/publicar/$id/$paso` (`:255-308`) | FichaPreview, WhatsAppDialog (escritorio, antes de las fotos), selector de zona (HousePickerSheet), combobox `place-search`. Sin superposiciones en `wizard-parts` (las pistas son desplegables en línea) |
| Propietario | `/propietario/casas`, `/casas/$id`, `/editar/$campo`, `/airbnb`, `/calendario`, `/actividad`, `/suscripcion` (`:235-303`) | ConfirmSheet (descartar borrador, descartar cambio, eliminar casa, parar suscripción, desconectar Airbnb, revocar iCal), CloseSheet, MarkSheet, HousePickerSheet o desplegable, ConnectSheet, EditPhotosDialog, editor en línea, InquiriesDialog (escritorio), toasts. En móvil, editar un dato es una **ruta** (`/editar/$campo`) |
| Admin | `/admin`, `/admin/casas`, `/admin/borradores`, `/admin/anuncios/$id`, `/admin/ediciones/$id`, `/admin/casas/$id…` (`:241-317`) | HouseSheet y toasts. Revisar anuncio y Revisar edición **no tienen superposiciones** (grep sin resultados en `admin-revision.tsx` y `admin-edicion.tsx`). Asistir reutiliza las del propietario |
| Escritorio (marco) | `client/chrome.tsx` | WhatsAppDialog (Ingresar), InquiriesDialog, UpdateBanner (`shell.tsx:67`) |
| Global | — | toast, UpdateBanner, `.rotate-notice` (`12-orientacion.css:11`, fuera de alcance) |

**Sin revisar a fondo:** `client/hydrate-listing.tsx`, `client/screens/admin-review-details.tsx`, `client/publish/photos.tsx` (por si abre algo propio), y las pruebas e2e que cubren estas superficies (`tests/e2e/contacto.spec.ts`, `calendario.spec.ts`, `ingresar-escritorio.spec.ts`, `explorar-mapa.spec.ts`, `eliminar-casa.spec.ts`, `admin-casas.spec.ts`, `airbnb*.spec.ts`, `suscripcion.spec.ts`, entre otras), que habrá que mantener al migrar.
