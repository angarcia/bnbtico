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

### Excepciones con su propio CSS

No pasan por estos componentes: el corazón (`FavoriteButton`), el icono de WhatsApp de la tarjeta (`card-wa`), «Abrir
WhatsApp» de Actividad (`inquiry-wa`), los flotantes del mapa (`float-btn`, `map-label`, `map-count`), los chips, los
segmentos (`.seg`, `CurrencySwitch`), los contadores −/+ (paso 4 de la migración), `house-tool`, `new-house` y la portada
estática (`public/portada.html`).
