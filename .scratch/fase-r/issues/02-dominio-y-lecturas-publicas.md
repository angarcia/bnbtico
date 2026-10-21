# 02: Domain foundation and public reads

**What to build:** the framework-free domain module every later ticket depends on, proven with the first real data path: public listings read from PostgREST through the `ListingsApi` interface, with the same contract suite passing against the in-memory fake and against PostgREST on local Supabase. Includes the additive migration that lets the catalog be one query.

**Blocked by:** 01 (Skeleton, pipeline and first deploy).

**Status:** ready-for-agent

- [ ] Database types generated from the local schema and committed; a CI step regenerates them and fails on a diff.
- [ ] Pure modules moved from the old app with their unit tests: per-step validation and normalisation, filters, cantones, geo (approximate point), money and currency formatting, phone, share text, SEO text, image resize helpers. Zod schemas replace the hand-written form parsers with identical semantics.
- [ ] Typed row mapping in one place; `acceptsNightly` handled consistently for owner and public rows.
- [ ] `describe(listing)` returns main price, unit (noche/mes), situation copy per status, share URL and preview text; table-driven tests cover every status and price combination that the old app rendered in six places.
- [ ] `can(listing, action)` for edit, discard, submit, reopen mirrors the SQL rules (editable only in draft/changes; discard only for never-reviewed drafts; reopen only from active/changes/rejected); table-driven tests.
- [ ] `ListingsApi` and `AuthApi` interfaces declared with domain types and a domain error type carrying a Spanish message; the PostgREST adapter is the only module importing supabase-js.
- [ ] In-memory fake for `ListingsApi` that enforces ownership and status rules and returns the same Spanish messages as the DB for the covered cases.
- [ ] Contract harness: one suite file per capability, parametrised by adapter; runs in unit tests against the fake and in the database test project against PostgREST with the test numbers.
- [ ] First contracts green on both adapters: `searchPublic` with every filter, `getPublic` for active, never-sent (not found) and reviewed-then-hidden (blocked) listings, `linkState`, provinces with listings.
- [ ] Migration `cliente_directo`, part one: `listings_public` exposes an ordered `photos` array; a `provinces_with_listings` view; database tests for both.
- [ ] Error mapping: DB-raised messages pass through; PostgREST/GoTrue codes map to Spanish messages; anything else becomes one generic Spanish message; the "looks Spanish" regex is gone.
