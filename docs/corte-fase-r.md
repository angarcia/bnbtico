# Guion del corte de la fase R

Fecha de redacción: 2026-10-23 (ticket 13, parte preparada). **No se ejecuta hasta que Daniel apruebe `docs/pruebas-manuales-fase-r.md`.** Lo hace Daniel (o un agente con su permiso explícito para cada paso que toca Cloudflare, Supabase alojado, GitHub o Vercel). Pasos en orden; cada uno dice cómo volver atrás.

**Hoy (antes del corte):** Vercel sirve `bnbtico.com` (portada, rama `main`) y `pruebas.bnbtico.com` (app vieja con `PREVIEW_PASSWORD`, rama `develop`) desde `apps/web`. Los registros `@` (A `76.76.21.21`) y `pruebas` (CNAME `cname.vercel-dns.com`), y `www` si existe, están en la zona `bnbtico.com` de Cloudflare en modo **DNS only** (guía del ticket 01, parte C). La app nueva (`apps/app`) se despliega desde `develop` al worker `bnbtico-pruebas` en `nueva.bnbtico.com`, detrás de Cloudflare Access.

**Después del corte:** `pruebas.bnbtico.com` = worker `bnbtico-pruebas` (Access); `bnbtico.com` = worker `bnbtico-production` sirviendo **solo la portada** hasta el lanzamiento; `nueva.bnbtico.com` desaparece; `apps/app` se llama `apps/web`; el proyecto de Vercel se borra una semana después.

## Qué está preparado ya (2026-10-23)

- **Portada estática** en `apps/app/public/portada.html` + `public/portada/` + `public/og.jpg`: mismas etiquetas SEO, JSON-LD (Organization y WebSite), imagen OG 1200×630 y copy que `apps/web/app/page.tsx`. Sin JavaScript ni Google Analytics. CSP propia más estricta que la del shell (sin Supabase ni Turnstile).
- **El worker decide `/`** (`src/server/app.ts`; `"/"` está en `run_worker_first`):
  - pruebas y local: `/` es el shell de la SPA (el router lleva a `/explorar`, como hoy); `/?pronto=1` muestra la portada (como en la app vieja).
  - producción con `LAUNCHED` distinto de `"true"` (`landingOnly`, `src/domain/seo.ts`): `/` es la portada; también se sirven `robots.txt` (indexable), `sitemap.xml` (solo `https://bnbtico.com/`, sin consultar Supabase), `favicon.ico`, `og.jpg`, `portada/*`, `fonts/*.woff2` e `icons/*.png`. Todo lo demás (`/explorar`, `/casa/CT-…`, `/sw.js`, `/assets/*`, balizas, purga…) responde **404 con la portada**. El cron diario no hace nada (aún no hay Supabase de producción).
  - `HEAD /` responde 200 en todos los entornos.
- **`wrangler.jsonc` entorno `production`:** `LAUNCHED: "false"`, `assets.run_worker_first: true` (todo pasa por el worker para poder cerrar la SPA), `workers_dev`/`preview_urls` en `false` y **sin rutas**. Las rutas del día del corte están en comentarios. Comprobado con `CLOUDFLARE_ENV=production pnpm build` + `vite preview` + `wrangler deploy --dry-run` (bindings `ENVIRONMENT=production`, `LAUNCHED=false`).
- **Migración pendiente** `supabase/migrations-pendientes/corte_fotos_solo_rpc.sql` (nota del ticket 08): fuera de `supabase/migrations/` para que no se aplique sola. Ensayada en local: con ella aplicada solo fallan las dos pruebas de `tests/db/cliente-directo-fotos.test.ts` que comprueban el comportamiento viejo (paso 8); `fotos.spec.ts`, `publicar.spec.ts` y `admin.spec.ts` en verde. El arnés de base ya siembra las fotos con la service role, así que vale antes y después.

## 0. Comprobaciones previas (sin tocar nada)

1. `docs/pruebas-manuales-fase-r.md` ejecutado en `nueva.bnbtico.com` y aprobado por Daniel (todas las casillas de B o los fallos aceptados por escrito).
2. GitHub Actions verde en el último commit de `develop` (tipos, unitarias, base, Playwright, Lighthouse, tamaño, despliegue). En local, desde `apps/app`: `pnpm typecheck && pnpm test && pnpm test:db && pnpm dev:vars && pnpm build && pnpm size && pnpm test:e2e && pnpm lighthouse`.
3. `docs/antes-de-produccion.md` revisada. Para el **corte** solo afecta: Turnstile con los hostnames nuevos (paso 4). Twilio de pago, Geo permissions, topes de envío y alerta de gasto son del **lanzamiento** (cuando bnbtico.com abra la app), no del corte; anotar en el registro si se adelanta alguno.
4. Decisiones abiertas resueltas (ver «Decisiones para Daniel» al final): Google Analytics en la portada y `www`.
5. Nadie está usando la app vieja en `pruebas.bnbtico.com` (avisar a quien pruebe).
6. Anotar los registros DNS actuales de la zona (Cloudflare → DNS → Export) en un archivo local: es la copia para volver atrás.

## 1. Vercel deja de construir (reversible)

Antes de empujar nada que renombre carpetas, para que Vercel no intente construir la app nueva con Next:

- Vercel → proyecto `bnbtico` → Settings → Git → **Ignored Build Step** → «Don't build anything» (o el comando `exit 0`). Los despliegues actuales siguen sirviendo.
- **Volver atrás:** quitar el Ignored Build Step.

## 2. Access para `pruebas.bnbtico.com` (antes de mover el DNS)

Cloudflare → Zero Trust → Access → Applications:

1. **Add an application → Self-hosted**: nombre `bnbtico pruebas`, dominio `pruebas.bnbtico.com`, sesión 1 mes, política **Allow** con los correos de quienes prueban (los mismos que en `bnbtico nueva`), One-time PIN.
2. Bypass (**Everyone**), como en `nueva`: `pruebas.bnbtico.com/casa/*` (ficha y vista previa de WhatsApp) y `pruebas.bnbtico.com/_purge/*` (lo llama Postgres con `pg_net`; el endpoint exige su secreto). Opcional: `/sw.js` y `/manifest.webmanifest`.
3. Así no hay un minuto en que `pruebas.bnbtico.com` sirva la app nueva sin protección. Mientras el DNS apunta a Vercel (DNS only), Access no interviene.
- **Volver atrás:** borrar la aplicación.

## 3. `pruebas.bnbtico.com` → worker `bnbtico-pruebas`

Un dominio personalizado de Workers no se crea si ya existe un registro DNS con ese nombre: hay unos minutos sin servicio en `pruebas` (aceptable: es el entorno de pruebas).

1. En `apps/app/wrangler.jsonc`, entorno `pruebas`: `"routes": [{ "pattern": "nueva.bnbtico.com", "custom_domain": true }, { "pattern": "pruebas.bnbtico.com", "custom_domain": true }]` (los dos a la vez durante la transición), y en sus `vars` `"PUBLIC_ORIGIN": "https://pruebas.bnbtico.com"` (base del enlace de los avisos por WhatsApp; fase 5). Commit en `develop` sin empujar todavía.
2. Cloudflare → DNS: borrar el CNAME `pruebas` → `cname.vercel-dns.com`.
3. `git push origin develop`. El despliegue crea el dominio personalizado (registro y certificado) para `pruebas.bnbtico.com`.
4. Comprobar desde el teléfono: `https://pruebas.bnbtico.com/` pide el PIN de Access y abre Explorar; `/casa/CT-1015` sin PIN; `curl -I https://pruebas.bnbtico.com/` → 200 tras Access (o 302 a Access sin sesión); `/?pronto=1` muestra la portada; `robots.txt` → `Disallow: /`.
- **Volver atrás:** quitar `pruebas.bnbtico.com` de las rutas y desplegar (o Workers → `bnbtico-pruebas` → Settings → Domains & Routes → quitar el dominio), recrear el CNAME `pruebas` → `cname.vercel-dns.com` en **DNS only**, quitar el Ignored Build Step de Vercel si hace falta redeploy. Vercel conserva el dominio en su proyecto mientras no se borre (paso 11).

## 4. Supabase `bnbtico-pruebas` y Turnstile con el dominio nuevo

1. Vault (SQL Editor): `select vault.update_secret((select id from vault.secrets where name = 'worker_purge_url'), 'https://pruebas.bnbtico.com');`
   Comprobar: aprobar o cambiar la disponibilidad de una casa activa y ver en `net._http_response` un 200 del worker. **Volver atrás:** el mismo `update_secret` con `https://nueva.bnbtico.com`.
2. Authentication → URL Configuration → Site URL `https://pruebas.bnbtico.com` (ya lo era para la app vieja; comprobar).
3. Turnstile → el widget `bnbtico` → Hostnames: añadir `pruebas.bnbtico.com` (y `bnbtico.com` para el lanzamiento). Sin esto, Ingresar falla en `pruebas` con `captcha_failed`.

## 5. `bnbtico.com` → worker `bnbtico-production` (solo portada)

El worker de producción se despliega al empujar a `main` (paso 9). Orden recomendado: primero el paso 9 hasta tener `bnbtico-production` desplegado sin rutas, después este paso.

1. En `wrangler.jsonc` (en `apps/app`, o en `apps/web` si ya se hizo el paso 7), entorno `production`: `"routes": [{ "pattern": "bnbtico.com", "custom_domain": true }]` (y `www.bnbtico.com` si se decide servirlo con el worker; ver decisiones). Commit en `develop`.
2. Cloudflare → DNS: borrar el A `@` → `76.76.21.21` (y el CNAME `www` si va al worker). **No tocar MX ni TXT** (correo, Search Console).
3. Merge a `main` y push: el despliegue crea el dominio personalizado.
4. Comprobar: `curl -I https://bnbtico.com/` → 200 `text/html`; la portada en el teléfono; `https://bnbtico.com/explorar` y `/casa/CT-1015` → 404 con la portada; `robots.txt` → `Allow: /` con el sitemap; `sitemap.xml` con solo `https://bnbtico.com/`; el depurador de compartir de Facebook o WhatsApp muestra `og.jpg`; Search Console sigue verificado (si la verificación era por TXT, no cambia nada).
- **Volver atrás:** quitar la ruta y desplegar (o quitar el dominio en el panel del worker), recrear A `@` → `76.76.21.21` en **DNS only**. Vercel sigue teniendo el dominio y el despliegue de la portada vieja hasta el paso 11.

## 6. Retirar `nueva.bnbtico.com`

Cuando `pruebas.bnbtico.com` lleve al menos un día funcionando:

1. `wrangler.jsonc` entorno `pruebas`: dejar solo `pruebas.bnbtico.com` en `routes`. Push a `develop`. Al quitar el dominio personalizado, Cloudflare borra su registro.
2. Zero Trust → Access → borrar la aplicación `bnbtico nueva` (y sus bypass).
3. Si quedan instalaciones de la PWA de `nueva` en teléfonos de prueba, desinstalarlas (otro origen: no migran solas).
- **Volver atrás:** volver a añadir la ruta y desplegar; recrear la aplicación de Access.

## 7. Borrar la app vieja y renombrar `apps/app` → `apps/web`

Un solo commit en `develop`, con todo en verde antes de confirmar. Vercel ya no construye (paso 1).

1. `git rm -r apps/web && git mv apps/app apps/web`.
2. `apps/web/package.json`: `"name": "web"`; script `db:types` → `... > apps/web/src/domain/database.types.ts`.
3. `package.json` raíz: `dev`, `build`, `typecheck`, `test`, `test:e2e` siguen con `--filter web` (ahora la app nueva); añadir `test:db`, `size`, `lighthouse` con `--filter web`; quitar `start` y `lint` (eran de Next) y todos los `*:app`.
4. `pnpm install` para regenerar `pnpm-lock.yaml` (el importador `apps/app` pasa a `apps/web`; desaparecen las dependencias de Next).
5. `.claude/launch.json`: una sola configuración `web` con `pnpm --filter web dev --port 5173 --strictPort --host 127.0.0.1`.
6. `.github/workflows/app.yml`: `working-directory: apps/web`, `workingDirectory: apps/web` en las dos `wrangler-action`, `apps/web/lighthouse-results/` en el artefacto y en `hashFiles`, el mensaje `pnpm --filter web db:types`. Renombrar el archivo a `web.yml` es opcional (cambia el nombre del check en GitHub; actualizar la protección de rama si la hay).
7. `.gitignore`: quitar la línea `apps/web/AGENTS.md` y su comentario (lo generaba Next); `.next/` puede irse también.
8. Sin cambios por la ruta: `playwright.config.ts`, `playwright.lighthouse.config.ts`, `vitest.config.ts`, `.size-limit.json`, `tsconfig*.json`, `scripts/dev-vars.mjs` y las pruebas usan rutas relativas al paquete (las de `design/pantallas/fotos/` conservan la profundidad).
9. Documentos: `CLAUDE.md` (quitar las notas de Next/Vercel/`PREVIEW_PASSWORD`/proveedor demo/`.note[role="alert"]`/`apps/web/AGENTS.md`; `apps/app` → `apps/web`; `.claude/launch.json` y Playwright de la app nueva), `README.md` (estructura y desarrollo con Vite), `docs/plan-implementacion.md` (fase R hecha), `docs/configuracion-supabase.md` (quitar la sección de Vercel), `docs/pruebas-manuales-fase-2.md` (marcar como histórico o cambiar las URL a `pruebas.bnbtico.com` de la app nueva), `docs/architecture.md`, `.env.example` (variables de Next → `.dev.vars`/`VITE_*`). `git grep -n "apps/app\|PREVIEW_PASSWORD\|proxy.ts\|Vercel"` fuera de `docs/historico/` y `.scratch/` debe quedar vacío o solo con menciones históricas.
10. Comprobar: `pnpm typecheck && pnpm test && pnpm test:db && pnpm dev:vars && pnpm build && pnpm size && pnpm test:e2e && pnpm lighthouse` desde `apps/web`, y `pnpm test:prototype` desde la raíz.
- **Volver atrás:** `git revert` del commit (la app vieja vuelve al árbol; Vercel puede volver a construir quitando el Ignored Build Step).

## 8. Fotos solo por RPC (migración pendiente del ticket 08)

Cuando la app vieja ya no sirve a nadie (tras el paso 3):

1. Desde la raíz: `pnpm exec supabase migration new corte_fotos_solo_rpc < /dev/null`, copiar encima `supabase/migrations-pendientes/corte_fotos_solo_rpc.sql`, borrar la carpeta `supabase/migrations-pendientes/`.
2. `pnpm exec supabase migration up --local` y `pnpm --filter web db:types` (no deberían cambiar los tipos).
3. Ajustar `tests/db/cliente-directo-fotos.test.ts`:
   - «máximo 15 fotos, también con un insert directo»: el insert directo ahora falla por privilegios (`permission denied for table listing_photos`, código `42501`); el tope de 15 por RPC no cambia.
   - «solo nombres conocidos…»: `<casa>/<uuid>.jpg` (foto única de la app vieja) pasa a ser rechazado por Storage; solo `<casa>/<uuid>/{480,800,1600}.jpg`.
   Ensayado el 2026-10-23: con la migración aplicada fallan exactamente esas dos y nada más (base 116/118, `fotos`, `publicar` y `admin` de Playwright en verde).
4. Todo en verde → commit → `pnpm exec supabase db push` contra `bnbtico-pruebas`.
- **Volver atrás:** migración nueva con `grant insert, update, delete on listing_photos to authenticated;`, la política `photos_owner_write` (`for all using (listing_editable(listing_id)) with check (listing_editable(listing_id))`) en lugar de `photos_owner_read`, y la política de Storage con `(/(480|800|1600))?`.

## 9. Merge a `main`

1. Antes del primer push a `main` con la app nueva: el workflow de `main` despliega `bnbtico-production` con los secretos del repositorio, que hoy son los de `bnbtico-pruebas` (incluida la service role). La portada no los usa. Recomendado: crear GitHub Environments `pruebas` y `production` y mover los secretos a `pruebas`, de modo que `production` despliegue sin secretos hasta el lanzamiento (decisión de Daniel; si no, se acepta que el worker de producción guarde la clave de pruebas sin usarla).
2. `git checkout main && git merge --no-ff develop && git push origin main`. CI corre todas las puertas y despliega el entorno `production` (sin rutas la primera vez; con la ruta tras el paso 5).
3. A partir de aquí, los cambios de la portada se hacen en `develop` y se llevan a `main` (ya no hay rama solo para la portada).
- **Volver atrás:** `git revert -m 1 <merge>` en `main` y push; si ya se hizo el paso 5, además su vuelta atrás.

## 10. Registro y cierre

- `docs/decisiones.md`: entrada del corte con la fecha, los números medidos el mismo día (Lighthouse de la ficha y del shell en CI, tamaño gz, primera semana de `web_vitals` si la hay) y lo que se dejó para el lanzamiento.
- Ticket 13: marcar lo hecho; `Status: done`.

## 11. Una semana después: borrar el proyecto de Vercel

1. Comprobar que no hay tráfico en Vercel (Analytics/Logs) y que nada apunta a `76.76.21.21` ni a `cname.vercel-dns.com` en la zona.
2. Vercel → proyecto `bnbtico` → Settings → Domains: quitar `bnbtico.com`, `www.bnbtico.com` y `pruebas.bnbtico.com`; después Settings → **Delete Project**. Las variables (`PREVIEW_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_*`) se van con él.
3. `git grep -n "PREVIEW_PASSWORD\|proxy"` fuera de `docs/historico/` vacío.
- **No tiene vuelta atrás** (hay que recrear el proyecto y conectarlo al repo). Por eso se espera una semana.

## El día del lanzamiento (no es el corte)

Producción con la app entera: proyecto Supabase de producción (`docs/configuracion-supabase.md` §7), `SUPABASE_URL` en `vars` del entorno `production`, secretos del Environment `production`, `LAUNCHED: "true"`, `assets.run_worker_first` en `production` igual a la lista del nivel superior (si no, cada fichero estático gasta una invocación), Vault `worker_purge_url` = `https://bnbtico.com` en el proyecto de producción, Access **no** (es público), y la lista completa de `docs/antes-de-produccion.md`.

## Decisiones para Daniel

1. **Google Analytics en la portada.** La portada vieja carga gtag (`G-PZ17LLFS6S`) en producción; la nueva no lo lleva: rompería la CSP estricta (script de `googletagmanager.com` y un script en línea). Opciones: (a) sin GA hasta el lanzamiento (la portada no tiene interacción; Search Console sigue dando búsquedas e impresiones); (b) GA solo en la portada: script propio `/portada/ga.js` con la inicialización, y en la CSP de la portada `script-src 'self' https://www.googletagmanager.com` y `connect-src https://*.google-analytics.com https://*.analytics.google.com`, sin tocar la zona privada. Recomendación: (a) hasta el lanzamiento y decidir entonces junto con el aviso de cookies.
2. **`www.bnbtico.com`:** si existe el registro, ¿redirección 301 a `bnbtico.com` (Cloudflare → Rules → Redirect Rules, con el registro `www` en modo proxy) o servirlo con el worker? Recomendación: redirección.
3. **Secretos por entorno en GitHub** (paso 9.1).
