# 08: Closing of phase 5

**What to build:** the end-to-end journey with the clock moved, the manual test plan and the documents. See spec § Testing and § Further Notes.

**Blocked by:** 05, 06, 07

**Status:** blocked

- [ ] `tests/e2e/fase5.spec.ts`, each actor in its own Pixel 7 context, through the local test route: review → approval with offer → 90/30/7/0 (fake sender recorded the four texts with `#pago=`; the app card) → −1 → Pendiente de pago and 410 «regularice» → add method (fake checkout) → Activa → stop → Inactiva and 410 «paró» → resume → Activa and the ficha back. Runs in CI if it does not need pg_net (try).
- [ ] `docs/pruebas-manuales-fase-5.md` (format of fase 4: A previous actions one at a time — Stripe keys and webhook, Twilio sandbox join, secrets, Vault, migration, Access bypass, deploy —; B journeys from iPhone and Android with the curl of the test route on `workers.dev`; C what to report).
- [ ] `docs/plan-implementacion.md` «Estado» (fase 4 already applied and deployed; fase 5 built), `docs/decisiones.md`, `docs/antes-de-produccion.md`, `docs/configuracion-supabase.md` (new secrets and vars), `docs/architecture.md`, `CLAUDE.md` if a rule changed.
- [ ] Skipped-in-CI specs listed with why.
- [ ] All batteries green on the final tree; sizes and Lighthouse numbers in the closing notes.
