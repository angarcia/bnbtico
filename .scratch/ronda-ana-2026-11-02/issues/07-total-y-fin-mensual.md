# 07 · Fin del modo mensual y total orientativo en Explorar

Status: ready-for-agent

## Regla del precio de una estancia (una sola, en dominio y en SQL)
Módulo nuevo `apps/app/src/domain/stay-price.ts`, sin imports de framework:
- `stayEstimate({ nights: string[] /* llegada..salida-1 */, days, base, acceptsMonthly, monthlyCrc })`:
  - Si `nights.length >= 30` y `acceptsMonthly` y `monthlyCrc > 0` → `round(monthlyCrc * nights.length / 30)`, `kind: "monthly"`.
  - Si no → suma de `effectiveDay(days, base, d).priceCrc` (`domain/calendar.ts:118`) de cada noche, `kind: "nightly"`. Si alguna noche no tiene precio → `null`.
- Texto: `stayLabel` → «≈ ₡180 000 por 4 noches» (moneda elegida; en dólares redondeado como el resto). Nunca «total a pagar».
- La **misma regla en SQL**: `search_listings` devuelve `stay_total_crc int` (null sin fechas) calculado **después** de filtrar y del `limit`, sobre `listing_days` (que ya lee para comprobar las noches libres). Migración nueva con `create or replace` de la versión **más reciente** de `search_listings` (la del ticket 06, que cambió el orden: búsquela con `grep -l "search_listings" supabase/migrations/* | tail -1`), sin cambiar nada más. Prueba de contrato: fake (con `stayEstimate`) y PostgREST dan la misma cifra con precios especiales y con ≥ 30 noches.

## Fin del modo mensual en Explorar
- Quitar el chip «Solo alquiler mensual» / «Mensual» de la cabecera (`client/screens/explorar.tsx:65-81`), la clave `monthly`/`mensual` y `desde` de `domain/filters.ts`, `stayRange` mensual (`MONTHLY_STAY_NIGHTS`), el modo `from` de `RangeCalendar` en «¿Cuándo?» (`buscar.tsx:185-270`) y en la hoja de contacto, `monthlyWindowLabel`, `MONTHLY_FILTER_*`, la línea «N casas aceptan alquiler mensual…», `cardPrice` en modo mensual y la telemetría `monthly_filter_tap` (quitarla del esquema de eventos si lo hay).
- Enlaces viejos con `?mensual=1`, `modo=monthly` o `desde=` abren Explorar normal sin error.
- Mensaje de WhatsApp (`domain/inquiry.ts` `composeInquiryMessage`): solo la variante con llegada y salida; fuera «Me interesa alquilar por meses desde…».
- El rango de precio por noche ya no se oculta nunca.

## Tarjeta y mapa con fechas
- Con llegada y salida: la tarjeta muestra `stayLabel` en vez de «₡45 000 / noche» (`client/listing-card.tsx:24-31`); sin fechas, igual que hoy. Si `stay_total_crc` es null, el precio por noche.
- Los marcadores del mapa (`mapPriceLabel`) enseñan la misma cifra que la tarjeta (sin «por N noches»).

## No tocar
- Publicar: «Acepta alquiler mensual» y precio al mes opcional se quedan. La ficha sigue con su línea «Mensual: ₡X / mes» o «Mensual: precio a negociar con el anfitrión» (`shared/monthly-line.tsx`).
- Filtro por fechas libres: todas las noches de llegada a salida (la salida no cuenta); casas no disponibles nunca salen.
- `og:description`/compartir con el precio por noche (decisión 2026-11-02).
- Presupuesto de la zona privada (sin margen): el dominio nuevo debe ser pequeño; mida.

## Pruebas
- Unit nuevas para `stay-price.ts` (noches normales, especiales, noche sin precio, 29/30/45 noches con y sin precio al mes, que no acepta mensual).
- Reescribir: `explorar.spec.ts:122-210` (chip mensual) → tarjeta con total; `buscar.spec.ts:62-76` (modo «Desde») → quitar; `tests/unit/filters.test.ts:128-140`, `search.test.ts:17-36`; `contacto.spec.ts:164` (variante mensual del mensaje); `contact-draft.test.ts`.
- `tests/db/`: `search_listings` con total.
- Guía `docs/pruebas-manuales.md` (Explorar mensual → total); `docs/diseno-v1.md:21`.

## Añadido tras el 06
El 06 puso el orden «Limón primero» dentro de `search_listings` y quitó el `.order()` del adaptador; el orden depende de que PostgREST conserve el de la función (en la práctica sí, sin garantía). Ya que este ticket cambia lo que devuelve la función (`stay_total_crc`), añada también una columna de orden explícita (p. ej. `sort_rank`) y vuelva a ordenar en el adaptador con `.order()`, para que sea determinista. Mantenga `tests/db/caribe-primero.test.ts` en verde.
