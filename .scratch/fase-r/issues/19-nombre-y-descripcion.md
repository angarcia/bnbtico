# 19: Asistente · nombre de 5 a 60 caracteres y descripción de 80 a 2000

**Qué construir:** el paso 6 del asistente exige un nombre de 5 a 60 caracteres y una descripción de 80 a 2000, con contador visible; la misma regla en el dominio, el fake y SQL.

**Bloqueado por:** 18

**Status:** done (2026-10-26) · migración pendiente en el alojado

- [x] Dominio: `validateStep(6)` con los límites y mensajes claros; `parseStep(6)` recorta a 60 y 2000.
- [x] Pantalla: contador «n / 60» en el nombre y «n / 2000 · mínimo 80» en la descripción; `maxLength` 60 y 2000.
- [x] SQL: migración nueva (solo local) que redefine `submit_listing` con los límites y los mismos mensajes. Sin `check` en la tabla: los borradores se guardan a medias y una casa existente que no cumpla no debe romperse al leerla ni al editar otra cosa; solo al enviar a revisión.
- [x] Fake igual (vía `validateAll`). Contrato de publicar en los dos adaptadores (nombre corto, largo, descripción corta; casa vieja con nombre corto se lee). Fixtures de las pruebas al día.
- [x] Playwright del asistente, capturas Pixel 7 y 360 px del paso 6. Baterías en verde.

## Cierre (2026-10-26)

- **Dominio:** `TITLE_MIN/MAX`, `DESCRIPTION_MIN/MAX`, `charCount` (puntos de código, sin espacios de los extremos) y los dos mensajes en `domain/listing.ts`; `validateStep(6)` y `parseStep(6)` (recorta a 60 y 2000). Fake: `submitRefusal` con la regla.
- **SQL:** migración `20261027040909_nombre_y_descripcion` (solo local): `submit_listing` con `char_length(btrim(...))` y los mismos mensajes; sin `check`. Tipos sin cambios (misma firma).
- **Pantalla:** contadores en el nombre y la descripción del paso 6 (`CharCount`), `maxLength` 60/2000. Captura Pixel 7 y 360 px.
- **Pruebas:** unitarias (límites, recorte, emoji); contrato de publicar en los dos adaptadores (pantalla 6 inválida por longitud, envío con nombre corto y descripción corta; textos válidos en las demás); `tests/db/nombre-descripcion.test.ts` (casa activa anterior a la regla: se lee en público y por el dueño, se edita otra pantalla, enviarla exige la regla, corregida pasa); Playwright del asistente con los avisos y contadores. Fixture `COMPLETE` con descripción larga.
- **Baterías:** typecheck y build en verde; unitarias 646/646; base 168/168; Playwright 102/102; Lighthouse ficha 1,62 s, shell 0,26 s; zona privada 140,33 KB gz.
- **Para Daniel:** aplicar la migración en `bnbtico-pruebas` (A1 del plan manual).
