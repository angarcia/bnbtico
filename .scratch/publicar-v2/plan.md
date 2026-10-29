# Publicar v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Owners can send a house to review without photos and without a description (the admin approves only with ≥ 1 photo), house names are 5–32 characters, a signed-out visitor starts the wizard from the portada and verifies WhatsApp only after step 1, an optional email screen follows the first submit, and a new account is asked «¿Tiene una casa para alquilar?».

**Architecture:** The rules live once in `src/domain/listing.ts` / `src/domain/review.ts`, are mirrored by a new migration `publicar_v2` (`submit_listing`, `review_listing`, and D's `submit_edit`/`review_edit` if they hard-code the name length) and by the fake, and are pinned by the contract suite. The signed-out entry (`/publicar`, `/publicar/verificar`, `/publicar/continuar`) and the optional email screen live in a new deferred chunk `publicar-entrada-*.js`, reusing the sign-in form exported from `screens/cuenta.tsx` and small wizard parts extracted from `publish/fields.tsx`; the step-1 answer waits on the phone in localStorage. The worker rewrites the portada's owner block to a `/publicar` link whenever `landingOnly(env)` is false.

**Tech Stack:** Vite + React 19 + TanStack Router/Query, TypeScript strict, zod/mini, Supabase Postgres (plpgsql RPCs, RLS), Hono worker on Cloudflare Workers, Vitest (unit, db, contract), Playwright (mobile viewport), size-limit, Lighthouse.

**Spec:** `/Users/daguadomunoz/tmp_worskpace/casa-tica/.scratch/publicar-v2/spec.md` (authority: `.scratch/ronda-ana-2026-10-28/decisiones.md` §E). Runs **fourth**: after `densidad-y-tarjetas` (B+C), `explorar-airbnb` (A) and `editar-casa` (D); before `cuenta-y-actividad` (F+G).

All commands run from `/Users/daguadomunoz/tmp_worskpace/casa-tica/apps/app` unless they say otherwise; `pnpm db:reset` runs from the repo root. e2e: `VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm build && … pnpm test:e2e --workers=1 <spec>` (abbreviated below as `E2E <spec>`).

## Global Constraints

- UI copy in Spanish de Costa Rica, **usted**, no voseo/tuteo.
- Exact strings (pinned; use these byte for byte):
  - Name error: «El nombre de la casa debe tener entre 5 y 32 caracteres.» · empty name: «Póngale un nombre a la casa.»
  - Description error: «La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.»
  - Step 6 label «Descripción (opcional)», help «Puede añadirla después».
  - Step 7 help «Puede enviarla sin fotos; para publicarla necesitamos al menos una.»
  - Step 9 rows: «Fotos» → «Ninguna todavía» / «1 foto» / «N fotos»; «Nombre» → `«<title>»`, with « · sin descripción» appended when the description is empty.
  - Admin-facing approve refusal: «Para aprobarla hace falta al menos una foto.»
  - Owner-facing canned note: «Para publicarla necesitamos al menos una foto de la casa.»
  - Admin note at 0 photos: «Sin fotos: solo puede pedir cambios.» (arena, never ocre)
  - Verification title «Para guardar su casa, verifique su WhatsApp», line «Le enviamos un código por WhatsApp. Así nadie más puede publicar en su nombre.»
  - Code screen header «Publicar casa», return note «Después seguimos con su casa».
  - Email screen title «¿Quiere añadir un correo?», help «Para recuperar su cuenta si pierde el acceso a su WhatsApp. Opcional.», buttons «Guardar correo» (filled) and «Ahora no» (text).
  - Registration: «¡Listo! Su cuenta está creada», «¿Tiene una casa para alquilar?», «Sí, quiero publicarla» (filled), «No, busco casa» (outline), link «Añadir un correo de recuperación».
  - Portada link: `<a class="soon-cta" href="/publicar">Publicar mi casa</a>`.
  - Errors on `/publicar/continuar`: button «Intentar de nuevo».
- Constants: `TITLE_MIN = 5`, `TITLE_MAX = 32`, `DESCRIPTION_MIN = 80`, `DESCRIPTION_MAX = 2000`, `MIN_PHOTOS_TO_APPROVE = 1`, `MAX_PHOTOS = 15`; `PUBLISH_STEP1_KEY = "bnbtico-publicar-paso1"`, `PUBLISH_STEP1_TTL_MS = 604_800_000` (7 days), `EMAIL_SKIPPED_KEY = "bnbtico-correo-omitido"`, `PUBLISH_NEXT = "/publicar/continuar"`.
- Size: **never raise an existing limit; new deferred chunks get their own new size-limit entry.** New entry «Entrada de publicar» 5 KB. Every new chunk file name is excluded from the «Zona privada · JS inicial» entry and measured in exactly one entry.
- No `style={…}` in JSX; no `dangerouslySetInnerHTML`; no raw HTML APIs (architecture test).
- CSP `script-src 'self'` unchanged; the portada stays without JS and keeps its own CSP.
- `src/domain/` imports only `zod`/`zod/mini` and its own modules.
- PostgREST strings only in `src/data/postgrest/`.
- Migrations: `pnpm exec supabase migration new publicar_v2 < /dev/null` (repo root); never edit an older migration; then `pnpm db:reset` and `pnpm db:types`.
- New RPCs/tables get policies + contract/db tests before screens (this plan adds none; it redefines two/four functions).
- Any `UPDATE` of `listings` inside a migration needs `select set_config('app.allow_status','on',true)` first (this plan has none; if one is added, it needs it).
- Commits: Spanish, imperative, **no co-author line**, one per task with tests green; test first; **no push**.

## Review Focus

1. **Chunk globs.** `"dist/client/assets/publicar-*.js"` (publish entry) also matches `publicar-entrada-*.js`, and any new shared chunk (`wizard-parts-*`, `publish-return-*`) silently lands in the 150 KB initial entry because that entry is `*.js` minus exclusions. Test: Task 8, step «chunk audit» (build, list chunks, `pnpm size --json`, assert every new chunk is excluded from the initial entry and counted once).
2. **Portada markers.** `withOwnerCta` replaces the whole `<!--cta-propietarios-->…<!--/cta-propietarios-->` block, markers included; with `VITE_WA_OWNERS` set the worker's rewrite would find nothing and pruebas would keep the WhatsApp button. Test: Task 10, unit test chaining `withWizardCta(withOwnerCta(html, "+506 6000 0000"))` → contains `href="/publicar"`, and the worker test with that HTML.
3. **Double draft / lost answer on `/publicar/continuar`.** React StrictMode double effects, a reload mid-creation, or clearing the stored answer before the draft exists would create two drafts or lose the kind. Test: Task 8 e2e 1 counts the owner's drafts (exactly 1, kind `habitacion`) and asserts the key is gone only after landing on step 2; unit test of `readStep1` (valid, expired, malformed).
4. **Message drift between domain, fake, SQL — and D's edit RPCs.** The contract suite compares messages to domain constants; D's `submit_edit`/`review_edit` may still accept 33–60 character names. Test: Task 2 (db: `submit_edit` refuses 33 characters when D's RPC exists) and Task 3 (contract: exact `TITLE_LENGTH_ERROR`, `DESCRIPTION_LENGTH_ERROR`, `REVIEW_MESSAGES.fewPhotos` on fake and PostgREST).
5. **Code-screen routing.** Removing `!account.email` from the «¡Listo!» condition could send contact returns or publish returns through `/cuenta/lista`, or send a new account with an email past the question. Test: Task 7 e2e (new account without `next` → question; with `next=/publicar/continuar` → never sees «¡Listo!»), and the existing `contacto-cuenta.spec.ts` «salta ¡Listo! hacia la ficha» kept green.

## File Structure

New:
- `supabase/migrations/<ts>_publicar_v2.sql` — `submit_listing`, `review_listing` (and D's `submit_edit`/`review_edit` if needed), `events_name_check` with `publish_verify`.
- `apps/app/src/domain/publish-return.ts` — step-1 storage and the email-screen rule (pure).
- `apps/app/src/client/publish/wizard-parts.tsx` — `ChoiceCards`, `KindChoice`, `ReadyList`, `StageLabel` (moved out of `fields.tsx` / `screens/publicar.tsx`).
- `apps/app/src/client/screens/publicar-entrada.tsx` — `PublicarEntradaScreen` (`/publicar`), `VerificarScreen` (`/publicar/verificar`), `ContinuarScreen` (`/publicar/continuar`), `CorreoScreen` (`/propietario/casas/$id/correo`).
- `apps/app/tests/db/publicar-v2.test.ts`, `apps/app/tests/unit/publish-return.test.ts`, `apps/app/tests/e2e/publicar-v2.spec.ts`.

Modified (main ones): `src/domain/listing.ts`, `src/domain/review.ts`, `src/domain/contact-return.ts`, `src/domain/telemetry.ts`, `src/domain/portada.ts`, `src/data/fake/owner.ts`, `src/data/fake/admin.ts`, `src/client/publish/fields.tsx`, `src/client/publish/photos.tsx`, `src/client/publish/step-form.tsx`, `src/client/screens/publicar.tsx`, `src/client/screens/cuenta.tsx`, `src/client/screens/admin.tsx`, `src/client/screens/propietario.tsx` (leftovers only), `src/shared/listing-page.tsx`, `src/client/shell.tsx`, `src/server/app.ts`, `vite.config.ts` (none expected; the plugin keeps calling `withOwnerCta`), `.size-limit.json`, tests listed per task, docs.

---

### Task 0: Pre-flight (record, change nothing)

**Files:** none modified. Write the answers in the task's checklist (or the executor's notes) for later tasks.

- [ ] **0.1 Latest function definitions.** From the repo root:
  `grep -l "function public.submit_listing" supabase/migrations/* | tail -1`, same for `review_listing`, `submit_edit`, `review_edit`, `save_edit`, and `grep -l "events_name_check" supabase/migrations/* | tail -1`. Record each file. After `pnpm db:reset`, dump the live bodies:
  `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -Atc "select pg_get_functiondef('public.submit_listing(uuid)'::regprocedure)"` (and `review_listing(uuid,text,text)`, `submit_edit(uuid)`, `review_edit(uuid,text,text)`). Task 2 copies **these** bodies, not the ones quoted in the spec.
- [ ] **0.2 Name rule inside D.** In D's migration (`*_editar_casa_publicada.sql`), grep `between 5 and 60`, `60 caracteres`, and any helper (e.g. `listing_title_error`, `validate_listing`). Record: (a) does `submit_edit` and/or `review_edit` hard-code 60? (b) is there a shared SQL helper? If a helper exists, Task 2 redefines only the helper.
- [ ] **0.3 Event names.** Record the current `events_name_check` list (A adds `search_submit`, `explore_map_open`, `map_marker_tap`) and the `name: z.enum([...])` / `NO_LISTING` set in `src/domain/telemetry.ts`.
- [ ] **0.4 Domain leftovers after B and D.** `grep -rn "MIN_PHOTOS\|missingPhotosLabel\|photosMissing\|ResumeCard\|reopenForEdit" apps/app/src apps/app/tests`. Record every remaining use (B removes `ResumeCard`; D removes `reopenForEdit`, and `tests/db/nombre-descripcion.test.ts` may already be rewritten). Record whether D's photo editor already changed the step-7 counter in `client/publish/photos.tsx` to «N de 15».
- [ ] **0.5 Admin screen after B/D.** In `client/screens/admin.tsx` `ReviewForm`: record the class of the «Faltan fotos» note (`note-sun` or B's arena class name) and whether D moved `ReviewForm`/`RevisarScreen`. Record the arena note class B introduced (e.g. `note-arena`).
- [ ] **0.6 Sizes.** `VITE_WA_GUESTS="+506 6000 0000" pnpm build && pnpm size`. Record each entry's current size vs limit, especially «Asistente de publicar» (spec: 14.94/15 KB), «Pantallas de las pestañas» (24.5 KB), «Zona del admin» (12 KB), and whether D added an `editar-*.js` entry. `ls dist/client/assets/*.js | sed 's/-[A-Za-z0-9_-]\{8\}\.js$//' | sort -u` → record the chunk name list (baseline for Task 8's audit).
- [ ] **0.7 Routes and names.** In `client/shell.tsx` record: the `flow`/`privateFlow` ids, D's new routes (`/propietario/casas/$id/editar/$campo`), and the `CuentaScreenName` union. In `client/screens/cuenta.tsx` record whether F+G (not yet run) or anyone renamed `EntryForm`, `CodeForm`, `ListaScreen`, `ReturnCard`, `useContactMode`. In `domain/navigation.ts` record B's `cardLabel` for drafts (E must not touch it).
- [ ] **0.8 Manual-test numbering.** Record the next free «U» number in `docs/pruebas-manuales-revision-ux.md` and the top entry date of `docs/decisiones.md`.
- [ ] **0.9 Green baseline.** `pnpm typecheck && pnpm test && pnpm test:db` all pass before starting. If not, stop and report.

No commit.

---

### Task 1: Domain rules — send without photos/description, name 5–32, approve with 1 photo

**Files:** `src/domain/listing.ts`, `src/domain/review.ts`, `tests/unit/listing.test.ts`, `tests/unit/review.test.ts`.

**Interfaces:**
```ts
// listing.ts
export const TITLE_MIN = 5;
export const TITLE_MAX = 32;
export const DESCRIPTION_MIN = 80;
export const DESCRIPTION_MAX = 2000;
export const MIN_PHOTOS_TO_APPROVE = 1;           // replaces MIN_PHOTOS (deleted)
export const TITLE_LENGTH_ERROR = `El nombre de la casa debe tener entre ${TITLE_MIN} y ${TITLE_MAX} caracteres.`;
export const TITLE_EMPTY_ERROR = "Póngale un nombre a la casa.";
export const DESCRIPTION_LENGTH_ERROR = `La descripción debe tener entre ${DESCRIPTION_MIN} y ${DESCRIPTION_MAX} caracteres o quedar vacía.`;
// validateStep(6): empty title → TITLE_EMPTY_ERROR; title out of 5..32 → TITLE_LENGTH_ERROR;
//   description: charCount === 0 passes; else out of 80..2000 → DESCRIPTION_LENGTH_ERROR.
// validateStep(7): only > MAX_PHOTOS → "Máximo 15 fotos."
// validateAll(d): validateStep over STEPS, nothing extra (photosMissing deleted).
// resumeStep(d): unchanged body; never stops at 7 for photos.
// Deleted: MIN_PHOTOS, photosMissing, missingPhotosLabel.
// review.ts
REVIEW_MESSAGES.fewPhotos = "Para aprobarla hace falta al menos una foto.";
export const NO_PHOTOS_NOTE = "Para publicarla necesitamos al menos una foto de la casa.";
```

- [ ] **Failing tests** in `tests/unit/listing.test.ts` (replace the old 5-photo/60-char expectations at l.196–199, 302, 350):
  ```ts
  it("paso 6: la descripción es opcional; si se escribe, de 80 a 2000", () => {
    const d = validDraft();
    expect(validateStep(6, { ...d, description: "" })).toBeNull();
    expect(validateStep(6, { ...d, description: "   " })).toBeNull();
    expect(validateStep(6, { ...d, description: "a".repeat(79) })).toBe("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
    expect(validateStep(6, { ...d, description: "a".repeat(80) })).toBeNull();
    expect(validateStep(6, { ...d, description: "a".repeat(2001) })).toBe(DESCRIPTION_LENGTH_ERROR);
  });
  it("paso 6: nombre de 5 a 32 caracteres", () => {
    expect(validateStep(6, { ...validDraft(), title: "" })).toBe("Póngale un nombre a la casa.");
    expect(validateStep(6, { ...validDraft(), title: "Casa" })).toBe("El nombre de la casa debe tener entre 5 y 32 caracteres.");
    expect(validateStep(6, { ...validDraft(), title: "a".repeat(32) })).toBeNull();
    expect(validateStep(6, { ...validDraft(), title: "a".repeat(33) })).toBe(TITLE_LENGTH_ERROR);
  });
  it("sin fotos y sin descripción se puede enviar; más de 15, no", () => {
    expect(validateAll({ ...validDraft(), photoCount: 0, description: "" })).toBeNull();
    expect(validateAll({ ...validDraft(), photoCount: 16 })).toEqual({ step: 7, error: "Máximo 15 fotos." });
    expect(resumeStep({ ...validDraft(), photoCount: 0 })).toBe(9);
  });
  it("aprobar pide al menos una foto", () => expect(MIN_PHOTOS_TO_APPROVE).toBe(1));
  ```
  In `tests/unit/review.test.ts`: `expect(REVIEW_MESSAGES.fewPhotos).toBe("Para aprobarla hace falta al menos una foto.")` and `expect(NO_PHOTOS_NOTE).toBe("Para publicarla necesitamos al menos una foto de la casa.")`. Make sure `validDraft()` has a title ≤ 32 characters (fix the fixture if not).
- [ ] Run `pnpm test -- tests/unit/listing.test.ts tests/unit/review.test.ts` → FAIL (old values).
- [ ] Implement the interfaces above. Delete `MIN_PHOTOS`, `photosMissing`, `missingPhotosLabel`. Update the comments (C4 note at l.256 and l.276) to say photos are not required to send.
- [ ] `pnpm typecheck` now fails at every leftover import recorded in 0.4 (`data/fake/owner.ts`, `data/fake/admin.ts`, `client/publish/fields.tsx`, `client/publish/photos.tsx`, `client/screens/admin.tsx`, any B/D leftover). Make it compile **minimally** here: fake → `MIN_PHOTOS_TO_APPROVE` / no send minimum (full rules in Task 3); UI → remove the `missing` computations (UI copy lands in Task 4/5). No visual work in this task.
- [ ] Run `pnpm test` and `pnpm typecheck` → PASS (contract-fake tests that still expect «Agregue al menos 5 fotos.» are updated in Task 3; if they fail here, mark them `.todo` is **not** allowed — instead do Task 3's fake edits now and keep Task 3 for the contract assertions).
- [ ] Commit `apps/app/src/domain/listing.ts apps/app/src/domain/review.ts apps/app/tests/unit/listing.test.ts apps/app/tests/unit/review.test.ts` + the compile fixes: «Permite enviar sin fotos ni descripción y limita el nombre a 32 caracteres en el dominio».

---

### Task 2: Migration `publicar_v2`

**Files:** `supabase/migrations/<ts>_publicar_v2.sql` (new), `apps/app/tests/db/publicar-v2.test.ts` (new), `apps/app/tests/db/nombre-descripcion.test.ts`, `apps/app/tests/db/cliente-directo-fotos.test.ts` (only if it asserts the 5-photo send rule), `apps/app/src/domain/database.types.ts` (regenerated).

**Interfaces (SQL; bodies copied from Task 0.1's live definitions, only these lines change):**
```sql
-- submit_listing(p_listing uuid) returns listing_status
--   replace: if coalesce(l.title,'') = '' or coalesce(l.description,'') = '' then raise 'Complete el nombre…'
if btrim(coalesce(l.title, '')) = '' then raise exception 'Póngale un nombre a la casa.'; end if;
if char_length(btrim(l.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
if btrim(coalesce(l.description, '')) <> '' and char_length(btrim(l.description)) not between 80 and 2000 then
  raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.';
end if;
--   delete: if n_photos < 5 then raise exception 'Agregue al menos 5 fotos.'; end if;
--   keep:   if n_photos > 15 then raise exception 'Máximo 15 fotos.'; end if;
-- review_listing(p_listing uuid, p_decision text, p_note text) returns listing_status
if n_photos < 1 then raise exception 'Para aprobarla hace falta al menos una foto.'; end if;
-- If Task 0.2 found 60 hard-coded in submit_edit / review_edit (or a shared helper): redefine them with 5..32 and the
--   same message. Keep D's `listing_edits.title` table check (5..60) as is: the RPCs are the rule.
-- events: drop + add events_name_check with Task 0.3's list plus 'publish_verify'.
```
Keep `security definer`, `search_path`, grants and ownership exactly as in the copied definitions (`create or replace` keeps grants; re-state `revoke … from public, anon` / `grant execute … to authenticated` if the source migration did).

- [ ] **Failing test** `tests/db/publicar-v2.test.ts` (pattern of `nombre-descripcion.test.ts`: `postgrestHarness()`, `h.reset()`, `h.seed`, `sql`):
  ```ts
  it("envía sin fotos y sin descripción", async () => {
    const s = await h.seed({ status: "draft", photos: 0, draft: { description: "" } });
    expect(await h.owner("owner").submit(s.id)).toBeUndefined();
    expect((await h.owner("owner").getOwn(s.id))?.status).toBe("review");
  });
  it("rechaza descripción de 79, nombre de 33 y nombre vacío", async () => { /* seeds with photos: 0 */
    // description "a".repeat(79) → "La descripción debe tener entre 80 y 2000 caracteres o quedar vacía."
    // title "a".repeat(33)      → "El nombre de la casa debe tener entre 5 y 32 caracteres."
    // title "   "               → "Póngale un nombre a la casa."
  });
  it("15 fotos se envían; la 16.ª no llega a guardarse", async () => {
    const s = await h.seed({ status: "draft", photos: 15 });
    await expect(h.addPhotos(s.id, 1)).rejects.toThrow("Máximo 15 fotos.");
    expect(await h.owner("owner").submit(s.id)).toBeUndefined();
  });
  it("aprobar sin fotos falla; con una, publica", async () => {
    const none = await h.seed({ status: "review", photos: 0 });
    await expect(h.admin("aal2").review(none.id, "approve", "")).rejects.toThrow("Para aprobarla hace falta al menos una foto.");
    const one = await h.seed({ status: "review", photos: 1 });
    expect(await h.admin("aal2").review(one.id, "approve", "")).toBeUndefined(); // or the adapter's return; match admin.contract
    expect((await h.anon.getPublic(one.publicId))?.photos).toHaveLength(1);
  });
  it("acepta el evento publish_verify sin casa", () => {
    expect(() => sql(`insert into events (name, path) values ('publish_verify', '/publicar/verificar')`)).not.toThrow(); // match the columns of tests/db/telemetria.test.ts
  });
  // Only if Task 0.2 (a) is yes:
  it("una edición con un nombre de 33 caracteres no se envía", async () => { /* active house, saveEdit({ title: "a".repeat(33) }) → submitEdit rejects with TITLE_LENGTH_ERROR */ });
  ```
  Update `nombre-descripcion.test.ts`: the 60-character case becomes 32 («…entre 5 y 32 caracteres.») and the description cases expect «…o quedar vacía.»; add «descripción vacía pasa». If D already rewrote it without `reopenForEdit`, follow D's structure.
- [ ] Run `pnpm test:db -- tests/db/publicar-v2.test.ts tests/db/nombre-descripcion.test.ts` → FAIL.
- [ ] From the repo root: `pnpm exec supabase migration new publicar_v2 < /dev/null`; write the file; `pnpm db:reset`; in `apps/app`: `pnpm db:types` (expect no diff or only comments; commit whatever it produces).
- [ ] Run `pnpm test:db` (whole project) → PASS, except contract-PostgREST expectations updated in Task 3 (run Task 3 before committing if they fail; commit both together in that case).
- [ ] Commit `supabase/migrations/<ts>_publicar_v2.sql apps/app/tests/db/publicar-v2.test.ts apps/app/tests/db/nombre-descripcion.test.ts apps/app/src/domain/database.types.ts`: «Envía a revisión sin fotos ni descripción y aprueba con al menos una foto en la base».

---

### Task 3: Fake and contract suite

**Files:** `src/data/fake/owner.ts` (`submitRefusal`), `src/data/fake/admin.ts` (`review`), D's fake edit validation if it uses `TITLE_MAX` (nothing to do: the constant moved), `tests/contract/publish.contract.ts`, `tests/contract/admin.contract.ts`, `tests/unit/errors-rows.test.ts` (sample message only if it must be a real one; it may stay).

**Interfaces:**
```ts
// submitRefusal(l, photos): same order as SQL:
//   … if (!l.title.trim()) return TITLE_EMPTY_ERROR;
//   if (!between(charCount(l.title), TITLE_MIN, TITLE_MAX)) return TITLE_LENGTH_ERROR;
//   if (charCount(l.description) > 0 && !between(charCount(l.description), DESCRIPTION_MIN, DESCRIPTION_MAX)) return DESCRIPTION_LENGTH_ERROR;
//   … if (photos > MAX_PHOTOS) return `Máximo ${MAX_PHOTOS} fotos.`;  (no minimum)
// fake admin review: decision === "approve" && db.photosOf(id).length < MIN_PHOTOS_TO_APPROVE → DomainError(M.fewPhotos, "validation")
```

- [ ] **Failing contract tests** (`publish.contract.ts` «enviar a revisión»): replace `fewPhotos` (4 photos) by `noPhotos = seed({ status: "draft", photos: 0, draft: { description: "" } })` and assert `await me.submit(s.noPhotos.id)` resolves and status is `review`; the «nombre de 5 a 60» test becomes «nombre de 5 a 32 y descripción vacía o de 80 a 2000» with `"a".repeat(33)` → `TITLE_LENGTH_ERROR`, `"a".repeat(79)` → `DESCRIPTION_LENGTH_ERROR`, `""` → passes. Mind the five-drafts cap (seed inside the test, as today). Remove the comment at l.75 about «el mínimo se exige al enviar».
  `admin.contract.ts` l.98–113: title «… sin fotos, inexistente»; `few = seed({ status: "review", photos: 0 })` → approve rejects with `REVIEW_MESSAGES.fewPhotos`; then `admin.review(few.id, "changes", NO_PHOTOS_NOTE)` and `(await h.owner("owner").getOwn(few.id))?.reviewNote` equals `NO_PHOTOS_NOTE`; add `one = seed({ status: "review", photos: 1 })` approves to `active`.
- [ ] Run `pnpm test -- tests/unit/contract-publish-fake.test.ts tests/unit/contract-admin-fake.test.ts` and `pnpm test:db -- tests/db/contract-publish-postgrest.test.ts tests/db/contract-admin-postgrest.test.ts` → fake FAIL (PostgREST passes after Task 2).
- [ ] Implement the fake changes.
- [ ] Run the four commands again → PASS; then `pnpm test` and `pnpm test:db` → PASS.
- [ ] Commit `apps/app/src/data/fake/owner.ts apps/app/src/data/fake/admin.ts apps/app/tests/contract/publish.contract.ts apps/app/tests/contract/admin.contract.ts`: «Aplica en el fake y en el contrato las reglas nuevas de envío y aprobación».

---

### Task 4: Wizard steps 6, 7 and 9, the ficha without description

**Files:** `src/client/publish/fields.tsx` (`TitleField`, `DescriptionField`, `SendSummary`, `ReadyList` copy), `src/client/publish/photos.tsx` (counter and help), `src/shared/listing-page.tsx`, `src/client/screens/propietario.tsx` (only Task 0.4 leftovers), `tests/e2e/publicar.spec.ts`, `tests/e2e/fotos.spec.ts`, `tests/unit/worker.test.ts`.

**Decisions pinned:**
- `TitleField`: `maxLength={TITLE_MAX}` (32), `CharCount` shows «n / 32 · mínimo 5» (existing format).
- `DescriptionField`: label «Descripción (opcional)»; at `n === 0` the right side shows «Puede añadirla después» (`xs muted`, id `pub-description-count`); `0 < n < 80` keeps «Faltan N caracteres»; `n ≥ 80` the counter.
- Step 7 (`PhotosStep`): counter «{n} de 15» (class `primary`, no `is-short`); when `photos.length === 0` the line «Puede enviarla sin fotos; para publicarla necesitamos al menos una.» (`small muted photos-help`) replaces «Faltan N fotos · puede añadirlas al final». If D already changed the counter (0.4), keep D's.
- Step 9 (`SendSummary`): rows Alojamiento (1) · Dónde (2) · Capacidad (4) · Nombre (6: `«title»`, plus « · sin descripción» when empty; «Sin nombre» when empty) · Fotos (7: «Ninguna todavía» / «1 foto» / «N fotos») · Precio (8). No `warn`; `missing` removed. Must still fit 375×667 without scroll (existing `expectNoScroll`); if it does not, tighten `.review-row` vertical padding in `global.css` by 2 px, nothing else.
- `ReadyList`: «Fotos horizontales, si ya las tiene» · «El precio por noche» · «Unos 10 minutos» (no «5 fotos»).
- `ListingPage`: render `<p className="listing-description">` only when `l.description.trim()`; no heading appears in its place. The admin `RevisarScreen` description card shows «Sin descripción» (`small muted`) when empty (Task 5).

- [ ] **Failing tests:**
  - `tests/unit/worker.test.ts`: seed an active house with `draft: { description: "" }` and `photos: 1`; the SSR HTML has no `class="listing-description"` and no `1 / 1` counter.
  - `tests/e2e/publicar.spec.ts` (new tests, existing setup): (a) «nombre: se detiene en 32 y muestra 32 / 32» — on step 6 type `"a".repeat(40)` into «Nombre de la casa», expect `toHaveValue("a".repeat(32))` and `#pub-title-count` to contain «32 / 32»; (b) «envía sin fotos ni descripción» — fill steps 1–5, step 6 only the name, «Continuar» on an empty step 7 shows «Puede enviarla sin fotos; para publicarla necesitamos al menos una.» and «0 de 15», step 8 price, step 9 shows «Ninguna todavía» and « · sin descripción», «Enviar a revisión» lands on `/enviada` (Task 9 inserts the email screen; set `profiles.email` for `owner` in this test with `sql` so the email screen does not appear, and reset it in `finally`). Update the existing eight-screens test's step-7/9 assertions.
  - `tests/e2e/fotos.spec.ts` l.47/53: replace «Faltan 5 fotos · puede añadirlas al final» with the new help line at 0 photos and expect it hidden after the first upload.
- [ ] Run `pnpm test -- tests/unit/worker.test.ts` → FAIL; `E2E publicar.spec.ts fotos.spec.ts` → FAIL.
- [ ] Implement.
- [ ] Run again → PASS. `pnpm typecheck && pnpm test` → PASS.
- [ ] Commit the files above: «Ajusta el asistente y la ficha para casas sin fotos ni descripción y nombres de 32 caracteres».

---

### Task 5: Admin review with zero photos

**Files:** `src/client/screens/admin.tsx` (`ReviewForm`, description card in `RevisarScreen`), `tests/e2e/admin.spec.ts` (or a new test in `tests/e2e/publicar-v2.spec.ts` — keep admin flows with the existing admin helpers `secondCode`).

**Decisions pinned:**
- `ReviewForm`: `const noPhotos = photos < MIN_PHOTOS_TO_APPROVE;` `useState(noPhotos ? NO_PHOTOS_NOTE : "")` for the note; «Aprobar y publicar» `disabled={noPhotos}`; note `<p className="note <arena class from 0.5> small">Sin fotos: solo puede pedir cambios.</p>` when `noPhotos`. «Pedir cambios» sends the (prefilled, editable) note.
- `RevisarScreen` description: `l.description.trim() ? <p …>{l.description}</p> : <p className="small muted">Sin descripción</p>`.

- [ ] **Failing e2e** «el admin no aprueba sin fotos y pide una con el mensaje»: seed `review` house with `photos: 0` for `owner`; admin session + `secondCode`; open `/admin/anuncios/<id>`; expect «Aprobar y publicar» disabled, `#admin-review-note` `toHaveValue(NO_PHOTOS_NOTE)`, «Sin fotos: solo puede pedir cambios.» visible; click «Pedir cambios»; owner session → `/propietario/casas` (or the house detail) shows «Para publicarla necesitamos al menos una foto de la casa.».
- [ ] Run `E2E admin.spec.ts` → FAIL.
- [ ] Implement.
- [ ] Run → PASS; `pnpm size` → «Zona del admin» still ≤ 12 KB.
- [ ] Commit `apps/app/src/client/screens/admin.tsx apps/app/tests/e2e/admin.spec.ts`: «Deja al admin pedir la primera foto con un mensaje ya escrito».

---

### Task 6: Publish-return rules and telemetry event (pure)

**Files:** `src/domain/publish-return.ts` (new), `src/domain/contact-return.ts`, `src/domain/telemetry.ts`, `tests/unit/publish-return.test.ts` (new), `tests/unit/contact-return.test.ts`, `tests/unit/telemetry.test.ts`.

**Interfaces:**
```ts
// contact-return.ts (already in the initial JS: no new chunk)
export const PUBLISH_NEXT = "/publicar/continuar";
export function isPublishNext(next: string | null | undefined): boolean; // safeNext(next) === PUBLISH_NEXT (query/hash not allowed)

// publish-return.ts (zod/mini only)
export const PUBLISH_STEP1_KEY = "bnbtico-publicar-paso1";
export const PUBLISH_STEP1_TTL_MS = 604_800_000;
export type Step1Kind = "completo" | "habitacion";
export function storeStep1(kind: Step1Kind, now: number): string;               // JSON.stringify({ kind, savedAt: now })
export function readStep1(raw: string | null, now: number): { kind: Step1Kind } | null; // null if missing, malformed, other kind, savedAt in the future, or now - savedAt > TTL
export const EMAIL_SKIPPED_KEY = "bnbtico-correo-omitido";
export function shouldAskEmail(account: { email: string | null } | undefined, skipped: string | null): boolean; // !!account && !account.email && skipped === null

// telemetry.ts
// events enum += "publish_verify"; NO_LISTING += "publish_verify"; pageType: "/publicar" and "/publicar/…" → "publicar"
```

- [ ] **Failing tests:**
  ```ts
  const NOW = 1_730_000_000_000;
  expect(readStep1(storeStep1("habitacion", NOW), NOW + 1000)).toEqual({ kind: "habitacion" });
  expect(readStep1(JSON.stringify({ kind: "habitacion", savedAt: NOW }), NOW + PUBLISH_STEP1_TTL_MS + 1)).toBeNull();
  expect(readStep1("{no es json", NOW)).toBeNull();
  expect(readStep1(JSON.stringify({ kind: "casa", savedAt: NOW }), NOW)).toBeNull();
  expect(readStep1(JSON.stringify({ kind: "completo" }), NOW)).toBeNull();
  expect(readStep1(null, NOW)).toBeNull();
  expect(isPublishNext("/publicar/continuar")).toBe(true);
  expect(isPublishNext("/publicar/continuar?x=1")).toBe(false);
  expect(isPublishNext("//evil.com/publicar/continuar")).toBe(false);
  expect(isPublishNext("/casa/CT-0001?contacto=1")).toBe(false);
  expect(shouldAskEmail({ email: null }, null)).toBe(true);
  expect(shouldAskEmail({ email: "a@b.cr" }, null)).toBe(false);
  expect(shouldAskEmail({ email: null }, "1")).toBe(false);
  expect(shouldAskEmail(undefined, null)).toBe(false);
  // telemetry.test.ts: parseEvent({ name: "publish_verify", path: "/publicar/verificar", build: "x" }) is ok without listing;
  // pageType("/publicar/verificar") === "publicar"
  ```
- [ ] Run `pnpm test -- tests/unit/publish-return.test.ts tests/unit/contact-return.test.ts tests/unit/telemetry.test.ts` → FAIL.
- [ ] Implement.
- [ ] Run → PASS; `pnpm test` (architecture test: domain imports) → PASS.
- [ ] Commit the five files: «Añade las reglas de la vuelta a publicar y el evento publish_verify».

---

### Task 7: Sign-in form shared; code screen and «¿Tiene una casa para alquilar?»

**Files:** `src/client/screens/cuenta.tsx` (`EntryForm` → `SignInForm`, `CodeForm`, `ListaScreen`, `ReturnCard`), `tests/e2e/cuenta.spec.ts`, `tests/e2e/contacto-cuenta.spec.ts` (keep green; adjust comments only), `tests/e2e/publicar-v2.spec.ts` (new file, registration tests).

**Interfaces:**
```tsx
/** Body of Ingresar (no header): phone first, name for a new number, Turnstile, «Recibir código por WhatsApp». */
export function SignInForm({ next, mode }: { next?: string; mode: "account" | "contact" | "publish" }): JSX.Element;
// EntryForm = <FlowHeader …/> + <SignInForm next={next} mode={isContactNext(next) ? "contact" : isPublishNext(next) ? "publish" : "account"} />
// mode "publish": title «Para guardar su casa, verifique su WhatsApp» (or «Es su primera vez en bnbtico» after needs-name),
//   intro «Le enviamos un código por WhatsApp. Así nadie más puede publicar en su nombre.», no ContactCard, no ReturnCard,
//   no shield note about sharing with the owner; «No tengo acceso a mi WhatsApp» stays. Submits to /cuenta/codigo?next=<next>.
// useContactMode(next) → also returns `publish: isPublishNext(next)`; header «Publicar casa» when publish.
// CodeForm after verify:
//   if (mode === "register" && !contact && !publish) navigate("/cuenta/lista", { next })
//   else goTo(next ?? (list.length ? "/propietario/casas" : "/explorar"))
// CodeForm with publish: instead of <ReturnCard>, <p className="note small">Después seguimos con su casa</p>.
// ListaScreen: if isContactNext(next) || isPublishNext(next) → <Replace href={next} /> (old links; keeps contacto-cuenta green).
//   Otherwise always shows (also with email): avatar check, «¡Listo! Su cuenta está creada», h3 «¿Tiene una casa para alquilar?»,
//   <Link to="/propietario/publicar" className="btn btn-primary btn-xl">Sí, quiero publicarla</Link>,
//   <a href={next ?? "/explorar"} className="btn btn-ghost btn-lg">No, busco casa</a> (router.navigate({ href })),
//   and, only without email, <Link to="/cuenta" search={{ editar: "1" }} className="link small">Añadir un correo de recuperación</Link>.
```
There is **no** «Ya tengo cuenta» toggle: the phone-first flow (ticket 18) already signs in existing numbers, and `cuenta.spec.ts` asserts that link does not exist.

- [ ] **Failing e2e** in `tests/e2e/publicar-v2.spec.ts`:
  - «una cuenta nueva desde Ingresar responde Sí y entra al asistente»: `deleteAccount(FREE_PHONE)`; `/explorar` → «Ingresar» → `8888 9999` → name «Ana Prueba» → `enterCode`; expect URL `/cuenta/lista`, headings «¡Listo! Su cuenta está creada» and «¿Tiene una casa para alquilar?», link «Añadir un correo de recuperación» visible; click «Sí, quiero publicarla» → URL `/propietario/publicar/<uuid>/1`. `finally deleteAccount(FREE_PHONE)`.
  - «otra cuenta nueva responde No y va a Explorar»: same with `INTL_PHONE` (country «Otro país», as in `cuenta.spec.ts` l.137) → «No, busco casa» → URL `/explorar`.
  - Update `cuenta.spec.ts` l.56–59: «Ahora no · continuar» → «No, busco casa».
- [ ] Run `E2E publicar-v2.spec.ts cuenta.spec.ts contacto-cuenta.spec.ts` → FAIL (new ones).
- [ ] Implement (pure refactor first: extract `SignInForm`, run `E2E cuenta.spec.ts contacto-cuenta.spec.ts` green, then the new behaviour).
- [ ] Run → PASS. `pnpm build && pnpm size`: «Pantallas de las pestañas» ≤ 24.5 KB. If it does not fit, move `SignInForm` and its helpers to `src/client/sign-in-form.tsx`, exclude `sign-in-form-*.js` from the initial entry and measure it in «Entrada de publicar» (created in Task 8; create the entry here if needed). Never raise 24.5 KB.
- [ ] Commit `apps/app/src/client/screens/cuenta.tsx apps/app/tests/e2e/publicar-v2.spec.ts apps/app/tests/e2e/cuenta.spec.ts` (+ `.size-limit.json`, `sign-in-form.tsx` if the fallback ran): «Pregunta por la casa al crear la cuenta y comparte el formulario de ingreso».

---

### Task 8: `/publicar` without account — step 1 on the phone, verification, continue

**Files:** `src/client/publish/wizard-parts.tsx` (new; `ChoiceCards`, `KindChoice`, `ReadyList`, `StageLabel` moved from `fields.tsx` and `screens/publicar.tsx`, which now import them), `src/client/screens/publicar-entrada.tsx` (new), `src/client/shell.tsx`, `.size-limit.json`, `tests/e2e/publicar-v2.spec.ts`.

**Interfaces:**
```tsx
// wizard-parts.tsx
export function ChoiceCards(props: { name: string; type: "checkbox" | "radio"; options: { value: string; label: string; hint: string }[]; selected: string[] }): JSX.Element;
export function KindChoice({ kind }: { kind: Kind | null }): JSX.Element;   // <h2>¿Qué es?</h2> + ChoiceCards name="kind" (completo / habitación)
export function ReadyList(): JSX.Element;
export function StageLabel({ step }: { step: Step }): JSX.Element;
// publicar-entrada.tsx
export function PublicarEntradaScreen(): JSX.Element; // /publicar (signed out): header «Publicar casa» + <StageLabel step={1}/>, close → "/explorar",
//   «Tenga a mano:» + ReadyList, <form> KindChoice (prefilled from readStep1), «Continuar» → validateStep(1, { ...emptyDraft(), kind }),
//   error in `.note[role=alert]`; ok → localStorage.setItem(PUBLISH_STEP1_KEY, storeStep1(kind, Date.now())) → navigate("/publicar/verificar")
export function VerificarScreen(): JSX.Element;       // /publicar/verificar: no stored answer → <Navigate to="/publicar" replace/>;
//   same header (StageLabel step 1), useEffect once → track("publish_verify"); <SignInForm next={PUBLISH_NEXT} mode="publish" />
export function ContinuarScreen(): JSX.Element;       // /publicar/continuar (privateFlow)
// shell.tsx
const publicarEntrada = () => import("./screens/publicar-entrada");
createRoute({ getParentRoute: () => flow, path: "/publicar", beforeLoad: async () => { if (await currentSession()) throw redirect({ to: "/propietario/publicar", replace: true }); }, component: lazyRouteComponent(publicarEntrada, "PublicarEntradaScreen") });
createRoute({ getParentRoute: () => flow, path: "/publicar/verificar", beforeLoad: /* same redirect to /publicar/continuar when signed in */, component: lazyRouteComponent(publicarEntrada, "VerificarScreen") });
createRoute({ getParentRoute: () => privateFlow, path: "/publicar/continuar", component: lazyRouteComponent(publicarEntrada, "ContinuarScreen") });
```
`ContinuarScreen` logic (one attempt per visit, `useRef` guard like `PublicarScreen.autoStarted`; waits for `resumable.isFetchedAfterMount && !resumable.isFetching`):
1. `readStep1(localStorage.getItem(PUBLISH_STEP1_KEY), Date.now())` is null → `<Navigate to="/propietario/publicar" replace />`.
2. `resumableQuery(userId)` returns a draft → the choice card of `PublicarScreen` («Tiene un borrador sin enviar», «Seguir con el borrador» → `resumeStep`, «Empezar otra»). «Seguir» clears the key. «Empezar otra» runs step 3.
3. `createDraft()` → `api.saveStep(id, 1, { kind })` → `addOwnCached` + invalidate `own-listings`/`own-resumable` (as `PublicarScreen`) → `localStorage.removeItem(PUBLISH_STEP1_KEY)` → `navigate("/propietario/publicar/$id/$paso", { paso: "2" }, replace)`. The key is removed **only** after `saveStep` resolved.
4. Errors (the five-drafts cap message from the base, network): `.note[role=alert]` with the message and «Intentar de nuevo» (re-runs step 3); the key stays.
Header of `ContinuarScreen`: «Publicar casa», no stage label, a `SkeletonCard`-like placeholder while working (reuse `.card skeleton` classes; do not import `propietario.tsx`).

- [ ] **Failing e2e** in `tests/e2e/publicar-v2.spec.ts`:
  1. «desde la portada sin cuenta: paso 1, verificación y «¿Dónde está su casa?»»: `deleteAccount(FREE_PHONE)`; `/?pronto=1` → click «Publicar mi casa» (needs Task 10; until then start at `/publicar` and add the portada click in Task 10) → expect «¿Qué es?» and «Su casa» «1 de 4» → «Habitación» → «Continuar» → URL `/publicar/verificar`, heading «Para guardar su casa, verifique su WhatsApp» → number `8888 9999` → name → `enterCode` → expect heading «¿Dónde está su casa?» at `/propietario/publicar/<uuid>/2`; `localStorage.getItem("bnbtico-publicar-paso1")` is null; via `serviceClient()` the account has exactly **one** listing, `status = 'draft'`, `kind = 'habitacion'`. Header of the code screen reads «Publicar casa» and «Después seguimos con su casa» is visible; «¡Listo!» never appears.
  2. «con un borrador ya empezado, elige; «Empezar otra» usa lo guardado»: `injectSession(page, "owner")` is **not** used (the flow must go through `/publicar` signed out): seed a draft for `owner` (`h.seed({ status: "draft" })`), open `/publicar` signed out → «Alojamiento completo» → «Continuar» → number `8777 0001` → `enterCode` → «Tiene un borrador sin enviar» → «Empezar otra» → step 2 of a new id; the owner now has two drafts and the new one has `kind = 'completo'`.
  3. «con sesión, /publicar lleva al asistente de siempre»: `injectSession(page, "owner")`, `/publicar` → URL `/propietario/publicar/<uuid>/1`.
  4. «un paso 1 caducado no se usa»: signed in, set the key to `{"kind":"habitacion","savedAt":0}` and open `/publicar/continuar` → URL `/propietario/publicar…` (the normal entry).
  Also extend `tests/unit/telemetry.test.ts`? No: the beacon is covered by `tests/e2e/telemetria.spec.ts` pattern — add one assertion there that opening `/publicar/verificar` (after step 1) posts `{ name: "publish_verify" }` to `/events`.
- [ ] Run `E2E publicar-v2.spec.ts telemetria.spec.ts` → FAIL.
- [ ] Implement `wizard-parts.tsx` first as a pure move (run `E2E publicar.spec.ts` green), then `publicar-entrada.tsx` and the routes.
- [ ] **Chunk audit (Review Focus 1).** `VITE_WA_GUESTS="+506 6000 0000" pnpm build`; list chunk names as in Task 0.6 and diff against the baseline. Expected new names: `publicar-entrada`, `wizard-parts`, possibly `publish-return`. In `.size-limit.json`:
  - add `"!dist/client/assets/publicar-entrada-*.js"`, `"!dist/client/assets/wizard-parts-*.js"`, `"!dist/client/assets/publish-return-*.js"` (and any other new name) to «Zona privada · JS inicial»;
  - add `"!dist/client/assets/publicar-entrada-*.js"` to «Asistente de publicar» (its `publicar-*.js` glob matches the new chunk);
  - new entry after «Asistente de publicar»: `{ "name": "Entrada de publicar · trozo diferido (/publicar sin cuenta, la verificación, la vuelta tras el código y «¿Quiere añadir un correo?»; las piezas del paso 1 que comparte con el asistente)", "path": ["dist/client/assets/publicar-entrada-*.js", "dist/client/assets/wizard-parts-*.js", "dist/client/assets/publish-return-*.js"], "limit": "5 KB", "gzip": true }`.
  Then `pnpm size --json` and check: every new chunk appears in exactly one entry; «Asistente de publicar» ≤ 15 KB (it shrinks: the moved parts leave it); no limit changed. If a module you expected in `wizard-parts` ends up in another new chunk name, add that name the same way.
- [ ] Run `E2E publicar-v2.spec.ts publicar.spec.ts telemetria.spec.ts` → PASS; `pnpm typecheck && pnpm test` → PASS.
- [ ] Commit `apps/app/src/client/publish/wizard-parts.tsx apps/app/src/client/publish/fields.tsx apps/app/src/client/screens/publicar.tsx apps/app/src/client/screens/publicar-entrada.tsx apps/app/src/client/shell.tsx apps/app/.size-limit.json apps/app/tests/e2e/publicar-v2.spec.ts apps/app/tests/e2e/telemetria.spec.ts`: «Deja empezar a publicar sin cuenta y verificar el WhatsApp después del paso 1».

---

### Task 9: «¿Quiere añadir un correo?» after submit

**Files:** `src/client/publish/step-form.tsx` (`sendForReview`), `src/client/screens/publicar-entrada.tsx` (`CorreoScreen`), `src/client/shell.tsx` (route), `tests/e2e/publicar-v2.spec.ts`.

**Interfaces:**
```ts
// sendForReview, after `await (await api()).submit(id)`:
const account = client.getQueryData<Account>(accountQuery(userId).queryKey) ?? (await client.fetchQuery(accountQuery(userId)).catch(() => undefined));
const ask = shouldAskEmail(account, localStorage.getItem(EMAIL_SKIPPED_KEY));
await router.navigate({ to: ask ? "/propietario/casas/$id/correo" : "/propietario/casas/$id/enviada", params: { id }, replace: true });
// shell.tsx, under privateFlow:
createRoute({ getParentRoute: () => privateFlow, path: "/propietario/casas/$id/correo", component: lazyRouteComponent(publicarEntrada, "CorreoScreen") });
// CorreoScreen: FlowHeader «Publicar casa» (no back), h2 «¿Quiere añadir un correo?», field
//   <label htmlFor="pub-email">Correo</label><input id="pub-email" type="email" autoComplete="email" …/> + help line,
//   «Guardar correo» → (await authApi()).updateProfile({ email }) (same validation as Mi perfil: «Ese correo no parece válido.»),
//   setQueryData(accountQuery), navigate to /enviada (replace); «Ahora no» → localStorage.setItem(EMAIL_SKIPPED_KEY, "1") → /enviada.
//   An empty email on «Guardar correo» shows «Escriba su correo o toque «Ahora no».» (field error).
```
Pre-check `authApi` / `updateProfile` partial-patch support in `domain/account.ts` (`patch.email !== undefined` path exists); if `updateProfile` requires `name`, pass the cached account's name.

- [ ] **Failing e2e** «envía sin fotos ni descripción; el correo se puede saltar una vez»: `injectSession(page, "owner")`, `sql("update profiles set email = null …")`, seed a complete draft with `photos: 0, draft: { description: "" }`; open step 9 → «Enviar a revisión» → URL `/propietario/casas/<id>/correo`, heading «¿Quiere añadir un correo?» → «Ahora no» → URL `/enviada`; localStorage `bnbtico-correo-omitido` = "1". Seed a second complete draft, send it → straight to `/enviada`. Second test: clear the flag, send, type `ana@ejemplo.cr`, «Guardar correo» → `/enviada` and `profiles.email` = `ana@ejemplo.cr` (reset in `finally`).
- [ ] Run `E2E publicar-v2.spec.ts` → FAIL.
- [ ] Implement. Re-run Task 4's «envía sin fotos» test (it sets an email, so it still lands on `/enviada`).
- [ ] Run `E2E publicar-v2.spec.ts publicar.spec.ts` → PASS; `pnpm build && pnpm size` → all entries within limits.
- [ ] Commit `apps/app/src/client/publish/step-form.tsx apps/app/src/client/screens/publicar-entrada.tsx apps/app/src/client/shell.tsx apps/app/tests/e2e/publicar-v2.spec.ts`: «Ofrece añadir un correo de recuperación tras enviar la casa».

---

### Task 10: The portada's owner button follows `LAUNCHED`

**Files:** `src/domain/portada.ts`, `src/server/app.ts` (`landing()`), `tests/unit/portada.ctas.test.ts`, `tests/unit/worker.test.ts`, `tests/e2e/portada.spec.ts`, `tests/e2e/publicar-v2.spec.ts` (e2e 1 starts at the portada).

**Interfaces:**
```ts
export const WIZARD_CTA = `<a class="soon-cta" href="/publicar">Publicar mi casa</a>`;
export function ownerCtaTarget({ landingOnly }: { landingOnly: boolean }): "whatsapp" | "wizard"; // landingOnly ? "whatsapp" : "wizard"
// withOwnerCta(html, number): now keeps the markers:
//   `<!--cta-propietarios--><a class="soon-cta" href="${href}" rel="noopener">Quiero publicar mi casa gratis</a><!--/cta-propietarios-->`
export function withWizardCta(html: string): string; // BLOCK → `<!--cta-propietarios-->${WIZARD_CTA}<!--/cta-propietarios-->`
// app.ts landing(): const body = ownerCtaTarget({ landingOnly: landingOnly(c.env) }) === "wizard" ? withWizardCta(html) : html;
```

- [ ] **Failing tests:**
  - `portada.ctas.test.ts`: `ownerCtaTarget({ landingOnly: true })` → `"whatsapp"`, `false` → `"wizard"`; `withWizardCta(HTML)` contains `WIZARD_CTA`, not «Abrimos pronto», keeps the surroundings; `withWizardCta(withOwnerCta(HTML, "+506 6000 0000"))` contains `href="/publicar"` and not `wa.me`; the existing WhatsApp test still passes (markers now kept: drop any assertion that they vanish).
  - `worker.test.ts`: an `ASSETS` override returning `PORTADA` (a string with the block) for `/portada`: `request("/?pronto=1")` in `ENVIRONMENT: "pruebas"` → HTML contains `href="/publicar"`; `setup({ ENVIRONMENT: "production" })` (no `LAUNCHED`) → `request("/")` contains the original block (or the WhatsApp link when the HTML has it) and not `href="/publicar"`; `setup({ ENVIRONMENT: "production", LAUNCHED: "true" })` → `/?pronto=1` contains `href="/publicar"`. CSP header of the portada unchanged (compare with the existing portada test's expectation).
  - `portada.spec.ts`: `/?pronto=1` has link «Publicar mi casa» with `href="/publicar"` and still requests no `.js`.
  - `publicar-v2.spec.ts` e2e 1: start at `/?pronto=1` and click «Publicar mi casa».
- [ ] Run `pnpm test -- tests/unit/portada.ctas.test.ts tests/unit/worker.test.ts` → FAIL; `E2E portada.spec.ts` → FAIL.
- [ ] Implement.
- [ ] Run → PASS; `pnpm lighthouse` is run in Task 12.
- [ ] Commit the five files: «Abre el asistente desde la portada salvo en producción antes del lanzamiento».

---

### Task 11: Documentation (same day)

**Files:** `docs/decisiones.md`, `docs/diseno-v1.md`, `docs/publicacion.md`, `CLAUDE.md`, `docs/antes-de-produccion.md`, `docs/telemetria.md`, `docs/pruebas-manuales-revision-ux.md`.

- [ ] `docs/decisiones.md`: new entry **at the top** `## 2026-10-29 · Publicar v2: enviar sin fotos, verificar después del paso 1` (above any entry earlier plans of this round added that day): send without photos/description; approve with ≥ 1 photo, admin canned note «Para publicarla necesitamos al menos una foto de la casa.»; name 5–32 (no data migration; longer names stay until edited); signed-out `/publicar` with step 1 kept on the phone 7 days (`bnbtico-publicar-paso1`), verification after step 1, `/publicar/continuar`; optional email after submit (`bnbtico-correo-omitido`); registration question; portada button tied to `landingOnly` (`withOwnerCta` keeps the markers); new size entry «Entrada de publicar» 5 KB; no «Ya tengo cuenta» toggle (phone-first flow). Mark the superseded decisions (fase 2/ticket 19, C4, C1) with a pointer.
- [ ] `docs/diseno-v1.md`: steps 6–7 and 9 (copy above), §12 «Enviada» preceded by «¿Quiere añadir un correo?», §6–7 Ingresar/Código in publish mode, §8 the registration screen.
- [ ] `docs/publicacion.md`: minimums (0 photos to send, 1 to approve, description optional or 80–2000, name 5–32, price per night required).
- [ ] `CLAUDE.md`: the line «**WhatsApp verificado por código es lo único obligatorio** para publicar o contactar» gains «(al publicar se pide después del paso 1 del asistente)».
- [ ] `docs/antes-de-produccion.md`: «El día del lanzamiento, comprobar que "Publicar mi casa" de la portada abre el asistente (`/publicar`).»
- [ ] `docs/telemetria.md`: `publish_verify` (no listing) and the funnel query step 1 (`page_view` of `/publicar`) → `publish_verify` → `wizard_step` at `/propietario/publicar/:id/2`.
- [ ] `docs/pruebas-manuales-revision-ux.md`: new section «Publicar v2 (2026-10-29)» with the next free U numbers (Task 0.8): portada → step 1 → verify → step 2 on a phone without account; send without photos; email screen once; admin with 0 photos; new account question Sí/No; name stops at 32.
- [ ] Commit the seven files: «Documenta publicar v2: envío sin fotos, verificación tras el paso 1 y la pregunta al registrarse».

---

### Task 12: Final verification

- [ ] `pnpm typecheck` → PASS.
- [ ] `pnpm test` → PASS (includes architecture: no `style={`, no `dangerouslySetInnerHTML`, domain imports).
- [ ] `pnpm db:reset` (repo root) then `pnpm test:db` → PASS.
- [ ] `VITE_WA_GUESTS="+506 6000 0000" pnpm build` → PASS.
- [ ] `pnpm size` → every entry within its limit; diff `.size-limit.json` against Task 0: only exclusions and the new «Entrada de publicar» entry were added, no limit raised.
- [ ] Full e2e: `VITE_WA_GUESTS="+506 6000 0000" CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e --workers=1` → PASS (hydration check included).
- [ ] `pnpm lighthouse` → ficha cold < 2.0 s and installed shell < 2.5 s (mobile profile).
- [ ] From the repo root: `pnpm test:prototype` → PASS.
- [ ] `git status` clean except intended files; `git log --oneline` shows one Spanish imperative commit per task, none with a co-author line. Do not push.

---

## Self-review

- **Spec coverage:** §1 → Tasks 1–5 (domain, SQL, fake/contract, wizard + ficha, admin); §2 → Tasks 1–4 (+ D's edit RPCs in Task 2 via 0.2); §3 → Tasks 6–8 (rules, sign-in form/code screen, routes) and 9 (email); §4 → Task 7; §5 → Task 10; §6 → Task 1/4 remove `missingPhotosLabel` and the «Faltan N fotos» line (B owns the card); Data → Task 2 (+ `publish_verify`) and Task 6; Testing → db (Task 2), contract (3), Vitest (1, 6, 10), worker (4, 10), Playwright 1–6 (8, 8, 9, 5, 4, 7), gates (8, 12); Documentation → Task 11.
- **Type consistency:** `Step1Kind` ⊂ `Kind`; `readStep1` returns `{ kind }` passed to `saveStep(id, 1, { kind })` (`Partial<ListingDraft>`); `SignInForm` `mode` union used by `EntryForm` and `VerificarScreen`; `isPublishNext`/`PUBLISH_NEXT` in `contact-return.ts` (initial JS), storage keys in `publish-return.ts`; messages are domain constants reused by the fake and asserted against SQL in the contract suite.
- **Ambiguities resolved:** (1) the new chunk name `publicar-entrada-*.js` is matched by the publish glob → explicit negation; (2) `withOwnerCta` drops the markers → it now keeps them so the worker can rewrite; (3) «Ya tengo cuenta» toggle dropped (phone-first flow, asserted by `cuenta.spec.ts`); (4) description message unified to «…o quedar vacía.» in domain, fake and SQL; empty name gets «Póngale un nombre a la casa.» in SQL too; (5) «refuses 16 photos» is tested as the 16th insert refused (the 15-photo trigger makes a 16-photo draft unreachable), the SQL check stays; (6) `/cuenta/lista` with a contact or publish `next` redirects to it (old links), otherwise always shows the question; (7) the email screen appears whenever the account has no email and the device has no skip flag (so only once in practice); (8) step-9 rows split into «Nombre» (with « · sin descripción») and «Fotos»; ReadyList drops «5 fotos»; (9) `CorreoScreen` lives in the new chunk, not in `propietario-*` (tab budget) nor `publicar-*` (14.94/15 KB).
