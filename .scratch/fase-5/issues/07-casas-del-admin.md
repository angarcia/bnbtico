# 07: Admin Casas list (design 23)

**What to build:** `/admin/casas` (today «Muy pronto») with search, chips Todas / Activas / Por pagar / Inactivas and subscription lines. Read only. See spec § Screens.

**Blocked by:** 02

**Status:** done

- [x] `AdminListingsApi.houses()` (aal2 only) with contract on fake and local Supabase (aal1 admin and non-admin get nothing).
- [x] Screen inside the admin chunk (limit 12 KB); search by name, CT-#### or owner; counts per chip.
- [x] Playwright with the local admin (8899 0001, TOTP).
- [x] Green: all batteries.

## Cierre (2026-10-27)

- **Sin migración nueva.** La lista sale de lecturas que ya permiten las políticas de admin (`is_admin()` en aal2): `listings` con `subscriptions!inner(plan, promo_ends_on, paid_since, stopped_at, monthly_price_crc)` (solo las aprobadas alguna vez, que son las que tienen suscripción), la portada (`listing_photos.position = 0`) y el propietario (`profiles`), más `payment_methods(owner_id)` para saber si la cuenta tiene método. `stoppedOn` = día de Costa Rica de `stopped_at`; «hoy» = `costaRicaToday(Date.now())` en el navegador (el fake usa su reloj). Orden: la aprobada más recientemente primero (`first_published_at desc`). Prueba de base `tests/db/admin-casas.test.ts` (3): aal2 lee casas con suscripción y métodos de todos; aal1 no lee casas, suscripciones ni métodos; un propietario solo sus suscripciones y ningún método ajeno.
- **Dominio** `src/domain/admin-houses.ts`: `AdminHouse`, `AdminHouses { houses, today }`, chips `todas/activas/por-pagar/inactivas` (`houseChip`, `countHouses`, `filterHouses` sin tildes ni mayúsculas por nombre, CT-#### o propietario), `HOUSE_BADGES` (Activa salvia `badge-ok`, Por pagar ocre `badge-sun` = `#FBE8C2`/`#7A4E07`, Inactiva arena `badge-mute`; «En edición», «En revisión», «Cambios pedidos», «Rechazada» para las publicadas que se están editando) y `adminHouseLine`: «Gratis hasta 14 oct 2027», «Pagando desde el 15 oct 2026 · ₡2 900 al mes», «Oferta vencida el 14 oct · sin método de pago» (o «Sin oferta de lanzamiento · sin método de pago»), «Parada por el propietario el 9 oct». `shortDate` de `subscription.ts` pasa a exportarse. 11 pruebas en `tests/unit/admin-houses.test.ts`.
- **API** `AdminListingsApi.houses()`: no admin → lista vacía; admin en aal1 → `REVIEW_MESSAGES.mfaRequired` (`forbidden`), como la cola. Contrato `tests/contract/admin-houses.contract.ts` (6, fake y Supabase local): estados activa / pendiente de pago (fin de oferta + trabajo diario) / parada / en edición, fuera las nunca publicadas (borrador, revisión, cambios, rechazada); propietario, zona, portada y suscripción; orden; método de pago y plan de pago; sin fotos no hay portada; no admin y aal1.
- **Pantalla** `/admin/casas` (`CasasAdminScreen`, en el trozo del admin; `?ver=activas|por-pagar|inactivas`): buscador «Nombre, CT-#### o propietario» (filtra en el cliente), chips con recuentos de todas las casas (no de la búsqueda), filas con portada, nombre, «CT · propietario · zona», línea de suscripción e insignia. Solo lectura: la activa abre su ficha pública; las demás, el detalle de revisión (`/admin/anuncios/$id`). Sin pausar, sin aperturas/visitas. Revisar invalida también esta lista.
- **Playwright** `tests/e2e/admin-casas.spec.ts` (2, admin 8899 0001 con TOTP, sin vaciar la base: cada prueba crea sus casas con un sufijo y las busca; recuentos por diferencia; quita antes el método de pago de las dos cuentas de prueba): líneas e insignias de activa, por pagar (color ocre comprobado) y parada; chips y URL; búsqueda por sufijo, CT y propietario; sin resultados; abrir revisión y ficha; una casa nueva sube «Activas» y «Todas»; un propietario ve «Esta sección es solo para el equipo de bnbtico». Captura Pixel 7 revisada (`test-results/admin-casas-todas.png`); se corrigió el estilo global de `input` dentro del buscador.
- **Baterías** (desde `apps/app`, Supabase local propio): `typecheck` limpio; `test` 63 archivos, 887 pruebas; `test:db` 23 archivos, 243 pruebas; `build` en verde; `size`: zona privada 141,81 KB gz / 150, zona del admin 8,17 KB gz / 12 (antes 6,87); `test:e2e` 124 en verde + 2 omitidas (medición).
- **Desviaciones:** pie de la lista «Toque una casa activa para ver su ficha; las demás abren su revisión.» (el del diseño hablaba de pausar, fuera de alcance); «Parada por el propietario» en vez de «Pausada por la propietaria» del diseño (manda la especificación); con `max_rows` (200 en local, 1000 en el alojado) la lista se corta en las más recientes: suficiente para v1, paginar cuando haga falta.
- **Para Daniel:** nada que aplicar (sin migración); comprobar la pantalla en `nueva.bnbtico.com` con su admin cuando se despliegue.

### Al unir con el ticket 06 (2026-10-27)

Un conflicto en `src/client/admin.ts` (invalidaciones al revisar): queda `["offer-taken"]` (ticket 06, sustituye a `["active-count"]`) y la lista de Casas del admin. Baterías sobre la unión (06 + 07, Supabase local principal): `typecheck` limpio; `test` 63 archivos, 889; `test:db` 23 archivos, 243; `build` en verde; `size` zona privada 142,04 KB gz / 150, pestañas 24,09 / 24,5, admin 8,08 / 12; `test:e2e` 130 en verde + 2 omitidas; Lighthouse ficha 1,63 s (1,63 · 1,64 · 1,63), shell instalado 0,27 s.
