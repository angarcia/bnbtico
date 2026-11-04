# 04 · Calendario del anfitrión: «Marcar una reserva»; fuera «Cerrar la casa»

Status: ready-for-agent

## Qué
1. En `client/screens/calendario.tsx:318` la fila «Cerrar la casa hasta…» pasa a **«Marcar una reserva»** (ayuda: «Marque de una vez las noches de una reserva larga como ocupadas.»). Abre una hoja con el **calendario de rango de «¿Cuándo?»** (`shared/range-calendar.tsx`, el mismo que usa la hoja de contacto) para elegir llegada y salida, y un botón «Marcar como ocupado». Guarda con la RPC existente `save_listing_days(p_listing, p_days, p_available=false)` las noches **de llegada a salida − 1** (la salida no se ocupa; misma regla que Explorar). Precios especiales de esos días se conservan.
   - Si alguna noche ya estaba ocupada, no pasa nada (queda ocupada). Texto de confirmación: «3 noches marcadas como ocupadas · 20–22 dic» (reutilice `selectionLabel` de `domain/calendar.ts:301`).
   - Ventana: la del calendario (`inWindow`, hoy a +12 meses).
2. **Quitar cerrar/abrir la casa entera de la app:** `client/close-sheet.tsx`, la fila, el estado «Cerrada hasta…», el calendario atenuado de solo lectura cuando `!available` (`calendario.tsx:197,234,240,265`), la acción `available` de `domain/can.ts:15`, `availabilityUpdate`/`validateReopenDate` si quedan sin uso, `setAvailable` de los adaptadores (`data/postgrest/owner.ts:109-115`, `data/fake/owner.ts:125-132`) y de `ListingsApi` (`domain/api.ts:112`). Borre lo que quede sin uso, con sus pruebas.
3. **Migración nueva** `reabrir_casas_cerradas`: `update listings set available = true, reopen_at = null where not available` (con `set local app.allow_status = 'on'` si el trigger lo exige). No borre columnas, RPC `set_listing_available` ni el `pg_cron` `bnbtico-reabrir-casas` (se retiran más adelante; decisión 2026-11-02).
4. La ficha deja de tener el estado «No disponible por ahora» en la práctica, pero **no** quite aún ese código de `listing-page.tsx:79-86` (lo sigue usando el SSR si una fila quedase cerrada); anótelo como pendiente.

## No tocar
- El calendario de cada casa: tocar días uno a uno para Ocupado/precio sigue igual (`selectDay`, `setAvailability`, `setPrice`).
- `search_listings` sigue exigiendo `l.available` (no cambie la RPC en este ticket).
- Estilo del rango de «¿Cuándo?» (extremos cuadrados 8 px terracota 50 %, banda 9 %; decisiones 2026-10-29).
- Trozos diferidos: `range-calendar` es un trozo aparte; impórtelo con `lazy` en la hoja, no en el trozo de las pestañas sin medir `pnpm size`.

## Pruebas
- E2E a reescribir: `calendario.spec.ts:345-352,422-448`, `fase4.spec.ts:191-231` (cierre/reapertura → marcar reserva). `no-disponible.spec.ts`: déjelo si sigue cubriendo SSR de una fila cerrada sembrada por SQL; si no, explíquelo.
- Contrato: `calendar.contract.ts:126,147` (quitar lo de `setAvailable`; añadir «marcar rango» = `saveDays` con available false).
- DB: prueba de la migración en `tests/db/`.
- Guía y diseño: `docs/pruebas-manuales.md` (calendario del anfitrión), `docs/diseno-v1.md:35`.

## Al rehacerlo tras la reversión (Daniel, 2026-11-04) — MANDA sobre lo anterior
- **Se mantienen las dos cosas** (cambia el punto 2 de arriba: NO se quita cerrar la casa, NO hay migración de reapertura, NO se borran `setAvailable`, `CloseSheet`, `availabilityUpdate`, `validateReopenDate` ni la acción `available`).
- **Fila nueva «Marcar una reserva»** (ayuda: «Marque de una vez las noches de una reserva larga como ocupadas.»): hoja con el calendario de rango de «¿Cuándo?» (`shared/range-calendar.tsx`), resumen «N noches · 7–10 nov», «Marcar como ocupado» / «Cancelar»; guarda con `save_listing_days(p_days, p_available=false)` las noches de llegada a salida − 1 (la salida libre), conservando precios especiales; confirmación «4 noches marcadas como ocupadas · 7–10 nov». Trozo diferido con su límite. Respeta el teclado y el foco como las demás hojas.
- **«Cerrar la casa hasta…» pasa a «Pausar la casa»** (ayuda: «No sale en Explorar ni recibe consultas. Puede elegir cuándo vuelve.»); dentro, la fecha de vuelta sigue opcional; el comportamiento no cambia. Textos de la hoja, botón y estados en coherencia («Pausar la casa», «Volver a publicarla» o el que ya haya para abrirla, a criterio, en usted). En Mis casas la etiqueta pasa de «Cerrada hasta el <fecha>» a **«Pausada hasta el <fecha>»** (sin fecha, «Pausada»); distinta de «Pausada por bnbtico» del admin (texto y color).
- Hechos antes: 01, 07, 08, 02, 03, 12, 10, 05, 09 parcial, tarjetas flotantes tanda 1, barra plana. Referencia del primer intento: `git show 4214b46` (solo la parte de «Marcar una reserva»).
