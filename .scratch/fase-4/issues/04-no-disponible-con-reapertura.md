# 04: «No disponible» with reopening date and the house detail (design 19)

**What to build:** closing a house to consultations with an optional reopening date from the detail switch, the closed labels, and the «Calendario y precios» row with the occupied nights of the month. See spec § «No disponible» with reopening date.

**Blocked by:** 03

**Status:** done

- [x] Switch off → bottom sheet «Cerrar a consultas» (dialog semantics as the contact sheet: focus trap, Escape, backdrop) with optional date (min tomorrow, max +365, `validateReopenDate`), «Cerrar a consultas» / «Cancelar». Switch on → one tap, optimistic, clears the date. DB message on refusal.
- [x] Row label «Cerrada hasta el <fecha>» / «Cerrada a consultas»; Mis casas pill unchanged; the public contact button already shows the date (check it with a real closed-with-date house).
- [x] Detail row «Calendario y precios» → «<Mes>: N noches ocupadas» / «Sin noches ocupadas este mes», from the calendar query; links to the calendar with `casa=`.
- [x] Size: sheet inside the `propietario` chunk; tab-screens limit raised to 21 KB only if needed, justified.
- [x] Playwright: close with date → «Cerrada hasta el …» → ficha button «No disponible… Vuelve a estar disponible el …» → `select reopen_due_listings('<date>')` via SQL → detail and ficha open again, prices and occupied nights intact; close without date stays closed after `reopen_due_listings(+40 days)`; reopen by hand clears the date; a house put back to edit (draft) with a due date is reopened to consultations but stays hidden.
- [x] Green: `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`, `lighthouse`.

## Cierre (2026-10-23)

- **Hoja** `apps/app/src/client/close-sheet.tsx` (solo la importa el detalle, va en el trozo `propietario`): `role="dialog"` con `aria-labelledby` «Cerrar a consultas», página `inert`, foco atrapado, Escape / fondo / «Cancelar» la cierran y el foco vuelve al interruptor; fecha `min` mañana CR y `max` +365, `validateReopenDate` con el mensaje de la base dentro de la hoja; «Cerrar a consultas» relleno y «Cancelar». Encender = un toque optimista que borra la fecha. Rechazo de la base: vuelve atrás y muestra su mensaje en el detalle.
- `useSetAvailable` (`src/client/owner.ts`) ahora recibe `{ available: true } | { available: false; reopenAt }` y parchea `available` y `reopenAt` (y los restaura al fallar); «Abrir a consultas» del calendario pasa `{ available: true }`.
- Detalle (`src/client/screens/propietario.tsx`): bajo el interruptor «Cerrada hasta el <fecha>» / «Cerrada a consultas» (con la casa abierta, el subtítulo de siempre). Fila «Calendario y precios» → `occupiedNightsLabel` del mes actual CR desde `calendarQuery` (una petición ligera que comparte caché con la pantalla del calendario), enlace con `casa=<id>`. La pastilla «No disponible» de Mis casas no cambia.
- **Playwright** `tests/e2e/no-disponible.spec.ts` (4, Pixel 7, cada prueba siembra sus casas): cerrar con fecha (Escape, fondo, Cancelar, fecha de hoy rechazada, Tab dentro de la hoja) → «Cerrada hasta el …» → pastilla en Mis casas → ficha SSR (casa nunca visitada) con «No disponible para consultas» y «Vuelve a estar disponible el …» → `select public.reopen_due_listings('<fecha>')` con `sql()` → detalle abierto y ficha (por la SPA, desde «Ver ficha») con «Contactar por WhatsApp»; precio y días (ocupados y ★) intactos. Sin fecha sigue cerrada tras `reopen_due_listings(+40)`. Abrir a mano borra la fecha; rechazo de la base vuelve atrás con su mensaje. Casa devuelta a borrador con fecha vencida: `available` true, `status` draft, sin ficha pública. Ajustadas `propietario.spec.ts` y `app-instalada.spec.ts` (apagar pasa por la hoja). Capturas revisadas: `test-results/no-disponible-hoja.png`, `no-disponible-cerrada.png`.
- La frescura de la ficha SSR en caché tras la reapertura se deja al ticket 05 (aquí la ficha del servidor solo se mira en una casa recién creada).
- **Baterías** (desde `apps/app`): `typecheck` limpio; `test` 49 archivos, 623 pruebas; `test:db` 15 archivos, 164; `build` en verde; `test:e2e` 92 en verde + 2 omitidas (medición); `lighthouse` ficha en frío LCP **1,62 s**, shell instalado **0,25 s**.
- **Tamaños (gz):** pestañas **18,59 → 19,55 / 20 KB** (límite sin tocar); zona privada inicial **139,06 → 139,07 / 150**; calendario 6,26 → 6,56 / 8 (el detalle usa `occupiedNightsLabel` y `calendarQuery`: Rolldown saca la consulta a `calendar-days-*.js`, 0,5 KB, que ya cubría el patrón `calendar-*`); hoja de contacto 4,86 / 5 (sin tocar).
- Sin migraciones. **Para Daniel:** nada nuevo (la migración del ticket 02 sigue pendiente en `bnbtico-pruebas`).
