# Spec · Fase 3 · Contact by WhatsApp

Status: ready-for-agent (approved by Daniel 2026-10-23; per-house WhatsApp deferred, see below)
Date: 2026-10-23
Decided by: Daniel (brief of 2026-10-23), on top of `CLAUDE.md`, `docs/plan-implementacion.md` (Fase 3), `docs/diseno-v1.md` and the prototype (mobile view).
Language note: this spec is in English because it is a technical artifact; all UI copy stays in Spanish de Costa Rica, treating the user as **usted**.

## Problem Statement

bnbtico exists so that a client finds a house and writes to its owner on WhatsApp. After phases 1, 2 and R, a client can browse Explorar, open a listing from a WhatsApp link and see everything about the house, but the only call to action, «Contactar por WhatsApp», is disabled («disponible pronto»). Owners publish houses and get nothing back. There are no favorites either: the Favoritos tab is a placeholder.

Phase 3 closes the loop: a client writes to the owner on WhatsApp with a well-drafted message, the owner sees who wrote in Mis consultas and can reopen the chat in one tap, clients can keep a shortlist of houses without an account, and an owner can receive the consultations of each house on a different, verified WhatsApp number.

## Solution

- **Contact sheet on the listing page** (SSR `/casa/CT-####` and its SPA twin): the single fixed button opens a bottom sheet «Escríbale a <nombre>» with optional Llegada, Salida and Personas, and «Su mensaje» drafted automatically («Hola, vi <casa> en bnbtico y me interesa. ¿Está disponible del 20 al 27 de diciembre para 4 personas? Gracias.») that keeps redrafting itself while the client has not edited it by hand. The button «Abrir WhatsApp» (WhatsApp green) and the ochre note «Por su seguridad, nunca envíe dinero antes de confirmar la casa. bnbtico no procesa ni pide pagos.».
- **An account is required to contact.** Without a session, «Abrir WhatsApp» keeps what the client wrote, goes through Ingresar/Crear cuenta and lands back on the listing with the sheet open and the same dates, people and message.
- **Registering the inquiry and opening WhatsApp.** With a session, «Abrir WhatsApp» calls one RPC that checks the house can be contacted, stores (or refreshes) the inquiry and returns the house's WhatsApp number; the browser then opens `https://wa.me/<digits>?text=<message>`. The number of a house is never in the public view, in the SSR HTML or in any cache: it is handed out only by that RPC, to a signed-in client, and the act is recorded.
- **Mis consultas (owner):** a list of the clients who wrote, newest first, filter by house, each card with initials, name, relative date, house · dates · people, the message in quotes and «Abrir WhatsApp» that opens the chat with the client directly (no template, no intermediate sheet). «Nuevas» = not yet opened by the owner; the count shows on Inicio and as a terracotta badge on the Consultas tab.
- **Favorites without an account:** a heart on Explorar cards and on the listing page (cream round button on the photo); Favoritos screen with horizontal cards and a heart to remove; stored on the phone; with a session they also sync to the `favorites` table so they follow the user to another device.
- **WhatsApp per house with its own verification — DEFERRED (Daniel, 2026-10-23):** not in phase 3; every house keeps using the owner's account number. Kept below as the design for later (ticket 07, status `wontfix` for now). Originally: by default a house uses the owner's account number (copied at creation, as today). In the house detail («WhatsApp de esta casa») and on step 9 of the wizard the owner can set another number from any country; it only replaces the current one after a code sent by WhatsApp to that number is verified. Other houses do not change.

## User Stories

### Client

1. As a client on a listing, I want one button that opens a sheet with the message already written, so that contacting takes one tap and I don't have to think what to write.
2. As a client, I want to add arrival, departure and number of people and see the message update by itself, so that the owner gets the useful data.
3. As a client who edited the message by hand, I want my text to stay even if I change the dates afterwards, so that my words are not overwritten.
4. As a client, I want an error in Spanish if the departure is not after the arrival, so that I don't send nonsense dates.
5. As a client without an account, I want to be taken to create one with my WhatsApp and come back to the same sheet with what I had written, so that I don't lose it.
6. As a client with a session, I want «Abrir WhatsApp» to open WhatsApp with the owner's number and my message, so that I only have to press send.
7. As a client, I want to be told plainly that the owner will see my name and WhatsApp, so that I know what I share.
8. As a client, I want a house that is not available for consultations to say so instead of offering the button, so that I don't write in vain.
9. As a client, I want to save houses with a heart without an account, see them in Favoritos and remove them, so that I can compare.
10. As a client who signs in, I want my saved houses to stay and to appear on my other phone, so that I don't lose my list.
11. As a client, I want favorites of houses that are no longer public to disappear quietly (or show as «Ya no está disponible»), so that the list is honest.

### Owner

12. As an owner, I want to see in Mis consultas who wrote, about which house, for which dates and people, and what they said, so that I know who is who in my WhatsApp.
13. As an owner, I want «Abrir WhatsApp» on each inquiry to open the chat with that client, so that I can answer in one tap.
14. As an owner, I want the number of new inquiries on Inicio and on the Consultas tab, so that I notice them.
15. As an owner with several houses, I want to filter by house, so that I find the right inquiry.
16. As an owner, I want to receive the consultations of one house on another WhatsApp (my business line, my partner's phone), verified with a code, so that clients reach the right person.
17. As an owner, I want the old number to keep working until the new one is verified, and the other houses to stay as they are, so that I never lose contacts mid-change.
18. As an owner who switches «Disponible para consultas» off, I want clients to stop being able to contact that house, so that I don't get inquiries while it's closed.

### bnbtico (operator)

19. As the operator, I want house numbers to be handed out only to signed-in clients and every hand-out recorded, so that numbers can't be scraped from the catalog.
20. As the operator, I want a per-client limit of inquiries per day, so that one account can't harvest every number.
21. As the operator, I want the `whatsapp_tap` and `inquiry_created` events in our own telemetry, so that we can count contacts without third parties.

## Implementation Decisions

### What already exists (phase R)

- Tables `inquiries(id, listing_id, client_id, owner_id, arrival, departure, people, message, consent_share_phone, created_at)` and `favorites(user_id, listing_id, created_at)` in `0001_init.sql`, with RLS on. `inquiries_insert` only checks `client_id = auth.uid()`; `favorites_self` is `for all` on `user_id = auth.uid()`.
- `listings.whatsapp_phone` (copied from the profile by `listings_insert_guard`, frozen by `listings_protect`); `listings_public` exposes `owner_name`, `owner_whatsapp_verified`, `available`, `reopen_at`, never the number nor `owner_id`.
- The SSR listing hydrates on its own (`hydrate-listing.tsx`: no router, no session, no persistence); session-dependent parts mount after hydration in fixed boxes (`useHydrated`); a Playwright test fails on hydration warnings. The SPA route `/casa/$publicId` reuses `ListingScreen`.
- Account flow `/cuenta?next=…` (`safeNext`), pending OTP in sessionStorage, session in localStorage under `bnbtico-auth` (readable without supabase-js).
- `waLink(number, text)` in `src/client/support.ts`; `formatPhone`/`composePhone`/`PHONE_COUNTRIES` in `src/domain/phone.ts`; `track()` beacons with `whatsapp_tap` placeholder.
- Private-zone initial JS: **145.24 KB gz of 150**. Only ~4.8 KB headroom.

### Bundle budget (applies to every ticket)

- Every new screen and the contact sheet are lazy chunks (`lazyRouteComponent` / dynamic `import()`), with their own `size-limit` entry. Favoritos, Mis consultas, the contact sheet and the per-house phone verification are not in the initial private bundle.
- Ticket 02 starts by making room: the owner screens and Favoritos/Ayuda that are statically imported in `shell.tsx` move behind `lazyRouteComponent` with a prefetch on tab hover/touchstart and on idle, so a tab tap stays < 100 ms when visited and the bottom-nav tap still responds < 50 ms. Target after phase 3: initial private JS ≤ 140 KB gz.
- The SSR listing hydration chunk must not grow by more than 3 KB gz: the heart and the button are tiny; the sheet loads on tap (and is prefetched on idle after hydration).

### Schema (one additive migration, `fase3_consultas`; a second one, `fase3_whatsapp_casa`, in ticket 07)

- `inquiries`:
  - New columns: `whatsapp_phone text not null` (destination snapshot at the time of contact), `updated_at timestamptz not null default now()`, `owner_opened_at timestamptz` (owner tapped «Abrir WhatsApp»), `source text not null default 'listing' check (source in ('listing','bnbtico'))` (the bnbtico-created kind from the design is v1.1; the column avoids a later migration).
  - Drop `inquiries_insert`; revoke insert/update/delete from `anon` and `authenticated`. Select stays: client sees own, owner sees own listings', admin (aal2) all. Select on `whatsapp_phone` is revoked per column (the client already got it from the RPC; no second read path).
  - RPC `create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people int, p_message text) returns table(inquiry_id uuid, whatsapp_phone text)`, `security definer`, `search_path = ''`:
    - requires `auth.uid()` with an active profile (`is_active`) and a verified phone;
    - listing must be public (`listing_visible`/status `active`) and `available`; not the caller's own house («Esta es su propia casa.»);
    - validates dates (both or none; departure > arrival; arrival not before today in Costa Rica), people 1–50, message 1–1000 chars after trim;
    - dedup: if the same client has an inquiry for the same listing created in the last 7 days, update it (dates, people, message, `updated_at`, `whatsapp_phone`, `owner_opened_at = null`) instead of inserting; otherwise insert;
    - rate limit: at most 20 distinct listings per client in the last 24 h («Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.»);
    - returns the listing's current `whatsapp_phone`.
  - RPC `mark_inquiry_opened(p_id uuid)`: owner of the inquiry only; sets `owner_opened_at` if null.
  - Owner list: RPC `owner_inquiries()` (or a `security_invoker = false` view filtered by `auth.uid()`) returning inquiry fields + listing `public_id`/`title` + client `full_name` and `phone` (the client's profile is otherwise not readable by the owner). Only the owner's inquiries; ordered by `updated_at desc`; capped at 200.
  - `owner_new_inquiries_count()` or the count derived from the list query (preferred: one query per screen; Inicio and the tab badge reuse the list query).
- `favorites`: keep `favorites_self`; add a `with check` that the listing is publicly visible at insert time (no favoriting drafts by id). Reads return only listing ids; the screen fetches the cards from `listings_public` (non-public ones simply don't come back).
- Telemetry: `events.type` gains `inquiry_created` (if the column has a check, extend it).
- `0001_init.sql` is not edited. Types regenerated (`pnpm --filter app db:types`).

### Domain

- `src/domain/inquiry.ts` (no framework): `composeInquiryMessage(title, {arrival?, departure?, people?})` ported from the prototype (`contactCompose`, same sentences, «1 persona», month names, cross-month and cross-year ranges); `validateInquiryDraft` (dates both-or-none, departure > arrival, arrival ≥ today CR, people 1–50, message non-empty ≤ 1000) with Spanish messages identical to the RPC's; `formatInquiryDates` for the owner card («20–27 dic», «28 dic – 2 ene», «sin fechas»); `waUrl(e164, text)` (digits only, `encodeURIComponent`; moves `waLink` here and `support.ts` reuses it); `initials(name)`; relative date («hace 2 h», «ayer», «12 oct») with an injectable clock.
- Draft auto-redraft rule as a pure reducer: the message follows the composed text while `message === lastComposed`; once edited, it stays.
- Contact draft persistence: `sessionStorage` key `bnbtico-contacto:<CT-####>` `{arrival, departure, people, message, edited, open}` with 30 min expiry, behind the existing storage adapter. Cleared after a successful inquiry.
- Favorites: `src/domain/favorites.ts` with a pure merge (local ∪ remote, dedup, newest first) and a local store `bnbtico-favoritos` (array of `{publicId, savedAt}`; capped at 100).

### API (interfaces in `src/domain/api.ts`, two adapters, one contract suite each)

- `InquiriesApi`: `create(publicId, draft) → {inquiryId, whatsappPhone}`, `listForOwner() → OwnerInquiry[]`, `markOpened(id)`.
- `FavoritesApi` (session only; anonymous favorites never touch the network): `list() → publicId[]`, `add(publicId)`, `remove(publicId)`, `addMany(publicIds)` (used by the merge on sign-in).
- `ListingPhoneApi` (ticket 07): `start(listingId, e164, captchaToken?)`, `verify(listingId, code)`, `useAccountNumber(listingId)`.
- Contracts (`tests/contract/inquiries.contract.ts`, `favorites.contract.ts`, `listing-phone.contract.ts`) run against the fake (`tests/unit`) and PostgREST on local Supabase (`tests/db`). They cover: anonymous cannot create; own house rejected; draft/in-review/inactive/unavailable rejected with the DB message; returns the house number; dedup within 7 days updates and resets `owner_opened_at`; after 7 days a new row; rate limit; owner sees only their inquiries with client name and phone; another owner sees nothing; client sees own inquiry but cannot update/delete; mark opened only by owner; favorites isolation between users, cannot favorite a non-public listing, remove idempotent.

### Listing page (SSR and SPA)

- The button lives in the existing `.cta-bar` (same height before and after hydration). Before hydration it renders as a non-interactive box of the same size; after hydration it becomes «Contactar por WhatsApp» (enabled) or «No disponible para consultas» (disabled, when `available` is false; with «Vuelve a estar disponible el <fecha>» if `reopen_at`). The SSR HTML never contains session-dependent markup.
- Tap → `track("whatsapp_tap")` → lazy-load and open the sheet. The sheet is a dialog (`role="dialog"`, `aria-modal`, focus trap, Escape and backdrop close, returns focus), 28 px top radius, over the dimmed page; body scroll locked; the keyboard does not hide the textarea (same `--kb` approach as the wizard on iPhone).
- Owner line: «Escríbale a <owner_name>» + «Propietario de <casa> · WhatsApp verificado».
- Consent line under the button: «<Nombre> verá su nombre y su WhatsApp.» No checkbox (design 04 has none; tapping the button is the act). `consent_share_phone = true` is stored.
- On the SSR page there is no router: navigation to the account flow is a full navigation to `/cuenta?next=/casa/CT-####%3Fcontacto%3D1`; the SPA listing route opens the sheet when `contacto=1` and a draft exists, then removes the parameter (replace).
- Opening WhatsApp: after the RPC resolves, `location.assign(waUrl)` in the same tab (a `window.open` after an `await` is blocked by iOS popup blockers; `wa.me` hands off to the app). Before the RPC, the button shows a pressed/loading state immediately (< 50 ms). On error, the DB message in the sheet (`.note[role="alert"]`) and nothing opens. The worker's `/events` gets `inquiry_created` (no personal data: only `listingId`).
- An owner opening their own active house sees the normal button; the RPC refuses on tap with «Esta es su propia casa.» (the public view has no `owner_id`, and adding it is not worth a column).

### Mis consultas (owner)

- Route `/propietario/consultas` (replaces the placeholder), lazy. Root screen header (logo, H1 «Mis consultas»), text «Clientes que le escribieron por WhatsApp desde su ficha. Toque una para seguir la conversación; aquí no hay nada que aceptar ni rechazar.», chips «Todas · N» + one per house with inquiries (chip in sage when active, as Explorar), cards per design 18, «Nueva» marker on unopened ones, closing note «Es un registro de quién le escribió; la conversación completa está en su WhatsApp.». Empty state: «Todavía no le han escrito. Comparta su ficha para recibir consultas.» + «Compartir ficha» if there is an active house.
- «Abrir WhatsApp» = `mark_inquiry_opened` (optimistic, fire-and-forget with `keepalive`) + `location.assign(wa.me/<client digits>)` with **no text** (the conversation already exists, prototype `consultas-directo.js`).
- Query key `["inquiries", uid]`, stale 30 s, persisted with the private keys, refetch on focus/resume; Inicio's «N consultas nuevas» card and the tab badge read the same query (no extra request on Inicio if cached; one light query otherwise).

### Favorites

- Heart: on Explorar cards (top-right over the photo, already designed in screen 01) and on the listing hero (cream round button next to share). `aria-pressed`, label «Guardar en favoritos» / «Quitar de favoritos», terracotta `#D65C3C` when on. Optimistic, never blocks.
- On the SSR listing the heart is a fixed-size placeholder until hydration, then reads the local store (no network for anonymous users).
- Favoritos screen (`/favoritos`, lazy): header «Favoritos» with «Ingresar» (outline) when signed out; «N casas · guardadas en este teléfono» (signed out) or «N casas guardadas» (signed in); horizontal cards (photo, name, heart, «zona · N pers. · N hab.», three features, price with the ₡/$ toggle as elsewhere); sage note «Compare y escriba directo · Guardar casas no necesita cuenta. Para contactar a un propietario solo tiene que verificar su WhatsApp con un código.»; empty state «Toque el corazón de una casa para guardarla aquí.» + «Explorar casas». Cards come from `listings_public` by `public_id in (…)` (one query, cached with the public keys); ids that don't come back are dropped from the store silently.
- Sync: on sign-in (and on app start with a session) → `addMany(local)` then `list()` → local = merge. With a session, add/remove write locally first and then to the API (rollback on error with a toast). Sign-out keeps the local list (it's «este teléfono»).

### WhatsApp per house (ticket 07 — deferred, not built in phase 3)

- Supabase Auth can only verify the account's own phone, so the code for a house number is sent and checked by the worker with **Twilio Verify** (the same Verify service the hosted project already uses, channel `whatsapp`).
- Worker routes `POST /api/casa-whatsapp/start` and `POST /api/casa-whatsapp/verify` (in `run_worker_first`). The worker does not verify JWTs: it forwards the user's `Authorization` header to PostgREST, calling `begin_listing_phone_change(listing_id, phone)` (owner-only, listing not rejected, number E.164, different from current, rate limits: 5 starts per listing per hour, 10 per owner per day; stores a row in `listing_phone_changes(listing_id, phone, requested_at, attempts, verified_at)`), then calls Twilio Verify `start`. On verify, it reads the pending change with the user's JWT, checks the code with Twilio (max 5 attempts, 10 min validity), and on success calls `confirm_listing_phone(listing_id, phone)` with the service role, which sets `listings.whatsapp_phone` (allowed only to that function: `listings_protect` keeps freezing it for everyone else) and marks the change verified. Turnstile on `start`.
- «Usar el WhatsApp de mi cuenta» needs no code: RPC `use_account_phone_for_listing(listing_id)` (owner, copies `profiles.phone`).
- Without Twilio secrets the routes answer 503 and the UI says «Por ahora no se puede cambiar el número. Escríbanos por WhatsApp.» (fail closed). In local and CI a `PHONE_VERIFY_MODE=local-test` var accepts code `123456` **only** for the numbers in `[auth.sms.test_otp]` plus a dedicated test number for houses; it is refused if `ENVIRONMENT` is `pruebas` or `production`.
- UI: house detail row «WhatsApp de esta casa» → flow screen `/propietario/casas/$id/whatsapp` (lazy): current number with «Verificado», country selector + number (reusing the account's selector component), «Enviar código por WhatsApp», six-box code (same component as Ingresar), resend after 30 s, «Usar el WhatsApp de mi cuenta». Copy: «Los clientes le escriben a este número desde la ficha. Las otras casas no cambian. El número actual sigue funcionando hasta que verifique el nuevo.» Wizard step 9 keeps showing the number with «Cambiar» → same screen, returning to step 9.
- Changing the number of an active house does not send it to review (it's not public content) and does not purge the SSR page (the number isn't in it).

### Copy (usted; design 04, 05, 18 rule)

All strings above. Dates in the message: «del 20 al 27 de diciembre», «del 28 de diciembre al 2 de enero». No voseo («Escribile», «acordás», «Tocá» in older code/copy must not leak into new screens; the listing bar's «el precio final lo acordás con el propietario» is outside this phase and stays as approved in design v1 unless Daniel says otherwise).

## Testing Decisions

- Test first, as in phase R. Seams: (1) contract suites for every new API capability against fake and local Supabase; (2) database tests for the migration (grants: anon/authenticated can't insert/update inquiries directly; client can't read another's; owner reads client phone only through `owner_inquiries`; `listings_protect` still freezes `whatsapp_phone` except through `confirm_listing_phone`; favorites check); (3) worker HTTP seam for `/api/casa-whatsapp/*` with an injected verifier (Twilio fake) and a PostgREST fake; (4) Vitest for the domain (message composition with the prototype's exact cases, validation, reducer, merge, relative dates, wa.me URL); (5) Playwright on Pixel 7.
- Playwright flows: SSR listing → sheet → dates/people → message updates → edit → stays → no session → Ingresar → code → back on the listing with the sheet open and the same text → «Abrir WhatsApp» → request to `wa.me` intercepted with the exact URL (`page.route('https://wa.me/**')`) → owner signs in → Mis consultas shows it as «Nueva» → «Abrir WhatsApp» opens `wa.me/<client>` → badge disappears. Unavailable house. Hydration test stays green with heart and button. Favorites anonymous → persist across reload → sign in → appear on a fresh context of the same user. 
- Gates unchanged: `typecheck`, `test`, `test:db`, `build`, `size` (private < 150, new chunk limits), `test:e2e`, `lighthouse` (listing < 2.0 s cold, shell < 2.5 s).
- Prototype tests in `tests/prototype/*.cjs` must keep passing (they are not modified).

## Out of Scope

- Veriff and its suggestion; client ratings; inquiries created by bnbtico (admin concierge) and their screen; «Buscan casa» (phase 6); calendar and «no disponible con fecha de reapertura» editing (phase 4: the sheet only reads `available`/`reopen_at`); a client-side «Mis contactos» list; WhatsApp Business API, notifications to the owner on new inquiries (the client's WhatsApp message is the notification); any intermediate number.
- Any change to `apps/web`, to the cutover (`docs/corte-fase-r.md`, ticket 13 of phase R), to the hosted Supabase project, Cloudflare or GitHub.

## Further Notes

- **Manual actions for Daniel (at the end, one at a time):** apply the migration `fase3_consultas` to `bnbtico-pruebas`; run the phase 3 manual test plan from the phone. (No Twilio secrets: per-house WhatsApp is deferred.)
- **Before production** (`docs/antes-de-produccion.md`): review the 20/day inquiry limit and the per-house verification limits with real data; Twilio Geo Permissions also cover the per-house codes; privacy text must mention that the owner sees the client's name and WhatsApp when contacted and that inquiries are kept (retention to decide, proposal 24 months).
- Decisions recorded in `docs/decisiones.md` on the day each ticket lands.
