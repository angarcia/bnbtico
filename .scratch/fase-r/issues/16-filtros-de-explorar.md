# 16: Filtros de Explorar en una fila y modalidad no excluyente

**Qué construir:** los chips de Explorar caben en una fila a 360 px sin scroll lateral, y Vacacional/Mensual son dos chips que se pueden marcar a la vez, en Explorar y en Filtros.

**Bloqueado por:** 15

**Status:** done (2026-10-26)

- [x] Explorar: chips Vacacional, Mensual y «Más filtros» con el contador; Piscina, Mascotas y Frente al mar pasan a Filtros (ya están en «Qué necesitan»). Sin scroll lateral a 360 px (Playwright mide el ancho).
- [x] Modalidad: ninguno o los dos = todas; uno = solo esa modalidad. Dominio (`filters.ts`: `modes`), URL (`modo=nightly|monthly|both`; los enlaces viejos con `modo=nightly`/`monthly` siguen valiendo), consulta del adaptador PostgREST y del fake, y el contrato de lecturas públicas con las tres combinaciones.
- [x] Filtros: sección «Modalidad» con los mismos dos chips.
- [x] Unitarias, contrato en los dos adaptadores, Playwright y capturas Pixel 7 y 360 px. Baterías en verde.

## Cierre (2026-10-26)

- **Dominio:** `Filters.modes` (en vez de `mode`), `modeFilter`, `toggleMode`, `modeParam`, `MODE_CHIPS`; `modo=nightly|monthly|both`. Adaptadores PostgREST y fake filtran con `modeFilter`; contrato de lecturas públicas con `both` = todas (fake y Supabase local).
- **Pantallas:** Explorar con Vacacional, Mensual y «Más filtros» (`.chiprow.fit`, sin scroll); Filtros con «Modalidad». Capturas Pixel 7 y 360 px.
- **Pruebas:** unitarias nuevas (3) en `filters.test.ts`; Playwright `explorar.spec.ts` (ancho de la fila a 360 px, combinaciones y URL, Filtros, características en «Más filtros» con contador).
- **Baterías:** typecheck y build en verde; unitarias 644/644; base 164/164; Playwright 102/102; Lighthouse ficha 1,61 s, shell 0,29 s; zona privada 140,23 KB gz / 150. Sin migraciones.
