# 20: «Disponible para consultas» pasa a «Anuncio visible»

**Qué construir:** el interruptor del detalle del propietario se llama «Anuncio visible» y explica qué pasa al apagarlo: la casa no aparece en Explorar y su ficha dice que no está disponible por ahora; el calendario no cambia.

**Bloqueado por:** 19

**Status:** ready-for-agent

- [ ] Detalle del propietario: «Anuncio visible» con la línea «Si lo apaga, la casa no aparece en Explorar y su ficha dice que no está disponible por ahora. Su calendario no cambia.»; apagado: «Pausado hasta el …» / «Pausado». La hoja de cierre con el mismo vocabulario.
- [ ] Explorar no muestra las casas pausadas (adaptador PostgREST y fake; contrato). La ficha sigue abriéndose con «No disponible por ahora» y el botón deshabilitado «No disponible por ahora».
- [ ] Pruebas y `docs/pruebas-manuales-fase-r.md` (B12d, B12e, B19) con el copy nuevo. Baterías en verde.
