# 02 — Publicar: avanzar siempre; obligatorios en terracota y avisos en ocre

Status: resolved

Grupo 5 de `../spec.md` (reglas allí).

- Cliente: «Continuar» nunca bloquea (salvo el tipo en el paso 1); los adaptadores (`saveStep`, PostgREST y fake) guardan lo que se pueda guardar sin romper los CHECK de la tabla.
- `validateStep` no cambia de significado para la edición de casas publicadas (`editar.tsx`, `domain/edit.ts`).
- «Revisar y enviar»: filas obligatorias que faltan en terracota (`.review-row.is-missing`), resto en ocre (aviso); «Enviar a revisión» activo en cuanto están los obligatorios. Fotos entra como obligatoria.
- Servidor: migración nueva de `submit_listing` con solo los obligatorios (añade ≥ 1 foto; quita capacidad, habitaciones, baños, baño compartido, descripción y parqueo); `submitRefusal` del fake igual; suite de contrato y pruebas SQL al día.
- «Falta: …» de Mis casas y `resumeStep`: solo los obligatorios.

## Comments

- 2026-10-30: la descripción vacía también da aviso en ocre («Añadir una descripción»), como pide Ana para lo que falta. Sin leyenda bajo la lista: no cabía en 375×667; las filas terracota ya dicen la acción y el botón queda desactivado.
