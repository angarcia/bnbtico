# Historia 07 · Propuesta de componentes y estilos comunes (borrador para Ana, 2026-11-19)

Estado: **propuesta aprobada por Ana el 2026-11-19** (componentes, orden de migración y muestras 1–6); quedan D4–D9, con muestras propias en [muestras/decisiones.html](muestras/decisiones.html). No se ha cambiado código de la app. La migración espera a que Ana apruebe esta propuesta y las muestras visuales (escenario 2 de la historia).

Sale de cuatro inventarios hechos leyendo el código (no abriendo la app; lo no medido va marcado allí):

| Familia | Archivo | Qué cubre |
|---|---|---|
| Botones y acciones | [inventario-botones.md](inventario-botones.md) | `.btn` y modificadores, enlaces de acción, iconos, flotantes, segmentos, −/+ |
| Superficies | [inventario-superficies.md](inventario-superficies.md) | hojas, ventanas de escritorio, confirmaciones, pantallas completas, desplegables, avisos |
| Campos y formularios | [inventario-campos.md](inventario-campos.md) | campos, buscadores, chips, tarjetas de elección, contadores, códigos, errores, barras de pie |
| Estructura y contenido | [inventario-estructura.md](inventario-estructura.md) | navegación, cabeceras, tarjetas, filas, etiquetas, avisos, estados, tipografía, espacios, radios, sombras, capas, foco |

Las 40 rutas de `shell.tsx`, la ficha SSR, sus páginas de estado, la portada y el escritorio están cubiertas; cada inventario termina con su lista y con lo que solo se miró por encima (calendario, recuperar, ayuda, pasos de publicar uno a uno, `photos.tsx`, `admin-review-details.tsx`).

## 1. Lo que se encontró, en corto

- **No hay componentes de base.** De 117 botones `.btn`, 106 llevan las clases a mano; `ConfirmSheet` recibe las clases como texto. Lo que sí se comparte bien: los campos de publicar y editar (`publish/fields.tsx`), `FeatureChoiceContent`, `CounterRow` (en parte).
- **Mismo papel, aspectos distintos.** «Cancelar» con 4 alturas y 3 aspectos (en escritorio se vuelve terracota, como lo destructivo). Lo destructivo en terracota o en rojo según quién borre. Siete tratamientos de desactivado. Tres formas de enseñar un error. Dos contadores −/+. Dos segmentos. Cuatro esqueletos. Seis clases para el título de una tarjeta. Tres tablas de etiquetas de estado con textos distintos («Pendiente de pago» / «Por pagar»).
- **Nombres que engañan.** `btn-primary`, `btn-soft` y `btn-outline` son idénticos; `btn-outline` no tiene contorno.
- **Un fallo real:** `btn-secondary` no existe en el CSS; «Continuar con el último calendario» de la hoja de marcar noches sale sin estilo ([mark-sheet.tsx:65](../../../apps/app/src/client/mark-sheet.tsx)). Comprobado en el código.
- **Superficies:** cinco mecanismos (hojas propias, `<dialog>`, pantallas completas a mano, desplegables, avisos). Tocar fuera cierra unas sí y otras no; Atrás solo cierra la Descripción y el mapa; el foco no siempre vuelve; el aviso (toast) queda tapado por hojas y ventanas; nada protege los cambios sin guardar.
- **Accesibilidad:**
  - El anillo de foco global (`--sun` #F2B544 sobre la crema #FFFBF2) da ≈1,8:1, por debajo del 3:1 de WCAG. Comprobado en `01-base.css:64`.
  - Las tarjetas de elección y algunos chips no enseñan foco con teclado.
  - `aria-pressed` está puesto sobre `<label>`.
  - Publicar y editar no marcan el campo que falla.
  - Hay áreas táctiles de 32–38 px: `.cal-cancel`, `.cal-base`, `.seg`, `.currency-switch`, `.check`, `.chip-sm` y quitar foto.
- **Tokens:** `tokens.json` va por la 0.3.4 y la guía y el CSS citan 0.3.3/0.2.2. Hay 26 hex y 26 rgba sueltos, 21 tamaños de letra (16 px es el segundo más usado y no está en la escala), 23 radios (`8px` a mano 27 veces), 23 sombras y 18 z-index sin escala. `--disabled-bg`, `--shadow-lift` y `--w-regular` se usan sin estar definidas.

## 2. Decisiones para Ana

Respondidas por Ana el 2026-11-19: **D1** verde, uno solo (confirmado tras ver antes y después) · **D2** un nivel, terracota · **D3** contorno fino en los dos · **D10** preguntar solo si hay cambios. D4–D9: Ana elige la propuesta por defecto en todas salvo **D5: etiquetas redondas (999 px)**, tras ver `muestras/decisiones.html`. Anotado en `docs/decisiones.md` (2026-11-19).

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| D1 | Anillo de foco: ¿verde `--primary` (7,3:1) en toda la app, o mantener el ocre con un borde oscuro? | Verde, uno solo |
| D2 | Destructivo: ¿un nivel (terracota) o dos (terracota para «Quitar», rojo para «Eliminar casa» y rechazos del admin)? | Un nivel, terracota, igual para propietario y admin |
| D3 | Secundario («Cancelar», «Ahora no»): ¿contorno en móvil y en escritorio, o fondo suave en los dos? Hoy cambia de uno a otro. | Contorno fino en los dos, misma altura que el primario a su lado |
| D4 | Botón verde de WhatsApp: ¿solo «Contactar por WhatsApp» (como dice el token) o también ayuda y admin? | Solo contactar al anfitrión y responder desde Actividad; ayuda y admin con el secundario + icono |
| D5 | Etiquetas de estado: ¿radio 6 px (decisión 2026-10-29) o redondas (999 px, como están hoy)? | 6 px, como dice la decisión |
| D6 | Chip elegido: el CSS usa verde al 26 % y `tokens.json` y la guía dicen salvia. ¿Se corrige el token? | Corregir el token y la guía al verde al 26 % |
| D7 | Guía, línea 77: «8 px» e «inputs 16 px» a la vez. ¿El radio de campos y botones es 8 px? | 8 px para controles; 16 px queda como mínimo de letra en campos (iPhone) |
| D8 | «No/Sí» y «Privado/Compartido»: ¿segmento o chips de una sola opción? | Segmento |
| D9 | Ventanas de escritorio: ¿Atrás del navegador las cierra (como en las hojas del móvil)? | Sí en hojas del móvil; no en ventanas de escritorio |
| D10 | Cambios sin guardar al cerrar una ventana (06): ¿preguntar «¿Descartar los cambios?» o cerrar sin guardar, como hoy? | Preguntar solo si hay cambios |

## 3. Propuesta de destino

Criterio: piezas pequeñas con tipos cerrados (`variant`, `size`, `tone` como uniones de cadenas, nunca `className` libre), sin un sistema universal. Cada componente vive con su CSS en su archivo de estilos de base; las pantallas no redefinen su aspecto. Lo que puede pintarse en el servidor y sin router va en `shared/` para que la ficha SSR lo use sin arrastrar módulos privados.

### 3.1 Tokens (primero, sin cambiar aspecto salvo lo aprobado)

- Radios: `--r-control: 8px`, `--r-tag: 999px` (D5: redondas), y los que ya existen.
- Color: `--focus-ring`, `--disabled-bg`, `--disabled-fg`, `--scrim`; las variables que hoy no tienen token pasan a `tokens.json` (`--fg-title`, `--primary-ink`, `--wa-icon`, `--ochre`, `--surface-soft`, `--beige-soft`, `--chosen`).
- Letra: escala con nombre (`--fs-xs` 14 · `--fs-sm` 15 · `--fs-note` 16 · `--fs-base` 17 · `--fs-md` 18 · `--fs-title` 20 · `--fs-h2` 24 · `--fs-h1` 34/30).
- Capas: `--z-float`, `--z-bar`, `--z-banner`, `--z-topbar`, `--z-overlay`, `--z-toast` (por encima de las hojas). Leaflet queda como excepción.
- Área táctil mínima `--hit: 44px`; ancho de ventana `--dialog-w: 520px`, `--dialog-w-wide: min(960px, 100% - 48px)`.
- Puntos de corte de `tokens.json` igualados a los reales (900, 1024, 1200).

### 3.2 Componentes

| Componente | Reúne | API (borrador) |
|---|---|---|
| `Button` / `ButtonLink` | `.btn-*` | `variant: "primary" \| "secondary" \| "pay" \| "whatsapp" \| "danger"`, `size: "md" \| "lg" \| "xl"` (44/52/56), `block`, `pending` (pone `aria-busy` y `disabled`), `icon` |
| `TextButton` | `.btn-link`, `.btn-text`, `.sub-stop`, `.delete-house`, `.cal-cancel`, `.cal-base` | `tone: "link" \| "quiet" \| "danger"`, siempre 44 px de alto |
| `IconButton` (+ `CloseButton`, `BackButton`) | `icon-btn`, `header-close`, `cal-arrow`, quitar foto, botones del mapa | `label` obligatorio, `tone: "plain" \| "overlay" \| "float"`, 44 × 44 |
| `Segmented` | `.seg`, `CurrencySwitch` | `label`, `options`, `value`, `onChange`; 44 px |
| `Stepper` | `CounterRow`, `.people-stepper` ×4 | `value`, `min`, `max`, `onChange`, `label`, `unit`, `editable` |
| `Field` + `TextInput` / `TextArea` / `Select` / `AffixInput` | campos sueltos, `.input-money`, precio de Filtros, `.cal-price` | `label`, `hint`, `error` (enlaza `aria-describedby` y `aria-invalid`), `count`; `size` |
| `SearchInput` + `useCombobox` | 3 buscadores y 3 listas de sugerencias | `variant: "field" \| "combobox" \| "float"` |
| `ChoiceChips`, `ChoiceCards` | características, baño, mensual, atajos de noches, tipo | `type: "checkbox" \| "radio"`, `layout`; foco visible con `:has(:focus-visible)` |
| `CodeInput` | código de cuenta y de admin | `length` 6, error enlazado |
| `StickyActions` | barras de pie y su espaciador | `primary`, `secondary` |
| `ScreenHeader` | `RootHeader`, `FlowHeader`, cabeceras a mano y las de carga de `shell.tsx` | `kind: "root" \| "flow" \| "wizard"`, `back` **o** `close`, `action` |
| `Card` | `.card`, `-arena`, `-soft`, `-sun` | `tone`, `padding`, `as` |
| `StatusTag` + `domain/status-label.ts` | `.badge-*`, `.state-*`, `.tag-rev` y las 3 tablas | `status`; texto y tono de **una** tabla de dominio sin CSS |
| `Notice` / `LoadError` | `.note`, `note-*`, las 4 copias del error de carga | `tone: "info" \| "sun" \| "review" \| "error"` (error pone `role="alert"`), `action` |
| `EmptyState`, `Skeleton`, `CountBadge`, `ListRow` | estados vacíos, 4 esqueletos, 4 contadores, filas de lista | ver [inventario-estructura.md §4](inventario-estructura.md) |
| `useOverlay` + `Sheet` / `Dialog size="normal" \| "wide"` / `FullScreen` | `useModal`, `usePrivateSheet`, `<dialog>` de escritorio | pila de superficies, Escape solo a la de arriba, foco atrapado y devuelto, `aria-labelledby`, `busy`, `confirmDiscard` (D10); cabecera, cuerpo con scroll y pie fijo |
| `ConfirmDialog` | `ConfirmSheet` | `tone: "default" \| "destructive"`, `safeFirst`, `busy`; «Cancelar» siempre secundario |
| `useDismiss` | 3 cierres de desplegables escritos a mano | Escape, clic fuera, perder el foco |

**Variantes justificadas que se conservan (escenario 4):** destructivo y pago como `variant`; ventana ancha de fotos como `size="wide"`; hoja de contacto (en línea en la ficha de escritorio); selector de casa como desplegable en escritorio; tarjetas de elección del paso 1; precio compacto del calendario (`AffixInput size="sm"`); buscador flotante del mapa.

**Excepciones con su propio CSS:** corazón de favoritos, icono de WhatsApp de la tarjeta, mapa a pantalla completa (estado en la URL), Leaflet, aviso de girar el teléfono, `toast()` y `UpdateBanner` (sin React; solo cambia su capa). **Portada:** HTML estático sin JS; solo se anotan sus diferencias y se borran del CSS de la app las clases `.soon*` sin uso. **Visor de fotos:** no existe; queda fuera.

### 3.3 Orden de la migración (pasos internos, cada uno con pruebas en verde)

1. Tokens y variables que faltan, con el anillo de foco y el desactivado (cambio visual pequeño y aprobado).
2. `Button`, `TextButton`, `IconButton` y migración de todos los `.btn`; borrar las clases repetidas y muertas. Corrige el `btn-secondary` de la hoja de marcar noches.
3. `useOverlay`, `Sheet`, `Dialog`, `ConfirmDialog`, `useDismiss`; migrar las 19 superficies. Deja lista la base de la 06.
4. `Field` y los campos, `Stepper`, `Segmented`, `ChoiceChips`, `CodeInput`, `StickyActions`.
5. `ScreenHeader`, `Card`, `StatusTag` (con la tabla única), `Notice`, `EmptyState`, `Skeleton`, `CountBadge`, `ListRow`.
6. Guía de uso (`docs/componentes.md`) con ejemplos, y una prueba que vigile la consistencia: que no aparezcan clases de los componentes escritas a mano en las pantallas, ni hex, radios o z-index sueltos fuera de los archivos de base (con lista de excepciones).

Cada paso: e2e completo, hidratación de la ficha, `size` (JS privado < 161 KB gz) y capturas móvil/escritorio de las pantallas tocadas. Las pruebas e2e que dependen de clases concretas se mantienen o se pasan a roles.

## 4. Muestras visuales

[muestras/muestras.html](muestras/muestras.html) pone «hoy» (con el CSS real de la app) junto a «propuesta» (con `muestras/propuesta.css`, clases `ui-*` sobre los mismos tokens). Las capturas son [movil-375.png](muestras/movil-375.png) y [escritorio-1280.png](muestras/escritorio-1280.png), y se rehacen con `muestras/capturar.mjs`. Contenido:
1. botones con todos sus estados;
2. confirmación destructiva;
3. campo con error, con desactivado y con solo lectura;
4. chips, segmentos y contador;
5. etiquetas y avisos;
6. ventanas de escritorio: la normal con «¿Descartar los cambios?» y la ancha de fotos.

Pendiente: el visto bueno de Ana a las muestras y a D4–D9. Hasta entonces no se migra nada.
