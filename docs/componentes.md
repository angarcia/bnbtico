# Componentes de la interfaz

Guía de uso de las piezas comunes de `apps/app` (historia 07, «unificar estilos mediante componentes reutilizables»). Cada
componente tiene tipos cerrados (`variant`, `size`, `tone`) y su CSS en un solo sitio; las pantallas no escriben las clases
ni redefinen el aspecto. Propuesta y decisiones: `.scratch/revision-app-2026-11-17/07/propuesta.md` y `docs/decisiones.md`
(2026-11-19).

## Botones

Desde el paso 2 de la migración (2026-11-19). Código en `apps/app/src/shared/button.tsx` (sin router ni consultas: lo usa
también la ficha SSR) y `apps/app/src/client/router-buttons.tsx` (las mismas piezas sobre `Link` de TanStack Router, hechas
con `createLink`). CSS en `apps/app/src/styles/01-base.css`, bloque «Botones»; la respuesta al pasar el ratón, en
`13-escritorio.css`. Lo vigila `apps/app/tests/unit/botones.test.tsx`: ningún archivo de `src/client` ni `src/shared`
escribe `className` con `btn…` o `icon-btn`, y ninguna hoja de estilos de pantalla cambia la altura de un botón.

### Button, ButtonLink, RouterButtonLink

| Prop | Valores | Notas |
|---|---|---|
| `variant` | `"primary"` · `"secondary"` · `"pay"` · `"whatsapp"` · `"danger"` | obligatoria |
| `size` | `"md"` (44 px, por defecto) · `"lg"` (52) · `"xl"` (56) | |
| `block` | `boolean` | a todo el ancho |
| `icon` | `ReactNode` | a la izquierda del texto |
| `pending` | `boolean` (solo `Button`) | pone `aria-busy="true"` y `disabled`; el texto («Guardando…») lo pone quien lo usa |
| `placement` | `"grow"` · `"back"` · `"desktop-sign-in"` · `"house-share"` | solo colocación ya existente (flex, ancho fijo del «Atrás» del asistente); no cambia el aspecto |

El resto de atributos (`type`, `disabled`, `onClick`, `aria-*`, `ref`, `href`, `target`…) pasan tal cual. `Button` es
`type="button"` salvo que diga `type="submit"`.

Cuándo usar cada variante:

- **primary**: la acción principal, verde tonal (Verde B, 2026-11-04). Sustituye a `btn-primary`, `btn-soft` y `btn-outline`, que eran iguales.
- **secondary**: «Cancelar», «Ahora no», «Intentar de nuevo» y las acciones de segundo nivel. Contorno verde fino, igual en el teléfono y en escritorio (D3). «Cancelar» es siempre secundario.
- **danger**: todo lo destructivo, en terracota tonal, también en el admin (D2). Ya no hay rojo lleno ni contorno rojo.
- **pay**: dinero y avisos de pago, en ocre (lo vigila `tests/unit/ocre.test.ts`).
- **whatsapp**: verde lleno, **solo** para hablar con el anfitrión («Contactar por WhatsApp», la hoja de contacto). Para escribir a 3bstays (Ayuda, casa bloqueada, avisos del admin), `secondary` con `icon={<WaIcon />}` (D4).

```tsx
import { Button, ButtonLink, WaIcon } from "../../shared/button";
import { RouterButtonLink } from "../router-buttons";

<Button variant="primary" size="lg" type="submit" disabled={!dirty} pending={saving}>
  {saving ? "Guardando…" : "Guardar cambios"}
</Button>
<Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button>
<RouterButtonLink to="/propietario/publicar/$id/$paso" params={{ id, paso: "1" }} variant="primary" block>
  Corregir y reenviar
</RouterButtonLink>
<ButtonLink variant="secondary" size="xl" block icon={<WaIcon />} href={waLink(numero, saludo)} target="_blank" rel="noopener">
  Abrir WhatsApp
</ButtonLink>
```

En las barras de pie fijas (`sticky-actions`) los botones van en `size="lg"`; en la barra de arriba del asistente en
escritorio, `"md"`.

### ButtonPlaceholder

La caja de un botón que todavía no responde: antes de hidratar la ficha (`aria-hidden="true"`) o en una vista previa
(`aria-disabled="true"`, con el desactivado común). Mismas props de aspecto que `Button`.

```tsx
<ButtonPlaceholder variant="whatsapp" size="xl" block icon={<I.wa size={22} />} aria-hidden="true">Contactar por WhatsApp</ButtonPlaceholder>
```

### TextButton, TextButtonLink, RouterTextLink

Acción en texto, siempre de 44 px de alto. `tone`: `"link"` (verde, como `.btn-link`), `"quiet"` (gris subrayado, como
`.btn-text`: «Quitar fechas», «Parar suscripción»), `"danger"` (terracota: «Eliminar casa» al final del detalle).
`placement` admite las clases de colocación que ya había (`delete-house`, `sub-stop`, `logout-link`,
`account-profile-toggle`, `sent-link`, `cal-base`, `header-close`).

```tsx
<TextButton tone="quiet" placement="sub-stop" onClick={() => setConfirming(true)}>Parar suscripción</TextButton>
```

### IconButton, IconButtonLink, RouterIconLink

Botón de 44 × 44 con un icono. `label` es obligatorio (se convierte en `aria-label`). `tone`: `"plain"` (por defecto),
`"overlay"` (crema al 70 % sobre las fotos), `"float"` (tarjeta flotante del mapa). `placement`: `cal-arrow`, `status-back`,
`search-close`, `map-card-close`, `map-locate`, `header-close`, `remove` (quitar foto: área de 44 con el dibujo de 36).
Desactivado: fondo y texto de `--disabled-bg` / `--disabled-fg`. `IconButtonPlaceholder` es su caja antes de hidratar.

```tsx
<IconButton label="Mes anterior" placement="cal-arrow" disabled={first} onClick={prev}><I.back size={20} /></IconButton>
```

### ConfirmSheet

`client/confirm-sheet.tsx` ya no recibe clases: `tone="default"` (por defecto; confirma con `primary`) o
`tone="destructive"` (confirma con `danger`). «Cancelar» es siempre `secondary lg`, salvo con `tone="keep"`: quedarse es el botón principal y la acción es un `TextButton` terracota (solo «Parar suscripción» en escritorio, decisión de Ana del 2026-11-19, para no empujar a parar); `cancelLabel` y `cancelFirst` siguen
existiendo. `pending` pone el botón de confirmar en espera y desactiva «Cancelar».

```tsx
<ConfirmSheet title="¿Descartar este borrador?" body="No se puede deshacer." confirmLabel="Descartar" tone="destructive"
  onClose={close} onConfirm={discard} />
```

## Ventanas y hojas

Desde el paso 3 de la migración (2026-11-19). Código en `apps/app/src/shared/overlay-stack.ts` (la pila, sin React),
`apps/app/src/shared/overlay.tsx` (`useOverlay` y los contenedores) y `apps/app/src/shared/dismiss.ts` (`useDismiss`). CSS:
`styles/07-contacto.css` (fondo, `.sheet`, `.dialog`) y `styles/13-escritorio.css` (la hoja como ventana en escritorio).
Tokens en `01-base.css`: `--scrim`, `--dialog-w`, `--dialog-w-wide` y la escala `--z-*` (`--z-overlay` 30 < `--z-toast` 40:
el aviso queda siempre encima). Trozo propio `overlay-*` (fuera del JS inicial; solo lo piden trozos diferidos). Lo vigilan
`tests/unit/overlay.test.ts`, `tests/unit/private-sheets.test.ts` y `tests/e2e/superficies.spec.ts`.

**Por qué `<section>` con portal y no `<dialog>`:** la pila propia ya da el bloqueo del scroll (`html.sheet-open`), el fondo
animado, el retorno del foco después de quitar `inert` y las superficies apiladas; con `<dialog>` la capa superior del
navegador taparía siempre el aviso (`toast`), que no es React y vive en `<body>`.

### Reglas comunes (las pone la pila; las pantallas no las escriben)

- Abierta alguna: `html.sheet-open` y `#root` inerte; las de debajo de la de arriba, también inertes. Todo se quita al vaciarse la pila.
- Escape y la trampa de Tab, solo en la de arriba. Al abrir, el foco va al contenedor (o a `initialFocus`); al cerrar, a quien
  la abrió (o a `returnFocus`), y si ya no está o está desactivado, a `main h1`. Si la pantalla ya enfocó otra cosa, se respeta.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título (con `useId`) o `label` / `labelledBy`, `aria-busy` con `busy`.
- **Atrás (D9):** en el teléfono, `Sheet` y `FullScreen` añaden una entrada al historial y Atrás cierra la de arriba; en
  escritorio, `Dialog` y la hoja hecha ventana no la añaden (Atrás navega). `FullScreen` la añade también en escritorio. Si la
  pestaña se va a otra web (`location.assign` a WhatsApp), llame a `leavingPage()` antes de cerrar.
- **Cambios sin guardar (D10):** con `confirmDiscard={() => hayCambios}`, Escape, el fondo, Atrás y la ✕ abren encima
  «¿Descartar los cambios?» («Descartar» destructivo, «Seguir editando» secundario). «Cancelar» del pie cierra sin preguntar.
- `busy`: ningún cierre (ni la ✕, que se desactiva).

| Contenedor | Uso | Cierra con el fondo | Atrás |
|---|---|---|---|
| `Sheet` | hoja inferior; en escritorio, ventana normal (salvo `layout="picker"`) | sí | teléfono |
| `Dialog size="normal"` | ventana de escritorio, 520 px | sí | no |
| `Dialog size="wide"` | ventana ancha, hasta 960 px | **no** | no |
| `FullScreen` | Descripción, Vista previa | — | siempre |

Props comunes: `onClose(reason)` (`"escape" | "backdrop" | "button" | "back"`), `busy`, `dismissible` (`{ escape, backdrop,
back }`, para salirse del valor de la variante), `confirmDiscard`, `initialFocus`, `returnFocus(opener)`, `title`,
`subtitle`, `closeButton` (✕ en la cabecera; por defecto, con título), `headerStart`, `label`, `labelledBy`, `describedBy`,
`id`, `footer` (pie fijo en `Dialog`). `layout` es una unión cerrada para las clases que ya existían (`Sheet`: `contact`,
`picker`, `airbnb`; `Dialog`: `sign-in`, `inquiries`, `photos`, `filters`; `FullScreen`: `description`, `preview`); no
cambia el comportamiento. `children` puede ser una función que recibe `{ titleId, close }` (`close` pide cerrar como la ✕).

```tsx
import { Dialog, Sheet } from "../shared/overlay";

<Sheet title="Pausar la casa" closeButton={false} onClose={onClose} confirmDiscard={() => date !== ""}>
  <form onSubmit={onSubmit}>…<Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button></form>
</Sheet>

<Dialog size="wide" layout="photos" title="Fotos" onClose={onClose}>
  {({ close }) => <EditPhotos listing={listing} userId={userId} onDone={close} />}
</Dialog>

// Base para los editores de un dato de la historia 06:
<Dialog title={fieldTitle} onClose={onClose} busy={saving} confirmDiscard={() => hasChanges}
  footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form={formId}>Guardar</Button></>}>
  <EditFieldForm … />
</Dialog>
```

`ConfirmSheet` (`client/confirm-sheet.tsx`) es una `Sheet` sin ✕, con la misma API pública de antes; `pending` es su `busy`.

### useDismiss (desplegables no modales)

Para el selector de casa en escritorio (`house-picker.tsx`) y los paneles Lugar, Fechas y Noches de Explorar. No bloquea la
página ni atrapa el foco: Escape (no sigue hacia arriba), tocar fuera y, con `blur`, perder el foco.

```tsx
const dismiss = useDismiss({ open: !!panel, inside: () => [group.current], onDismiss: (reason) => { setPanel(null); if (reason === "escape") trigger.current?.focus(); } });
<div ref={group} onKeyDown={dismiss.onKeyDown} onBlur={dismiss.onBlur}>…</div>
```

**Fuera del sistema:** el mapa a pantalla completa (estado en la URL `?mapa=1`; `role="region"`, Escape vuelve a la lista),
`toast()` y `UpdateBanner` (sin React; solo usan la escala `--z-*`), y los combobox de zona (`buscar.tsx`, `place-search.tsx`:
la lista de `buscar` está siempre a la vista y la de `place-search` se cierra al salir del campo, el patrón ARIA del combobox).

### Excepciones con su propio CSS

No pasan por estos componentes: el corazón (`FavoriteButton`), el icono de WhatsApp de la tarjeta (`card-wa`), «Abrir
WhatsApp» de Actividad (`inquiry-wa`), los flotantes del mapa (`float-btn`, `map-label`, `map-count`), los chips de
navegación y el botón de Filtros (`chip`, `filters-btn`), `house-tool`, `new-house` y la portada estática
(`public/portada.html`). Los chips de elección, los segmentos y los contadores −/+ son del paso 4 (abajo).

## Campos y formularios

Desde el paso 4 de la migración (2026-11-20). Código en `apps/app/src/shared/field.tsx` (`Field`, `TextInput`, `TextArea`,
`Select`, `AffixInput`, `SearchInput`, `Checkbox`, `StickyActions`), `shared/choice.tsx` (`ChoiceChips`, `Segmented`),
`shared/stepper.tsx` (`Stepper`, `CounterRow`), `shared/combobox.ts` (`useCombobox`), `client/code-input.tsx` (`CodeInput`)
y `client/publish/wizard-parts.tsx` (`ChoiceCards`). Ninguno usa el router ni consultas. CSS en `styles/01-base.css`, bloque
«Campos»: el campo base va con `:where()` (sin peso) y lo que lleva un campo dentro lo vacía con `.bare-input`, una sola vez.
Trozos: `field-*`, `combobox-*` y `code-input-*` los leen solo trozos diferidos (presupuesto propio en `.size-limit.json`);
`Segmented` va con `CurrencySwitch` en el JS inicial y `Stepper`/`ChoiceChips` en `stepper-*`, que pide el arranque (Explorar).
Lo vigilan `tests/unit/campos.test.tsx` (marcado, enlaces ARIA, 44 px, foco, y que ninguna pantalla vuelva a escribir
`people-stepper`, `seg`, `code-boxes`, `input-money`, `cal-price`, `zone-input`, `search-field` ni `aria-pressed` en un
`<label>`) y `tests/e2e/campos.spec.ts`.

Formularios sin controlar donde ya lo estaban (publicar, editar, perfil): los valores salen de `FormData`; `Segmented` con
`name` pone el suyo en un campo oculto.

### Field

Envoltorio de un campo: pinta la etiqueta, el contador, el error y la ayuda, y da al control su `id`, `aria-describedby`
(error, ayuda, contador y `describedBy`, en ese orden) y `aria-invalid`. **El error va debajo del campo que falla**, con
`role="alert"` e `id` `<id>-error` (ayuda `<id>-hint`, contador `<id>-count`).

| Prop | Valores | Notas |
|---|---|---|
| `label` | `ReactNode` | obligatoria; `labelHidden` la deja solo para lectores de pantalla |
| `id` | `string` | si falta, `useId()` |
| `error` | `string \| null` | el mensaje de la validación existente |
| `hint` / `hintTone` | `ReactNode` / `"muted"` · `"warn"` | `warn`: en ocre y anunciado (precio al mes mal escrito) |
| `count` | `{ text, tone?: "muted" \| "bad" \| "warn" }` | a la derecha de la etiqueta («12 / 32», «Faltan 20 caracteres») |
| `size` | `"md"` (52 px) · `"compact"` (48 px y etiqueta de 14, para hojas) | |
| `describedBy` | `string` | otros textos que describen el campo (un error que vale para dos campos) |
| `grow` | `boolean` | llena el alto que queda (la descripción del asistente) |

```tsx
<Field id="pub-title" label="Nombre de la casa" error={useFieldError("title")} count={{ text: `${n} / 32 · mínimo 5` }}>
  {(control) => <TextInput {...control} name="title" maxLength={32} defaultValue={value} />}
</Field>
```

**Errores de una casa** (publicar y «Editar un dato»): `domain/field-errors.ts` (`listingFieldError`) dice de qué campo es
un mensaje (los mismos mensajes en el navegador, el fake y la base, así que también los del servidor van a su campo);
`step-form.tsx` y `editar.tsx` lo ponen en `FieldErrorContext` (`client/publish/field-error.ts`) y cada campo lo lee con
`useFieldError(name)`. Lo que no es de un campo (ubicación, fotos, red) sigue en el aviso de arriba (`.note[role=alert]`);
si el campo no está en la pantalla (el precio al mes con «No»), también.

### TextInput, TextArea, Select

El campo base: 52 px, borde `--line` de 1 px, radio `--r-control` (8 px, D7), letra de 18 px (nunca menos de 16: el iPhone
ampliaría la página). Desactivado con `--disabled-bg`/`--disabled-fg`; solo lectura (`readOnly`), gris claro sin borde y
seleccionable; con `aria-invalid`, borde `--bad` (también en `select`). Pasan los atributos tal cual, sin `className`.

### AffixInput

Campo con un signo delante, que no se lee (`aria-hidden`): `prefix="₡"` (o `"$"` en Filtros con dólares). `size`: `"lg"` (56 px,
cifra de 24: publicar y editar), `"md"` (52: Filtros), `"sm"` (44 compacto: panel del calendario). Con `aria-invalid`, la
caja va en rojo.

```tsx
<AffixInput {...control} size="lg" prefix="₡" name="nightlyPriceCrc" inputMode="numeric" defaultValue={price ?? ""} placeholder="95 000" />
```

### SearchInput y useCombobox

Buscador con la lupa como icono. `variant`: `"field"` (buscar en una lista: Casas del admin), `"combobox"` (con sugerencias
debajo: «¿Dónde?», «Otra…»), `"float"` (sobre el mapa del paso 2); `after` pone algo al final («Quitar»). `useCombobox({ count,
open, initial: 0 | -1, listbox })` da los ids de la lista y de cada opción, la marcada con las flechas (en bucle) y los
atributos ARIA del campo (`inputProps`); Enter, Escape y elegir los decide cada pantalla. La lista es `ul.suggestions` con
`li.suggestion` (52 px; `.is-active` con el teclado, `.is-chosen` la elegida, en ocre con ✓).

### ChoiceChips y ChoiceCards

`ChoiceChips`: chips con el ✓ en un hueco fijo (marcar no mueve el texto), 44 px. Con `type="checkbox" | "radio"` y `name`
(por defecto `as="input"`), casillas nativas dentro de un `<label>`: el estado lo da el input y el aspecto sale de
`:has(input:checked)`, con el anillo de foco en `:has(input:focus-visible)`. Con `as="button"`, botones con `aria-pressed` para
lo que guarda el estado en la URL (Filtros, Explorar, atajos de noches). `layout`: `"grid"` (dos columnas) o `"kind"` (tres,
icono encima); `float` para los de Explorar sobre el mapa; `label` nombra el grupo. Cada opción: `{ value, label, name? }`
(`name`: nombre accesible largo, «Cargador eléctrico»).

```tsx
<ChoiceChips type="checkbox" name="features" options={FEATURE_CHOICE_ORDER.map((key) => ({ value: key, name: FEATURE_CHOICE_NAME[key], label: <FeatureChoiceLabel feature={key} /> }))} selected={on} onToggle={toggle} />
```

`ChoiceCards` (paso 1 y editar el tipo) se conserva: radios nativos con aspecto de tarjeta, sin `aria-pressed` en el label,
con foco visible y `error` debajo.

### Segmented

Una sola elección en una pista, botones de 44 px: «₡ | $» (`CurrencySwitch`), «Disponible | Ocupado», «Fechas | Número de
noches», «No | Sí» y «Privado | Compartido» (D8). Props: `options` (`{ value, label, name? }`), `value` (o `null`, ninguna),
`onChange`, `label` o `labelledBy`, `name` (campo oculto en un formulario sin controlar), `fill` (a todo el ancho), `float`,
`currency`, `placement` (clases de sitio que ya existían). Botones nativos: Tab y Espacio.

```tsx
<Segmented name="acceptsMonthly" labelledBy="pub-acceptsMonthly" options={[{ value: "no", label: "No" }, { value: "yes", label: "Sí" }]} value={yes ? "yes" : "no"} onChange={(v) => setYes(v === "yes")} />
```

### Stepper y CounterRow

Un solo contador −/+: botones de 44 × 44 en verde tonal, el desactivado común, y un nombre accesible único a partir de
`unit` (`"Una persona" | "Un dormitorio" | "Un baño" | "Una noche"` → «Una persona menos», «Una persona más»). Props:
`value`, `min`, `max`, `onChange`, `empty` («–» en gris), `display` y `valueLabel` (lo que se ve y se lee: «2+», «2 o
más»), `describedBy` (su error), `input` (la cifra en un campo editable, en la hoja de contacto). `CounterRow` es la fila con
`label` e `icon` (`iconByValue` lo pone junto a la cifra).

```tsx
<CounterRow label="Personas" icon={<I.users size={22} />} unit="Una persona" value={ppl} min={0} max={SEARCH_MAX_PEOPLE} empty={!ppl} onChange={setPpl} />
```

### CodeInput, Checkbox, StickyActions

- `CodeInput id value onChange error`: las seis casillas del código (Ingresar y el segundo código del admin), con el campo real
  encima, `one-time-code` y el error enlazado debajo.
- `Checkbox`: casilla con su texto en una fila de 44 px (lista «Antes de decidir» del admin).
- `StickyActions spacer="normal" | "review" | "none" layout="column"?`: la barra de pie fija y su espaciador (`none` cuando
  el formulario ya deja el sitio, como el asistente). El panel del calendario (`.cal-panel`) sigue siendo un panel aparte.

### Excepciones que se conservan

Los chips de escritorio de Explorar a 36 px y 14 px (solo con puntero), el panel compacto del calendario (`AffixInput
size="sm"`), la fecha nativa de «Pausar la casa», el buscador flotante del mapa, las tarjetas del paso 1, la capacidad sin
iconos al editar, el prefijo de país de Ingresar (es un `select`), el chevrón de `select` dibujado en una imagen (no admite
variables) y las casillas de fecha de la hoja de contacto (`DateBox`).
