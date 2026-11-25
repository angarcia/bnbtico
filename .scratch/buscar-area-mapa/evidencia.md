# Búsqueda por el área del mapa (historia #96) · evidencia

Fecha: 2026-11-25. Base local (Supabase local, Postgres 17), migración `20261125180000_buscar_area_mapa`.

## Plan y coste

Dentro de `begin; … rollback;`: 5 000 casas activas repartidas al azar por Costa Rica (lat 8,1–11,1; lng −85,8 a −82,6), más las de prueba; `analyze`.

| Llamada | Filas | Tiempo |
|---|---|---|
| `search_listings(p_limit => 60)` (todo el país) | 60 | 6,9 ms |
| Área de Cahuita (−82,9; 9,6; −82,7; 9,8) | 27 | 0,57 ms |
| Área de todo el país | 60 | 6,8 ms |

Filtro espacial (`public_lat between … and public_lng between …`): `Bitmap Index Scan on listings_public_point_idx` → 268 candidatas por el índice, 27 tras el recheck, 31 bloques leídos, 0,033 ms.

Límites de la evidencia: datos sintéticos en local; no mide red ni la base alojada. El total orientativo (con fechas) solo se calcula para las 60 devueltas, como antes.

## Peticiones por interacción

- Tres toques seguidos en «Acercar mapa»: una sola petición `search_listings` (e2e `explorar-area-mapa.spec.ts`, primer caso).
- Volver a un área ya consultada: ninguna petición (caché de Query; comprobado en el navegador).
- Un área superada mientras carga: su petición queda cancelada (`ERR_ABORTED` en la pestaña Red).

## Privacidad

El área se filtra por el punto público guardado (150–499 m del real, aleatorio y estable). Un área de ±55 m alrededor del punto real no encuentra la casa; una alrededor del público, sí (`tests/db/buscar-area-mapa.test.ts`). Afinar el área solo acota el punto público, que ya se publica.
