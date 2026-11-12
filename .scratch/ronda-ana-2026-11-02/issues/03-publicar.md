# 03 · Publicar: Habitación = 1 habitación; corregir vuelve al resumen

Status: ready-for-agent

## A. Habitación = 1 habitación
Hoy el paso 4 (`client/publish/fields.tsx:205-212`, `CapacityCounters`, contador `bedrooms` con `min={kind==="habitacion"?1:0}`) pregunta habitaciones también para Habitación.
- Si `kind === "habitacion"`: **no mostrar** el contador de habitaciones (en el asistente y en `screens/editar.tsx:229`, que reutiliza `CapacityCounters`). Personas, baños y «baño privado/compartido» se quedan.
- Guardar `bedrooms = 1` para Habitación: en `domain/listing.ts` `normalize` (hoy solo anula `bathroomShared` si no es habitación) o en el parseo del paso 4; que fake y PostgREST coincidan (prueba de contrato). Cambiar de tipo a Habitación fija 1; de Habitación a completo deja el contador con 1 editable.
- Arregla de paso: una Habitación con `bedrooms` null se veía como «Estudio» en la tarjeta (`domain/describe.ts:49-54`, `rows.ts:196`).
- `validateStep(4)`/`warnings()` no deben avisar de habitaciones para Habitación.
- Casas ya existentes de tipo Habitación con `bedrooms` null/0: `normalize` al leer basta para mostrar «1 habitación»; no hace falta migración (diga si opina otra cosa).

## B. Corregir desde «Revisar y enviar» vuelve al resumen
Hoy las filas del paso 9 son `<Link to="/propietario/publicar/$id/$paso">` (`fields.tsx:343-361`) y `step-form.tsx:247-265` avanza con `nextStep(step)`.
- Las filas (terracota y ocre) enlazan con `?volver=revisar`. Con ese parámetro, «Continuar» guarda y va **directo al paso 9**; «Atrás» también vuelve al 9. Sin el parámetro, todo igual que hoy.
- El parámetro se valida en el esquema de búsqueda de la ruta (TanStack Router) y se pierde al llegar al 9.
- El salto de `sendForReview` (`step-form.tsx:127-131`, si el servidor ve un obligatorio inválido) también lleva `?volver=revisar`.

## No tocar
- «Continuar» nunca bloquea salvo el tipo del paso 1 (decisión 2026-10-30). Obligatorios: tipo, ubicación, nombre 5–32, precio por noche, ≥ 1 foto. Avisos en ocre.
- Nombre obligatorio (decisión 2026-11-02: se queda). Descripción opcional.
- `domain/publish-return.ts` es otra cosa (vuelta tras verificar WhatsApp); no lo mezcle.
- `bedrooms ≥ 1` de `update_listing_live`/`listing_edit_check` siguen valiendo (con 1 cumplen).

## Pruebas
- Unit: `tests/unit/listing.test.ts:165-182, 290-291, 356, 386-393` (adaptar: Habitación ya no da error/aviso de habitaciones; normalize fija 1); `search.test.ts:88-91` (`cardFacts` de una Habitación → «1 habitación»).
- Contrato: `tests/contract/publish.contract.ts` (bedrooms = 1 para habitación en ambos adaptadores), `edit.contract.ts:49`.
- E2E nuevas/adaptadas: `publicar.spec.ts` — Habitación no ve el contador; desde el paso 9, tocar una fila terracota → arreglar → «Continuar» → está en el 9. `editar-casa.spec.ts:41,49`.
- Guía: `docs/pruebas-manuales.md` (paso 4 y paso 9); `docs/diseno-v1.md:33` (punto 11: habitaciones solo si no es Habitación).

## Al rehacerlo tras la reversión (2026-11-03): lo añadido en el primer intento (manda sobre lo anterior)
- Hechos antes: 01, 07, 08 y 02 (la UI dice «anfitrión»). El 12 (editar como crear) NO está hecho: la edición sigue con sus reglas actuales; no las cambies aquí.
- **C. Copy de la edición:** en la ficha editable de una casa publicada, la fila «Personas, habitaciones y baños» (`domain/edit.ts`) dice «Personas y baños» cuando el tipo es Habitación (también en el aria-label de «Descartar» y en la cabecera de `screens/editar.tsx`).
- **D. Base de datos (migración `habitacion_una_habitacion`):** `bedrooms = 1` siempre que `kind = 'habitacion'`, por cualquier camino (asistente, `update_listing_live`, aprobar un cambio de tipo en la revisión dato a dato, SQL). Primer intento: trigger BEFORE `listings_habitacion_una` (insert/update of kind, bedrooms) que fija `new.bedrooms := 1`, más arreglo de datos con `select set_config('app.allow_status','on',true)` antes del UPDATE, y `listing_edit_check` sin exigir habitaciones cuando el tipo resultante es Habitación (parte de la versión VIGENTE de `listing_edit_check`: búscala con grep; la reversión `20261103055921` la restauró). Comprueba que el trigger no choca con `listings_protect` (orden alfabético de triggers). Pruebas en `tests/db`.
- **E. Formulario de «Revisar y enviar»:** las filas (terracota y ocre) enlazan con `?volver=revisar` (las e2e del primer intento esperaban ese href en las filas; actualízalas).
- Referencia: `git show 160c12e` (revísalo, no lo copies a ciegas; allí una e2e leía la casa justo después de «Continuar» sin esperar al guardado por detrás: usa `expect.poll`).

## Ajuste tras probarlo (2026-11-03, Daniel): una Habitación no pregunta baños
- Paso 4 y edición de una Habitación: solo **Personas** y **Baño de la habitación** (privado/compartido); fuera el contador de baños.
- Se guarda `bathrooms = 1` siempre que `kind = 'habitacion'` (en `normalize` y en la base: amplía el trigger `listings_habitacion_una` con una migración nueva que fije también `bathrooms := 1`, y arreglo de datos con `app.allow_status`; ojo a `update_listing_live`/`listing_edit_check`, que no deben pedir baños a una Habitación).
- Texto en una Habitación: el tipo de baño en vez del número. Ficha: «2 personas · 1 habitación · baño compartido» (o «baño privado»; si no está elegido, «1 baño»); resumen del paso 9 y edición: «2 pers. · baño compartido» / fila «Personas y baño». Tarjeta de Explorar (`cardFacts`) sin cambios (no muestra baños).
- Sin aviso ocre de baños para una Habitación (sí el de «baño privado o compartido» si falta).
