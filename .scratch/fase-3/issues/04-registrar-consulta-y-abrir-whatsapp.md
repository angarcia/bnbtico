# 04: Register the inquiry and open WhatsApp with the house's number

**What to build:** with a session, «Abrir WhatsApp» calls `InquiriesApi.create` and, on success, opens `https://wa.me/<house digits>?text=<message>` in the same tab; on error, shows the DB message and opens nothing. Spec § Listing page («Opening WhatsApp»).

**Blocked by:** 03

**Status:** needs-triage

- [ ] Immediate pressed/loading state (< 50 ms), single flight (double tap does not create two calls), DB message in the sheet on error («Esta es su propia casa.», not available, rate limit, offline «Sin conexión…»).
- [ ] `location.assign(waUrl(phone, message))` after the RPC; the draft is cleared on success; returning to the app (back) shows the listing with the sheet closed.
- [ ] Number never present in SSR HTML, public view, persisted Query cache or logs; the RPC result is not cached.
- [ ] Event `inquiry_created` (listing id only) via `/events`; the worker accepts the new type (worker seam test).
- [ ] An inquiry for a house with a different `whatsapp_phone` than the owner's profile routes to the house's number (seed it with the service role in the test).
- [ ] Playwright: signed-in client contacts → intercepted `wa.me` URL is exactly the expected number and encoded text; row exists in the DB with dates/people/message; repeat within 7 days updates the same row; owner on own house sees the refusal; unavailable house cannot be contacted even by forcing the RPC (contract already covers it). Gates green.
