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
WhatsApp» de Actividad (`inquiry-wa`), los flotantes del mapa (`float-btn`, `map-label`, `map-count`), los chips, los
segmentos (`.seg`, `CurrencySwitch`), los contadores −/+ (paso 4 de la migración), `house-tool`, `new-house` y la portada
estática (`public/portada.html`).
