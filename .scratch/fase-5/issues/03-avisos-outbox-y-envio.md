# 03: Reminders: outbox sending from the worker cron

**What to build:** `WhatsAppSender` (fake + Twilio), `sendReminders` in the worker cron, the hourly trigger, the allowlist and the test route `/_pruebas/oferta/CT-####`. See spec § Worker.

**Blocked by:** 02

**Status:** blocked

- [ ] `WhatsAppSender` interface in the domain; `TwilioSender` (fetch, Basic auth, `whatsapp:` addresses; 4xx/5xx = definite, network/timeout = unknown) and `FakeSender`; allowlist → `skipped`.
- [ ] Cron `17 * * * *` in every env (same trigger count); `runDaily` only at 09 UTC; `sendReminders` only 08:00–17:59 CR; batch ≤ 20; `landingOnly` skips; errors logged as one JSON line, never failing the keep-alive.
- [ ] Test route: 404 in production and without `TEST_CLOCK_SECRET`; sets days left, runs `run_subscription_day`, sends one batch, returns JSON.
- [ ] HTTP seam / cron tests with injected sender and clock: hours, batch and subrequest limits, retry after a definite refusal sends once, two overlapping runs send each reminder once, `unknown` never resent, skipped when the house got a method or was stopped, allowlist, production 404.
- [ ] `pnpm dev:vars` writes the fake sender and a local `TEST_CLOCK_SECRET`; `wrangler.jsonc` updated (vars, `run_worker_first`).
- [ ] Green: `typecheck`, `test`, `test:db`, `build`, `size`.
