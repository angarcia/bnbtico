# 01: Subscription rules in the domain (Vitest port of the prototype)

**What to build:** `src/domain/subscription.ts` (no framework) with every rule of spec § Domain, and its Vitest suite porting the v1 rules of `tests/prototype/estados-casa.cjs`, `mis-casas.cjs` and `house-controls.cjs`. No database, no screens.

**Blocked by:** —

**Status:** done

- [x] `tierForSlot`, `launchOffer(taken)` (input is now assigned slots; `offer.ts` reexports or moves without breaking its callers), `promoEndsOn` (month-end clamping, last free day), `daysLeft`, `reminderThreshold` (smallest threshold ≥ days left; 91 → null … −1 → null; prototype bug not ported), `nextStatus` with `SUBSCRIPTION_MESSAGES`, `payButtonDue`, `subscriptionLine`, `reminderCard`, `reminderWhatsApp` (90/30/7 and 0 variants), `payLink`/`parsePayHash`, `nextCharge`, `blockedReason`.
- [x] Every case listed in spec § Domain «Rules from the prototype tests…» as a Vitest case with fake time (Costa Rica dates; no real `Date.now()`).
- [x] Copy in usted exactly as the spec; amounts `₡2 900`.
- [x] `tests/prototype/*.cjs` untouched and passing; architecture test green (no framework imports).
- [x] Green: `typecheck`, `test`, `build`, `size` (nothing should move: the module is not imported by screens yet).

## Cierre (2026-10-27)

- `apps/app/src/domain/subscription.ts` (sin frameworks; importa `./dates`, `./money`, `./offer` y el tipo de `./listing`). Pruebas en `apps/app/tests/unit/subscription.test.ts`: 55 casos; un `describe` por archivo del prototipo con las reglas de v1 de la especificación, más uno por función. Fechas fijas de Costa Rica; un caso con `vi.useFakeTimers` + `costaRicaToday` comprueba el cambio de día a medianoche de Costa Rica.
- **Precio:** el texto sale de `MONTHLY_FEE_CRC` (₡2 900, decisión del 2026-10-27, más reciente que el «₡2 900» de la especificación). Las pruebas fijan «₡2 900»; `subscriptionLine` usa `monthlyPriceCrc` de la casa. Los importes llevan `formatCRC` (espacio U+00A0): el SQL de los tickets 02/03 tiene que generar el mismo carácter.
- `LAUNCH_TIERS`, `MONTHLY_FEE_CRC` y `launchOffer` **siguen en `offer.ts`** (las pantallas no cambian) y `subscription.ts` los reexporta; el argumento de `launchOffer` pasa a llamarse `taken` (plazas asignadas), documentado. Las pantallas siguen pasándole las casas activas hasta el ticket 06.
- API para los tickets siguientes: `REMINDER_DAYS`, `REMINDER_WINDOW_DAYS`, tipo `HouseSubscription` (`status`, `plan`, `promoEndsOn`, `paidSince`, `stoppedOn` —día de Costa Rica—, `monthlyPriceCrc`, `hasMethod`), `tierForSlot`, `promoEndsOn`, `daysLeft`, `reminderThreshold`, `promoRunning`, `reminderDaysLeft`, `nextStatus` + `SUBSCRIPTION_MESSAGES`, `payButtonDue(sub, today)`, `subscriptionLine(sub, today)`, `cardDate`, `reminderCard(días)` → `{ title, body } | null`, `reminderWhatsApp`, `payLink`, `parsePayHash`, `nextCharge(casas, método | null, today)`, `blockedReason`.
- Decisiones de lectura (para que el SQL del ticket 02 las copie):
  - `nextStatus` devuelve `{ ok: true, status } | { ok: false, message }`. `methodAdded` es un evento de la cuenta: `payment_due` → `active` y **las demás casas no cambian** (no se rechaza). `dayPassed` solo vale para `active` (el trabajo diario solo toca esas); en otro estado se rechaza con `dayPassed`. `approve` solo desde `review`; `stop` desde `active`/`payment_due`; `resume` desde `inactive` por la regla de aprobar. En `stop`/`resume`, `isOwner: false` → «No encontramos ese anuncio.» y `accountActive: false` → «Su cuenta está desactivada. Escríbanos por WhatsApp.» (el de `inquiry.ts`).
  - Mensajes nuevos que la especificación no redacta: `approve` «Solo se pueden aprobar casas en revisión.», `stop` «Solo puede parar la suscripción de una casa activa o pendiente de pago.», `resume` «Solo puede reactivar una casa con la suscripción parada.», `dayPassed` «Solo cambia con los días una casa activa.».
  - `payButtonDue` recibe `today` (la ventana depende del día). Incluye el día 0 y la casa pendiente de pago aunque no tenga oferta.
  - `subscriptionLine`: «Gratis hasta el 14 oct 2027» y «Suscripción activa desde el …» siempre con año; «Parada el 9 oct» sin año si es del año en curso. Con método y la oferta ya vencida (antes de que corra el trabajo diario) dice «Suscripción activa desde el <fin + 1>».
  - WhatsApp del día 0: la especificación lo deja en «…»; se completa con «Hoy todavía no se le cobra nada; después, ₡2 900 al mes por casa, sin permanencia; puede pararla cuando quiera.». Sin nombre: «Hola. Somos bnbtico.». La fecha va como «14 de octubre» (`longDate`).
  - `nextCharge`: por casa activa, el inicio del plan de pago (o fin de oferta + 1) o su siguiente mensualidad ≥ hoy (mismo número de día, ajustado a fin de mes); suma las que caen el primer día.
- `reminderThreshold` corrige el fallo del prototipo (`find(d => daysLeft <= d)` daba siempre 90): hay un caso que compara las dos.
- No portado (y por qué): Veriff (v1.1), contacto directo (fuera de v1), «Simular fin de oferta · demo» (lo sustituye el reloj de pruebas), aserciones de la vista web y de HTML (botón de contacto ausente, tarjeta móvil: son de pantalla, van en Playwright de los tickets siguientes), persistencia en `localStorage` del prototipo. «Fuera del catálogo» se prueba como `can(…, "share") === false` (estado distinto de `active`, lo que filtra `listings_public`).
- Baterías (desde `apps/app`): `typecheck` limpio; `test` 57 archivos, 753 pruebas en verde (incluida la de arquitectura); `build` en verde; `size`: zona privada 141,8 KB gz / 150 (antes 141,81), pestañas 21,27 / 22 (antes 21,26): ruido del hash de los trozos, ningún trozo contiene el módulo (comprobado con `grep` en `dist`). `node tests/prototype/{estados-casa,mis-casas,house-controls}.cjs` pasan (archivos sin tocar). Sin `test:db` ni `test:e2e`: no hay cambios de base ni de pantallas.
