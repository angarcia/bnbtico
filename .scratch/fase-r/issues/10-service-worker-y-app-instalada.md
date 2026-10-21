# 10: Service worker and installed app

**What to build:** a client installs bnbtico on the home screen, opens it and sees Explorar in under half a second from cache, browses screens already visited with no signal, sees a "Sin conexión" state if they try to write, and gets a "Hay una versión nueva · Actualizar" prompt when a new build is deployed, never in the middle of the wizard.

**Blocked by:** 04 (Explorar and Filtros rendered in the browser), 05 (Account and session in the browser).

**Status:** ready-for-agent

- [ ] Service worker with precache of the shell, hashed assets, fonts and icons; runtime caching: Storage photos cache-first (30 days, 400 entries, purge on quota error), OSM tiles stale-while-revalidate, listing HTML network-first with a 3 s timeout; PostgREST and Auth responses never cached.
- [ ] Navigation fallback to the shell for private routes only; public routes stay network-first.
- [ ] Update flow: new version waits, prompt shown, no reload while a wizard route is active, update check on visibility change.
- [ ] Manifest `start_url` is `/explorar`; icons and maskable icons from the design kit; standalone display; no server redirect on open.
- [ ] Query persistence busted on build hash; signed-out clears persisted private data.
- [ ] "Sin conexión" state on mutations without network; no write queue.
- [ ] Playwright: second open serves the shell from the service worker with the network blocked; a visited Explorar renders offline; a write offline shows the state.
- [ ] Measured under DevTools "Slow 4G" and 4x CPU: installed open to interactive Explorar recorded in the closing comment.
