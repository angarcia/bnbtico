# 02: Subscription in the database and the API (no screens)

**What to build:** migration `fase5_suscripcion` and the new API capabilities with their contract suite green against the fake and local Supabase, before any screen. See spec § Schema and § API.

**Blocked by:** 01

**Status:** blocked

- [ ] Migration (local only; `pnpm exec supabase migration new fase5_suscripcion < /dev/null`): reshape `subscriptions` and `subscription_reminders`, new `payment_methods`, `payment_customers`, `payment_events` with RLS, revokes and column grants; backfill of active houses by `first_published_at`; `review_listing` with slot assignment under an advisory lock; `owner_billing`, `stop_subscription`, `resume_subscription`, `launch_offer_taken`, `listing_blocked_reason`, `run_subscription_day` + job `bnbtico-suscripciones` `5 6 * * *`, `claim_reminders`, `finish_reminders`, `payment_setup_context`, `save_payment_customer`, `apply_payment_event`, `test_set_offer_days_left` (Vault `bnbtico_test_clock`). Messages identical to `SUBSCRIPTION_MESSAGES`. Types regenerated.
- [ ] The backfill is tested on a local base that already has active houses (apply the migration over data, not only after `db reset`; memory «Migraciones con datos»).
- [ ] API: `OwnerBillingApi` (`overview`, `stop`, `resume`), `PublicListingsApi.offerTaken`, `blockedReason`; a service-role data module for the worker (claim/finish/run day/apply event/save customer/setup context/test clock) in `src/data/postgrest/` with fetch like `fx.ts`. Fake with the same clock as calendar/inquiries.
- [ ] Contract `tests/contract/subscription.contract.ts` on both adapters with every case of spec § API.
- [ ] DB tests `tests/db/fase5-suscripcion.test.ts` with every case of spec § Schema «DB tests» (including two concurrent approvals and two concurrent claims from separate connections).
- [ ] Existing suites green (admin approval, publish, owner listings, inquiries refuse non-active houses, sitemap/Favoritos only active).
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`.
