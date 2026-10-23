# 02: Contact sheet on the listing (dates, people, self-drafting message)

**What to build:** first make room in the private bundle; then turn the disabled button into the real «Contactar por WhatsApp» after hydration, opening the lazy contact sheet per design 04 with Llegada/Salida/Personas and the message that redrafts itself until edited. In this ticket «Abrir WhatsApp» validates and saves the draft; the account gate is 03 and sending is 04 (until then, with a valid draft, it shows «Disponible muy pronto» in the sheet — never a dead button on a deploy that Daniel tests: tickets 02–04 can be deployed together). Spec § Bundle budget, § Listing page, § Copy.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Room first: statically imported screens in `shell.tsx` (owner screens, Favoritos placeholder, Ayuda…) move behind `lazyRouteComponent` with prefetch on touchstart/hover of the tab and on idle; visited tab still < 100 ms without network (`medicion` test), tap feedback < 50 ms. Private initial JS measured before/after in the closure; target ≤ 140 KB gz. New `size-limit` entry for the sheet chunk.
- [ ] Button in `.cta-bar`: same box before and after hydration; enabled «Contactar por WhatsApp» when `available`, disabled «No disponible para consultas» (+ «Vuelve a estar disponible el …» with `reopen_at`) otherwise. No hydration warnings (existing test stays green, extended to cover the button). SSR hydration chunk grows ≤ 3 KB gz.
- [ ] Sheet (`role="dialog"`, focus trap, Escape/backdrop/«Cerrar», focus return, scroll lock, 28 px radius, dimmed page), header «Escríbale a <owner_name>», «Propietario de <casa> · WhatsApp verificado», date inputs and people, «Su mensaje» textarea with the redraft rule, hint «Se redacta solo con sus fechas y personas. Puede editarlo aquí o en WhatsApp antes de enviar.», button «Abrir WhatsApp» (WhatsApp green, 18 px radius), consent line «<Nombre> verá su nombre y su WhatsApp.», ochre safety note. Textarea not hidden by the keyboard (iPhone rule of the wizard).
- [ ] Validation with domain messages in `.note[role="alert"]`; draft kept in sessionStorage per listing (30 min) so closing and reopening the sheet, or reloading, keeps it.
- [ ] Works the same on the SSR page (no router) and on the SPA route `/casa/$publicId`; the sheet chunk is prefetched on idle after hydration; `whatsapp_tap` beacon on tap.
- [ ] CSP: no inline styles/scripts; Playwright fails on violations as today.
- [ ] Playwright (Pixel 7): open sheet on SSR listing, message updates with dates and people, edit by hand stays after changing dates, invalid dates show the error, unavailable house shows the disabled button, screenshot reviewed. Gates green incl. `lighthouse`.
