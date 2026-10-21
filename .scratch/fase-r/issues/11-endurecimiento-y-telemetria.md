# 11: Hardening and telemetry

**What to build:** the app ships with the security conditions accepted on 2026-10-21 and tells the operator how it performs for real users: a strict Content Security Policy, no raw HTML anywhere, bot protection on the code form, Web Vitals and client errors and first-party events stored per page and country, a daily database backup outside Supabase, and a daily keep-alive that keeps the free project awake.

**Blocked by:** 03 (Public listing page from a WhatsApp link), 05 (Account and session in the browser).

**Status:** ready-for-agent

**Manual steps (Daniel), before this ticket:** create a Turnstile widget in Cloudflare and enable bot protection in Supabase Auth with its secret; create an R2 bucket credential and add it plus the hosted database connection string as GitHub secrets; set a Twilio spend alert.

- [ ] CSP sent by the worker and present in the shell: scripts self only, no inline scripts; connections to self, the Supabase project and OSM tiles; images from self, data URLs, Storage and tiles; inline styles reviewed with the aim of no `unsafe-inline` for styles. The app works with the policy enforced.
- [ ] Lint rule fails the build on `dangerouslySetInnerHTML`.
- [ ] Turnstile widget on OTP start; local tests use the test keys.
- [ ] `web-vitals` beacon (LCP, INP, CLS) to the worker; error beacon for uncaught errors and unhandled rejections with route and build hash; first-party events (page view, listing view, WhatsApp tap placeholder); the worker validates size and shape and writes with the service role.
- [ ] Migration: `web_vitals`, `client_errors`, `events` tables with no access for anon or authenticated; database test confirms.
- [ ] Worker seam tests for the three beacons (accept, reject malformed, reject oversize).
- [ ] Daily cron trigger: keep-alive request to PostgREST; structured log line.
- [ ] Backup workflow: daily `pg_dump` of the hosted database to R2 with 30-day retention; a documented monthly restore test; first run verified.
- [ ] Hosted project `db-max-rows` set to 200 (recorded how).
- [ ] One SQL query documented that returns p75 LCP per page type for country CR.
