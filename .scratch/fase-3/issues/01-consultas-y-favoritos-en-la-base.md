# 01: Inquiries and favorites in the database and the API (no screens)

**What to build:** migration `fase3_consultas` and the two new API capabilities, with their contract suites green against the fake and against local Supabase, before any screen. See `.scratch/fase-3/spec.md` § Schema, § Domain (inquiry/favorites pure parts), § API.

**Blocked by:** none (phase R tickets 01–12 done).

**Status:** ready-for-agent

- [ ] Migration `fase3_consultas` (local only): `inquiries` gains `whatsapp_phone`, `updated_at`, `owner_opened_at`, `source`; `inquiries_insert` dropped; insert/update/delete revoked from anon/authenticated; select on `whatsapp_phone` revoked per column; RPCs `create_inquiry`, `mark_inquiry_opened`, `owner_inquiries` (security definer, `search_path = ''`, Spanish messages); favorites insert checks the listing is public; `events` accepts `inquiry_created`. Types regenerated.
- [ ] `create_inquiry` rules: session with active profile; listing active and available; not own house («Esta es su propia casa.»); dates both-or-none, departure > arrival, arrival ≥ today in Costa Rica; people 1–50; message 1–1000 after trim; dedup within 7 days updates the row and resets `owner_opened_at`; ≤ 20 distinct listings per client per 24 h; returns the current house number.
- [ ] Domain: `src/domain/inquiry.ts` (`composeInquiryMessage` with the prototype's exact cases from `tests/prototype/contacto-hoja.cjs`, `validateInquiryDraft` with the same messages as the RPC, redraft reducer, `formatInquiryDates`, `relativeDate` with injected clock, `initials`, `waUrl` — `support.ts` reuses it), `src/domain/favorites.ts` (merge, local store shape, cap 100). Unit tests first.
- [ ] `InquiriesApi` (`create`, `listForOwner`, `markOpened`) and `FavoritesApi` (`list`, `add`, `remove`, `addMany`) in `api.ts`; PostgREST adapters (only place with supabase-js) and fake (`FakeDb` gains inquiries and favorites with the same rules and messages).
- [ ] Contract suites `inquiries.contract.ts` and `favorites.contract.ts` on both adapters, covering every case in the spec's API section (including: client cannot update/delete its inquiry, another owner sees nothing, owner gets client name and phone only via `listForOwner`, rate limit, 7-day dedup with injectable clock in the fake and a backdated row in the DB test).
- [ ] DB tests for grants: direct insert into `inquiries` as authenticated fails; client cannot read `whatsapp_phone` through the table; `listings_protect` unchanged.
- [ ] All green: `typecheck`, `test`, `test:db`, `build`, `size` (no UI change, size must not move).
