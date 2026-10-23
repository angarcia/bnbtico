# 07: WhatsApp per house with its own verification

**What to build:** an owner can set a different WhatsApp (any country) for one house, verified with a code sent by WhatsApp to that number through Twilio Verify from the worker; or go back to the account's number without a code. Migration `fase3_whatsapp_casa`. Spec § WhatsApp per house.

**Blocked by:** 04 (the number is what `create_inquiry` returns)

**Status:** wontfix (deferred by Daniel on 2026-10-23: no Twilio yet; every house uses the account's WhatsApp. Kept as the design for later; noted in `docs/plan-implementacion.md`.)

- [ ] Migration (local only): `listing_phone_changes`; RPCs `begin_listing_phone_change`, `confirm_listing_phone` (service role only; the only path besides admin that changes `whatsapp_phone`), `use_account_phone_for_listing`; rate limits; `listings_protect` keeps freezing the column for every other caller. DB tests for each rule.
- [ ] `ListingPhoneApi` with contract on fake and on local Supabase + local worker (`start`, `verify`, `useAccountNumber`): owner only, wrong code, 5 attempts, 10 min expiry, codes single-use, editing the number invalidates the pending code, other houses unchanged, current number kept until verified.
- [ ] Worker `POST /api/casa-whatsapp/start|verify` (`run_worker_first`): forwards the user's `Authorization` to PostgREST, Twilio Verify through an injected `PhoneVerifier` (real: REST with `TWILIO_*` secrets; local-test: code 123456 for test numbers, refused when `ENVIRONMENT` is `pruebas`/`production`; none: 503). Turnstile token on start. Worker seam tests with fakes; CSP `connect-src` unchanged (same origin).
- [ ] UI: house detail row → lazy flow screen `/propietario/casas/$id/whatsapp` (country selector, number, «Enviar código por WhatsApp», six-box code, resend after 30 s, «Usar el WhatsApp de mi cuenta», copy from the spec); wizard step 9 «Cambiar» → same screen and back to step 9. 503 message when not configured.
- [ ] Playwright: change to a test number with the local verifier → client contacts → intercepted `wa.me` uses the new number; another house of the same owner unchanged; back to the account's number. Gates green.
- [ ] Docs: `docs/configuracion-supabase.md` (or the worker section) lists the three `TWILIO_*` secrets for `pruebas`.
