# 06: Close phase 4 (full journey, manual test plan, documents)

**What to build:** the end-to-end Playwright journey, the manual test plan and the documents up to date. Same shape as `.scratch/fase-3/issues/08-cierre-de-la-fase-3.md`.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] `tests/e2e/fase4.spec.ts`, each actor in its own Pixel 7 context: owner submits → «Marcar las noches ocupadas» → marks 3 nights and a ★ price while in review → admin (aal2) approves → anonymous client opens the ficha and sees them → owner frees one night and changes the ★ → the client's fresh load shows it (purge) → owner closes with a reopening date → client sees «No disponible… Vuelve a estar disponible el …» and «Calendario cerrado» → `reopen_due_listings` → open again with the calendar intact. Independent of other specs.
- [ ] Three full e2e runs in a row green (no order dependence), `lighthouse` green; numbers in the closing notes.
- [ ] `docs/pruebas-manuales-fase-4.md` in the format of `docs/pruebas-manuales-fase-3.md` (A: Daniel's actions in order — migration with `pg_cron`, Vault secrets check, deploy; B: journeys from iPhone and Android, including the midnight reopening checked the next morning; C: what to report).
- [ ] `docs/plan-implementacion.md` (Estado: fase 4 construida, pendientes), `docs/antes-de-produccion.md` (pg_cron in production and alert, Vault purge secrets for bnbtico.com, 12-month window review), `docs/decisiones.md` (closing entry), `docs/design.md` if it still describes seasons as current.
- [ ] Sizes table and Lighthouse in the closing notes.
