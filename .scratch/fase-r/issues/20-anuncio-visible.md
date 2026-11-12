# 20: «Disponible para consultas» pasa a «Anuncio visible»

**Qué construir:** el interruptor del detalle del propietario se llama «Anuncio visible» y explica qué pasa al apagarlo: la casa no aparece en Explorar y su ficha dice que no está disponible por ahora; el calendario no cambia.

**Bloqueado por:** 19

**Status:** done (2026-10-26)

- [x] Detalle del propietario: «Anuncio visible» con la línea «Si lo apaga, la casa no aparece en Explorar y su ficha dice que no está disponible por ahora. Su calendario no cambia.»; apagado: «Pausado hasta el …» / «Pausado». La hoja de cierre con el mismo vocabulario.
- [x] Explorar no muestra las casas pausadas (adaptador PostgREST y fake; contrato). La ficha sigue abriéndose con «No disponible por ahora» y el botón deshabilitado «No disponible por ahora».
- [x] Pruebas y `docs/pruebas-manuales-fase-r.md` (B12d, B12e, B19) con el copy nuevo. Baterías en verde.

## Cierre (2026-10-26)

- **Copy:** detalle del propietario «Anuncio visible» con la línea explicativa; apagado «Pausado hasta el …: no aparece en Explorar» / «Pausado: no aparece en Explorar hasta que lo encienda»; `describe().statusLabel` «Pausado» (Mis casas); hoja `close-sheet.tsx` «Pausar anuncio»; ficha con el botón deshabilitado «No disponible por ahora».
- **Explorar:** `searchPublic` filtra `available = true` (PostgREST y fake). Contrato nuevo en lecturas públicas (pausada fuera de la búsqueda; `getPublic` y `getManyPublic` la traen con `available: false`; al encender vuelve). Playwright `no-disponible.spec.ts` comprueba que no sale en Explorar.
- **Pruebas ajustadas al copy:** `no-disponible`, `propietario`, `frescura`, `fase4`, `contacto`, `app-instalada`, `contact-button.test.tsx`, `worker.test.ts`, `describe-can.test.ts`. Docs: decisiones, plan manual de la fase R (B12d, B12e, B19) y nota en los de las fases 3 y 4.
- **Baterías:** typecheck y build en verde; unitarias 647/647; base 169/169; Playwright 102/102; Lighthouse ficha 1,60 s, shell 0,27 s; zona privada 140,33 KB gz. Captura Pixel 7 y 360 px del detalle. Sin migraciones.
