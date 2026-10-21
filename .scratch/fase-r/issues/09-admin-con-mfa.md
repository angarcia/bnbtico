# 09: Admin review with phone MFA

**What to build:** an admin signs in like anyone, is asked for a second WhatsApp code before the admin screens open, sees the review queue instantly, approves, requests changes or rejects with a reason, watches the house leave the queue at once, and the public page of the house updates within seconds. A stolen admin session without the second factor cannot review anything, because the database refuses it.

**Blocked by:** 03 (Public listing page from a WhatsApp link), 05 (Account and session in the browser).

**Status:** ready-for-agent

**Manual step (Daniel, or me through the Management API with your CLI session):** enable the phone MFA factor on the hosted Supabase project.

- [ ] Local Supabase config enables phone MFA enrolment and verification; migration requires `aal2` in every admin RLS policy and in the review RPC; database test proves an admin token at `aal1` cannot list the queue or review, and at `aal2` can.
- [ ] `AuthApi` gains MFA enrolment and challenge/verify; admin routes require an `aal2` session in the router guard (UX) while SQL enforces.
- [ ] Admin screens per design v1: queue with Por revisar / Cambios pedidos / Rechazados, summary boxes, house detail with checklist, "Aprobar y publicar", request changes and reject with mandatory reason (≤ 2000).
- [ ] Review is optimistic (house removed from the queue), rolls back with the DB message, and calls the purge endpoint for the listing URL on success.
- [ ] Admin contracts on both adapters: queue split by status and age, review decisions and their validation, non-admin gets nothing.
- [ ] Playwright: admin flow ported with the test admin number and the MFA step.
