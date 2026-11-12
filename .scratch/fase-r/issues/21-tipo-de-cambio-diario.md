# 21: Tipo de cambio diario (fuera la constante ₡510)

**Qué construir:** el tipo USD→CRC con que se muestran los dólares deja de ser la constante `FX_CRC_PER_USD = 510`. El cron diario del worker lo lee de una fuente gratuita sin registro (con respaldo), lo guarda con fecha y fuente en una tabla pública de solo lectura, y la app y la ficha SSR lo usan en todo lo que convierte, diciendo de qué día es. Aprobado por Daniel el 2026-10-26.

**Bloqueado por:** 20

**Status:** done (2026-10-26) · migración pendiente en el alojado

- [x] Licencias y condiciones de las dos fuentes comprobadas en su documentación oficial y anotadas con enlaces en `docs/decisiones.md`. Principal = la que no exige atribución; la otra, respaldo.
- [x] Dominio (`src/domain/fx.ts`): tipo `FxRate` (colones por dólar, día, fuente), parser de cada fuente, rango plausible 300–900, elección principal → respaldo → último valor, valor inicial 510 «constante», fecha corta («26 oct.») y atribución por fuente.
- [x] Migración (solo local): tabla `fx_rates` (un tipo por día, fuente con lista cerrada, check del rango) legible por anon y authenticated, escrita solo por la service role; fila inicial 510 «constante».
- [x] Worker: el cron diario pide el tipo a la principal y, si falla o es implausible, al respaldo; lo guarda con la service role (fetch a PostgREST en `src/data/postgrest/`, sin supabase-js); si las dos fallan, no escribe nada (queda el último) y lo dice en el log. Sin clave de servicio o en «solo portada», no lo intenta.
- [x] `PublicListingsApi.fxRate()` en los dos adaptadores con su contrato (sin filas propias → 510 «constante»; el más reciente por día).
- [x] App: consulta `["fx"]` (staleTime largo, persistida con la caché pública) usada en tarjetas, ficha («≈»), Favoritos, calendario de la ficha y filtros de precio en dólares. La fecha del tipo donde ya se dice que es orientativo, sin agrandar la interfaz.
- [x] Ficha SSR: el worker lee el tipo junto con la casa; `ssr-data` lleva el tipo usado; sin avisos de hidratación. Si falla la lectura del tipo, la ficha sale con el de respaldo y sin caché del borde.
- [x] Atribución (solo si el tipo vigente viene de la fuente que la exige): línea pequeña y gris bajo el selector de Mi cuenta («Tipo de referencia del 26 oct. · <Fuente>» con el nombre enlazado) y al final de la nota de Explorar en dólares («· <Fuente>»). Nada en la ficha.
- [x] CSP del navegador sin cambios (las fuentes las pide el worker).
- [x] Pruebas sin red: unitarias de los parsers y de la elección; costura del cron con fetch inyectado; contrato en los dos adaptadores; base (privilegios de la tabla); Playwright con un tipo sembrado distinto de 510 en Explorar y en la ficha en dólares. `docs/pruebas-manuales-fase-r.md` con los pasos nuevos.
- [x] `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e` y `lighthouse` en verde; capturas en Pixel 7 y a 360 px.

## Cierre (2026-10-26)

- **Licencias** (detalle y enlaces en `docs/decisiones.md`): fawazahmed0/exchange-api es CC0-1.0, sin límites ni atribución → **principal** (jsDelivr y su dominio de respaldo `latest.currency-api.pages.dev`). ExchangeRate-API (acceso abierto) exige el enlace «Rates By Exchange Rate API» a `https://www.exchangerate-api.com` y prohíbe redistribuir los datos como servicio → **respaldo**, con la atribución solo en Mi cuenta (línea bajo el selector) y al final de la nota de Explorar, y solo cuando el tipo vigente viene de ella.
- **Dominio** `src/domain/fx.ts`: `FxRate`, `FX_INITIAL` (510 · constante · 2026-10-26), `isPlausibleRate` (300–900), `parseFawazahmed0`, `parseExchangeRateApi`, `FX_SOURCES`, `fetchFxRate` (fetch inyectado, 8 s por petición, motivos de cada fallo), `FX_ATTRIBUTION`, `fxDayLabel` («26 oct.», «1 set.»), `fxRateLabel`, `fromFxRow`. Fuera `FX_CRC_PER_USD`: `formatUSD`, `formatMoney`, `compactPrice`, `priceInputToColones` y `colonesToPriceInput` reciben el tipo.
- **Migración `20261027044539_tipo_de_cambio`** (solo local; tipos regenerados): `fx_rates` (día clave, `numeric(10,4)` con check 300–900, fuente con lista cerrada), lectura para anon/authenticated, escritura solo service role, fila inicial 510 «constante».
- **Worker:** `runDaily` llama a `refreshFx` tras el keep-alive y el recorte (escritor `src/data/postgrest/fx.ts`, upsert por día con fetch a PostgREST); línea de log `{"event":"fx",…}`; si fallan las dos fuentes no escribe (`kept: "último guardado"`); un fallo del tipo no hace fallar el cron. La ficha SSR lee `fxRate()` a la vez que la casa y los días; `ssr-data.fx`; si falla, el inicial y `no-store`.
- **App:** `src/shared/fx.ts` (`fxQuery` `["fx"]`, 6 h, persistida; `useFx(enabled)`; `seedFx`). Tarjetas, Favoritos, ficha (cifra, «≈», calendario), Filtros (espera al tipo en dólares) y Mi cuenta. Fecha visible en la nota de Explorar, la ayuda de Filtros y Mi cuenta; en la ficha va en el `title` de la referencia para no agrandar la barra fija (revisión UX C3).
- **Pruebas:** unitarias `fx.test.ts` (14: parsers, rango, fuentes, atribución, elección principal/respaldo/ninguna, tiempo máximo, etiquetas), `cron.test.ts` +8 (costura del cron con fetch inyectado y del escritor), `worker.test.ts` +3 (tipo en la ficha y en ssr-data, sin cron, fallo → inicial y no-store), contrato `fx.contract.ts` en el fake y en Supabase local (3 cada uno), `tests/db/tipo-de-cambio.test.ts` (permisos y checks); Playwright `tipo-de-cambio.spec.ts` (4: Explorar y Filtros en dólares con ₡400 y atribución, ficha SSR con ₡400 sin avisos de hidratación ni atribución, Mi cuenta con la línea, fuente principal sin enlace). Las existentes siguen con 510 (la fila inicial).
- **Baterías:** typecheck y build en verde; unitarias 676/676; base 176/176; Playwright 106/106; Lighthouse ficha 1,62 s, shell 0,28 s. Zona privada **141,5 KB gz** / 150 (antes 140,32). Capturas Pixel 7 y 360 px de Explorar, Filtros, ficha y Mi cuenta en dólares con atribución.
- **CSP sin cambios.**
- **Para Daniel:** aplicar la migración en `bnbtico-pruebas` (A1 del plan manual) y, tras el primer cron (03:17 de Costa Rica), comprobar B23 (línea `fx` en Workers Logs) y B5g. Nada que configurar: el worker ya tiene la clave de servicio.
