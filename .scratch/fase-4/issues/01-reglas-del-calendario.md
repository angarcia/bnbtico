# 01: Calendar rules in the domain (Vitest port of the prototype)

**What to build:** `src/domain/calendar.ts`, pure and framework-free, with the v1 rules of `tests/prototype/calendar.cjs` ported to Vitest. No database, no screens. See `.scratch/fase-4/spec.md` § Domain.

**Blocked by:** none (phase 3 done).

**Status:** done

- [x] Unit tests first (`tests/unit/calendar.test.ts`), one `describe` per prototype rule group listed in the spec (§ Domain, last bullet), each naming the `calendar.cjs` assertion it ports. Seasons/weekend/«Configurar tarifas» rules are not ported (out of v1); say so in a comment at the top.
- [x] Types `CalendarDay`, `DayState`, `CalendarChange`; `effectiveDay`, `monthGrid` (Monday-first, blanks, `past`), `calendarWindow` (today CR … +365), `compactPrice` («95k», «180k», «1,2M»).
- [x] Selection reducer (`selectDay`, `clearSelection`, `setAvailability`, `setPrice`) with prefill, «Varios precios» on mixed prices, editing intent, last deselection clears the draft; `changeFromSelection()` → `null` when nothing chosen.
- [x] `applyChange` (occupy/free keep price; price = base ⇒ no ★ and no stored row; only differences stored) and `validateChange` / `validateReopenDate` with `CALENDAR_MESSAGES` (exact strings of the spec, to be reused by the RPCs and the fake).
- [x] `selectionLabel` (contiguous, cross-month, non-contiguous, singular) and `occupiedNightsIn(days, month)`.
- [x] `tests/unit/architecture.test.ts` still green (no framework imports). `node tests/prototype/calendar.cjs` still passes (file untouched).
- [x] Green: `typecheck`, `test`, `build`, `size` (no UI: size must not move).

## Cierre (2026-10-23)

- `apps/app/src/domain/calendar.ts` (sin frameworks; importa solo `./listing` —`parseColones`, tipo `ListingStatus`—, `./money` y el tipo de `./currency`). Pruebas en `apps/app/tests/unit/calendar.test.ts`: 66 casos, un `describe` por grupo de reglas de `calendar.cjs` con la aserción que porta; el comentario de cabecera dice qué no se porta (temporadas, fin de semana, «Restaurar tarifa» con tarifas, «Configurar tarifas»).
- API para los tickets siguientes:
  - Tipos `CalendarDay`, `DayState`, `CalendarChange`, `CalendarListing`, `Selection`, `SelectionContext`, `GridDay`; `CalendarDays` acepta lista o `Map` (la rejilla consulta 42 días).
  - `effectiveDay`, `monthGrid(month, today)` (lunes primero, huecos `null` al inicio y al final, `past` y `beyond` = después de hoy + 365), `calendarWindow(today)` → `{first, last, firstMonth, lastMonth}`, `addDays`, `addMonths`, `monthTitle` («Diciembre 2026»), `compactPrice(crc, currency?)`.
  - Reductor: `emptySelection`, `selectDay(s, día, ctx)` (ignora pasados, fuera de ventana e inexistentes; ordena), `clearSelection`, `setAvailability`, `setPrice` (texto del campo; acepta «95 000», «₡95.000» con `parseColones`), `changeFromSelection` → `null` si no hay días o nada elegido; un precio ilegible o vacío llega como `NaN` y lo rechaza `validateChange` (como el prototipo).
  - `validateChange(change, { today, listing })` (`listing: null` = invitado, ajena o inexistente) en el orden de la RPC; `applyChange(days, base, change)` devuelve una lista nueva ordenada solo con diferencias (no valida: validar antes).
  - `validateReopenDate`, `availabilityUpdate(listing, available, reopenAt, today)` (reglas de `set_listing_available` de tres argumentos) y `reopenIfDue(listing, today)` (la de `reopen_due_listings`; nunca toca el estado ni los días). Para el fake del ticket 02.
  - `selectionLabel`, `occupiedNightsIn` y `occupiedNightsLabel` («Diciembre: 9 noches ocupadas», «Enero: 1 noche ocupada», «Sin noches ocupadas este mes»).
- `CALENDAR_MESSAGES`: los siete del spec tal cual, más `notActive` (el mensaje vigente de `set_listing_available`, «Solo puede cambiar la disponibilidad de una casa activa.») y **dos que el spec no redacta** y la migración del ticket 02 debe copiar: `noNightlyPrice` «Esta casa se alquila solo por mes: no lleva precio por noche.» (precio en casa solo mensual) y `reopenWhileOpen` «La fecha de reapertura solo se pone al cerrar la casa.» (fecha con `p_available = true`).
- La regla «cerrada sigue visible y sin contacto» se prueba aquí como «cerrar no cambia el estado (`can(…, "share")`)»; el rechazo de la consulta ya lo cubre `tests/contract/inquiries.contract.ts` (`unavailable`).
- Baterías (desde `apps/app`): `typecheck` limpio; `test` 47 archivos, 603 pruebas en verde; `build` en verde (incluye la prueba de arquitectura); `size` sin cambios: zona privada 136,51 KB gz / 150, pestañas 18,58 / 20, hoja de contacto 4,87 / 5 (idénticos con y sin el módulo: nada lo importa todavía). `node tests/prototype/calendar.cjs` pasa (archivo sin tocar). Sin `test:db` ni `test:e2e` (no hay cambios de base ni de UI).
