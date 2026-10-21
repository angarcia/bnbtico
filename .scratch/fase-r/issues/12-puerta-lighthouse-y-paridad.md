# 12: Lighthouse gate and parity run

**What to build:** the pipeline refuses performance regressions, and the new app is shown to match the old one on every flow before the DNS moves: the full ported Playwright suite is green in CI, Lighthouse CI gates the listing page and the installed shell, the manual plan is executed from a phone against `nueva.bnbtico.com`, and a WhatsApp preview is checked.

**Blocked by:** 07 (Publish wizard), 08 (Photos), 09 (Admin with MFA), 10 (Service worker), 11 (Hardening and telemetry).

**Status:** ready-for-agent

**Manual step (Daniel):** run `docs/pruebas-manuales-fase-2.md` from your phone against `nueva.bnbtico.com` and share one listing link to yourself on WhatsApp; report what fails.

- [ ] Lighthouse CI in the pipeline with the mobile profile, 4x CPU slowdown and 150 ms RTT; gates LCP under 2.0 s on a listing page and under 2.5 s on the installed shell; results posted on the pull request.
- [ ] Full Playwright suite (account, wizard with photos, admin, public listing, Explorar and filters, owner detail) green in CI against local Supabase, one worker.
- [ ] The 20 database tests plus the new ones green; the contract suite green on both adapters.
- [ ] Findings from the manual plan fixed or ticketed; the WhatsApp preview shows cover and title.
- [ ] Measured values recorded: bundle size, Lighthouse numbers, DevTools-throttled timings for the six budgets.
