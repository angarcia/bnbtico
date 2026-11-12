# 02 · «Anfitrión» en toda la interfaz

Status: ready-for-agent

## Qué
Sustituir «propietario/propietaria/propietarios/dueño» por «anfitrión/anfitriona/anfitriones/anfitrión» **en el texto visible** de `apps/app/src` (incluye `domain/*` que produce copy, p. ej. `describe.ts` `NEGOTIABLE_LINE` «precio a negociar con el dueño» → «con el anfitrión»; `owner-notice.ts`; `support-numbers.ts`/«WhatsApp de propietarios»; ficha «Publicada por», nota de precios «el precio final lo acuerda con el anfitrión»; hoja de contacto «Anfitrión de {título} · WhatsApp verificado»; Cuenta; admin; mensajes de error de RPC que se muestran al usuario (solo si se muestran tal cual: entonces migración nueva que reescriba el texto con `create or replace`, sin cambiar lógica; si es mucho, anótelo y no lo haga).
Use el género neutro «anfitrión» salvo que el texto ya distinga.

## Cómo
1. `grep -rniE "propietari|dueñ" apps/app/src apps/app/public` y clasifique: copy visible → cambiar; identificadores, comentarios, nombres de tablas/columnas/rutas (`/propietario/...`) → **no tocar**.
2. Lista los cambios en su informe (archivo:línea, antes → después).

## No tocar
- Rutas `/propietario/...`, nombres de código `Owner`, `owner_*`, tablas y columnas.
- `apps/app/public/portada.html` (la landing no se toca, regla de CLAUDE.md).
- Tono de usted.
- Docs históricos (`docs/historico/`, guías por fase). Sí actualizar `docs/pruebas-manuales.md` donde cite copy literal, y `CLAUDE.md` solo si cita copy literal de UI.

## Pruebas
Actualizar todas las aserciones de texto (`tests/**`) que esperen «propietario»/«dueño». `pnpm test` y typecheck en verde; listar las e2e tocadas.
