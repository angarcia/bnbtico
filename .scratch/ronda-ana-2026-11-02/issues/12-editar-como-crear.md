# 12 · Editar sigue las reglas de crear

Status: ready-for-agent (después del 03; antes del 10)

Decisión 2026-11-02 (Daniel, opción B), en `docs/decisiones.md`. Auditoría completa del estado de partida: ver el apartado «Auditoría» al final.

## Regla
- **Mismos límites, mensajes, contadores y obligatorios que crear.** Obligatorios (bloquean): tipo, ubicación, nombre 5–32, precio por noche, ≥ 1 foto. Todo lo demás: aviso en ocre, no bloquea (mismas funciones `requiredProblems`/`warnings` de `domain/publish-rules.ts`, no una copia).
- **Excepción (datos que se publican al momento, `update_listing_live`):** personas, habitaciones, baños, características/parqueo (el baño compartido va con el tipo, por revisión), precio por noche y al mes. Si el dato **ya tenía un valor válido**, el nuevo tiene que ser válido (no vacío, no inválido); si estaba vacío, se puede dejar vacío (aviso en ocre). Precio al mes vacío sigue valiendo siempre («a negociar»).
- **Editar un dato valida solo ese dato**, en cliente y en SQL; nunca la casa entera.

## Cambios
1. `domain/edit.ts` `planEdit`/`firstError`: bloquear solo los obligatorios de crear del dato editado + la excepción de arriba; el resto devolverlo como avisos ocre que la pantalla pinta como en el asistente. Para `nombre` solo `titleError`; para `descripcion` solo la regla de crear (vacía o 80–2000 como **aviso**; tope 2000 duro).
2. SQL, migración nueva `editar_como_crear` (`create or replace` de las versiones **más recientes**; búsquelas con `grep -l`):
   - `update_listing_live`: validar solo las claves del parche, con la excepción de arriba (comparar con el valor actual de la fila).
   - `listing_edit_check` / `save_edit` / `review_edit_field`: fuera el mínimo 80 de la descripción (solo tope 2000) y fuera habitaciones/baño compartido de la comprobación de nombre, descripción y ubicación. Nombre vacío → «Póngale un nombre a la casa.» (mismo texto que `submit_listing`).
   - `submit_listing`: añadir el tope de 2000 de la descripción (hoy no existe en SQL al crear).
   - CHECK `listing_edits.title` 5–60 → 5–32 con `btrim` (`NOT VALID` si hay filas viejas; diga cuántas hay en local); CHECK de descripción con `btrim`.
   - Respete la migración del 03 (`habitacion_una_habitacion`, trigger de bedrooms).
3. Cliente, menores:
   - «Enviar a revisión» de la edición no espera a la ubicación (`editar.tsx` `ReadyScope`), igual que crear.
   - `KindInputs` marca «Alojamiento completo» para tipos viejos `casa`/`apartamento` (como `KindChoice`).
   - Editar Habitación: `BathroomChoice` en la pantalla de capacidad (donde se valida), no solo en la de tipo.
   - Nombre viejo de > 32: si el campo no se toca no se envía ni se recorta (`parseStep` recorta: compare antes).
   - Fotos: mismo contador y misma ayuda «Necesita al menos una foto…» que el asistente.
   - Precio al mes mal escrito: aviso ocre visible en crear y en editar (hoy `storable` lo borra en silencio al crear).

## No tocar
- Qué pasa por revisión y qué se publica al momento (decisión 2026-10-29, revisión dato a dato A5).
- No se puede quitar la última foto aprobada de una casa publicada (`remove_listing_photo`).
- «Continuar» del asistente nunca bloquea salvo el tipo del paso 1.
- Tickets 01–03 ya hechos.

## Pruebas
- Unit `tests/unit/edit.test.ts`, `listing.test.ts`: una tabla de casos crear vs editar por campo (mismo resultado salvo la excepción).
- Contrato `edit.contract.ts`, `publish.contract.ts` (fake y PostgREST).
- `tests/db`: casa publicada sin baños cambia el precio; renombrar con descripción de 50 caracteres; borrar la capacidad de una casa que la tenía falla; descripción de 50 al editar se guarda.
- E2E `editar-casa.spec.ts`; guía `docs/pruebas-manuales.md` (edición).

## Auditoría (2026-11-02, resumen)
- Editar bloquea lo que crear avisa: capacidad, habitaciones, baños, baño compartido, parqueo, descripción 1–79, precio al mes (`planEdit` usa `validateStep`).
- `update_listing_live` (`20261029122021:80-119`) y `listing_edit_check` (`20261030092712:87-105`) validan la fila entera.
- Renombrar falla por la descripción (`firstError` usa el paso 6 entero).
- Nombre: crear 5–32; `listing_edits.title` CHECK 5–60. Descripción: mínimo 80 solo al editar; tope 2000 solo en cliente al crear.
- `save_edit` con nombre vacío da el mensaje de longitud.
- Nombres viejos > 32 se truncan en silencio. Tipo viejo sin tarjeta marcada. «Enviar a revisión» espera a la ubicación. Contador de fotos distinto.
