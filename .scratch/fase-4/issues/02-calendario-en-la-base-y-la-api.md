# 02: Calendar and reopening in the database and the API (no screens)

**What to build:** migration `fase4_calendario` and the new API capabilities, with their contract suite green against the fake and against local Supabase, before any screen. See spec § Schema and § API.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Migration `fase4_calendario` (local only; `pnpm exec supabase migration new fase4_calendario < /dev/null`): drop `days_owner_write` and `rates_owner_write`, revoke insert/update/delete on `listing_days` and `listing_rates` from anon/authenticated; RPC `save_listing_days` (rules, messages and single purge per the spec); `set_listing_available(p_listing, p_available, p_reopen_at default null)` replacing the old one; `pg_cron` + `reopen_due_listings(p_today)` (never changes `status`) + job `bnbtico-reabrir-casas` at `0 6 * * *`; `public_listing_days(p_public_id)` for anon/authenticated. All `security definer`, `search_path = ''`, Spanish messages identical to `CALENDAR_MESSAGES`. Types regenerated.
- [ ] API: `OwnerCalendarApi` (`days`, `save`), `OwnerListingsApi.setAvailable(id, available, reopenAt?)`, `PublicListingsApi.getPublicDays`. PostgREST adapters (only place with supabase-js; owner calendar in the lazy `supabase-data` chunk) and fake (`FakeDb.days`, injectable today, `reopenDue`).
- [ ] Contract `tests/contract/calendar.contract.ts` on both adapters covering every case in spec § API.
- [ ] DB tests `tests/db/fase4-calendario.test.ts` covering every case in spec § API (grants, cron job registered, reopening without status change, exactly one purge per save, none for a draft).
- [ ] Existing suites unchanged and green (the availability switch keeps working with the new signature; `create_inquiry` still refuses closed houses).
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`.
