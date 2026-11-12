# Ronda de Ana del 2026-11-02

Fuente: correo de Ana «cambios bnbtico» (2026-11-02). Decisiones confirmadas por Daniel: `docs/decisiones.md`, entrada del 2026-11-02 (manda sobre este directorio si discrepan).

## Reglas para quien implementa (obligatorias)

1. **Lea el ticket entero, incluida la sección «No tocar».** Cada punto de «No tocar» es una decisión vigente con fecha. Si para cumplir el ticket tiene que cambiar algo de esa lista, **pare y pregunte**; no lo decida usted.
2. **Nada fuera del alcance del ticket.** Si ve otro fallo, anótelo en su informe final; no lo arregle.
3. **Primero la prueba** (Vitest para lógica, contrato fake + PostgREST si toca datos), luego el código.
4. Comprobaciones antes de entregar, desde `apps/app`: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm size` (y `pnpm test:db` si hay migración). **No ejecute la suite e2e completa.** Desde el ticket 12: actualice las e2e afectadas y, al final, ejecute **solo** las de las pantallas tocadas (`pnpm test:e2e tests/e2e/<archivo>.spec.ts …`: las que cambió y las que usan los textos o componentes que tocó, búsquelas con grep) y dé la lista y el resultado. La suite completa la corre el orquestador una vez por tanda (cada 3–4 tickets) y antes de cada push.
5. Capturas en viewport móvil (Pixel 7 / iPhone SE 375×667) de cada pantalla tocada en `.scratch/ronda-ana-2026-11-02/capturas/<ticket>-<n>.png` (Playwright con `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, app local `supabase start` + `pnpm dev` de `apps/app`).
6. Copy en español de Costa Rica, de **usted**. «Anfitrión» en la UI (desde el ticket 02), `Owner` en el código.
7. Migraciones: `pnpm exec supabase migration new <nombre> < /dev/null`; nunca editar migraciones existentes. Un `UPDATE` sobre `listings` necesita `set local app.allow_status = 'on'` (ver migraciones previas). **No hacer `db push` ni `git push`.**
8. Actualice `docs/pruebas-manuales.md` (las comprobaciones de las pantallas tocadas) y, si cambia el diseño, `docs/diseno-v1.md`.
9. **No haga commit.** Entregue: resumen del diff, pruebas ejecutadas con resultado, capturas, dudas.
10. Presupuestos: zona privada inicial ≤ 150 KB gz (hoy ~149,6: **sin margen**). Lo nuevo va en trozos diferidos con su entrada en `apps/app/.size-limit.json`. No suba límites sin decirlo.

## Orden (secuencial: comparten `global.css` y la ficha)

| # | Ticket | Migración |
|---|--------|-----------|
| 01 | Cabecera de la ficha: pin, sin «ubicación aproximada», bloque del anfitrión, hero 4:3 | no |
| 02 | «Anfitrión» en toda la interfaz | no |
| 03 | Publicar: Habitación = 1 habitación; corregir vuelve al resumen | no |
| 12 | Editar sigue las reglas de crear (va tras el 03) | sí |
| 04 | Calendario del anfitrión: «Marcar una reserva»; fuera «Cerrar la casa» | sí (reabrir) |
| 05 | «Ver ficha» flotante en el detalle del anfitrión | no |
| 06 | Filtros: baños, tipo; todo el país con el Caribe primero | sí (orden de search_listings) |
| 07 | Fin del modo mensual y total orientativo en Explorar | sí (search_listings) |
| 08 | Ficha y hoja: calendario seleccionable, fechas compartidas, total, días ocupados | no |
| 09 | Tarjeta de Explorar: fotos 5:4 deslizables a todo el ancho y botón de WhatsApp | no |
| 10 | Admin edita casas (primero plan) | sí |
| 11 | Filtro de precio con deslizador e histograma | no |

## Proceso tras la reversión (2026-11-02, Daniel)

La ronda se revirtió entera (`8ac6f5f`). Se rehace **un ticket cada vez**, implementado por un agente **Opus**: revisión del orquestador, commit, `db push` si hay migración (preguntando antes), push a `develop`, CI en verde y Daniel lo prueba en nueva.bnbtico.com; con su visto bueno, el siguiente. Orden: 01 → 02 → 03 → 12 → 04 → 05 → 06 → 07 → 08 → 11; el 10 cuando estén D1–D7; **el 09 no, de momento**. Cambio respecto al primer intento: el hero de la ficha va en **5:4** (no 4:3).
