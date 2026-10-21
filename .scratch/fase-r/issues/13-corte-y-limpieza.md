# 13: Cutover and cleanup

**What to build:** `pruebas.bnbtico.com` and `bnbtico.com` are served by the new app on Cloudflare, the landing page keeps working as static HTML, the old Next app and its Vercel project are gone, the new package carries the name `apps/web`, and every document and local tool points at the new app.

**Blocked by:** 12 (Lighthouse gate and parity run).

**Status:** ready-for-agent

**Manual steps (Daniel):** approve the DNS switch (records can be changed through the API once the zone is on Cloudflare), retire the Vercel project after a week, create the Access application for `pruebas.bnbtico.com`.

- [ ] Landing page ported as a static asset with its SEO tags, JSON-LD, OG image and the `?pronto=1` behavior; `HEAD /` returns 200; production worker routes `bnbtico.com` to the landing only until launch.
- [ ] `pruebas.bnbtico.com` routed to the `pruebas` environment behind Access; `nueva.bnbtico.com` removed after the switch.
- [ ] Old `apps/web` deleted; `apps/app` renamed to `apps/web`; root scripts, `.claude/launch.json` and the Playwright configuration updated; the Next-specific notes removed from `CLAUDE.md`.
- [ ] Documents updated: `docs/plan-implementacion.md` (fase R done, estado), `docs/decisiones.md` (cutover entry with measured numbers), `docs/configuracion-supabase.md` (Cloudflare and GitHub secrets instead of Vercel), `docs/pruebas-manuales-fase-2.md` (URLs).
- [ ] Vercel project removed; no reference to `PREVIEW_PASSWORD` or the proxy remains.
- [ ] Final commit on `develop` and merge to `main` for the landing.
