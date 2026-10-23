# 03: Account required to contact; back to the sheet with what was written

**What to build:** without a session, «Abrir WhatsApp» keeps the draft and sends the client through Ingresar / Crear cuenta (`/cuenta?next=/casa/CT-####?contacto=1`), and after the code they land on the listing with the sheet open and the same dates, people and message. The code screen's card «recordando a qué casa vuelve» (design 07) shows the house. Spec § Listing page.

**Blocked by:** 02

**Status:** needs-triage

- [ ] Session state on the SSR listing read after hydration from storage without loading supabase-js when there is no stored session (as `src/client/session.ts`).
- [ ] Signed out: «Abrir WhatsApp» saves the draft (`open: true`) and navigates (full navigation from SSR, router navigation from the SPA) to the account flow with `next` built through `safeNext`; the sheet's copy under the button for signed-out users: «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.».
- [ ] Ingresar/Crear cuenta and Código: card «Vuelve a <casa>» (photo thumbnail, title) when `next` is a listing; new account path through `/cuenta/lista` keeps `next`.
- [ ] Return: the SPA listing route opens the sheet when `contacto=1` and a draft exists, then removes the parameter with `replace`; without a draft it just shows the listing. Expired draft (> 30 min) → sheet with the composed default.
- [ ] Country selector unchanged (any country).
- [ ] Playwright: signed out → sheet → write → Abrir WhatsApp → Ingresar with `+50688881234` → code → back with the same text and the sheet open; new account variant with a fresh test number; foreign number (`+1 415 555 0100`). Gates green.
