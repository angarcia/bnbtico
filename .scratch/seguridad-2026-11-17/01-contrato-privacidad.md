# Contrato de privacidad de coordenadas y fotos (historia #67, segv1-contrato)

Estado: **aprobado por Ana el 2026-11-20, con las recomendaciones de D1–D5** (sección 3). Habilita #68 (coordenadas) y
#69 (fotos). D4 ya aplicada: migración `20261120225022_fotos_sin_enumerar.sql`.
#68 hecha el 2026-11-20: migración `20261120225837_punto_publico_guardado.sql`, regresión
`apps/app/tests/db/coordenadas-publicas.test.ts`.
Fecha: 2026-11-20. Versión del código revisada: `d2cf137` (develop) más `9b32828` y `7d61382` (locales, #71).
Reproducción: `apps/app/tests/db/privacidad-exposicion.test.ts` (base local, datos desechables, lecturas con roles reales;
la service role solo siembra). Las dos pruebas afirman la exposición **actual**: #68 y #69 las convertirán en regresiones.

## 1. Lo que pasa hoy

### Coordenadas — confirmado

- `approx_point(lat, lng, public_id)` (única definición: `20261019203305_fase2_permisos.sql:127`) desplaza el punto entre
  150 y 499 m con distancia y ángulo sacados de `md5(public_id)`. El `CT-####` es público, así que el desplazamiento
  también: la prueba recupera el punto exacto **a menos de 1 m** con solo `listings_public` y el CT.
- Salidas públicas del punto (todas con `approx_point`): la vista `listings_public` (ficha, SSR de `/casa/CT-####`,
  favoritos) y la RPC `search_listings` (Explorar, mapa). Ninguna otra vista ni RPC pública devuelve `lat`/`lng` de una casa.
  `listings` (exactas) solo la leen dueño y admin.
- Filtro por zona: `search_listings` usa el punto **exacto** para «a 5 km o menos de la zona». Solo responde sí/no frente a
  centros de zona fijos: revela poco (discos de 5 km). Ver decisión D3.
- Cachés con el punto: HTML de la ficha en la caché de Cloudflare (se purga con `/_purge/*`), la caché de TanStack Query en
  IndexedDB de cada navegador y cualquier copia que alguien ya haya guardado. **Todo punto publicado hasta hoy ya está
  quemado:** con el CT se invierte desde cualquier copia antigua. Cambiar el algoritmo no lo arregla para esas copias; solo
  sirve un punto público **nuevo**, y la casa exacta sigue donde está.

### Fotos — confirmado

- Bucket `listings` **público** y política `listings_photos_public_read` (`for select to public using (bucket_id = 'listings')`,
  `20261019192540_fase2_casas.sql:143`), nunca retirada. Rutas `<casa>/<uuid>/<480|800|1600>.jpg`, caché de un año.
- Las **filas** sí están protegidas: `listing_photos` solo se lee si la casa es visible (`listing_visible`);
  `listing_edit_photos`, dueño y admin. El fallo está en los **objetos**.
- Matriz observada (borrador con una foto subida):

  | Quién | Enumera la raíz (uuid de todas las casas, también borradores) | Enumera la carpeta de la casa | Descarga la foto |
  |---|---|---|---|
  | anónimo | sí | sí | sí (también por URL pública, sin sesión) |
  | otro usuario | sí | sí | sí |
  | dueño | sí | sí | sí |
  | admin aal1 | sí | sí | sí |
  | admin aal2 | sí | sí | sí |

  Esperado: anónimo y otro usuario **no** en las tres columnas para borradores, fotos de ediciones pendientes, rechazadas
  y retiradas; dueño sí; admin solo con aal2; fotos aprobadas de casas activas, descarga pública (sin enumeración).
- Importante: en un bucket **público**, Storage sirve `/object/public/...` **sin mirar políticas**. Quitar la política de
  lectura solo corta la enumeración y la descarga autenticada; la URL pública sigue funcionando para quien conozca la ruta.
  Las fotos de borrador y de edición pendiente viven en el mismo bucket que las aprobadas (`listing_edit_photos.path`:
  «la misma carpeta que las fotos aprobadas»).

## 2. Contrato propuesto

### Coordenadas (#68)

1. **El punto público es un dato guardado, no calculado:** columnas nuevas `public_lat`, `public_lng` en `listings`, escritas
   solo por SQL con un desplazamiento **aleatorio** (`gen_random_uuid()`/`random()`, misma banda 150–499 m) al crear la
   ubicación y al aprobar un cambio de ubicación (`review_edit_field` de lat/lng y cualquier otra RPC que la cambie; #68
   las inventaría con un trigger que recalcula `public_*` cuando cambian `lat`/`lng`, para no depender de cada RPC).
   No se deriva de nada público → no se invierte. Estable: no cambia entre lecturas ni al reconstruir el cliente.
2. `listings_public` y `search_listings` devuelven `public_lat`/`public_lng` con los mismos nombres de columna (`lat`, `lng`):
   **sin cambio de contrato para el navegador**, sin pestañas antiguas rotas. `approx_point` se borra (también de PostgREST).
3. Columnas nuevas: sin `grant` a `anon`/`authenticated` sobre `listings` más allá de lo de hoy (dueño y admin ya leen la
   tabla). Las exactas siguen igual: solo dueño y admin (aal2 para el admin, como hoy).
4. Migración: rellena `public_*` de todas las casas con un punto aleatorio **nuevo** (los antiguos están quemados) y purga
   la caché de todas las fichas activas (la purga existente). Reversión: la vista vuelve a `approx_point` (migración inversa);
   no se recupera nada de privacidad al revertir, solo el comportamiento.
5. Alternativas descartadas: **HMAC con secreto en Vault** (estable sin columna, pero rotar el secreto mueve todas las casas y
   el secreto pasa a ser crítico); **rejilla** (redondear a celdas de ~500 m: casas vecinas apiladas en el mismo punto del
   mapa y la celda delata la zona igual).

### Fotos (#69)

1. **Dos buckets:** `listings` (público) solo con fotos **aprobadas de casas que se pueden mostrar**; `listings-privadas`
   (privado) para borradores, ediciones pendientes y lo rechazado/retirado mientras se conserve. La política de lectura
   pública del bucket público se sustituye por ninguna (sin enumeración); en el privado, lectura para dueño y admin aal2
   (`is_admin()` ya exige aal2), escritura del dueño en su carpeta como hoy.
2. **Subida:** el navegador sube siempre al privado (mismas tres variantes, mismo `<casa>/<uuid>/<tamaño>.jpg`).
3. **Publicar = copiar** del privado al público: al aprobar una casa (`review_listing` approve) y al aprobar una foto de
   edición (`review_edit_photo`). Postgres no copia objetos: la copia la hace el **worker** con la service role (ya la
   tiene), en un endpoint nuevo llamado por `pg_net` desde las RPCs, como la purga de caché (mismo patrón, secreto en Vault).
   Idempotente (copiar dos veces da lo mismo) y con reintento en el cron horario para lo que quedó a medias
   (`listing_photos.published_at is null`). Mientras no está copiada, la ficha pública **no** la enseña.
4. **Retirar = borrar del público:** al quitar una foto aprobada, al parar o eliminar la casa (decisión D2) y al rechazar.
   Se purga la caché de Cloudflare de esas URLs; la caché del CDN de Supabase y los navegadores pueden servir la copia
   vieja hasta un año: **no se promete borrar copias ya descargadas.**
5. **Dueño y admin ven lo privado con URL firmada** (`createSignedUrl`, 1 h) pedida al pintar: no se guarda en la caché
   persistida de Query (IndexedDB) ni en HTML SSR. La ficha pública, el OG y Explorar siguen con URL pública: sin cambio
   de LCP ni de `srcset`.
6. **Datos existentes:** mover al privado las fotos de borradores, ediciones pendientes y casas no activas; dejar en el
   público solo las aprobadas de casas activas. Script del worker (o de Ana con la CLI), por lotes, que **copia, comprueba
   y después borra**: interrumpido, se reanuda sin perder originales; revertir = copiar de vuelta. Las URL públicas de fotos
   pendientes que alguien ya tenga dejan de funcionar al borrarlas del público (limitado por la caché del CDN).
7. Coste: Storage del plan gratuito (1 GB) — las fotos aprobadas no se duplican (se borran del privado tras copiar,
   decisión D1); las privadas firmadas no pasan por el worker. Peticiones de worker: una por foto aprobada, no por visita.
8. Alternativas descartadas: **un bucket privado + proxy del worker** para todas las fotos (cada imagen de cada visita sería
   una petición del worker: rompe el plan gratuito de 100 000/día y empeora el LCP); **solo quitar la política de
   lectura** (corta la enumeración pero una ruta conocida sigue abierta: no cumple «incluso con ruta conocida» de #69).
   Esta última sí vale como **mitigación inmediata** mientras se hace #69 (D4).

## 3. Decisiones (aprobadas el 2026-11-20 tal como se recomiendan)

- **D1. ¿Borrar del privado la foto tras copiarla al público?** Recomiendo sí (no duplica el GB gratuito); si se rechaza
  luego una edición, la aprobada sigue en el público.
- **D2. ¿Al parar o eliminar una casa, sus fotos salen del público?** Recomiendo sí: el enlace de una ficha parada ya deja de
  funcionar (regla vigente); sin esto, las fotos siguen descargables por URL. Al reactivarla se vuelven a copiar.
- **D3. Filtro de 5 km: ¿punto exacto o público?** Recomiendo exacto (como hoy): el resultado solo dice «cerca de esta zona»,
  y cambiarlo al público movería casas cerca del borde dentro o fuera de la búsqueda.
- **D4. ¿Mitigación inmediata?** Una migración pequeña que quita `listings_photos_public_read` (adiós a la enumeración, nada
  más cambia porque la app no lista el bucket). Se puede hacer ya, antes de #69; cierra la parte más barata del ataque
  (descubrir uuid de borradores).
- **D5. Copia en producción:** `3bstays-prod` aún no existe; propongo que nazca con el contrato aplicado, y que la migración de
  objetos solo corra en `bnbtico-pruebas`.

## 4. Lo que queda fuera

Sin cambios de pantallas ni de copy. Sin prometer anonimato: el punto público sigue a menos de 500 m de la casa, y la zona
y la descripción dan pistas. Sin borrar copias que terceros ya tengan. No se ejecuta ninguna migración ni traslado aquí.
