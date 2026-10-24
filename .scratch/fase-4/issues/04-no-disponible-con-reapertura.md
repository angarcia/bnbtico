# 04: «No disponible» with reopening date and the house detail (design 19)

**What to build:** closing a house to consultations with an optional reopening date from the detail switch, the closed labels, and the «Calendario y precios» row with the occupied nights of the month. See spec § «No disponible» with reopening date.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Switch off → bottom sheet «Cerrar a consultas» (dialog semantics as the contact sheet: focus trap, Escape, backdrop) with optional date (min tomorrow, max +365, `validateReopenDate`), «Cerrar a consultas» / «Cancelar». Switch on → one tap, optimistic, clears the date. DB message on refusal.
- [ ] Row label «Cerrada hasta el <fecha>» / «Cerrada a consultas»; Mis casas pill unchanged; the public contact button already shows the date (check it with a real closed-with-date house).
- [ ] Detail row «Calendario y precios» → «<Mes>: N noches ocupadas» / «Sin noches ocupadas este mes», from the calendar query; links to the calendar with `casa=`.
- [ ] Size: sheet inside the `propietario` chunk; tab-screens limit raised to 21 KB only if needed, justified.
- [ ] Playwright: close with date → «Cerrada hasta el …» → ficha button «No disponible… Vuelve a estar disponible el …» → `select reopen_due_listings('<date>')` via SQL → detail and ficha open again, prices and occupied nights intact; close without date stays closed after `reopen_due_listings(+40 days)`; reopen by hand clears the date; a house put back to edit (draft) with a due date is reopened to consultations but stays hidden.
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`, `lighthouse`.
