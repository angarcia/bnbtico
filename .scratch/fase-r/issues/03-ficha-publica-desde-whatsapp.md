# 03: Public listing page from a WhatsApp link

**What to build:** a client taps `bnbtico.com/casa/CT-####` in WhatsApp and sees the photo, title and price within the first second; the WhatsApp preview of the link shows the cover and title. The page is rendered by the worker from real data, cached at the CDN, purged when the listing changes, and takes over in the browser without a hydration warning. The map and the currency toggle appear after hydration without moving the layout.

**Blocked by:** 02 (Domain foundation and public reads).

**Status:** ready-for-human (desplegado; falta la comprobación de Daniel en `nueva.bnbtico.com` y WhatsApp)

- [x] Worker route for the listing reads the public view through the PostgREST adapter with the anon key and renders the design-v1 listing page: hero with photo counter, title, zone, features with icons, approximate area, single note, price bar with the "el precio final lo acuerda con el propietario" line, disabled "Contactar por WhatsApp" with "Disponible pronto".
- [x] Head contains Open Graph and Twitter tags with the 800 px cover (or the single legacy photo), canonical to the production domain, the description in the agreed format, and a preload for the hero image.
- [x] Listing JSON embedded in a non-executed JSON script; the browser seeds the Query cache from it and hydrates without refetching.
- [x] Map (Leaflet, OSM tiles, 500 m circle on the approximate point) and the currency toggle mount after hydration inside fixed-size boxes; currency preference is client state and persists.
- [x] Not found returns 404 with the "enlace no existe" page; reviewed-then-hidden returns the "Este enlace ya no está activo" page with a non-200 status; both decided through `linkState`.
- [x] Cache headers: long `s-maxage` with stale-while-revalidate; a protected purge endpoint on the worker purges the listing URL through the Cloudflare zone API (purge by URL, not by tag).
- [x] Worker seam tests with the fake adapter: head tags, preload, JSON script, cache headers, 404, blocked, purge endpoint rejects a wrong secret.
- [x] Playwright: opens a real listing on local Supabase, asserts no hydration warning, price in colones and dollars, map present after load.
- [x] Sitemap lists active listings only, cached one hour; robots indexes production only.
- [ ] On `nueva.bnbtico.com`, sharing a listing link to yourself on WhatsApp shows the cover and title.

## Avance (2026-10-22)

- Worker: `src/server/app.ts` (`createApp` con dependencias inyectables) y `render.tsx`. Ficha, «no existe» (404), «ya no está activo» (410) y error (503, sin caché) comparten un único `ssr-data` que el navegador hidrata.
- Caché en el borde con la Cache API; la clave lleva la versión del despliegue (`CF_VERSION_METADATA`) para que un HTML cacheado nunca apunte a JS de otro despliegue. `POST /_purge/CT-####` con `Authorization: Bearer <PURGE_SECRET>` purga esa URL por la API de la zona y la borra de la caché local.
- **Pendiente de cablear:** quién llama a la purga. El navegador no puede guardar el secreto; la propuesta es un trigger en Postgres con `pg_net` al cambiar estado o disponibilidad (tickets 06/09). Mientras tanto la caché de la ficha dura como mucho 24 h o hasta el siguiente despliegue.
- Mapa (Leaflet, carga diferida) y moneda (localStorage) se montan tras hidratar, en cajas de tamaño fijo. El JS inicial de la zona privada (entrada + shell) es de 110,68 KB gz; Leaflet (43,6 KB) y supabase-js del navegador (81 KB) van en trozos diferidos.
- Pruebas: 195 unitarias (incluida la costura HTTP del worker con el fake), 16 de base y 5 de Playwright (ficha real en Supabase local: sin avisos de hidratación, sin peticiones a PostgREST al hidratar, colones y dólares, mapa cargado, 404 y 410).

## Despliegue (2026-10-23)

- Migración `cliente_directo` aplicada a `bnbtico-pruebas` (`supabase db push`). Casa de prueba **CT-1015** creada por el camino real (propietario `8777 0001`, 5 fotos, aprobada por el admin `8899 0001`).
- Desplegado (`bc2d823`). Comprobado con curl en `bnbtico-pruebas.ana-garcia-saiz.workers.dev`: ficha 200 con OG, canónica, preload y `s-maxage`; `og:image` 200; 404 para un id inexistente; sitemap con CT-1015.
- Pendiente: Daniel comprueba en `nueva.bnbtico.com` la ficha sin PIN (aplicación de Access con bypass en `/casa/*`) y la vista previa de WhatsApp.
- Incidencia del despliegue: `SUPABASE_ANON_KEY` estaba como secreto y el workflow la leía como variable → worker sin clave → 500. Ahora acepta las dos, el build de despliegue falla con un mensaje claro si falta, y el worker responde 503 con su página en vez de un 500 vacío.
- Pendientes que pasan a otros tickets: quién llama a la purga (trigger con `pg_net`, tickets 06/09); la precarga del hero aparece dos veces (la de la cabecera y la que añade React), sin efecto en la descarga.

