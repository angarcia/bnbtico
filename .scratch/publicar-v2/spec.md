# Spec · Publicar v2: enviar sin fotos, verificar el WhatsApp después del paso 1 y preguntar por la casa al registrarse

Status: needs-triage
Date: 2026-10-28
Decided by: Daniel, question by question on 2026-10-28/29, from Ana's emails of 2026-10-28. Authority: `.scratch/ronda-ana-2026-10-28/decisiones.md`, section **E**.
Language note: technical artifact in English; all UI copy in Spanish de Costa Rica, treating the user as **usted**.
Supersedes:
- `docs/decisiones.md` (fase 2 and ticket 19, 2026-10-27 «nombre y descripción»): «Agregue al menos 5 fotos» to send and «Pida al menos 5 fotos antes de aprobar»; description required (80–2000); name 5–60.
- Revisión UX C4 (`.scratch/revision-ux/2026-10-26-revision-ux.md`): «el mínimo de fotos se exige al enviar» and the «Faltan N fotos» resume line.
- `docs/diseno-v1.md` §12 «Enviada a revisión» (l.34) (now preceded by the optional email screen) and §8 «Mi cuenta» / §6–7 Ingresar–Código (the «¡Listo! Su cuenta está creada» screen now asks «¿Tiene una casa para alquilar?»).
- Revisión UX C1 and `src/domain/portada.ts` (the portada's owner button always opens WhatsApp): it opens the wizard whenever the app is open (see §5).
- `CLAUDE.md` «WhatsApp verificado por código es lo único obligatorio para publicar»: still true, but the verification now happens **after step 1**, not before entering the wizard.
Related: `.scratch/densidad-y-tarjetas/spec.md` (B: a draft is one item in Mis casas, card buttons), `.scratch/editar-casa/spec.md` (D: uses `TITLE_MAX` and `MIN_PHOTOS_TO_APPROVE`), `.scratch/ubicacion-por-punto/spec.md` (step 2).
Visual authority, once Daniel approves them: the wizard verification and optional-email mockups in `design/pantallas/v2/`.

## Order and dependencies

Fourth project (B+C → A → D → **E** → F+G). Depends on **B** for the single draft item and the outline «Seguir publicando» (E adds nothing to Mis casas beyond what B specifies). D validates names and the approval minimum through the domain constants changed here; if D is built first, its tests use whatever values the constants hold and are updated with E. Independent of A and F+G.

## Problem Statement

- Owners with a house but no good photos yet, or who do not know what to write, **stop at step 6 or 7** and never send. We would rather review a house without photos and ask for them than lose the owner.
- Five photos are required to send. Many small Caribbean houses have three good photos; the rule makes owners pad with bad ones.
- Names up to 60 characters do not fit one line on a card at 375 px and on the WhatsApp preview.
- From the portada, «Publicar mi casa» opens WhatsApp to bnbtico (C1), because the wizard requires an account first. Asking for name, number and code **before** the owner has seen anything of the wizard loses people at the first screen.
- A new account created to look for houses never learns it can publish; one created to publish lands in Explorar.

## Solution

### 1. Send without photos and without description; approve with at least one photo

- **Step 6** (`StepFields` case 6, `validateStep(6)`): the description is **optional**. Empty passes; non-empty keeps the 80–2000 bounds (`DESCRIPTION_MIN`/`DESCRIPTION_MAX`) and their message. The label reads «Descripción (opcional)» and the help line «Puede añadirla después».
- **Step 7**: no minimum. `photosMissing` and the step-7 check in `validateAll` go away; `resumeStep` no longer stops at photos. The help line: «Puede enviarla sin fotos; para publicarla necesitamos al menos una.»
- **Step 9** («Enviar»): the ready list (`ReadyList`) shows «Fotos: ninguna todavía» / «Descripción: sin descripción» as plain lines, not as errors.
- **`submit_listing`** (latest in `20261028071444_ubicacion_en_listings.sql`): remove `n_photos < 5`; keep `> 15`; description: `''` allowed, otherwise 80–2000; name 5–**32**.
- **`review_listing`** (latest in `20261027202238_fase5_suscripcion.sql`): approval needs `n_photos >= 1`, else «Para aprobarla hace falta al menos una foto.» (admin-facing).
- **Admin review** (`RevisarScreen`, `client/screens/admin.tsx`): with 0 photos, «Aprobar y publicar» is disabled and the note field is prefilled with the canned message «Para publicarla necesitamos al menos una foto de la casa.» (owner-facing); «Pedir cambios» sends it. The «Faltan fotos» note reads «Sin fotos: solo puede pedir cambios.» (arena, per B).
- **Ficha without description** (`shared/listing-page.tsx`): the description block is not rendered (no empty heading). With one photo, no counter (as today).
- Constants (`domain/listing.ts`): `MIN_PHOTOS` (5) is replaced by `MIN_PHOTOS_TO_APPROVE = 1`, used by the admin screen and by `review_listing`'s twin in the fake.

### 2. Name: 5 to 32 characters

- `TITLE_MAX = 32` (`domain/listing.ts`), and `TITLE_LENGTH_ERROR` follows. The name input has `maxLength={32}` and a counter «12 / 32».
- `submit_listing`, the fake and D's `submit_edit` use 5–32.
- Existing houses with longer names are test data (`bnbtico-pruebas` is wiped before this round's migrations, as in `.scratch/mensual-como-caracteristica/spec.md` «Test data reset»); no data migration. A published house with a longer name keeps it until its owner edits the name (D validates the new value only).

### 3. Publishing without an account: verification after step 1

New public route **`/publicar`** (under `flow`, no `requireSession`), lazy in the publish chunk:

1. **Signed in** → `redirect` to `/propietario/publicar` (today's entry: resume or create).
2. **Signed out** → step 1 «¿Qué es?» rendered with the same `StepFields` (case 1) and header («Publicar casa», «Su casa · 1 de 4»). «Continuar» validates with `validateStep(1)` and stores the answer **on the phone**: localStorage `bnbtico-publicar-paso1` = `{"kind":"habitacion","savedAt":1730000000000}` (7-day expiry, read with a zod/mini schema; anything invalid is ignored).
3. **«Para guardar su casa, verifique su WhatsApp»** (`/publicar/verificar`, same chunk, same wizard header): the sign-in form of `/cuenta` (name, +506 number, Turnstile) extracted from `CuentaScreen` as `SignInForm`, with the line «Le enviamos un código por WhatsApp. Así nadie más puede publicar en su nombre.» and «Ya tengo cuenta» switching to sign-in mode. Submitting goes to `/cuenta/codigo?next=/publicar/continuar`.
4. **Code screen** (`CodigoScreen`): a `next` of `/publicar/continuar` is a **publish return** (`isPublishNext`, next to `isContactNext` in `domain/contact-return.ts`): the header says «Publicar casa», the return card says «Después seguimos con su casa», and after verifying it goes straight to `next` (no `/cuenta/lista`, like the contact return).
5. **`/publicar/continuar`** (private flow): reads `bnbtico-publicar-paso1`.
   - No stored answer → `/propietario/publicar`.
   - The account already has a resumable draft (`resumableQuery`) → the existing choice of `PublicarScreen` («Seguir con el borrador» / «Empezar otra»); «Empezar otra» applies the stored answer.
   - Otherwise: `createDraft()`, then save step 1 with `planStep(…, 1, { kind })`, clear the stored answer, and navigate to `/propietario/publicar/$id/2` («¿Dónde está su casa?»).
   - Errors (the 5-drafts cap, network) show in the screen with «Intentar de nuevo»; the stored answer is kept until a draft exists.
6. **After «Enviar a revisión»**: if the account has no email and the owner did not skip it before (localStorage `bnbtico-correo-omitido`), **`/propietario/casas/$id/correo`** «¿Quiere añadir un correo?» comes before «Enviada»: one email field («Para recuperar su cuenta si pierde el acceso a su WhatsApp. Opcional.»), «Guardar correo» (filled; `updateProfile`, same validation as Mi perfil) and «Ahora no» (text; sets the skip flag). Both continue to `/propietario/casas/$id/enviada`. This applies to every first submit, from the portada or not.

### 4. Registration asks «¿Tiene una casa para alquilar?»

`/cuenta/lista` (`ListaScreen`, shown after the code of a **new** account when `next` is not a contact or publish return) changes:

- Title «¡Listo! Su cuenta está creada», then **«¿Tiene una casa para alquilar?»** with «Sí, quiero publicarla» (filled → `/propietario/publicar`) and «No, busco casa» (outline → `next` or `/explorar`).
- The email invitation becomes a text link below, «Añadir un correo de recuperación» (→ `/cuenta?editar=1`), shown only without email. The screen now shows also when the account has an email (today it is skipped then).
- Accounts created through `/publicar` never see it (they come back through `next`).

### 5. Portada: the owner button follows `LAUNCHED`

- The worker already reads `portada.html` at serve time (`src/server/app.ts`, `landing()`). Add a pure rule in `src/domain/portada.ts`: `ownerCtaTarget({ landingOnly }) → "whatsapp" | "wizard"`.
  - `landingOnly(env)` true (production while `LAUNCHED` ≠ `"true"`): the portada keeps the build-time WhatsApp button (C1) or the «Abrimos pronto…» sentence.
  - Otherwise (pruebas, local, and production after launch through `/?pronto=1`): the worker rewrites the `<!--cta-propietarios-->` block (`HTMLRewriter` on the `soon-cta` anchor, or the same string replacement as `withOwnerCta`) into `<a class="soon-cta" href="/publicar">Publicar mi casa</a>`.
- The portada keeps no JS; the CSP of the portada is unchanged (the link is same-origin).
- `docs/antes-de-produccion.md`: «el día del lanzamiento, comprobar que "Publicar mi casa" de la portada abre el asistente».

### 6. One draft item in Mis casas

Owned by B (`.scratch/densidad-y-tarjetas/spec.md` §3): the draft card with «Seguir publicando» and «Descartar», and no notice card above it. E only removes what fed the old card: `missingPhotosLabel` and the «Faltan N fotos» stage line.

## Data

New migration `publicar_v2`:

- `create or replace function public.submit_listing(p_listing uuid)`: copy of the latest definition with the three rule changes of §1–2 (photos 0–15, description optional, name 5–32). Messages: «El nombre de la casa debe tener entre 5 y 32 caracteres.», «La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.»
- `create or replace function public.review_listing(…)`: copy of the latest definition with `n_photos < 1` → «Para aprobarla hace falta al menos una foto.»
- No table changes. `listings.description` already defaults to `''`.
- Telemetry: `wizard_step` already exists; add the event `publish_verify` (no listing) to `events_name_check` and `domain/telemetry.ts`, sent when `/publicar/verificar` is shown, to measure the drop between step 1 and verification.

Domain and fake: `validateStep`, `validateAll`, `resumeStep`, `TITLE_MAX`, `MIN_PHOTOS_TO_APPROVE`, `submitListing` and `reviewListing` of `data/fake/` with the same rules; `isPublishNext`, `PUBLISH_STEP1_KEY`, `readStep1`/`storeStep1` (pure, in `domain/contact-return.ts` or a new `domain/publish-return.ts`).

## Testing (test first)

- **DB (`tests/db/publicar-v2.test.ts`; update `nombre-descripcion.test.ts`, `cliente-directo-fotos.test.ts`):**
  - `submit_listing` accepts 0 photos and an empty description; refuses a 79-character description, a 33-character name, 16 photos.
  - `review_listing approve` with 0 photos raises; with 1 photo it publishes.
- **Contract suite** (`publish.contract.ts`): the same rules on PostgREST and the fake.
- **Vitest:** `validateStep(6)` with empty and short descriptions; `validateAll` with 0 photos; `resumeStep` skipping photos; `ownerCtaTarget`; `isPublishNext`; `readStep1` with a valid, expired and malformed value.
- **Worker unit test** (`tests/unit/worker.test.ts`): `/?pronto=1` outside production renders the `/publicar` link; production with `LAUNCHED` unset keeps the WhatsApp link.
- **Playwright** (mobile viewport):
  1. Signed out, portada (`/?pronto=1`) → «Publicar mi casa» → step 1 → «Habitación» → «Continuar» → verification screen → name, number, code 123456 → lands on «¿Dónde está su casa?» of a new draft whose kind is Habitación; the stored answer is gone.
  2. Same, but the account already has a draft: the choice screen appears; «Empezar otra» creates a second draft with the stored kind.
  3. A draft with no photos and no description is sent; the email screen appears (account without email); «Ahora no» → «Enviada»; a second submit does not show it again.
  4. Admin opens it: «Aprobar y publicar» disabled, note prefilled; «Pedir cambios» → the owner sees «Para publicarla necesitamos al menos una foto de la casa.»
  5. The name field stops at 32 characters and shows «32 / 32».
  6. New account from Ingresar (no `next`): «¿Tiene una casa para alquilar?» → «Sí, quiero publicarla» opens the wizard; another account → «No, busco casa» → Explorar.
- **Gates:** `size-limit` — the publish chunk is at 14.94 of 15 KB: `/publicar` and `/publicar/verificar` go in a new deferred chunk `publicar-entrada-*.js` with its own entry (5 KB) and `SignInForm` is shared with `cuenta-*.js` (measured in «Pantallas de las pestañas»); no limit is raised.

## Documentation (same day)

- `docs/decisiones.md`: send without photos/description, approve with ≥ 1 photo and the canned message, name 5–32, verification after step 1 with the answer on the phone, optional email after submit, the registration question, the portada button tied to `LAUNCHED`.
- `docs/diseno-v1.md`: steps 6–7 and 9, «Enviada», Ingresar/Código, the registration screen.
- `docs/publicacion.md`: the new minimums.
- `CLAUDE.md`: the «WhatsApp verificado … obligatorio para publicar» line notes that it is asked after step 1.
- `docs/antes-de-produccion.md`: the launch-day check of §5.
- `docs/telemetria.md`: `publish_verify` and the funnel step 1 → verification → step 2.

## Out of scope

- Uploading photos before verifying (photos need a draft, which needs an account).
- Keeping more than step 1 on the phone.
- Passkeys (after launch, decisions file).
- Changing the 5-drafts cap.
- The owner landing (`design/pantallas/32-landing-propietarios-movil.html`, `33-landing-propietarios-escritorio.html`) as a page of its own.
