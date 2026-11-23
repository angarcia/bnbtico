# Componentes de la interfaz

Guía de las piezas comunes de `apps/app` (historia 07, «unificar estilos mediante componentes reutilizables», pasos 1 a 6,
2026-11-19/20). Cada componente tiene props cerradas (`variant`, `size`, `tone`, `placement`) y su CSS en un solo sitio; las
pantallas no escriben sus clases ni redefinen su aspecto, y no llevan `className` libre. Decisiones en `docs/decisiones.md`
(2026-11-19 y 2026-11-20); propuesta e inventarios en `.scratch/revision-app-2026-11-17/07/`.

## Índice

1. [Reglas generales](#reglas-generales)
2. [Botones](#botones): `Button`, `ButtonLink`, `TextButton`, `IconButton`, `ButtonPlaceholder`, `ConfirmSheet`
3. [Hojas y ventanas](#hojas-y-ventanas): `Sheet`, `Dialog`, `FullScreen`, `useDismiss`
4. [Campos](#campos): `Field`, `TextInput`, `TextArea`, `Select`, `AffixInput`, `SearchInput`, `Checkbox`, `StickyActions`, `CodeInput`
5. [Elegir y contar](#elegir-y-contar): `ChoiceChips`, `ChoiceCards`, `Segmented`, `Stepper`, `CounterRow`
6. [Estructura](#estructura): `ScreenHeader`, `Card`, `List`/`ListRow`, `ClosedField`, `NavBar`
7. [Estados y avisos](#estados-y-avisos): `StatusTag`, `CountBadge`, `Notice`, `LoadError`, `EmptyState`, `Skeleton`
8. [Tokens](#tokens)
9. [Prueba de consistencia y sus excepciones](#prueba-de-consistencia-y-sus-excepciones)
10. [Crear una pantalla nueva](#crear-una-pantalla-nueva)

## Reglas generales

- **Dónde vive cada pieza.** En `src/shared/ui/` lo que no usa el router ni consultas (lo usa también la ficha SSR):
  `button.tsx`, `overlay.tsx`, `field.tsx`, `choice.tsx`, `stepper.tsx`, `structure.tsx`, `card.tsx`, `closed-field.tsx`.
  Las variantes sobre `Link` de TanStack Router, en `client/comun/router-buttons.tsx` (`RouterButtonLink`, `RouterTextLink`,
  `RouterIconLink`) y `client/comun/router-rows.tsx` (`RouterCardLink`, `RouterListRow`). `ScreenHeader` está en `client/comun/screen-header.tsx`.
- **CSS** en `shared/ui/componentes.css` (un bloque por familia; los tokens, en `:root` de `styles/tokens.css`); las hojas de cada área solo colocan
  (rejillas, márgenes), nunca cambian el aspecto de un componente.
- **`placement`** es la única puerta para clases: una lista cerrada de las clases de sitio que ya existían. Si falta una
  colocación o un tono, se añade al componente con su caso de uso, no se escribe la clase en la pantalla.
- **JS inicial** (`.size-limit.json`, 161 KB con al menos 1 KB de margen, decisión del 2026-11-20): lo que no hace falta en la
  primera pantalla del teléfono va en su trozo (`card-*`, `closed-field-*`, `router-rows-*`, `status-label-*`,
  `explorar-escritorio-*`, `panel-dias-*`). Antes de importar un componente diferido desde el arranque, mire `pnpm size`.

## Botones

`shared/ui/button.tsx`. CSS: «Botones» de `shared/ui/componentes.css`.

| Pieza | Cuándo | Props clave |
|---|---|---|
| `Button` / `ButtonLink` / `RouterButtonLink` | una acción | `variant` `primary` · `secondary` · `pay` · `whatsapp` · `danger`; `size` `md` 44 · `lg` 52 · `xl` 56; `block`; `icon`; `pending` (solo `Button`: `aria-busy` y `disabled`) |
| `TextButton` / `TextButtonLink` / `RouterTextLink` | acción en texto, 44 px | `tone` `link` · `quiet` · `danger` |
| `IconButton` / `IconButtonLink` / `RouterIconLink` | solo un icono, 44 × 44 | `label` obligatorio; `tone` `plain` · `overlay` · `float` |
| `ButtonPlaceholder`, `IconButtonPlaceholder` | la caja antes de hidratar | las de aspecto |
| `ConfirmSheet` (`client/comun/confirm-sheet.tsx`) | confirmar | `tone` `default` · `destructive` · `keep`; `pending` |

- `primary`: la principal (verde tonal). `secondary`: «Cancelar», «Ahora no», siempre con contorno (D3). `danger`: todo lo
  destructivo, en terracota, también en el admin (D2). `pay`: **solo** dinero (lo vigila `tests/unit/ocre.test.ts`).
  `whatsapp`: **solo** hablar con el anfitrión; para escribir a 3bstays, `secondary` con `icon={<WaIcon />}` (D4).

```tsx
<Button variant="primary" size="lg" type="submit" pending={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
<RouterButtonLink to="/explorar" variant="secondary">Ir a Explorar</RouterButtonLink>
<IconButton label="Mes anterior" placement="cal-arrow" onClick={prev}><I.back size={20} /></IconButton>
```

**No:** `className="btn …"`, un «Cancelar» que no sea `secondary`, ocre fuera del dinero, ni un `IconButton` sin `label`.

## Hojas y ventanas

`shared/ui/overlay.tsx` (con la pila de `shared/ui/overlay-stack.ts`); `useDismiss` en `shared/ui/dismiss.ts`. CSS en
`shared/ui/componentes.css` (capas `componentes` y `escritorio`).

| Pieza | Cuándo | Cierra con el fondo | Atrás |
|---|---|---|---|
| `Sheet` | hoja inferior (en escritorio, ventana normal) | sí | teléfono |
| `Dialog size="normal"` | ventana de escritorio, 520 px (también cada dato de una casa, `layout="field"`) | sí | no |
| `Dialog size="wide"` | ventana ancha (la Ubicación de una casa), hasta 960 px; con `layout="photos"`, el editor de fotos casi a pantalla completa (`--dialog-w-photos`, alto fijo) | no | no |
| `FullScreen` | Descripción, Vista previa | — | siempre |

La pila pone `role="dialog"`, `aria-modal`, el foco (dentro al abrir, de vuelta al cerrar), Escape y Tab solo en la de arriba,
y el aviso (`toast`) siempre encima. Con `confirmDiscard={() => hayCambios}`, cerrar pregunta «¿Descartar los cambios?» (D10);
`busy` impide cerrar. Si la pestaña se va a WhatsApp, llame a `leavingPage()` antes de cerrar. `subtitle` pone una línea
pequeña bajo el título, en la hoja y en la ventana (el nombre de la casa en la ventana de un dato, el contador en Fotos).

**Una ventana con su propia URL** (los datos de una casa en escritorio, historia 06): la ruta pinta la pantalla de debajo y la
ventana encima; cerrar vuelve atrás en el historial. Atrás del navegador sale de la ruta, así que con cambios se para con
`useBlocker` de TanStack Router y se pregunta con `DiscardConfirm` (el mismo «¿Descartar los cambios?» de `confirmDiscard`,
exportado de `overlay.tsx`). Como la pantalla de debajo se vuelve a montar al cambiar de ruta, `returnFocus` busca el
disparador por un atributo (`data-edit-field`). Ejemplo en `client/propietario/publicar/editar.tsx` (`EditFieldForm` con `dialog`). `useDismiss` es para
desplegables no modales (selector de casa en escritorio, paneles de Explorar): Escape, clic fuera y perder el foco.

```tsx
<Sheet title="Pausar la casa" closeButton={false} onClose={onClose} confirmDiscard={() => date !== ""}>…</Sheet>
<Dialog size="normal" layout="field" title="Precio" subtitle="Casa Coco" confirmDiscard={dirty} busy={saving} onClose={finish}
  footer={<><Button variant="secondary" onClick={finish}>Cancelar</Button><Button variant="primary" type="submit" form={formId}>Guardar</Button></>}>…</Dialog>
```

**No:** un `<dialog>` o una capa propia, ni clases `sheet` / `dialog*` en la pantalla. Excepción: el fondo atenuado
(`sheet-backdrop`) que pintan algunas pantallas mientras llega el trozo de su hoja, y la hoja de contacto en línea de la ficha
de escritorio.

## Campos

`shared/ui/field.tsx` y `client/comun/code-input.tsx`. CSS: «Campos» de `shared/ui/componentes.css` (52 px, borde `--line`, radio `--r-control`, letra
de 18 px; nunca menos de 16).

- `Field label error hint count size describedBy grow`: envuelve un control y le da `id`, `aria-describedby` y `aria-invalid`.
  **El error va debajo del campo que falla**, con `role="alert"`. Errores de una casa: `listingFieldError`
  (`domain/field-errors.ts`) y `useFieldError(name)` (`client/propietario/publicar/field-error.ts`).
- `TextInput`, `TextArea`, `Select`: el control base. `AffixInput prefix size` (`lg`, `md`, `sm`): con «₡» o «$» delante.
  `SearchInput variant` (`field`, `combobox`, `float`) con `useCombobox` (`shared/ui/combobox.ts`). `Checkbox`: casilla de 44 px.
- `StickyActions spacer layout`: la barra de pie fija. `CodeInput`: el código de 6 dígitos.

```tsx
<Field id="pub-title" label="Nombre de la casa" error={useFieldError("title")} count={{ text: `${n} / 32` }}>
  {(control) => <TextInput {...control} name="title" maxLength={32} />}
</Field>
```

**No:** un `<input>` con su propio estilo, el error en una caja arriba si es de un campo, ni letra de menos de 16 px.

## Elegir y contar

`shared/ui/choice.tsx`, `shared/ui/stepper.tsx`, `ChoiceCards` en `client/propietario/publicar/wizard-parts.tsx`.

- `ChoiceChips type="checkbox" | "radio" | as="button"`: chips de elección con el ✓ en un hueco fijo (`as="button"` con
  `aria-pressed` cuando el estado está en la URL). `ChoiceCards`: las tarjetas del paso 1.
- `Segmented options value onChange`: una sola elección en una pista de 44 px («₡ | $», «No | Sí», «Disponible | Ocupado»).
- `Stepper` / `CounterRow`: el único contador −/+, con `unit` para el nombre accesible («Una persona más»).

```tsx
<Segmented label="Disponibilidad" options={AVAILABILITY} value={value} onChange={setValue} fill />
<CounterRow label="Personas" icon={<I.users size={22} />} unit="Una persona" value={ppl} min={0} max={16} onChange={setPpl} />
```

**No:** `aria-pressed` en un `<label>`, dos chips para «Sí/No» (es un segmento, D8), ni botones −/+ propios.

## Estructura

- **`ScreenHeader kind`** (`client/comun/screen-header.tsx`): `"root"` (pestañas y raíz: `title`, `home`, `action`, `aside`), `"flow"`
  (flecha `back={{ to, search?, historyBack? }}` **o** `close`, título con elipsis, `action`) y `"wizard"` (título, `action` y
  la ✕ a la derecha; `below` para el progreso; lo usa `WizardHeader` y el esqueleto de carga de `shell.tsx`). `close` es
  `{ to, label, title? }` o `{ onClick, label, title?, disabled?, busy? }`. No entra en la ficha SSR (usa `Link`).
- **`Card`** (`shared/ui/card.tsx`): `tone` `plain` · `solid` · `soft` · `sun` (dinero), `layout` `stack` · `row`, `gap`, `as`,
  `mark` `new` · `target`, `placement`. `CardLink` / `RouterCardLink` para una tarjeta que es un enlace. `cardClass()` solo
  para una pieza que toma el fondo de una tarjeta (la caja de un mapa).
- **`List` y `ListRow`, `ListRowButton`, `ListRowLink`, `RouterListRow`**: filas de 56 px; `tone="sun"` para la fila del pago.
- **`ClosedField kind`** (`shared/ui/closed-field.tsx`): `search` (la sección plegada de la búsqueda; `open` la convierte en su
  título), `picker` (selector de casa o zona) y `date` (fechas de la hoja de contacto).
- **`NavBar`** (`shared/ui/structure.tsx`): la barra de pestañas de presentación que comparten `TabsFrame` y la ficha
  (`SiteTopBar`); cada lado pinta sus enlaces con `renderLink`. `NavItemContent` y `BrandLogo` para lo de alrededor.

```tsx
<ScreenHeader kind="flow" title="Calendarios de Airbnb" back={{ to: "/propietario/calendario", historyBack: true }} />
<Card as="article" layout="stack" gap={10} placement="inquiry-card" mark={isNew ? "new" : undefined}>…</Card>
<List><RouterListRow to="/ayuda"><span className="body">Ayuda por WhatsApp</span></RouterListRow></List>
```

**No:** `<header className="header-flow">` a mano, `className="card …"`, ni una tarjeta ocre fuera del dinero.

## Estados y avisos

`shared/ui/structure.tsx`; los textos de estado en `domain/status-label.ts`.

- **`StatusTag label placement tight small`**: etiqueta redonda (D5). `label` sale de `statusLabel(status)` (un solo texto por
  estado en toda la app, también en «Casas» del admin), `holdLabel(kind, "photo" | "row")`, `editStatusLabel(status, "card" |
  "field")`, `cardLabel(l, edit)` (`domain/navigation.ts`) o `houseLabel(h)` (`domain/admin-houses.ts`); lo que no es un estado
  va como `{ text, tone }`. `placement`: `row` (por defecto), `photo` (sobre la foto), `field` (la fila de un dato). Los textos
  largo y corto se mantienen: «Pausada por 3bstays» sobre la foto, «Pausada» en las filas.
- **`CountBadge n placement`**: el único contador (`tab`, `house`, `filters`). Con `n <= 0` no pinta nada.
- **`Notice tone`**: `info`, `solid`, `sun` (dinero), `review`, `error` (siempre `role="alert"`); `announce` pone
  `role="status"`; `small`, `layout`, `inline`, `action`.
- **`LoadError onRetry`**: el error de carga de **toda** pantalla donde falla una consulta, rojo con «Reintentar», que llama a
  su `refetch` (si son dos, a las que fallaron). Texto por defecto «No pudimos cargar las casas…» o el mensaje del dominio como
  `children`. No va en «Ver más casas» (su botón ya reintenta) ni en los errores de una acción (`Notice tone="error"`).
- **`EmptyState title text action framed gap titleLevel`**: «no hay nada aquí» o «no encontramos…», en tarjeta o sin ella.
- **`Skeleton shape label count`**: `row`, `line`, `avatar`, `account`, `subscription`, `calendar`, `grid`; con `label`,
  `aria-busy` y `aria-label`.

```tsx
<StatusTag placement="photo" label={cardLabel(l, l.edit)} data-testid="card-label" />
{query.isError ? <LoadError onRetry={() => void query.refetch()}>{message(query.error)}</LoadError> : <Skeleton shape="row" label="Cargando sus casas" />}
<EmptyState title="No encontramos esta casa" text={<p className="small muted">Puede que la haya descartado.</p>} />
```

**No:** escribir el texto de un estado en la pantalla, un aviso de error sin `role="alert"`, un error de carga sin
«Reintentar», ni un esqueleto propio.

## Tokens

La fuente es `design/tokens/tokens.json` **0.3.6**; el CSS los expone como variables en `:root` de `styles/tokens.css` (claro y
oscuro). Familias:

- **Color:** `--bg`, `--surface`, `--surface-soft`, `--surface-2`, `--fg`, `--fg-title`, `--muted`, `--line*`, `--primary*`,
  `--state-soft/ink`, `--sun*`, `--review-soft`, `--brand*`, `--bad*`, `--busy*`, `--wa*`, `--overlay`, `--on-overlay`,
  `--chosen`, `--scrim`, `--focus-ring`, `--disabled-bg/fg`.
- **Letra:** `--fs-eyebrow` 13 · `--fs-xs` 14 · `--fs-sm` 15 · `--fs-note` 16 · `--fs-base` 17 · `--fs-md` 18 · `--fs-title`
  20 · `--fs-h2` 24 · `--fs-h1-desktop` 30 · `--fs-h1` 34; pesos `--w-regular`, `--w-medium`, `--w-strong`.
- **Radios:** `--r-control` 8 · `--r-pill` 6 · `--r-thumb` 10 · `--r` / `--r-tile` 12 · `--r-sheet` 16 · `--r-tag` 999.
- **Sombras:** `--shadow`, `--shadow-float`, `--float-shadow`, `--shadow-action`, `--shadow-lift`.
- **Capas:** `--z-explore`, `--z-float`, `--z-bar`, `--z-banner`, `--z-panel`, `--z-topbar`, `--z-overlay`, `--z-toast`.
- **Espacio y tamaño:** `--gutter` 16, `--gutter-tight` 12, `--hit` 44, `--dialog-w`, `--dialog-w-wide`, `--dialog-w-photos` (el editor de fotos, historia 06), `--nav-h`.
- **Puntos de corte** (`breakpoints` del JSON): 900 (lista y mapa en columnas), 1024 (marco de escritorio, `shared/desktop.ts`),
  1200.

Un token nuevo va primero en `tokens.json` (con su entrada en `changelog`) y después en `:root`.

## Prueba de consistencia y sus excepciones

`apps/app/tests/unit/consistencia.test.ts` falla, con archivo:línea y qué usar, si:

1. fuera de `styles/tokens.css` y de los bloques `:root` aparece un color hex o `rgb()`, un `border-radius` en px, un
   `z-index` numérico (salvo -1 a 3, el orden dentro de un componente), un `font-size` en px o una sombra que no es un token;
2. un TSX de `src/client` o `src/shared` escribe la clase de un componente común fuera de su archivo (botón, hoja, ventana,
   campo, chip, segmento, contador, tarjeta, fila, aviso, etiqueta, esqueleto, campo cerrado o cabecera);
3. un `style={{…}}` lleva colores, fondos, bordes, radios o sombras;
4. vuelven los textos de escritorio en `content:` o las variables y clases retiradas;
5. un archivo de `TEXT_SCOPE` (los que ya tienen sus textos en el catálogo del área) escribe texto suelto en el JSX: texto
   entre etiquetas, `label`, `title`, `aria-label`, `placeholder`, `alt` o `text:` con palabras. El texto va en la carpeta `copy/` del área (`client/<área>/copy/`, la ficha en `shared/copy/`, los componentes comunes en
   `shared/ui/copy/`): un módulo por pantalla o pieza, un `export const` por mensaje, importado con `import * as X_COPY`.
   Mensajes completos, los datos como parámetros con nombre y los plurales con `plural()` de `domain/plural.ts`. Los textos
   de una pieza diferida van en su propio módulo, para que no entren en el JS inicial. Al pasar un área, su carpeta se añade a `TEXT_SCOPE`.

**Añadir una excepción** (solo si de verdad no cabe en un token o un componente):

- CSS: una entrada en `CSS_EXCEPTIONS` con `file` (relativo a `src/`), `selector` (expresión sobre el selector entero), `rule`
  (`color`, `radius`, `z-index`, `font-size` o `shadow`) y `why` en una línea.
- Clase en un TSX: en `CLASS_EXCEPTIONS`, `"archivo": { "clase": "motivo" }`.
- Las excepciones que dejan de coincidir hacen fallar la prueba «cada excepción sigue haciendo falta»: quítelas.

Hoy quedan como excepción los tamaños de letra de un solo uso (títulos y cifras fuera de la escala), los blancos y sombras sobre
las fotos y el mapa, Leaflet (fondo y capas 500/600/1000), el QR, la máscara de la descripción, el aviso de girar el teléfono,
algunas sombras y radios de dibujo de un solo uso, y en el TSX los chips de navegación, el fondo atenuado mientras llega una
hoja, la hoja de contacto en línea, la cabecera de las páginas de estado de la ficha y el selector de zona del paso 2.

## Crear una pantalla nueva

Una pantalla se compone con estas piezas y no lleva CSS propio. Ejemplo (una pantalla de flujo en `client/<área>/`, con un dato que se guarda):

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScreenHeader } from "../comun/screen-header";
import { Button } from "../../shared/ui/button";
import { Card } from "../../shared/ui/card";
import { Field, StickyActions, TextInput } from "../../shared/ui/field";
import { EmptyState, LoadError, Notice, Skeleton, StatusTag } from "../../shared/ui/structure";
import { RouterButtonLink } from "../comun/router-buttons";
import { statusLabel } from "../../domain/status-label";

export function NotaDeCasaScreen({ id }: { id: string }) {
  const { data, isError, refetch } = useQuery(casaQuery(id));
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ScreenHeader kind="flow" title="Nota de la casa" back={{ to: "/propietario/casas", historyBack: true }} />
      {isError ? <LoadError onRetry={() => void refetch()}>No pudimos cargar la casa. Revise su conexión e inténtelo de nuevo.</LoadError>
        : data === undefined ? <Skeleton shape="row" label="Cargando su casa" />
        : data === null ? (
          <EmptyState title="No encontramos esta casa" text={<p className="small muted">Puede que la haya descartado.</p>}
            action={<RouterButtonLink to="/propietario/casas" variant="primary">Ir a Mis casas</RouterButtonLink>} />
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); setError(nota.trim() ? null : "Escriba una nota."); }}>
            <Card layout="stack" gap={12}>
              <StatusTag label={statusLabel(data.status)} />
              <Field id="nota" label="Nota para usted" error={error} hint="Solo la ve usted.">
                {(control) => <TextInput {...control} value={nota} onChange={(e) => setNota(e.target.value)} />}
              </Field>
            </Card>
            <Notice>Puede cambiarla cuando quiera.</Notice>
            <StickyActions spacer="normal">
              <RouterButtonLink to="/propietario/casas" variant="secondary" size="lg">Cancelar</RouterButtonLink>
              <Button variant="primary" size="lg" type="submit">Guardar</Button>
            </StickyActions>
          </form>
        )}
    </>
  );
}
```

Reglas: la cabecera es siempre `ScreenHeader`; los errores de una consulta, `LoadError` (o `Notice tone="error"` con el mensaje
del dominio); los textos de estado, de `domain/status-label.ts`; nada de `className` con las clases de estos componentes (lo
para `tests/unit/estructura.test.tsx`), ni hex, tamaños de letra, radios o sombras sueltos: si falta un tono o una colocación,
se añade al componente con su caso de uso.
