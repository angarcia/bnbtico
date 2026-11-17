# Feature flags (historia #58, épica #57)

Cinco flags por entorno que se cambian con configuración y despliegue. Reglas de producto de cada una: `docs/decisiones.md`, entrada del 2026-11-17 «Feature flags: qué pasa con los datos al apagar cada una». Preparación: `.scratch/feature-flags/`.

## Contrato

| Flag (`Flags`) | Columna de `feature_flags` | Variable de build | Inicial | Qué controla |
| --- | --- | --- | --- | --- |
| `exploreDates` | `explore_dates` | `FLAG_EXPLORAR_FECHAS` | apagada | Fechas y disponibilidad en Explorar |
| `exploreNights` | `explore_nights` | `FLAG_EXPLORAR_NOCHES` | encendida | Número de noches en Explorar |
| `datePrices` | `date_prices` | `FLAG_PRECIOS_POR_FECHA` | apagada | Precios por fecha (tarifas especiales) |
| `externalCalendars` | `external_calendars` | `FLAG_ICAL` | encendida | Calendarios externos (importar y exportar iCal) |
| `rooms` | `rooms` | `FLAG_HABITACIONES` | apagada | Publicar y filtrar habitaciones |

- **Dominio:** `apps/app/src/domain/flags.ts` — nombres, valores iniciales, `parseFlags` (solo «true», «false» o vacío) y `searchModeOf`.
- **Navegador y worker:** `apps/app/src/shared/flags.ts` — `FLAGS` y `SEARCH_MODE` de este build. Es la única puerta: no leer `__FLAGS__` directamente.
- **Base:** `public.feature_flags()` dentro de RPCs `security definer` (no se puede llamar desde fuera). Nadie lee ni escribe la tabla por REST; solo `service_role` llama a `set_feature_flags`.
- **Modo de Explorar:** fechas si `exploreDates`; si no, noches si `exploreNights`; si no, sin estancia (precio por noche).

## Quién decide qué

| Regla | Dónde se aplica | Historia |
| --- | --- | --- |
| Modo de búsqueda, controles, copy | Navegador (`SEARCH_MODE`, `FLAGS`; `parseFilters` y `normalizeSearch` con `mode`) | #60 y `flags-noches` (hecho) |
| Fechas en la URL o enlaces viejos con la flag apagada | Navegador: se ignoran, sin filtro oculto | #60 |
| No publicar ni aprobar habitaciones | Base (`submit_listing`, `review_listing`, `listings_protect`) y navegador | #62 |
| Tarifas especiales ocultas (se conservan) | Base (totales, `public_listing_days`, guardar precios) y navegador | #61 |
| Noches importadas dejan de bloquear, lecturas paradas, sin exportación | Base (`effective_calendar_days`, ciclo de Airbnb) y worker (`/ical/*`) | #63, prioridad baja |

Una regla de escritura nunca depende de un valor que envíe el navegador: la RPC consulta `public.feature_flags()`.

## Cambiar una flag

1. En GitHub, variable del entorno: `FLAG_<NOMBRE>_PRUEBAS` o `FLAG_<NOMBRE>_PRODUCCION`, con «true» o «false». Vacía o borrada = valor inicial.
2. «Re-run» del trabajo `deploy` de la última ejecución de la rama (`develop` para pruebas). El build vuelve a compilar con las flags nuevas y el paso «Feature flags en la base» las escribe antes de publicar.
3. Un valor inválido para el build o el despliegue con el nombre de la variable; no se publica nada.

**Volver atrás:** poner el valor anterior y repetir el paso 2. Ninguna flag borra datos; lo que oculta reaparece al encenderla (salvo lo que decida su historia, como el borrado de habitaciones de #62, que va en su propia migración).

**Cuándo toma efecto:** la base, al terminar el paso «Feature flags en la base» (un momento antes de publicar el worker); navegador y ficha, al publicarse el worker. El identificador del build lleva las flags, así que un «Re-run» del mismo commit también descarta la caché persistida de Query y renueva el precache del service worker.

**Pestañas abiertas con la versión anterior:** siguen con las flags anteriores hasta que el service worker se actualiza y recargan. Lo que lean puede quedar desfasado unos minutos; lo que escriban lo frena la base con su propio valor y muestra el mensaje de error de la RPC.

**Producción:** hasta tener base propia (`3bstays-prod`) el despliegue solo valida las flags. Al preparar el lanzamiento, escribirlas también allí (`docs/antes-de-produccion.md`).

## Local

Sin variables, los valores iniciales en el build y en la base (fila que crea la migración). Para probar otra combinación: `FLAG_*=true|false` en `apps/app/.env.local` y, si la regla vive en la base, el mismo valor con `set_feature_flags` desde las pruebas (`serviceClient()`). La base local no se sincroniza sola con `.env.local`.

## Pruebas

- Vitest usa los valores iniciales (`src/shared/flags.ts` sin `__FLAGS__`); la lógica de cada modo se prueba pasando `mode` a `parseFilters` / `normalizeSearch`.
- Playwright prueba el build con las flags de su entorno: `tests/e2e/helpers/flags.ts` (`onlySearchMode`) salta las pruebas de otro modo. Hoy, modo noches: las de la búsqueda por fechas se saltan hasta que #60 añada un build con fechas.

## Seguridad

Las flags son públicas (van en el JS del navegador), no secretos. No añaden scripts en línea ni orígenes: la CSP no cambia.
