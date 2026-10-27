# 16: Filtros de Explorar en una fila y modalidad no excluyente

**Qué construir:** los chips de Explorar caben en una fila a 360 px sin scroll lateral, y Vacacional/Mensual son dos chips que se pueden marcar a la vez, en Explorar y en Filtros.

**Bloqueado por:** 15

**Status:** ready-for-agent

- [ ] Explorar: chips Vacacional, Mensual y «Más filtros» con el contador; Piscina, Mascotas y Frente al mar pasan a Filtros (ya están en «Qué necesitan»). Sin scroll lateral a 360 px (Playwright mide el ancho).
- [ ] Modalidad: ninguno o los dos = todas; uno = solo esa modalidad. Dominio (`filters.ts`: `modes`), URL (`modo=nightly|monthly|both`; los enlaces viejos con `modo=nightly`/`monthly` siguen valiendo), consulta del adaptador PostgREST y del fake, y el contrato de lecturas públicas con las tres combinaciones.
- [ ] Filtros: sección «Modalidad» con los mismos dos chips.
- [ ] Unitarias, contrato en los dos adaptadores, Playwright y capturas Pixel 7 y 360 px. Baterías en verde.
