# 08: Phase 3 closing: end-to-end, manual plan and docs

**What to build:** one Playwright journey publish → approve → contact → Mis consultas → reply; the manual test plan for Daniel's phone; documents up to date.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] `tests/e2e/fase3.spec.ts`: owner publishes, admin (aal2) approves, client saves it as favorite, contacts without account (creates it), WhatsApp URL correct, owner sees «Nueva» and opens WhatsApp with the client; three full runs in a row green.
- [ ] `docs/pruebas-manuales-fase-3.md`: previous actions for Daniel (migration `fase3_consultas` on `bnbtico-pruebas`), journeys from the phone with checkboxes (real WhatsApp opening on iPhone and Android, installed PWA, returning from WhatsApp to the app, foreign numbers), what to report.
- [ ] `docs/plan-implementacion.md` (Estado), `docs/decisiones.md` (one entry per decision taken in the phase), `docs/antes-de-produccion.md` (limits, privacy text, inquiry retention), `CLAUDE.md` only if a rule changed (ask Daniel first).
- [ ] Final numbers in the closure: all batteries, private size, chunk sizes, Lighthouse listing and shell.
