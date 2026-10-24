# 01: Calendar rules in the domain (Vitest port of the prototype)

**What to build:** `src/domain/calendar.ts`, pure and framework-free, with the v1 rules of `tests/prototype/calendar.cjs` ported to Vitest. No database, no screens. See `.scratch/fase-4/spec.md` § Domain.

**Blocked by:** none (phase 3 done).

**Status:** ready-for-agent

- [ ] Unit tests first (`tests/unit/calendar.test.ts`), one `describe` per prototype rule group listed in the spec (§ Domain, last bullet), each naming the `calendar.cjs` assertion it ports. Seasons/weekend/«Configurar tarifas» rules are not ported (out of v1); say so in a comment at the top.
- [ ] Types `CalendarDay`, `DayState`, `CalendarChange`; `effectiveDay`, `monthGrid` (Monday-first, blanks, `past`), `calendarWindow` (today CR … +365), `compactPrice` («95k», «180k», «1,2M»).
- [ ] Selection reducer (`selectDay`, `clearSelection`, `setAvailability`, `setPrice`) with prefill, «Varios precios» on mixed prices, editing intent, last deselection clears the draft; `changeFromSelection()` → `null` when nothing chosen.
- [ ] `applyChange` (occupy/free keep price; price = base ⇒ no ★ and no stored row; only differences stored) and `validateChange` / `validateReopenDate` with `CALENDAR_MESSAGES` (exact strings of the spec, to be reused by the RPCs and the fake).
- [ ] `selectionLabel` (contiguous, cross-month, non-contiguous, singular) and `occupiedNightsIn(days, month)`.
- [ ] `tests/unit/architecture.test.ts` still green (no framework imports). `node tests/prototype/calendar.cjs` still passes (file untouched).
- [ ] Green: `typecheck`, `test`, `build`, `size` (no UI: size must not move).
