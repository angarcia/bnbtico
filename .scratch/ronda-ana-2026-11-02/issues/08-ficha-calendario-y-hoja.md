# 08 · Ficha y hoja: calendario seleccionable, fechas compartidas, total y días ocupados

Status: ready-for-agent (después del 07: usa `domain/stay-price.ts`)

## Fechas compartidas
- Una sola fuente en la pestaña: `sessionStorage["bnbtico-fechas"]` (`{llegada, salida}`; la escribe Explorar, `explorar.tsx:134-143`). Módulo pequeño `shared/stay-dates.ts` con `read()`, `write()` y suscripción (evento en memoria) para que ficha y hoja se enteren al momento. El borrador de contacto (`bnbtico-contacto:<CT>`) deja de guardar fechas propias; personas y lo demás igual. Descartar fechas pasadas o mal formadas como hoy (`readSearchDates`, `domain/contact-return.ts:23`).
- **SSR:** la ficha se pinta en el worker y se cachea en el borde sin mirar la query. Nada de leer `sessionStorage`/`window` en el render inicial: leer en `useEffect` tras `useHydrated()`. Sin avisos de hidratación.

## Calendario de la ficha (`shared/listing-calendar.tsx`, `shared/month-grid.tsx`)
- Sigue siendo un mes a la vez con ‹ ›, casillas 47×92 con precio (decisiones 2026-10-29, N4), pero ahora **se elige llegada y salida** tocando días (reutilice la lógica de `domain/range.ts`).
- Estilo del rango **igual que «¿Cuándo?»** (`global.css:467-474`: extremos con `--when-pick`, banda `--when-band` con medias bandas en los extremos), adaptado a la casilla de la ficha; el verde 6 % de los libres y el rayado de los ocupados siguen visibles debajo de la banda; el texto pasa el contraste (`tests/unit/contrast.test.ts`).
- Reglas: no se puede llegar en un día ocupado; un rango con una noche ocupada no vale («Hay noches ocupadas entre esas fechas.»); la salida sí puede caer en el primer día ocupado. «Quitar fechas» debajo.
- Arranca con las fechas compartidas y abre en el mes de la llegada.
- Debajo del calendario, con fechas: «≈ ₡180 000 por 4 noches · 20–24 nov» (`stayEstimate` con los días ya cargados).
- Las casillas pasan a ser botones con el nombre accesible `longDateWithYear(day)` (el mismo que usa la hoja; `tests/e2e/helpers/contact-sheet.ts` depende de él).
- **La caja mide lo mismo antes y después de hidratar** (`ficha-calendario.spec.ts:71`, CLS 0). Reserve la línea del total siempre.

## Barra de precio de la ficha (`PriceColumns`, `listing-page.tsx:178-208`)
- Con fechas, añadir el total orientativo sin cambiar el alto de la barra (p. ej. sustituir la línea secundaria). Sin fechas, igual que hoy. Si no cabe sin cambiar el alto, pare y enseñe dos opciones con captura.

## Hoja «Contactar por WhatsApp» (`shared/contact-sheet.tsx`, `shared/range-calendar.tsx`)
- Recibe los días de la casa (`listingDaysQuery`, ya en caché en la ficha) y **deshabilita** los días donde no se puede llegar (ocupados) con las mismas reglas de arriba; los nombres accesibles no cambian.
- Línea del total orientativo encima de la vista previa del mensaje.
- Cambiar fechas en la hoja actualiza el calendario de la ficha y viceversa.
- Ojo trozos: la hoja y el calendario de rango son trozos diferidos con límite (`9ce860e`, `listing-calendar.tsx:13-16`). No importe `MonthGrid`, `useQuery` o `describe` en `range-calendar.tsx`; pase los días por props. `pnpm size` en verde.

## No tocar
- Mensaje de solo lectura en la hoja (N2, 2026-10-29); personas −/+ con tope de capacidad; flujo de sesión/verificación de `contact-flow.ts`.
- Compartir con precio por noche.
- Precarga de la hoja en reposo tras hidratar.

## Pruebas
- Unit: `stay-dates.ts`; reglas de selección con ocupados; `month-grid.test.tsx` (botones y nombres).
- E2E: `ficha-calendario.spec.ts` (todas siguen; añadir elegir rango, total, rango con ocupado rechazado, alto igual), `ficha.spec.ts` (hidratación sin avisos), `contacto.spec.ts:164` (fechas desde Explorar) y una nueva: cambiar fechas en la ficha → abrir hoja → mismas fechas y mismo total; día ocupado deshabilitado en la hoja.
- Guía `docs/pruebas-manuales.md` C50, C51, C53, U114; actualizar `.scratch/revision-ux/2026-10-29-revision-ux.md` N4 con «cerrado el 2026-11-02».

## Al rehacerlo tras la reversión (2026-11-03): decisiones de Daniel del primer intento (mandan sobre lo anterior)
- Hecho antes: 01 (cabecera, hero 5:4) y 07 (total en Explorar, `domain/stay-price.ts`, `stayTotalLabel` en `domain/search.ts`, sin modo mensual). El 06 y el 09 NO están hechos (Explorar sigue en Limón; la tarjeta no tiene botón de WhatsApp).
- **Barra de precio (opción B):** con fechas, la cifra principal pasa a «≈ ₡285 000 / 3 noches» (y «≈ $559 / 3 noches»; por debajo de 440 px los dólares sin «/ N noches» si no cabe). **El mensual en la barra solo con 30 noches o más:** segunda línea «Mensual: ₡900 000 / mes» o «Mensual: precio a negociar con el dueño»; sin fechas o con menos de 30 noches, una sola línea (sin «Mensual»). Con 30+ noches la barra crece ~20 px tras hidratar (aceptado: va fija abajo).
- **Casilla «Alquiler mensual»** de las características: el precio en una línea aparte, debajo y más pequeña («₡900 000 / mes» o «A negociar»), en una casilla de dos columnas que va **la primera** de la rejilla (para no dejar huecos). Igual en SSR y cliente.
- **Fechas que traen noches ocupadas** (de Explorar o de un enlace): ficha y hoja dicen «Hay noches ocupadas entre esas fechas.» y no calculan total; la barra con el precio por noche.
- **«Abrir WhatsApp» (y «Continuar» sin sesión) bloqueado** con noches ocupadas **y mientras cargan los días**; se desbloquea al elegir otras fechas o quitarlas.
- Volver a Explorar vuelve a escribir las fechas de su búsqueda (se deja así).
- Rango en la ficha con el mismo estilo de «¿Cuándo?» (extremos terracota, banda translúcida).
- Presupuesto: el trozo de la hoja de contacto puede pasar de 7 a 7,5 KB (aprobado); nada más sin preguntar.
- El texto «dueño/propietario» se queda como está: «anfitrión» es el ticket 02.
- Referencia del primer intento: `git show 4b815b9` y `git show e84ce58` (revísalo, no lo copies a ciegas).
