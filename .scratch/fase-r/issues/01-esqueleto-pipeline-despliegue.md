# 01: Skeleton, pipeline and first deploy to nueva.bnbtico.com

**What to build:** a new package beside the old app that builds a Vite SPA shell and a Hono worker from one source tree, proves the SSR glue end to end on a fixture page (server render in the worker, hydration in the browser, no hydration warning), and deploys itself to `nueva.bnbtico.com` behind Cloudflare Access on every push to `develop`, with tests and the bundle-size gate running before the deploy. From the user's perspective: push a commit, open the URL on the phone two minutes later, see the shell with the design tokens and a server-rendered fixture listing page.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human (falta el primer push a `develop` y la comprobación de Daniel en `nueva.bnbtico.com`)

**Manual steps (Daniel), before the first deploy:**
- Create one Cloudflare API token (Workers Scripts edit, Account settings read, Zone DNS edit, Cache Purge) and add it with the account id as GitHub repository secrets.
- Confirm where the `bnbtico.com` nameservers point. If not Cloudflare: add the zone, recreate the existing Vercel records as "DNS only", change the nameservers at the registrar.
- Create the Zero Trust team (free) and an Access application for `nueva.bnbtico.com` allowing your email (one-time PIN).
- Add the hosted Supabase service role key as a GitHub secret (the workflow pushes it to the worker; nothing in the browser).

- [x] Package `apps/app` in the pnpm workspace with React 19, TanStack Router and Query, supabase-js, Hono, Vite, Vitest, Playwright, `size-limit`, `wrangler`; strict TypeScript; design tokens and the global stylesheet ported; fonts self-hosted.
- [x] Two build targets from one `vite` config: browser bundle and worker bundle; one dev command runs Vite and the worker in one process.
- [x] Worker: serves the SPA shell for every unknown path (single-page-application asset fallback), `robots.txt`, and a fixture `/casa/CT-0000` rendered with `renderToString` that injects head tags, a hero preload and an embedded JSON script.
- [x] Browser entry: hydrates the fixture route from the embedded JSON and mounts the shell with `createRoot` elsewhere; the shell shows the bottom tab bar and placeholder screens for Explorar, Favoritos, Cuenta.
- [x] Playwright (Pixel 7 viewport) test opens the fixture page and fails on any console hydration warning; a unit test calls the worker in-process and asserts the head tags and the JSON script.
- [x] `size-limit` configured on the private-zone entry with the 150 KB gzipped limit; current size recorded in the ticket's closing comment.
- [x] `wrangler.jsonc` with assets binding, observability, environments `pruebas` (custom domain `nueva.bnbtico.com`) and `production` (not routed yet).
- [x] GitHub Actions workflow: on push to `develop`/`main` and on pull requests: install, typecheck, unit tests, build, size gate, then deploy to the branch's environment (pull requests upload a preview version and post the URL). Worker secrets are set from GitHub secrets inside the workflow.
- [x] Old app untouched; root scripts gain `dev:app`, `test:app`, `build:app` without breaking the existing ones.
- [ ] `nueva.bnbtico.com` answers with the shell behind Access; `/casa/CT-0000` shows the fixture with OG tags visible in the page source.

## Avance (2026-10-22)

- Commits locales `dc6154d` (esqueleto) y `3ffd23d` (pipeline); sin push.
- Unitarias: 10/10 (worker en proceso + dinero). Playwright Pixel 7: 3/3; la prueba de hidratación falla con el error #418 de React si se fuerza un desajuste.
- size-limit, zona privada (`dist/client/assets/*.js`): **101,75 KB gz** de 150 KB.
- `wrangler deploy --dry-run` con `CLOUDFLARE_ENV=pruebas`: worker `bnbtico-pruebas`, dominio `nueva.bnbtico.com`, 536,5 KiB (108,7 KiB gz).
- Zona `bnbtico.com` ya en los nameservers de Cloudflare; `nueva.bnbtico.com` aún sin registro (lo crea el primer deploy).

