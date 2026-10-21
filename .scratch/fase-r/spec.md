# Spec · Fase R · Client-first rewrite of the bnbtico web app

Status: ready-for-agent
Date: 2026-10-21
Decided by: Daniel, after the architecture interview recorded in `docs/decisiones.md` (entry 2026-10-21) and summarised in `docs/plan-implementacion.md` (Stack, Fase R).
Language note: this spec is in English because it is a technical artifact; all UI copy stays in Spanish de Costa Rica, treating the user as **usted** (`docs/diseno-v1.md` rules the visuals and copy).

## Problem Statement

bnbtico is a catalog of houses for rent in Costa Rica. Owners publish a house, an admin reviews it, and clients contact the owner through WhatsApp. The product is a mobile-first web app (PWA) that will later be wrapped for the app stores.

Phases 0–2 were built with Next.js 16 on Vercel, rendering every screen on the server. With fewer than twenty screens and almost no data, the app does not feel fluid: every tap waits for a request to a server in us-east-1, which in turn verifies the session over the network and makes five to ten serial calls to Supabase before the screen appears. The installed PWA opens through a server redirect. Photos load at full size. Tab switches, back navigation and form steps all pay the round trip. For users in Costa Rica on mid-range phones and 4G, this reads as a slow website, not an app. Owners publish from their phones; a nine-step wizard that stalls on every "Continuar" loses them.

The data layer in Postgres (RLS, column grants, the listing state machine in plpgsql, the public view that hides owner data, 20 integration tests) is sound and must be kept.

## Solution

Rebuild the web app as a client-first application:

- A static shell, precached by a service worker, that renders every private screen in the browser from a local data cache (TanStack Query, persisted to IndexedDB) and talks **directly to PostgREST** with the user's JWT. Row-level security and column grants are the authorization layer; plpgsql RPCs own every state transition. Visited screens render with zero network; writes are optimistic.
- A small Hono worker on Cloudflare Workers that does the few things a server must do: render the public listing page `/casa/CT-####` with full HTML and Open Graph tags (the WhatsApp crawler does not run JavaScript, and the first impression must show the photo and price fast), serve the sitemap and robots, receive first-party telemetry beacons, and, in phase 5, receive payment webhooks and run the reminder cron.
- The same Supabase project, with additive migrations only.
- Deployed by GitHub Actions on every push: tests first, then `nueva.bnbtico.com` (develop) and later `bnbtico.com` (main). The current app keeps serving `pruebas.bnbtico.com` on Vercel until the new one reaches parity; then DNS moves, the old app is deleted and the new folder takes its name.

Performance budgets, as p75 targets for real users in Costa Rica: visual response to a tap < 50 ms; a visited screen < 100 ms with no network; a new screen with session < 300 ms to content; public listing cold LCP < 1.5 s; installed PWA open to interactive Explorar < 500 ms; private-zone initial JavaScript < 150 KB gzipped.

## User Stories

### Client (visitor or logged-in client)

1. As a client, I want a WhatsApp link to a house to open a page that already shows the photo, title and price within about a second on 4G, so that the first impression is of a real product.
2. As a client, I want the WhatsApp preview of a shared link to show the house photo and title, so that I know what I am opening before I tap.
3. As a client, I want to browse Explorar without an account, so that I can look at houses before I decide to register.
4. As a client, I want Explorar to open on Limón by default and to list only provinces that have houses, so that I do not filter into empty results.
5. As a client, I want the filters screen to show how many houses match before I apply them, so that I can adjust without going back and forth.
6. As a client, I want filter changes to feel instant and to update the URL, so that I can share or reopen a filtered view.
7. As a client, I want to switch between tabs (Explorar, Favoritos, Cuenta) with no visible delay, so that the app feels native.
8. As a client, I want to go back from a house to the list and find it exactly where I left it, with scroll position intact, so that browsing many houses is comfortable.
9. As a client, I want a house I already opened to reopen instantly, so that comparing houses is cheap.
10. As a client, I want to switch prices between colones and dollars without a page reload, so that I can read prices in my currency; the dollar value is a reference, never a total.
11. As a client, I want cover photos to load lazily and at a size that fits my screen, so that Explorar does not download sixty full-size photos.
12. As a client, I want the map on a house page to show only an approximate area, never the exact address, so that owners keep their privacy.
13. As a client, I want to install the app on my home screen and have it open directly on Explorar in under half a second, so that it behaves like an app.
14. As a client, I want screens I already visited to be readable when I lose signal, so that a tunnel or a dead zone does not blank the app.
15. As a client, I want a clear "Sin conexión" state when I try to write without network, so that I know the action did not happen.
16. As a client, I want to create my account with my name and WhatsApp number and receive a code by WhatsApp, so that I can prove I own the number.
17. As a client, I want the code screen to tell me when I can request another code (30 s cooldown) and to keep my number if I leave and come back within ten minutes, so that a slow WhatsApp does not force me to start over.
18. As a client, I want my session to persist across app restarts until I sign out, so that I do not re-enter a code every day.
19. As a client, I want "Cerrar sesión" to invalidate my session everywhere, so that a lost phone is less of a risk.
20. As a client, I want the "Ingresar" button and later the favorite heart to appear without shifting the layout, so that the page does not jump while it loads.

### Owner

21. As an owner, I want each "Continuar" in the publish wizard to move to the next step immediately and save in the background, so that publishing from my phone takes minutes, not a stall per step.
22. As an owner, I want a save that fails (validation or server) to bring me back to the step with the server's message in Spanish and my data intact, so that I never lose what I typed.
23. As an owner, I want to leave the wizard mid-way and resume the same draft later from any device, so that a phone call does not cost me the work.
24. As an owner, I want to upload several photos at once, see progress per photo and reorder or set the cover, so that photos are not a one-by-one chore.
25. As an owner, I want photos uploaded from my phone to be resized before upload, so that a 4 MB camera photo does not eat my data plan.
26. As an owner, I want the wizard to refuse a submission with fewer than five photos or missing required fields, with the same rules the server applies, so that I am not rejected after waiting.
27. As an owner, I want "Enviar a revisión" to confirm with the "¡Listo! Su casa está en revisión" screen, so that I know what happens next.
28. As an owner, I want Mis casas and the owner home to open instantly from cache and refresh in the background, so that checking my house's status is a glance.
29. As an owner, I want the status of my house (en revisión, cambios pedidos, activa, rechazada) and the admin's note to be visible in Mis casas and in the detail, so that I know what to do.
30. As an owner, I want "Corregir y reenviar" after "cambios pedidos" to reopen the wizard on my draft, so that fixing is cheap.
31. As an owner, I want editing an active house to warn me that it will be hidden during review before it happens, so that I am not surprised.
32. As an owner, I want the "Disponible para consultas" switch to respond at once and roll back if the server refuses, so that the control feels reliable.
33. As an owner, I want to share my public link from the detail screen with the native share sheet, so that sending it on WhatsApp is one tap.
34. As an owner, I want my WhatsApp number on the house to be the one from my account, read-only in v1, so that clients reach me.
35. As an owner, I want the keyboard on iPhone not to cover the field I am typing in, so that I can fill the wizard without fighting the screen.
36. As an owner, I want to see how many launch-offer slots remain, so that I know whether my house is in the free tier.

### Admin

37. As an admin, I want to sign in with my WhatsApp like anyone else and then confirm a second code before I can review, so that a stolen session cannot approve houses.
38. As an admin, I want the review queue (por revisar, cambios pedidos, rechazados) to load instantly and refresh on focus, so that reviewing on my phone is quick.
39. As an admin, I want to approve, request changes or reject with a reason, and see the house disappear from the queue at once, so that the queue reflects my work.
40. As an admin, I want approval to publish the house and make its public link live within seconds, so that the owner can share it right away.
41. As an admin, I want the public page cache of a house to be purged when its status changes, so that a blocked or edited house never shows stale content.

### bnbtico (operator)

42. As the operator, I want every push to `develop` to run all tests and deploy to a preview host automatically, so that I can check the app in my browser minutes after a change, as with Vercel.
43. As the operator, I want a bad deploy to be reversible in seconds, so that a mistake is not an outage.
44. As the operator, I want a daily database backup stored outside Supabase, so that the free plan's lack of backups is not a data-loss risk.
45. As the operator, I want real-user Web Vitals per page and country, so that the performance budgets are measured where users are, not where I am.
46. As the operator, I want client-side errors reported to a table with route and build hash, so that I learn about broken screens without a third-party SDK.
47. As the operator, I want first-party page-view and WhatsApp-tap events, so that I have usage numbers without a cookie banner.
48. As the operator, I want the staging host protected without a password in the application code, so that security does not depend on a branch of the worker.
49. As the operator, I want measurable triggers that tell me when to pay for Workers or Supabase Pro, so that I spend only when a limit is near.
50. As the operator, I want the OTP form protected against scripted abuse, so that nobody burns my Twilio credit from a terminal.
51. As the operator, I want the service role key to exist only in the worker's environment, never in the browser, so that RLS remains the only path for users.
52. As the operator, I want a bundle-size gate, a hydration gate and a Lighthouse gate on every pull request, so that performance regressions fail before deploy.
53. As the operator, I want the old app to keep serving `pruebas.bnbtico.com` untouched until the new one passes parity, so that nothing visible breaks during the rewrite.

## Implementation Decisions

### Application shape

- One package replaces the Next app: a Vite-built React 19 single-page application plus a Hono worker, built from the same source tree with two build targets (browser bundle and worker bundle). The package is created as `apps/app` and renamed to `apps/web` at cutover. No `packages/*`, no Turborepo.
- Routing with TanStack Router: typed paths and typed search parameters (zod schemas) for Explorar's filters. A pathless layout wraps every private route and redirects to the account flow when there is no session, preserving the intended destination.
- Data with TanStack Query: one query function per screen that returns a screen-shaped object; persisted to IndexedDB with a build-hash buster; `staleTime` per key (public listings 60 s, listing detail 5 min, provinces 10 min, owner listings 30 s, admin queue 0); refetch on window focus, reconnect and app resume; detail queries seeded from list rows so a tap renders before the network answers. No Realtime in v1.
- Mutations are optimistic with rollback and the DB's Spanish error message surfaced; saves use `keepalive` so a backgrounded app does not lose a step.
- Currency, role and OTP pending state are client state (localStorage / sessionStorage); the signed cookies, role cookie and currency cookie disappear.

### Server surface (the worker)

- Exactly one server-rendered route: the public listing page. The worker reads the public view with the anon key, renders the page component with React's `renderToString`, and injects Open Graph and Twitter tags, canonical, a preload for the hero image and the listing JSON in a non-executed JSON script tag. Responses carry a long CDN cache lifetime with stale-while-revalidate and a cache tag per listing; the admin review action and the owner's edit/availability actions trigger a purge by tag. Not-found and blocked states keep their HTTP status codes.
- Hydration rules: only the listing route hydrates; the map (Leaflet) and every session-dependent element (currency toggle, "Ingresar", later the favorite heart) mount after hydration inside fixed-size boxes; a CI test fails on any hydration warning.
- Landing page is a static HTML asset. Anonymous Explorar is client-rendered. Sitemap is one PostgREST query cached for one hour. Robots unchanged in intent (index only production).
- Beacons: `POST /vitals`, `POST /errors`, `POST /events` write to three operator tables with the service role; those tables deny all access to anon and authenticated roles.
- A daily cron trigger in the worker: today a keep-alive request to PostgREST; in phase 5 the reminder outbox sender.
- Every other path returns the SPA shell (asset binding with single-page-application fallback).

### Session and security

- supabase-js in the browser holds the session (localStorage) behind a storage adapter, so Capacitor can swap in the Keychain/Keystore later. OTP start and verify run client-side with the WhatsApp channel; the 30 s cooldown and the existing error-to-Spanish mapping are kept; pending OTP state lives in sessionStorage for ten minutes.
- Content Security Policy from the worker and in the shell: scripts only from self, no inline scripts, no third-party scripts in the private zone; connections only to self, the Supabase project and the OSM tile server; images from self, data URLs, Supabase Storage and OSM tiles. Inline styles are reviewed with the aim of dropping `unsafe-inline` for styles.
- A lint rule forbids `dangerouslySetInnerHTML`. No HTML is ever rendered from user text.
- Supabase defaults kept: one-hour access token, refresh rotation with reuse detection, logout revokes the session.
- Admin step-up is enforced in SQL: admins enrol a phone MFA factor; admin RLS policies and the review RPC require the JWT's `aal` claim to be `aal2`. The client requires `aal2` before showing admin routes (UX only).
- Turnstile protects OTP start (Supabase Auth CAPTCHA setting plus the widget). Hosted project `db-max-rows` set to 200.
- The service role key exists only in the worker environment (secrets) and in local test setup.

### Domain module and data access

- A framework-free domain module holds: generated database types (committed, with a CI diff check against `supabase gen types`), zod schemas and the per-step validation rules ported from the current schema module (same semantics, same tests), typed row mapping (one place; fixes the inconsistent `acceptsNightly` handling), a pure `describe(listing)` that yields main price, unit, situation copy, share URL and preview text (replacing six copies), and a pure `can(listing, action)` for edit / discard / submit / reopen that mirrors the SQL rules.
- `ListingsApi` interface: `searchPublic`, `getPublic`, `linkState`, `listOwn`, `getOwn`, `createDraft`, `saveStep`, `submit`, `reopenForEdit`, `setAvailable`, `deleteDraft`, `photos.upload/add/remove/reorder`, `admin.queue/get/review`. `AuthApi` interface: `start`, `verify`, `resend`, `cancel`, `session`, `profile`, `updateProfile`, `logout`, `enrolMfa`, `verifyMfa`.
- Two adapters per interface: PostgREST (the only module that imports supabase-js and knows column names) and an in-memory fake that enforces ownership and status rules. One contract suite runs against both.
- `saveStep` persists every field that normalisation changes (the current app persists only four of them, leaving a stale nightly price in the public view). The photo count on step 7 comes from the server-side list, never from a client field.
- Errors: the fake and the adapter map PostgREST/GoTrue errors to a domain error with a Spanish message; messages raised by the DB's own RPCs and trigger pass through as they are already in Spanish; anything else gets a generic Spanish message (the current "looks Spanish" regex heuristic is dropped).

### Schema changes (one additive migration, `cliente_directo`)

- RPCs `add_listing_photo(listing, path)` (position computed in SQL), `remove_listing_photo(photo)`, `reorder_listing_photos(listing, ids[])` (one transaction; cover = position 0).
- `listings_public` gains a `photos` JSON array (ordered paths) so the catalog is one query; a `provinces_with_listings` view replaces the client-side distinct.
- Storage insert policy caps objects per listing folder (15 photos × 3 variants); the owner insert policy caps open drafts per owner at five.
- Operator tables `web_vitals`, `client_errors`, `events` with no access for anon/authenticated.
- Admin `aal2` requirement added to admin policies and `review_listing`.
- Phase 5 tables (`payment_events`, outbox columns on `subscription_reminders`) are **not** part of this spec.

### Images

- The browser produces three JPEG variants at upload (480, 800, 1600 px long side, quality 0.8), uploaded in parallel with concurrency 3 directly to Storage with the user's JWT, then registered through the add-photo RPC. Paths are `<listing>/<uuid>/<size>.jpg` with a one-year cache header. Cards use `srcset` 480/800 with `loading="lazy"` and explicit dimensions; the hero uses 800 with high fetch priority; the OG image is the 800 variant. WebP is out of scope.

### Service worker and PWA

- Precache: shell, hashed JS/CSS, self-hosted fonts, icons, manifest. Runtime: Storage photos cache-first (30 days, 400 entries, purge on quota error); OSM tiles stale-while-revalidate; `/casa/*` HTML network-first with a 3 s timeout; PostgREST and Auth never cached. Navigation fallback to the shell for private routes only; public routes stay network-first so crawlers and freshness are honest.
- Update flow: new version waits; the app shows "Hay una versión nueva · Actualizar"; never auto-reloads inside the wizard; checks for updates on visibility change. Manifest `start_url` is `/explorar`.
- No offline write queue in v1.

### Hosting, deploy, telemetry

- Cloudflare Workers with static assets, free plan first; `wrangler.jsonc` in the repo with per-environment custom domains (`nueva.bnbtico.com` now; `pruebas.bnbtico.com` and `bnbtico.com` at cutover), observability on, one daily cron trigger. Staging protected by Cloudflare Access, not by application code.
- GitHub Actions: on push to `develop` or `main` and on pull requests: install, typecheck, unit tests, database tests against a local Supabase started in the runner, build, size gate, then `wrangler deploy` for the branch's environment (pull requests upload a preview version). Secrets: Cloudflare API token and account id; worker secrets set once with `wrangler secret put`.
- A second workflow runs a daily `pg_dump` of the hosted database to Cloudflare R2 with 30-day retention; a monthly restore test is documented.
- Upgrade triggers (recorded for the operator): Workers paid on any CPU-limit error, p95 CPU time above 7 ms or more than 50,000 worker requests per day; Supabase Pro at 800 MB storage, 4 GB monthly egress or 400 MB database.
- Google Analytics leaves the private zone; the landing may keep it later with a nonce if a campaign needs it.

### Migration and cutover

- The new package is built beside the old one. The old app receives no fixes. Both point at the `bnbtico-pruebas` Supabase project.
- Build order: (1) skeleton with the listing SSR route, client OTP session and the pipeline, deployed on day one; (2) domain module, generated types, interfaces, adapters, fake, contract suite, migration; (3) Explorar, filters, listing page, image variants; (4) owner zone and wizard with direct uploads; (5) admin with MFA; (6) account, help, favorites placeholder; (7) service worker; (8) CSP, Turnstile, beacons, backup workflow; (9) parity and cutover.
- Parity: the 20 database tests, the ported Playwright suite on a Pixel 7 viewport, the manual plan `docs/pruebas-manuales-fase-2.md` run from Daniel's phone against `nueva.bnbtico.com`, the three CI gates, and a WhatsApp self-share preview. Then: landing ported as a static asset, DNS move for both names, Vercel project removed after a week, old package deleted, new package renamed, documents updated (`CLAUDE.md`, plan, decisions, Supabase configuration guide, manual test plan URLs, launch configuration for the local dev server).
- The demo auth provider, the signed cookies, the proxy, server actions and all `loading.tsx` files are deleted with the old app. Local development always uses a local Supabase (test numbers with code 123456). The pending ES256 item is dropped: no server verifies JWTs.

## Testing Decisions

A good test exercises external behavior through a seam a caller actually uses, with real names from the domain (Listing, Owner, Admin, Publish step, Photo, Session), and never asserts on implementation details (component internals, query-builder chains, CSS classes beyond accessible roles). No mock of supabase-js exists outside the in-memory fake.

Four seams, three of them existing:

1. **`ListingsApi` / `AuthApi` contract suite** (new, primary). The same test files run against the in-memory fake (fast, in unit tests) and against PostgREST on the local Supabase (in the database test project), so the fake cannot drift from RLS. Covers: ownership (an owner cannot read or edit another owner's draft), status rules (no edit outside draft/changes, no status change by update, discard only for never-reviewed drafts with the correct message), `saveStep` persisting every normalised field, server-side photo count, photo limits and ordering, submit validation parity with the RPC, admin review with and without `aal2`, link state for active / never-sent / blocked. Prior art: the current `auth-contract` unit test that runs one suite against the demo and Supabase adapters, and `tests/db/fase2*.test.ts`.
2. **Worker HTTP seam** (new). In-process requests to the Hono app (no network): the listing route returns full HTML with OG tags, preload, embedded JSON and cache headers; 404 for unknown ids; the blocked page for reviewed-then-hidden listings; the sitemap lists only active listings; beacons reject malformed bodies and oversize payloads. PostgREST is replaced by the fake adapter here. Prior art: the current proxy unit tests that call the handler with constructed requests.
3. **Database seam** (existing `tests/db`): the contract suite's PostgREST run plus new cases for the migration: photo RPCs, `photos` in the public view, storage and draft caps, operator tables denied to users, `aal2` enforcement. Prior art: `fase2-permisos.test.ts`.
4. **Browser seam** (existing `tests/e2e`, Pixel 7, one worker): the ported scenarios (account with OTP, nine-step wizard with photos and no scroll, admin review, public listing with metadata and currency, Explorar and filters, owner detail and resend), a test that fails on any hydration warning on the listing page, and the keyboard rules on iOS-like viewports. Session is injected through localStorage instead of cookies. Prior art: `casas.spec.ts`, `cuenta.spec.ts`.

CI gates on every pull request: `size-limit` on the private-zone entry (< 150 KB gzipped); the hydration test; Lighthouse CI on the listing page and the installed shell with the mobile profile, 4x CPU slowdown and 150 ms RTT (LCP < 2.0 s and < 2.5 s respectively, looser than the budgets because the profile is harsher).

Real-user measurement from day one through the `web-vitals` beacon; budgets are evaluated as p75 for Costa Rica after the public opening. Daniel's phone (Vancouver, similar RTT to us-east-1 as Costa Rica) with DevTools "Slow 4G" and 4x CPU is the daily feel check.

Unit tests for pure modules (money, phone, geo, share, cantones, step validation, `describe`, `can`) move with the modules; the prototype tests in `tests/prototype` are untouched.

## Out of Scope

- Any new product screen from phases 3–6 (contact sheet, inquiries, favorites with data, calendar, subscription, "Buscan casa"). Favorites remains a placeholder.
- Design changes: `docs/diseno-v1.md` and `design/pantallas/` rule; the rewrite reproduces them.
- Phase 5 server code (payment webhooks, reminder outbox sender, reopen job). The spec only guarantees the homes exist (worker HTTP routes and cron trigger, `pg_cron`).
- WebP variants, server-side image processing, Supabase image transformations.
- Offline writes, Realtime subscriptions, push notifications.
- Province landing pages for Google and any additional SSR route.
- Capacitor packaging (only the storage adapter seam is prepared).
- Choice between Twilio Verify and Meta's API for templates.
- Paying for Workers or Supabase Pro (triggers are recorded; the click is the operator's).
- A dedicated backend service (Go or otherwise).

## Further Notes

- Effort is agent work plus Daniel's review; no human engineer-day estimates apply. The riskiest pieces (SSR glue with hydration, client-side OTP against the hosted project, the pipeline) are built first so unknowns fail early and are visible at `nueva.bnbtico.com`.
- Two facts were not available in the repository and must be confirmed before cutover: where the DNS zone of `bnbtico.com` is hosted today, and whether any tester is physically in Costa Rica (their Web Vitals rows would be the first real signal).
- The one-time manual steps for Daniel: Cloudflare API token into GitHub secrets, DNS zone on Cloudflare if not already, Access policy for `nueva.bnbtico.com`, `wrangler secret put` for the Supabase service role key, Turnstile enabled in Supabase Auth, Twilio spend alert.
- Rejected alternatives and their reasons live in `docs/decisiones.md` (2026-10-21): TanStack Start, Next 16 hybrid, SvelteKit, Expo, a dedicated API from day one, AWS native, Vercel Pro, Fly.io, meta-tag-only injection for the listing page, client-only admin step-up, image proxy through the worker.
- `docs/architecture.md` (rewritten 2026-10-21) is the one-page summary of this architecture. Historic documents (`docs/historico/architecture-hasta-2026-10-21.md`, the phase 2 design under `docs/superpowers/specs/`) are superseded by this spec where they conflict.
