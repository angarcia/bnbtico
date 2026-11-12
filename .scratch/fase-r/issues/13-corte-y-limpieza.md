# 13: Cutover and cleanup

**What to build:** `pruebas.bnbtico.com` and `bnbtico.com` are served by the new app on Cloudflare, the landing page keeps working as static HTML, the old Next app and its Vercel project are gone, the new package carries the name `apps/web`, and every document and local tool points at the new app.

**Blocked by:** 12 (Lighthouse gate and parity run).

**Status:** ready-for-human (parte no destructiva hecha el 2026-10-23; el corte espera la aprobación del plan de pruebas y sigue `docs/corte-fase-r.md`)

**Manual steps (Daniel):** approve the DNS switch (records can be changed through the API once the zone is on Cloudflare), retire the Vercel project after a week, create the Access application for `pruebas.bnbtico.com`.

- [x] Landing page ported as a static asset with its SEO tags, JSON-LD, OG image and the `?pronto=1` behavior; `HEAD /` returns 200; production worker serves the landing only until launch (`LAUNCHED`). *(La ruta `bnbtico.com` del entorno `production` se activa el día del corte: guion, paso 5.)*
- [ ] `pruebas.bnbtico.com` routed to the `pruebas` environment behind Access; `nueva.bnbtico.com` removed after the switch.
- [ ] Old `apps/web` deleted; `apps/app` renamed to `apps/web`; root scripts, `.claude/launch.json` and the Playwright configuration updated; the Next-specific notes removed from `CLAUDE.md`.
- [ ] Documents updated: `docs/plan-implementacion.md` (fase R done, estado), `docs/decisiones.md` (cutover entry with measured numbers), `docs/configuracion-supabase.md` (Cloudflare and GitHub secrets instead of Vercel), `docs/pruebas-manuales-fase-2.md` (URLs).
- [ ] Vercel project removed; no reference to `PREVIEW_PASSWORD` or the proxy remains.
- [ ] Final commit on `develop` and merge to `main` for the landing.

## Cierre de la parte preparable (2026-10-23)

Encargo: solo lo no destructivo. **No** se ha cambiado DNS, ni rutas, ni Access, ni Vault, ni Vercel; `apps/web` sigue en su sitio; `main` sin tocar; nada empujado. Lo que cambia en `nueva.bnbtico.com` al desplegar: solo que `/?pronto=1` muestra la portada (`/` sigue llevando a Explorar).

- **Portada estática:** `apps/app/public/portada.html` + `public/portada/` (`portada.css`, `playa-negra-800.jpg` 62 KB y `-1592.jpg` 109 KB con `srcset`, logo crema a 420 px, 31 KB en vez de 145 KB) + `public/og.jpg` (1200×630). Mismo copy, título, descripción, canónica, Open Graph, Twitter y JSON-LD (Organization + WebSite) que `apps/web/app/page.tsx`; el logo del JSON-LD apunta a `/icons/icono-512.png` (el `icon-512.png` de la app vieja no existe en la nueva). Sin JavaScript (el JSON-LD es dato) ni estilos en línea; **sin Google Analytics** (decisión pendiente, abajo). Fuera del precache del service worker.
- **Worker** (`src/server/app.ts`, `landingOnly` en `src/domain/seo.ts`): `"/"` en `run_worker_first`. Pruebas/local: `/` = shell (el router redirige a `/explorar`), `/?pronto=1` = portada. Producción con `LAUNCHED` ≠ `"true"`: `/` = portada; pasan robots (indexable), sitemap (solo `/`, sin consultar Supabase) y los ficheros de la portada (`favicon.ico`, `og.jpg`, `portada/*`, `fonts/*.woff2`, `icons/*.png`); todo lo demás 404 con la portada. CSP de la portada sin Supabase ni Turnstile; `cache-control` 5 min / 1 h en el borde. `HEAD /` 200 en todos. El cron no consulta nada en «solo portada».
- **`wrangler.jsonc`:** `production` con `LAUNCHED: "false"`, `assets.run_worker_first: true`, sin rutas (las del corte en comentarios); `pruebas` sigue en `nueva.bnbtico.com` con la ruta de `pruebas.bnbtico.com` comentada. Comprobado con `CLOUDFLARE_ENV=production pnpm build` + `vite preview` (`/` y `/?pronto=1` 200, `/explorar`, `/casa/CT-1015`, `/index.html`, `/sw.js`, `/assets/x.js` 404 con la portada, ficheros 200, sitemap con una URL) y `wrangler deploy --dry-run` (`ENVIRONMENT=production`, `LAUNCHED=false`).
- **Migración pendiente** `supabase/migrations-pendientes/corte_fotos_solo_rpc.sql` (nota del ticket 08: revocar insert/update/delete de `listing_photos` a `authenticated` y solo `<casa>/<uuid>/{480,800,1600}.jpg` en Storage). Ensayada en local y deshecha con `db reset`: con ella fallan solo las dos pruebas de base que comprueban lo viejo (documentadas en el guion, paso 8); Playwright de fotos, publicar y admin en verde. El arnés de base siembra ahora las fotos con la service role (vale antes y después).
- **Guion** `docs/corte-fase-r.md`: comprobaciones previas, Vercel sin builds, Access de `pruebas` antes del DNS, DNS y rutas por entorno, Vault, Turnstile, retirada de `nueva`, borrado y renombrado con la lista de archivos, migración de fotos, merge a `main`, Vercel fuera tras una semana, vuelta atrás de cada paso y lo que es del lanzamiento.
- **Documentos:** `CLAUDE.md` (fase R construida pendiente del corte, TOTP, portada, nueva documentación, admins de pruebas), `docs/plan-implementacion.md` (estado), `docs/configuracion-supabase.md` (sección 10: variables y secretos de GitHub y Cloudflare con su nombre exacto; Vercel marcado «hasta el corte»), `docs/decisiones.md` (entrada de la portada), `docs/pruebas-manuales-fase-r.md` (B5e: `/?pronto=1`).
- **Pruebas nuevas:** `tests/unit/portada.test.ts` (17: HTML, worker en pruebas y en producción con y sin lanzar, `wrangler.jsonc`), cron +2, `landingOnly` +2, precache +1; `tests/e2e/portada.spec.ts` (3: portada sin JS con imagen, fuente, CSP y etiquetas; `/` → Explorar; `HEAD /`). Captura Pixel 7 revisada (igual que la portada vieja).
- **Baterías** (árbol limpio con solo estos cambios, en un worktree aparte, porque en el árbol de trabajo había cambios ajenos en curso en `cuenta.tsx`/`cuenta.spec.ts`): `typecheck` y `build` en verde; unitarias **435/435**; base **118/118**; Playwright **51/51 + 2 omitidas**; Lighthouse 1/1 (ficha en frío **1,60 s**, shell instalado **0,24 s**). **Zona privada 145,26 KB gz** / 150 (asistente 9,96, admin 6,72, Web Vitals 3,15, `sw.js` 1,90).
- **Sin migraciones aplicadas** (la pendiente no está en `supabase/migrations/`).

### Queda para el día del corte (sin [x] arriba)

Todo en `docs/corte-fase-r.md`, en este orden: Vercel sin builds → Access de `pruebas.bnbtico.com` (+ bypass `/casa/*`, `/_purge/*`) → DNS y ruta de `pruebas` → Vault `worker_purge_url`, Site URL y Turnstile → `bnbtico.com` al worker de producción → retirar `nueva.bnbtico.com` → borrar `apps/web` y renombrar (scripts, `launch.json`, workflow, `.gitignore`, `CLAUDE.md` sin las notas de Next, README, docs) → migración de fotos → merge a `main` → `docs/decisiones.md` con los números del día → Vercel fuera a la semana. Los documentos que dependen del corte (`decisiones.md` con los números medidos, URL de `pruebas-manuales-fase-2.md`, quitar Vercel y `PREVIEW_PASSWORD`) quedan para ese día.

### Decisiones para Daniel

1. Google Analytics en la portada (recomendado: sin GA hasta el lanzamiento; opción con CSP propia solo en la portada en el guion).
2. `www.bnbtico.com`: redirección 301 o servirlo con el worker (recomendado: redirección).
3. Secretos por entorno en GitHub antes del primer push a `main` (hoy el worker de producción recibiría la service role de pruebas sin usarla).
