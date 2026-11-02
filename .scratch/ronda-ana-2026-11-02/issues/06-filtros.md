# 06 · Filtros: baños, tipo; todo el país con el Caribe primero

Status: ready-for-agent

Todo el filtrado vive en `apps/app/src/domain/filters.ts` (esquema zod de la URL, `effectiveFilters`, `extrasCount`, `toSearchParams`, `normalizeSearch`) y se aplica igual en `data/postgrest/listings.ts:24-39` y `data/fake/listings.ts:77-98` (suite de contrato). Pantalla: `client/screens/filtros.tsx`.

## Qué
1. **Baños:** clave de URL nueva (p. ej. `banos`), `<select>` «Baños» (Cualquiera, 1+, 2+, 3+) junto a «Habitaciones» en «Para quiénes» (ya es un `grid-2` con un solo campo). Filtra `bathrooms >= n` (`.gte("bathrooms", n)`); las casas con baños vacíos quedan fuera al filtrar, como con habitaciones.
2. **Tipo:** clave nueva (p. ej. `tipo=completo|habitacion`), chips «Cualquiera · Alojamiento completo · Habitación» en una sección «Tipo de alojamiento». «Alojamiento completo» = `kind in ('completo','casa','apartamento')` (valores viejos, `domain/listing.ts:22`).
3. Las dos claves entran en `extrasCount`, `toSearchParams`, `normalizeSearch`, «Limpiar» y el conteo «Ver N casas».
4. **«¿Dónde?» en blanco = todas las provincias, con el Caribe primero** (decisión 2026-11-02, sustituye «Caribe por defecto»): Explorar arranca sin provincia (fuera `defaultProvince` como valor por defecto). La fila «Zona» de «Su búsqueda» dice «Todas las provincias» sin zona; la línea de resultados, «N casas» (sin «en Limón»). Con zona elegida, manda la zona (5 km) como hoy. `?prov=` de enlaces viejos sigue filtrando por esa provincia.
5. **Orden con el Caribe primero:** las casas de Limón primero y, dentro de cada grupo, como hoy (`created_at desc`). En SQL: migración nueva con `create or replace` de la versión vigente de `search_listings` (`supabase/migrations/20261030233129_admin_casas_acciones.sql`) cambiando **solo** el `order by` (p. ej. `(l.province = 'Limón') desc, l.created_at desc`; mire cómo se guarda la provincia en la fila: si es código de cantón 7xx, use eso, como `caribeFirst` de `domain/zones.ts`). El fake igual. Prueba de contrato del orden.
6. **Fuera los chips de provincia** de Filtros (`filtros.tsx:136-162`, `provinces.length > 1`, `pickProvince`, `provinceChips` si queda sin uso).
7. **Lista y mapa enseñan lo mismo:** el mapa (`client/explore-map-full.tsx`, `MapScreen`) sigue usando la lista de la búsqueda (no hace falta otra consulta). Sin zona, abre centrado en el Caribe (como hoy con Limón); con zona, en la zona.

## No tocar
- Con zona elegida manda la zona (5 km).
- `SEARCH_LIMIT = 60` (si cree que con todo el país hace falta paginar, dígalo; no lo cambie).
- Filtro de precio (lo cambia otro ticket más adelante), características, personas en «¿Quiénes?».
- «Solo alquiler mensual» (lo quita el ticket 07; no lo toque aquí).
- Aspecto y comportamiento del botón «Mapa».

## Pruebas
- Unit `tests/unit/filters.test.ts` (claves nuevas, `extrasCount`, normalización; `provinceChips` si queda sin uso, borrar).
- Contrato `tests/contract/public-reads.contract.ts`: baños ≥ n y tipo (con fila `casa` vieja) en fake y PostgREST.
- E2E a reescribir: `explorar.spec.ts:63-64,70-71,110,120` (usan chips de provincia «Todas»); `buscar.spec.ts:154-165`. Nuevas: sin zona, la lista enseña una casa de Puntarenas después de las de Limón y la fila dice «Todas las provincias»; el mapa enseña las mismas casas que la lista.
- Guía `docs/pruebas-manuales.md` C30; `docs/diseno-v1.md:21`.
