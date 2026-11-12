# 22: Zonas con sugerencias y zoom del mapa (E1 y E2)

**Qué construir:** en el paso 2 del asistente («¿Dónde está?») el campo «Zona, playa o barrio» sugiere zonas reales mientras se escribe (Photon de Komoot, datos de OpenStreetMap, sin clave) y ofrece una lista corta de zonas frecuentes del Caribe sur para tocar sin escribir; en el paso 3 el mapa abre con zoom en la zona elegida. Aprobado por Daniel el 2026-10-26.

**Bloqueado por:** 21

**Status:** done (2026-10-26)

- [x] Política de uso de Photon comprobada en su documentación oficial y anotada con enlaces en `docs/decisiones.md` (límites, identificación, atribución de OpenStreetMap).
- [x] Dominio (`src/domain/zones.ts`): zonas frecuentes del Caribe sur con coordenadas fijas (Puerto Viejo, Playa Negra, Cocles, Playa Chiquita, Punta Uva, Manzanillo, Cahuita, Limón centro); URL de Photon limitada a Costa Rica (bbox) y con sesgo hacia el cantón o la provincia elegidos; parser de la respuesta (solo Costa Rica, sin repetidos, nombre con su contexto); mínimo 3 caracteres.
- [x] Paso 2: buscador con sugerencias (espera de ~300 ms entre teclas, cancelación de la petición anterior), chips de zonas frecuentes debajo y escritura libre («Otra») si no aparece. Si Photon no responde, la lista y el texto libre siguen funcionando. Se guarda el nombre tal como lo elige el propietario.
- [x] Centro de la zona: decidido dónde vive (estado del asistente o columnas nuevas) y documentado; nada nuevo en `listings_public`.
- [x] Paso 3: el mapa se centra con zoom ~15 en la zona elegida; con «Otra» o sin centro, como hasta ahora (provincia). El pin sigue dentro de Costa Rica.
- [x] CSP: `https://photon.komoot.io` en `connect-src` del shell (no en la ficha ni en la portada); la prueba de CSP sigue en verde.
- [x] Asistente sin scroll a 375×667 con y sin teclado; presupuestos de JS (`pnpm size`) en verde.
- [x] Pruebas: unitarias del parser y del filtrado; Playwright con Photon interceptado (sugerencias, elección, zoom del paso 3, chip frecuente y Photon caído). `docs/pruebas-manuales-fase-r.md` con los pasos nuevos.
- [x] `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e` y `lighthouse` en verde; capturas en Pixel 7 y a 360 px.

## Cierre (2026-10-26)

- **Política de Photon** (enlaces en `docs/decisiones.md`): uso libre «en un límite razonable», el abuso se limita o bloquea, sin clave ni cabecera exigida; datos de OpenStreetMap (ODbL) → «Datos © OpenStreetMap · Photon» al pie de la lista. `lang=es` da 400 en el servidor público: no se manda.
- **Dominio** `src/domain/zones.ts`: `FREQUENT_ZONES` (8, con coordenadas de OSM), `photonUrl` (≥ 3 caracteres, bbox de Costa Rica, `osm_tag=place` y `natural:beach`, sesgo al centro de la provincia), `parsePhoton` (solo CR y dentro del país, sin repetidos, cantón → provincia → resto, máx. 5), `frequentZone`, `zoneCenter`, `ZONE_ZOOM = 15`.
- **Paso 2** `src/client/publish/zone-field.tsx`: combobox accesible (`role=combobox`/`listbox`, flechas y Enter eligen sin enviar el paso; el siguiente Enter envía), espera de 300 ms, `AbortController` para la petición anterior, lista flotante (no cambia el alto), fila de chips frecuentes que se desliza de lado y «Otra» (vacía y enfoca). Sin red o con Photon caído: sin sugerencias, todo lo demás igual.
- **Centro de la zona:** solo en `sessionStorage` por casa (`zone-center.ts`), sin migración ni nada nuevo en `listings_public` (motivo en `docs/decisiones.md`). Paso 3: `LocationPicker` abre con zoom 15 en la zona elegida (o en la frecuente con ese nombre); sin centro, la provincia a zoom 9; con pin, el pin a zoom 13. El pin sigue limitado a Costa Rica.
- **CSP:** `PHOTON_ORIGIN` en `connect-src` solo del shell (`photon: true` en el bloque de `_headers`); `seguridad.spec.ts` y `worker.test.ts` comprueban que está en el shell y no en la ficha.
- **Pruebas:** unitarias `zones.test.ts` (9); Playwright `zonas.spec.ts` (3, 375×667, Photon interceptado: espera entre teclas y una sola petición, respuesta vieja descartada, elección con teclado, chip marcado, zona guardada, zoom 15 por las teselas pedidas y pin en Cocles; chip frecuente → zoom 15, «Otra» + texto libre con Photon caído → zoom 9; tocar una sugerencia homónima usa su centro). Fixture automático en `helpers/test.ts` que responde vacío a Photon en todas las pruebas (nada sale a la red). `publicar.spec.ts` (sin scroll con y sin teclado) en verde sin cambios.
- **Baterías:** typecheck y build en verde; unitarias 685/685; base 176/176; Playwright 109/109; Lighthouse ficha 1,62 s, shell 0,26 s. Zona privada 141,5 KB gz / 150 (sin cambio); asistente diferido 10,45 → **12,27 KB gz** / 15. Capturas Pixel 7, 360 px y 375×667 del paso 2 (vacío y con sugerencias) y del paso 3 con zoom.
- **Sin migraciones.** **Para Daniel:** nada que configurar; probar B11b1 del plan manual tras desplegar.
