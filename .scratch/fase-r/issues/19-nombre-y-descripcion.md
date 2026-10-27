# 19: Asistente · nombre de 5 a 60 caracteres y descripción de 80 a 2000

**Qué construir:** el paso 6 del asistente exige un nombre de 5 a 60 caracteres y una descripción de 80 a 2000, con contador visible; la misma regla en el dominio, el fake y SQL.

**Bloqueado por:** 18

**Status:** ready-for-agent

- [ ] Dominio: `validateStep(6)` con los límites y mensajes claros; `parseStep(6)` recorta a 60 y 2000.
- [ ] Pantalla: contador «n / 60» en el nombre y «n / 2000 · mínimo 80» en la descripción; `maxLength` 60 y 2000.
- [ ] SQL: migración nueva (solo local) que redefine `submit_listing` con los límites y los mismos mensajes. Sin `check` en la tabla: los borradores se guardan a medias y una casa existente que no cumpla no debe romperse al leerla ni al editar otra cosa; solo al enviar a revisión.
- [ ] Fake igual (vía `validateAll`). Contrato de publicar en los dos adaptadores (nombre corto, largo, descripción corta; casa vieja con nombre corto se lee). Fixtures de las pruebas al día.
- [ ] Playwright del asistente, capturas Pixel 7 y 360 px del paso 6. Baterías en verde.
