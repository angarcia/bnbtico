# 03: Public listing page from a WhatsApp link

**What to build:** a client taps `bnbtico.com/casa/CT-####` in WhatsApp and sees the photo, title and price within the first second; the WhatsApp preview of the link shows the cover and title. The page is rendered by the worker from real data, cached at the CDN, purged when the listing changes, and takes over in the browser without a hydration warning. The map and the currency toggle appear after hydration without moving the layout.

**Blocked by:** 02 (Domain foundation and public reads).

**Status:** ready-for-agent

- [ ] Worker route for the listing reads the public view through the PostgREST adapter with the anon key and renders the design-v1 listing page: hero with photo counter, title, zone, features with icons, approximate area, single note, price bar with the "el precio final lo acuerda con el propietario" line, disabled "Contactar por WhatsApp" with "Disponible pronto".
- [ ] Head contains Open Graph and Twitter tags with the 800 px cover (or the single legacy photo), canonical to the production domain, the description in the agreed format, and a preload for the hero image.
- [ ] Listing JSON embedded in a non-executed JSON script; the browser seeds the Query cache from it and hydrates without refetching.
- [ ] Map (Leaflet, OSM tiles, 500 m circle on the approximate point) and the currency toggle mount after hydration inside fixed-size boxes; currency preference is client state and persists.
- [ ] Not found returns 404 with the "enlace no existe" page; reviewed-then-hidden returns the "Este enlace ya no está activo" page with a non-200 status; both decided through `linkState`.
- [ ] Cache headers: long `s-maxage` with stale-while-revalidate; a protected purge endpoint on the worker purges the listing URL through the Cloudflare zone API (purge by URL, not by tag).
- [ ] Worker seam tests with the fake adapter: head tags, preload, JSON script, cache headers, 404, blocked, purge endpoint rejects a wrong secret.
- [ ] Playwright: opens a real listing on local Supabase, asserts no hydration warning, price in colones and dollars, map present after load.
- [ ] Sitemap lists active listings only, cached one hour; robots indexes production only.
- [ ] On `nueva.bnbtico.com`, sharing a listing link to yourself on WhatsApp shows the cover and title.
