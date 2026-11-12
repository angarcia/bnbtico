# Editar una casa publicada sin sacarla de Explorar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** A published house (`first_published_at` not null, status `active`/`payment_due`/`inactive`) is edited from its own editable ficha without ever leaving Explorar: some fields change at once, the others go into one reviewed edit (`listing_edits`) that the admin approves or sends back, while the approved version stays public.

**Architecture:** Postgres owns every rule: two new tables with owner/admin `select` only, `security definer` RPCs for every write (`update_listing_live`, `start_edit`, `save_edit`, `add/remove/reorder_edit_photo(s)`, `submit_edit`, `discard_edit`, `review_edit`), and changed guards (`listings_protect`, `listing_photos_guard`, Storage policies). `domain/edit.ts` mirrors the rules for the browser and the fake; `OwnerListingsApi`, `PhotosApi` and `AdminListingsApi` gain the edit methods behind the PostgREST adapter and the fake, pinned by one contract suite before any screen. Screens: the editable ficha (new lazy chunk), eight field screens (new lazy chunk), the photo editor (shared photo grid) and the admin edit review (admin chunk).

**Tech Stack:** Vite + React 19, TanStack Router/Query, TypeScript strict, Supabase Postgres (RLS, plpgsql, Storage), Vitest (unit, db, contract), Playwright (mobile viewport), size-limit.

**Spec:** `.scratch/editar-casa/spec.md` (authority: `.scratch/ronda-ana-2026-10-28/decisiones.md` §D; mockup `design/pantallas/v2/08-casa-editable.html` 08a–08d and `07-mis-casas.html`).

## Global Constraints

- UI copy in Spanish de Costa Rica, **usted**, no voseo/tuteo. Strings below are verbatim; do not paraphrase.
- Toasts: «Guardado. Ya se ve en su ficha.» (immediate) · «Guardado. Envíelo a revisión cuando termine.» (reviewed).
- Banner titles: «Cambios sin enviar: {resumen}» · «Edición en revisión: {resumen} · normalmente en menos de 24 horas» · «Le pedimos cambios en la edición»; second line for open/review: «Mientras tanto, los clientes ven la versión aprobada.»; buttons «Enviar a revisión» (filled), «Descartar cambios» (text button).
- Confirm: «¿Descartar los cambios sin aplicar? Su ficha sigue como está.» Read-only note: «Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.»
- Card labels: «Edición sin enviar», «Edición en revisión», «Cambios pedidos en la edición». Row tags: «Revisión» (reviewed field, nothing pending), «Sin enviar», «En revisión».
- Photo pill: «{N} fotos · Editar» / «{N} fotos · 1 nueva en revisión · Editar» / «{N} fotos · {k} nuevas en revisión · Editar». Photo editor: counter «{n} de 15», footnote «El orden y las fotos que quite se guardan al momento. Las fotos nuevas las revisamos antes de publicarlas.», tag «En revisión», sticky «Listo».
- Intro note on the ficha: «Toque un dato para cambiarlo. Lo marcado con Revisión lo revisamos antes de publicarlo; mientras tanto, los clientes ven la versión actual.»
- DB/domain messages (`EDIT_MESSAGES`, identical in SQL, domain and fake): «Ese dato no se puede cambiar aquí.» · «Solo puede cambiar así una casa publicada.» · «Ya hay una edición en revisión. Espere la respuesta o descártela.» · «No hay cambios que enviar.» · «Esta edición ya tiene una decisión.» · «No encontramos esa edición.» · «Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.» · «Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.» · «Esta casa está publicada: cambie sus datos desde Mis casas.» · «Máximo 15 fotos.»
- Admin: section «Ediciones por revisar», card line «Edición: {resumen}», screen title «Revisar edición», blocks «Antes» / «Ahora», fold «Lo que no cambia», buttons «Aprobar cambios» (filled), «Pedir cambios» (outline); no «Rechazar». Outcome toast after approve: «Cambios aprobados. La ficha ya los muestra.»; after changes: «Cambios pedidos. El propietario verá su mensaje.»
- Ocre (`btn-sun`, `card-sun`, `badge-sun`) only for money: the `PayNotice` and the «Suscripción parada» block. Edit banners use arena (`note-arena` / B's arena class), never ocre.
- Size: **never raise an existing limit** in `apps/app/.size-limit.json`; new deferred chunks get their own new size-limit entry, and every new chunk name is added as a `!` exclusion to «Zona privada · JS inicial». A chunk shared by the wizard and the edit screens is moved into its own new entry (ruling of plan 3/4), not added to an existing one. New entries: «Ficha editable» 5 KB, «Editar un dato» 6 KB, «Mapa de la revisión de una edición» 2 KB, plus shared chunks at measured gz rounded up to the next 0.5 KB.
- No `style={}` in JSX, no `dangerouslySetInnerHTML`, no inline scripts; CSP `script-src 'self'` (architecture test enforces).
- `src/domain/` imports no framework (only zod/mini and itself). PostgREST strings (`.from`, `.rpc`, select strings) only in `src/data/postgrest/`.
- Migrations: `pnpm exec supabase migration new <name> < /dev/null` (from repo root), never edit an existing migration (`0001_init.sql` and earlier ones), `pnpm db:reset` from the repo root after each, then `pnpm db:types` from `apps/app`. SQL functions: `security definer set search_path = ''`, every name schema-qualified (`public.`, `storage.`, `auth.`).
- New tables/RPCs get policies + DB tests + contract tests **before** any screen (Tasks 2–7 before Tasks 8–12).
- Any `UPDATE` of `listings` inside a migration or RPC runs after `select set_config('app.allow_status','on',true)`.
- Commits: Spanish, imperative, **no co-author line**, one per task step with green tests. Test first. **No push**, no `supabase db push`, no access to pruebas.bnbtico.com.
- Run from `apps/app`: `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm size`, `pnpm test:e2e`, `pnpm lighthouse`. E2E builds: `VITE_WA_GUESTS="+506 6000 0000" pnpm build` then `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e <spec>` (one worker). Touch gestures in e2e: `tests/e2e/helpers/touch.ts` (CDP), never `Input.synthesizeScrollGesture`.

## Review Focus

1. **Size budgets leak** (a new chunk lands inside «Zona privada · JS inicial» or uncounted; a shared wizard chunk pushes «Asistente de publicar» over 15 KB). Test: Task 8 step «chunk census» and the census repeated in Tasks 9–12 and 14: `ls dist/client/assets/*.js` prefixes vs the size-limit globs, `pnpm size` green, initial entry within ±0.3 KB of the pre-flight value.
2. **The approved version stops being public during an edit** (photos of the edit leak into `listings_public`, or `save_edit` touches `listings`). Test: Task 3 DB test «save_edit + submit_edit + add_edit_photo dejan listings y listings_public igual» and contract case in Task 5.
3. **Storage delete removes a photo still in use** (approved or new) or breaks draft photo removal. Test: Task 2 DB tests «borrar un objeto referenciado se rechaza; uno sin referencia se borra» + the unchanged `photos.contract.ts` draft removal cases (run in Task 2).
4. **Approval applies an invalid merged house or breaks photo order** (an immediate change meanwhile, kind → habitación with 0 bedrooms, > 15 photos, positions not appended). Test: Task 4 DB tests «approve vuelve a validar…» and «las fotos nuevas van después de la última aprobada».
5. **Guards regress**: active → draft still possible, `changes`/`rejected` → draft blocked, another owner/anon reads `listing_edits`, a write RPC accepts a non-published house. Test: Task 2/3 DB tests (`listings_protect`, RLS, «Solo puede cambiar así una casa publicada.») + the harness «reopened» seed rewritten in Task 5.

## File Structure

New:
- `supabase/migrations/<ts>_editar_casa_publicada.sql` — tables, RLS, helpers, `update_listing_live`, `listings_protect`, photo guards, Storage policies.
- `supabase/migrations/<ts>_editar_casa_ediciones.sql` — owner edit RPCs.
- `supabase/migrations/<ts>_editar_casa_revision.sql` — `review_edit`.
- `apps/app/src/domain/edit-label.ts` — `EditStatus`, `editLabel` (tiny: imported by the tab chunk through `navigation.ts`).
- `apps/app/src/domain/edit.ts` — types, `EDIT_MESSAGES`, field tables, `mergeEdit`, `editedFields`, `editSummary`, `parseField`, `planEdit`, `photoPill`.
- `apps/app/src/data/fake/edits.ts` — fake edit store rules shared by fake owner/photos/admin.
- `apps/app/src/client/edit.ts` — mutations `useUpdateLive`, `useSaveEdit`, `useSubmitEdit`, `useDiscardEdit`; admin `adminEditsQuery`, `useReviewEdit`.
- `apps/app/src/client/screens/casa-editable.tsx` — `EditableFicha` (chunk `casa-editable-*.js`).
- `apps/app/src/client/screens/editar.tsx` — `EditarCampoScreen`, `EditFieldForm`, `EditPhotos` (chunk `editar-*.js`).
- `apps/app/src/client/publish/photo-grid.tsx` — `PhotoGrid` + `PhotoSource` (shared by step 7 and the photo editor).
- `apps/app/src/client/edit-map-leaflet.ts` — `drawTwoPoints` (admin diff map).
- Tests: `apps/app/tests/unit/edit.test.ts`, `tests/db/editar-casa.test.ts`, `tests/contract/edit.contract.ts`, `tests/unit/contract-edit-fake.test.ts`, `tests/db/contract-edit-postgrest.test.ts`, `tests/e2e/editar-casa.spec.ts`.
- `.scratch/editar-casa/preflight.md` — Task 0 answers.

Modified: `src/domain/{listing,can,navigation,rows,api,review,database.types}.ts`, `src/data/postgrest/{owner,photos,admin}.ts`, `src/data/fake/{db,owner,photos,admin}.ts`, `src/client/{owner,admin,shell}.tsx|ts`, `src/client/screens/{propietario,admin}.tsx`, `src/client/publish/{fields,photos,step-form}.tsx`, `src/styles/global.css`, `.size-limit.json`, `tests/contract/{owner-listings,subscription}.contract.ts`, `tests/db/postgrest-harness.ts`, `tests/unit/{fake-harness,describe-can}.ts`, `tests/e2e/propietario.spec.ts`, docs (`docs/decisiones.md`, `docs/diseno-v1.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/publicacion.md`, `docs/pruebas-manuales-revision-ux.md`).

---

## Task 0: Pre-flight

Checks what B+C (densidad-y-tarjetas) and A (explorar-airbnb) changed. Changes no code; records answers in `.scratch/editar-casa/preflight.md` that later tasks read.

**Files:** create `.scratch/editar-casa/preflight.md`.

- [ ] Step 1: `git log --oneline -30` and `git status`; confirm the B+C and A plans are complete (their final verification commits exist) and the tree is clean.
- [ ] Step 2: From `apps/app`: `VITE_WA_GUESTS="+506 6000 0000" pnpm build && pnpm size`. Record every entry's measured gz size and limit (especially «Zona privada · JS inicial», «Pantallas de las pestañas» (24.5), «Asistente de publicar» (15), «Fotos del asistente» (5), «Zona del admin» (12)) and the list of chunk prefixes: `ls dist/client/assets/*.js | xargs -n1 basename | sed -E 's/-[A-Za-z0-9_-]{8}\.js$//' | sort -u`.
- [ ] Step 3: Record from B+C: the exact signature and file of `cardLabel` (expected `cardLabel(listing, edit?, billing?)` in `src/domain/navigation.ts`) and what type its `edit` parameter has; the badge classes it uses for labels; the card component name (`HouseCardTop` or other) and where the label is rendered; whether `casasView` returns `"list"` for 1; whether the «Anuncio visible» switch and `CloseSheet` are gone from `Detail` in `propietario.tsx`; the arena class name used for non-money notes (expected `note-arena`); `--gutter` exists; which helpers of `propietario.tsx` are still there (`PayNotice`, `SubscriptionLink`, `StatsLine`, `ShareButtonInline`, `ShareListItem`, `SkeletonCard`, `NotFoundCard`, `useOwnListing`, `useUserId`).
- [ ] Step 4: Record from A: new chunk names (`buscar-*`, `explore-map-leaflet-*`) and new size entries; nothing in A touches owner screens (confirm with `git diff <A-base>..HEAD --stat -- src/client/screens/propietario.tsx`).
- [ ] Step 5: Record whether E (publicar-v2) landed already: values of `TITLE_MAX` (60 or 32) and whether `MIN_PHOTOS_TO_APPROVE` exists in `src/domain/listing.ts`; whether F landed: does `/propietario/suscripcion` accept `?casa=` (`suscripcionSearch` in `shell.tsx`)? (Expected: neither.)
- [ ] Step 6: Record the next free manual test number in `docs/pruebas-manuales-revision-ux.md` (`grep -o "\bU[0-9]*\b" docs/pruebas-manuales-revision-ux.md | sort -uV | tail -1`, +1) and the latest migration file name.
- [ ] Step 7: Run `pnpm test` and `pnpm typecheck` (green baseline; record counts). Commit: `git add .scratch/editar-casa/preflight.md && git commit -m "Anota el pre-vuelo de editar una casa publicada"`.

---

## Task 1: Domain of an edit (pure)

**Files:** create `src/domain/edit-label.ts`, `src/domain/edit.ts`, `tests/unit/edit.test.ts`; modify `src/domain/listing.ts` (`Listing.edit`), `src/domain/can.ts`, `src/domain/navigation.ts` (if `cardLabel` exists), `tests/unit/describe-can.test.ts`, `tests/unit/navigation.test.ts`, every test fixture that builds a `Listing` literal (`tests/unit/{describe-can,preview,review}.test.ts`, `src/client/screens/calendario.tsx` if it builds one).

**Interfaces:**

```ts
// domain/edit-label.ts
export type EditStatus = "open" | "review" | "changes";
export const EDIT_LABELS: Record<EditStatus, string> = { open: "Edición sin enviar", review: "Edición en revisión", changes: "Cambios pedidos en la edición" };
/** Badge classes: open → B's draft class (expected "badge-mute"), review → "badge-review", changes → B's non-ocre «Cambios pedidos» class (from preflight). */
export function editLabel(e: { status: EditStatus } | null | undefined): { label: string; badge: string } | null;

// domain/listing.ts
export interface Listing extends ListingDraft { /* …existing… */ edit: ListingEdit | null }   // import type from ./edit
/** A published house keeps at least this many approved photos (removing the last is refused). */
export const MIN_PHOTOS_PUBLISHED = 1;

// domain/can.ts
export const PUBLISHED_STATUSES: readonly ListingStatus[] = ["active", "payment_due", "inactive"];
export function isPublished(l: Pick<Listing, "status" | "firstPublishedAt">): boolean; // status in PUBLISHED_STATUSES && firstPublishedAt !== null
// can(l, "reopen"): only "changes" | "rejected" (active removed)

// domain/edit.ts
export type { EditStatus } from "./edit-label"; export { editLabel, EDIT_LABELS } from "./edit-label";
export interface EditLocation { lat: number; lng: number; zone: string; zoneId: string | null; zoneSource: ZoneSource }
export interface ListingEdit {
  status: EditStatus; reviewNote: string | null;
  title: string | null; kind: Kind | null; bathroomShared: boolean | null;
  description: string | null;          // "" = borrar la descripción; null = sin cambio
  location: EditLocation | null;
  submittedAt: string | null;
  photos: Photo[];                     // new photos, by position
}
export const EDIT_MESSAGES = { notHere, notPublished, inReview, empty, decided, notFound, lastPhoto, newPhotosReviewed, frozen, maxPhotos } as const; // values: Global Constraints, in that order
export const EDIT_COPY = { savedLive: "Guardado. Ya se ve en su ficha.", savedEdit: "Guardado. Envíelo a revisión cuando termine.", discardConfirm: "¿Descartar los cambios sin aplicar? Su ficha sigue como está.", readOnly: "Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra." } as const;
export type EditField = "fotos" | "nombre" | "tipo" | "ubicacion" | "capacidad" | "caracteristicas" | "descripcion" | "precio";
export type FormField = Exclude<EditField, "fotos">;
export const FIELD_ORDER: readonly FormField[] = ["nombre", "tipo", "capacidad", "caracteristicas", "descripcion", "precio", "ubicacion"]; // mockup 08a
export const IMMEDIATE_FIELDS: readonly FormField[] = ["capacidad", "caracteristicas", "precio"];
export const REVIEWED_FIELDS: readonly FormField[] = ["nombre", "tipo", "ubicacion", "descripcion"];
export const FIELD_TITLES: Record<EditField, string> = { fotos: "Fotos", nombre: "Nombre", tipo: "Tipo", ubicacion: "Ubicación", capacidad: "Personas, habitaciones y baños", caracteristicas: "Características", descripcion: "Descripción", precio: "Precio" };
export const FIELD_STEP: Record<FormField, Step> = { tipo: 1, ubicacion: 2, capacidad: 4, caracteristicas: 5, nombre: 6, descripcion: 6, precio: 8 };
export const LIVE_KEYS = ["capacity", "bedrooms", "bathrooms", "features", "parkingPaid", "nightlyPriceCrc", "acceptsMonthly", "monthlyPriceCrc"] as const;
export type LivePatch = Partial<Pick<ListingDraft, (typeof LIVE_KEYS)[number]>>;
export const EDIT_KEYS = ["title", "kind", "bathroomShared", "description", "lat", "lng", "zone", "zoneId", "zoneSource"] as const;
export type EditPatch = Partial<Pick<ListingDraft, (typeof EDIT_KEYS)[number]>>;
export function editFieldFromParam(campo: string): EditField | null;
export function mergeEdit(l: Listing, e: ListingEdit | null): ListingDraft;   // overlay non-null fields; bathroomShared only if resulting kind is habitacion; location overlays lat/lng/zone/zoneId/zoneSource; photoCount = l.photos.length + (e?.photos.length ?? 0)
export function editedFields(e: ListingEdit): ("nombre" | "tipo" | "ubicacion" | "descripcion")[]; // in REVIEWED order nombre, tipo, ubicacion, descripcion
export function editSummary(e: ListingEdit): string;   // "nombre, descripción, 2 fotos nuevas" | "1 foto nueva" | ""
export function isEmptyEdit(e: ListingEdit): boolean;  // no field and no photo
export function parseField(field: FormField, input: FormInput): Partial<ListingDraft>; // parseStep(FIELD_STEP[field]) picked: nombre→title, descripcion→description, tipo→kind + bathroomShared (from the step-4 schema), ubicacion→lat,lng,province,canton,district,zone,zoneId,zoneSource, capacidad→capacity,bedrooms,bathrooms, caracteristicas→features,parkingPaid, precio→nightlyPriceCrc,acceptsMonthly,monthlyPriceCrc
export type EditPlan = { error: string } | { immediate: LivePatch } | { reviewed: EditPatch };
export function planEdit(l: Listing, field: FormField, patch: Partial<ListingDraft>): EditPlan;
export function photoPill(approved: number, pending: number): string; // "5 fotos · Editar" | "5 fotos · 1 nueva en revisión · Editar" | "5 fotos · 2 nuevas en revisión · Editar"; 1 approved → "1 foto · Editar"
```

`planEdit` rules (decisions):
- Immediate field: merged = `{ ...draftOf(l), ...patch }` using the **approved** listing (kind = approved kind), error = `validateStep(FIELD_STEP[field], merged)`; result = keys of `LIVE_KEYS` whose `normalize(merged)` value differs from `l` (arrays compared by elements), so `acceptsMonthly: false` also sends `monthlyPriceCrc: null` and removing «Parqueo» sends `parkingPaid: null`. No change → `{ immediate: {} }`.
- Reviewed field: if `l.edit?.status === "review"` → `{ error: EDIT_MESSAGES.inReview }`; base = `mergeEdit(l, l.edit)`, merged = `{ ...base, ...patch }`, error = `validateStep(FIELD_STEP[field], merged)`; result = that field's keys from `normalize(merged)` restricted to `EDIT_KEYS` (tipo → `kind` + `bathroomShared`; ubicacion → all five location keys; province/canton/district are dropped: the base recomputes them at approval). Equal-to-approved values are sent as they are; the server stores them as `null`.
- `descripcion` uses `validateStep(6)` as it is: before E lands an empty description is refused in the browser (E makes it optional); the SQL already accepts `''`.

- [ ] Step 1: Write `tests/unit/edit.test.ts` (fails: module missing):

```ts
import { describe, expect, it } from "vitest";
import { editLabel, editSummary, editedFields, editFieldFromParam, mergeEdit, parseField, planEdit, photoPill, EDIT_MESSAGES, type ListingEdit } from "../../src/domain/edit";
import { isPublished, can } from "../../src/domain/can";
import { formInput } from "../../src/domain/step-forms";
import { activeListing } from "./fixtures"; // add: a complete active Listing (Cahuita, completo, 2 personas, 1 hab, 1 baño, ₡42 000, wifi, 5 photos, firstPublishedAt set, edit null)

const edit = (p: Partial<ListingEdit> = {}): ListingEdit => ({ status: "open", reviewNote: null, title: null, kind: null, bathroomShared: null, description: null, location: null, submittedAt: null, photos: [], ...p });
const photo = (id: string) => ({ id, path: `x/${id}`, position: 0, url: `u/${id}` });

describe("editar una casa publicada · dominio", () => {
  it("isPublished: activa, pendiente de pago o inactiva con primera publicación", () => {
    expect(isPublished({ status: "active", firstPublishedAt: "2026-10-01" })).toBe(true);
    expect(isPublished({ status: "inactive", firstPublishedAt: "2026-10-01" })).toBe(true);
    expect(isPublished({ status: "draft", firstPublishedAt: "2026-10-01" })).toBe(false);
    expect(isPublished({ status: "active", firstPublishedAt: null })).toBe(false);
  });
  it("una casa activa ya no se reabre; con cambios pedidos o rechazada sí", () => {
    expect(can({ status: "active", reviewedAt: "x" }, "reopen")).toBe(false);
    expect(can({ status: "changes", reviewedAt: "x" }, "reopen")).toBe(true);
    expect(can({ status: "rejected", reviewedAt: "x" }, "reopen")).toBe(true);
  });
  it("editLabel", () => {
    expect(editLabel(null)).toBeNull();
    expect(editLabel(edit())!.label).toBe("Edición sin enviar");
    expect(editLabel(edit({ status: "review" }))!.label).toBe("Edición en revisión");
    expect(editLabel(edit({ status: "changes" }))!.label).toBe("Cambios pedidos en la edición");
  });
  it("editSummary y editedFields", () => {
    expect(editSummary(edit({ title: "Casa Coco frente al mar", description: "", photos: [photo("a"), photo("b")] }))).toBe("nombre, descripción, 2 fotos nuevas");
    expect(editSummary(edit({ photos: [photo("a")] }))).toBe("1 foto nueva");
    expect(editSummary(edit({ bathroomShared: true }))).toBe("tipo");
    expect(editedFields(edit({ location: { lat: 9.65, lng: -82.75, zone: "Cocles", zoneId: "704-cocles", zoneSource: "list" }, title: "Otro nombre" }))).toEqual(["nombre", "ubicacion"]);
  });
  it("mergeEdit superpone lo cambiado y cuenta las fotos nuevas", () => {
    const m = mergeEdit(activeListing, edit({ title: "Casa Coco", kind: "habitacion", bathroomShared: true, photos: [photo("a")] }));
    expect(m).toMatchObject({ title: "Casa Coco", kind: "habitacion", bathroomShared: true, description: activeListing.description, photoCount: 6 });
    expect(mergeEdit(activeListing, edit({ kind: "completo", bathroomShared: true })).bathroomShared).toBeNull();
  });
  it("planEdit: precio al momento, solo lo que cambia", () => {
    expect(planEdit(activeListing, "precio", { nightlyPriceCrc: 55000, acceptsMonthly: false, monthlyPriceCrc: null })).toEqual({ immediate: { nightlyPriceCrc: 55000 } });
    expect(planEdit(activeListing, "precio", { nightlyPriceCrc: 0 })).toEqual({ error: "Indique el precio por noche en colones." });
    expect(planEdit(activeListing, "caracteristicas", { features: ["wifi", "parking"], parkingPaid: null })).toEqual({ error: "Indique si el parqueo es gratuito o de pago." });
    expect(planEdit(activeListing, "capacidad", { capacity: 2, bedrooms: 1, bathrooms: 1 })).toEqual({ immediate: {} });
  });
  it("planEdit: nombre, tipo y ubicación van a la edición; en revisión se rechazan", () => {
    expect(planEdit(activeListing, "nombre", { title: "Casa Coco frente al mar" })).toEqual({ reviewed: { title: "Casa Coco frente al mar" } });
    expect(planEdit(activeListing, "nombre", { title: "Casa" })).toEqual({ error: "El nombre de la casa debe tener entre 5 y 60 caracteres." }); // 32 once E lands: use TITLE_LENGTH_ERROR
    expect(planEdit(activeListing, "tipo", { kind: "habitacion", bathroomShared: null })).toEqual({ error: "Indique si el baño es privado o compartido." });
    expect(planEdit(activeListing, "tipo", { kind: "completo", bathroomShared: true })).toEqual({ reviewed: { kind: "completo", bathroomShared: null } });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "nombre", { title: "Casa Coco" })).toEqual({ error: EDIT_MESSAGES.inReview });
    expect(planEdit({ ...activeListing, edit: edit({ status: "review" }) }, "precio", { nightlyPriceCrc: 50000 })).toEqual({ immediate: { nightlyPriceCrc: 50000 } });
  });
  it("parseField solo devuelve las claves de su dato", () => {
    expect(parseField("nombre", formInput([["title", " Casa Coco "], ["description", "x"]]))).toEqual({ title: "Casa Coco" });
    expect(parseField("tipo", formInput([["kind", "habitacion"], ["bathroomShared", "shared"]]))).toEqual({ kind: "habitacion", bathroomShared: true });
  });
  it("editFieldFromParam y photoPill", () => {
    expect(editFieldFromParam("precio")).toBe("precio");
    expect(editFieldFromParam("calendario")).toBeNull();
    expect(photoPill(5, 0)).toBe("5 fotos · Editar");
    expect(photoPill(5, 1)).toBe("5 fotos · 1 nueva en revisión · Editar");
    expect(photoPill(5, 2)).toBe("5 fotos · 2 nuevas en revisión · Editar");
    expect(photoPill(1, 0)).toBe("1 foto · Editar");
  });
});
```

  Use `TITLE_LENGTH_ERROR` instead of the literal if preflight says `TITLE_MAX` already is 32. Add `edit: null` to every `Listing` fixture; update `describe-can.test.ts` (reopen for active now false) and, if `cardLabel` exists, a `navigation.test.ts` case: an active house with `edit.status = "review"` → label «Edición en revisión»; payment_due with an edit → payment label wins (B's priority: payment > edit > Cerrada > status).
- [ ] Step 2: `pnpm test tests/unit/edit.test.ts` → FAIL (cannot find module `../../src/domain/edit`).
- [ ] Step 3: Implement the interfaces above. `cardLabel` (if present): consult `editLabel(edit)` after payment labels and before «Cerrada»; its `edit` parameter type becomes `Pick<ListingEdit, "status"> | null`. Keep `domain/edit.ts` free of framework imports (architecture test).
- [ ] Step 4: `pnpm test` and `pnpm typecheck` → PASS (fake/rows compile errors for the new `Listing.edit` are fixed here with `edit: null` in `fromListingRow`, fake `toListing` and admin `toItem`; real mapping comes in Task 5).
- [ ] Step 5: Commit `src/domain tests/unit src/data src/client/screens/calendario.tsx` — «Añade el dominio de la edición de una casa publicada».

---

## Task 2: Migration 1 — tables, live fields, guards and Storage

**Files:** create `supabase/migrations/<ts>_editar_casa_publicada.sql` (`pnpm exec supabase migration new editar_casa_publicada < /dev/null`), `apps/app/tests/db/editar-casa.test.ts`; regenerate `src/domain/database.types.ts`.

**Interfaces (SQL):**

```sql
-- the two tables exactly as in the spec (listing_edits with its checks and updated_at trigger; listing_edit_photos + index)
alter table public.listing_edits enable row level security;
alter table public.listing_edit_photos enable row level security;
create policy listing_edits_select on public.listing_edits for select using (exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin())));
create policy listing_edit_photos_select on public.listing_edit_photos for select using (exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin())));
revoke insert, update, delete on public.listing_edits, public.listing_edit_photos from anon, authenticated;
grant select on public.listing_edits, public.listing_edit_photos to authenticated;
revoke all on public.listing_edits, public.listing_edit_photos from anon;

public.listing_is_published(p_status public.listing_status, p_first timestamptz) returns boolean  -- immutable; status in ('active','payment_due','inactive') and p_first is not null
public.own_published_listing(p_listing uuid) returns public.listings  -- select … for update; not mine → 'No encontramos ese anuncio.'; not published → 'Solo puede cambiar así una casa publicada.'
public.update_listing_live(p_listing uuid, p_patch jsonb) returns void
public.listing_photo_uploadable(p_listing uuid) returns boolean  -- public.listing_editable(p) or (mine and published and no listing_edits row with status = 'review')
public.photo_unreferenced(p_name text) returns boolean            -- no listing_photos/listing_edit_photos row whose path = p_name or p_name like path || '/%'
create or replace function public.listings_protect()               -- copy of 20261027060732 with: status → 'draft' only from ('changes','rejected'); frozen published row → 'Esta casa está publicada: cambie sus datos desde Mis casas.'; other frozen rows keep the old message
create or replace function public.listing_photos_guard(p_listing uuid)  -- add only: published → 'Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.'; others as today
public.listing_photos_owner_guard(p_listing uuid) returns boolean        -- remove/reorder: mine and (draft|changes|published), returns published
create or replace function public.remove_listing_photo(p_photo uuid)    -- uses owner_guard; published and it is the last listing_photos row → 'Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.'
create or replace function public.reorder_listing_photos(p_listing uuid, p_ids uuid[])  -- uses owner_guard
-- Storage: drop and recreate on storage.objects
--   listings_photos_owner_insert: same name regex and 45-object cap, public.listing_photo_uploadable(folder) instead of listing_editable
--   listings_photos_owner_delete: bucket 'listings' and folder owned by auth.uid() and public.photo_unreferenced(name)
grants: update_listing_live, listing_photo_uploadable, photo_unreferenced → authenticated; revoke from public, anon; helpers own_published_listing / listing_photos_owner_guard revoked from public, anon, authenticated
```

Decision (spec ambiguity): the upload policy allows a published house **without** an edit (not only «with an open edit»): the first new photo is uploaded before `add_edit_photo` creates the edit, so requiring an existing edit would make the first upload impossible. While an edit is in `review` the upload is refused. Record this in `docs/decisiones.md` (Task 9).

`update_listing_live` pins: keys outside `capacity, bedrooms, bathrooms, features, parking_paid, nightly_price_crc, accepts_monthly, monthly_price_crc` → «Ese dato no se puede cambiar aquí.»; merged row validated with `submit_listing`'s messages in its order (capacity, bedrooms with the **approved** kind, bathrooms, parking both ways, nightly, monthly); `accepts_monthly = false` sets `monthly_price_crc = null`; an unknown feature value → «Ese dato no se puede cambiar aquí.»; write after `set_config('app.allow_status','on',true)`.

- [ ] Step 1: Write `tests/db/editar-casa.test.ts` (part 1) using `postgrestHarness()`, `signIn`, `serviceClient`, `anonClient`, `sql` like `cliente-directo-fotos.test.ts`:

```ts
describe("editar una casa publicada · al momento y guardas", () => {
  it("update_listing_live cambia el precio y la casa sigue activa y pública", async () => {
    const { id, publicId } = await h.seed({ status: "active" });
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { nightly_price_crc: 55000 } })).error).toBeNull();
    expect((await h.anon.getPublic(publicId))?.nightlyPriceCrc).toBe(55000);
    expect((await h.owner("owner").getOwn(id))?.status).toBe("active");
  });
  it("rechaza el nombre, un borrador y parqueo sin tipo", async () => {
    const active = await h.seed({ status: "active" });
    const draft = await h.seed({ status: "draft" });
    const live = (id: string, p: object) => owner.rpc("update_listing_live", { p_listing: id, p_patch: p });
    expect((await live(active.id, { title: "Casa nueva" })).error?.message).toBe("Ese dato no se puede cambiar aquí.");
    expect((await live(draft.id, { capacity: 3 })).error?.message).toBe("Solo puede cambiar así una casa publicada.");
    expect((await live(active.id, { features: ["wifi", "parking"] })).error?.message).toBe("Indique si el parqueo es gratuito o de pago.");
    expect((await live(active.id, { accepts_monthly: true, monthly_price_crc: 0 })).error?.message).toBe("Indique el precio al mes en colones o déjelo vacío.");
    expect((await other.rpc("update_listing_live", { p_listing: active.id, p_patch: { capacity: 9 } })).error?.message).toBe("No encontramos ese anuncio.");
  });
  it("accepts_monthly false borra el precio al mes", async () => { /* seed active with acceptsMonthly true, monthlyPriceCrc 650000 → live {accepts_monthly:false} → getOwn monthlyPriceCrc null */ });
  it("listings_protect: un update directo del título o a borrador de una casa activa se rechaza", async () => {
    const { id } = await h.seed({ status: "active" });
    expect((await owner.from("listings").update({ title: "Otro nombre" }).eq("id", id)).error?.message).toBe("Esta casa está publicada: cambie sus datos desde Mis casas.");
    expect((await owner.from("listings").update({ status: "draft" }).eq("id", id)).error?.message).toBe("Solo bnbtico puede cambiar el estado de un anuncio.");
    const changes = await h.seed({ status: "changes" });
    expect((await owner.from("listings").update({ status: "draft" }).eq("id", changes.id)).error).toBeNull();
  });
  it("fotos de una casa publicada: ordenar y quitar sí, añadir no, la última no", async () => {
    const { id } = await h.seed({ status: "active", photos: 2 });
    const ids = (await serviceClient().from("listing_photos").select("id").eq("listing_id", id).order("position")).data!.map((r) => r.id);
    expect((await owner.rpc("reorder_listing_photos", { p_listing: id, p_ids: [...ids].reverse() })).error).toBeNull();
    expect((await owner.rpc("add_listing_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error?.message).toBe("Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.");
    expect((await owner.rpc("remove_listing_photo", { p_photo: ids[0]! })).error).toBeNull();
    expect((await owner.rpc("remove_listing_photo", { p_photo: ids[1]! })).error?.message).toBe("Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.");
  });
  it("RLS: anon y otro propietario no leen ni escriben listing_edits", async () => {
    const { id } = await h.seed({ status: "active" });
    sql(`insert into public.listing_edits (listing_id, title) values ('${id}', 'Casa Coco frente al mar')`);
    expect((await anonClient().from("listing_edits").select("*")).data ?? []).toEqual([]);
    expect((await other.from("listing_edits").select("*").eq("listing_id", id)).data).toEqual([]);
    expect((await owner.from("listing_edits").select("title").eq("listing_id", id)).data).toEqual([{ title: "Casa Coco frente al mar" }]);
    expect((await owner.from("listing_edits").update({ title: "x" }).eq("listing_id", id)).error).not.toBeNull();
    expect((await owner.from("listing_edits").insert({ listing_id: (await h.seed({ status: "active" })).id })).error).not.toBeNull();
  });
  it("Storage: subir a una casa activa sí sin edición en revisión; no con la edición en revisión", async () => {
    const { id } = await h.seed({ status: "active" });
    const up = () => owner.storage.from("listings").upload(`${id}/${crypto.randomUUID()}/800.jpg`, JPEG, { contentType: "image/jpeg" });
    expect((await up()).error).toBeNull();
    sql(`insert into public.listing_edits (listing_id, status, title) values ('${id}', 'review', 'Casa Coco frente al mar')`);
    expect((await up()).error).not.toBeNull();
    expect((await other.storage.from("listings").upload(`${id}/${crypto.randomUUID()}/800.jpg`, JPEG)).error).not.toBeNull();
  });
  it("Storage: borrar un objeto referenciado se rechaza; uno sin referencia se borra", async () => {
    const { id } = await h.seed({ status: "active" });
    const used = `${id}/${crypto.randomUUID()}`; const loose = `${id}/${crypto.randomUUID()}`;
    for (const f of [used, loose]) await owner.storage.from("listings").upload(`${f}/800.jpg`, JPEG, { contentType: "image/jpeg" });
    await serviceClient().from("listing_photos").insert({ listing_id: id, path: used, position: 9 });
    await owner.storage.from("listings").remove([`${used}/800.jpg`, `${loose}/800.jpg`]);
    expect((await h.objects(id)).map((o) => o.name)).toEqual([`${used}/800.jpg`]);
  });
});
```

- [ ] Step 2: `pnpm test:db tests/db/editar-casa.test.ts` → FAIL (relation `listing_edits` does not exist / function `update_listing_live` not found).
- [ ] Step 3: Write the migration (interfaces above). Header comment in Spanish citing the spec; copy `listings_protect` from `20261027060732_primera_publicacion.sql` and photo RPCs from `20261023073359_cliente_directo_fotos.sql` with only the listed changes, rewritten with `search_path = ''`.
- [ ] Step 4: Repo root: `pnpm db:reset`; `apps/app`: `pnpm db:types`; `pnpm test:db tests/db/editar-casa.test.ts tests/db/cliente-directo-fotos.test.ts tests/db/contract-photos-postgrest.test.ts tests/db/listings-alta-segura.test.ts` → PASS. `cliente-directo-fotos.test.ts` «una casa en revisión o activa no gana fotos»: update the active expectation to the new message (review keeps the old one). Some `contract-*-postgrest` tests that seed `"reopened"` now fail: expected, fixed in Task 5 (record in the commit body).
- [ ] Step 5: Commit `supabase/migrations apps/app/tests/db apps/app/src/domain/database.types.ts` — «Añade las tablas de ediciones, los datos al momento y las guardas de casas publicadas».

---

## Task 3: Migration 2 — owner edit RPCs

**Files:** create `supabase/migrations/<ts>_editar_casa_ediciones.sql`; extend `tests/db/editar-casa.test.ts`; regenerate types.

**Interfaces (SQL; all `security definer set search_path = ''`, lock the listing with `own_published_listing`):**

```sql
public.start_edit(p_listing uuid) returns public.listing_edits      -- open/changes → that row; review → 'Ya hay una edición en revisión. Espere la respuesta o descártela.'; none → insert open
public.save_edit(p_listing uuid, p_patch jsonb) returns public.listing_edits  -- null in jsonb result when the row was deleted (return null::public.listing_edits)
public.add_edit_photo(p_listing uuid, p_path text) returns table (id uuid, path text, "position" int)
public.remove_edit_photo(p_photo uuid) returns text
public.reorder_edit_photos(p_listing uuid, p_ids uuid[]) returns void
public.submit_edit(p_listing uuid) returns text                     -- returns 'review'
public.discard_edit(p_listing uuid) returns text[]                  -- the new photos' paths ('{}' if none)
public.listing_edit_check(l public.listings, e public.listing_edits) returns void  -- merged validation, raises; helper revoked from all but owner of functions
public.edit_place(p_lat double precision, p_lng double precision, p_zone text, p_zone_id text, p_zone_source text) returns table (province text, canton text, district text, zone text) -- submit_listing's location rules and messages (place_at, zones_near 5 km, district name, ≤ 60 chars); helper, revoked
grants: the seven RPCs → authenticated; revoke from public, anon
```

Pinned rules: `save_edit` keys outside the nine (`title, kind, bathroom_shared, description, lat, lng, zone, zone_id, zone_source`) or location keys not all present together (lat, lng, zone, zone_source; zone_id may be null) → «Ese dato no se puede cambiar aquí.»; in `review` → inReview message; a value equal to the approved one stores `null` (location compared as the tuple of five; kind and bathroom_shared each compared to the approved value); light checks only (title ≤ 60 chars via the table check, description ≤ 2000, zone ≤ 60); if no field and no photo remain, the row is deleted and `null` returned. `add_edit_photo`: same path regex as `add_listing_photo`, calls `start_edit` (refuses in review), approved + new ≥ 15 → «Máximo 15 fotos.», position = max + 1 among the edit's photos. `remove_edit_photo`: not mine → «No encontramos esa foto.»; in review → inReview; recompacts; deletes the edit if it is now empty. `reorder_edit_photos`: the exact set or «La lista de fotos cambió. Vuelva a intentarlo.». `submit_edit`: no edit → «No encontramos esa edición.»; review → inReview; empty → «No hay cambios que enviar.»; `listing_edit_check` on the merged house; then `status = 'review', submitted_at = now(), review_note = null`. `listing_edit_check`: kind/bathroom («Indique si el baño es privado o compartido.»), bedrooms vs resulting kind, title `5..60` with `submit_listing`'s message (E changes to 32: leave the comment «E: 5–32»), description `''` or `80..2000` («La descripción debe tener entre 80 y 2000 caracteres.»), location through `edit_place` when changed. `discard_edit`: any state; no edit → `'{}'`.

- [ ] Step 1: Add to `tests/db/editar-casa.test.ts`:

```ts
describe("ediciones del propietario", () => {
  it("save_edit + add_edit_photo + submit_edit dejan listings y listings_public igual", async () => {
    const { id, publicId } = await h.seed({ status: "active" });
    const before = await h.anon.getPublic(publicId);
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco frente al mar" } })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: `${id}/${crypto.randomUUID()}` })).error).toBeNull();
    expect((await owner.rpc("submit_edit", { p_listing: id })).data).toBe("review");
    expect(await h.anon.getPublic(publicId)).toEqual(before);
    expect((await owner.from("listing_edits").select("status, title").eq("listing_id", id).single()).data).toEqual({ status: "review", title: "Casa Coco frente al mar" });
  });
  it("una segunda edición en revisión no se abre ni se cambia", async () => {
    /* after submit: start_edit and save_edit → 'Ya hay una edición en revisión. Espere la respuesta o descártela.' */
  });
  it("guardar el valor aprobado no cuenta como cambio y una edición vacía se borra", async () => {
    const { id } = await h.seed({ status: "active", draft: { title: "Cabina Cahuita" } });
    await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco frente al mar" } });
    const { data } = await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Cabina Cahuita" } });
    expect(data).toBeNull();
    expect((await owner.from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
  });
  it("submit_edit rechaza una zona a 10 km, un nombre de 4 letras y una edición vacía", async () => {
    const { id } = await h.seed({ status: "active" });
    // Cahuita zone with a pin ~10 km away (Puerto Viejo, 9.6553, -82.7536), zone_id '704-cahuita'
    await owner.rpc("save_edit", { p_listing: id, p_patch: { lat: 9.6553, lng: -82.7536, zone: "Cahuita", zone_id: "704-cahuita", zone_source: "list" } });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
    await owner.rpc("discard_edit", { p_listing: id });
    expect((await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa" } })).error?.message).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("No encontramos esa edición.");
    await owner.rpc("start_edit", { p_listing: id });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error?.message).toBe("No hay cambios que enviar.");
  });
  it("fotos nuevas: aprobadas + nuevas ≤ 15; discard devuelve sus rutas y borra la edición", async () => {
    const { id } = await h.seed({ status: "active", photos: 13 });
    const p = () => `${id}/${crypto.randomUUID()}`;
    const [a, b] = [p(), p()];
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: a })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: b })).error).toBeNull();
    expect((await owner.rpc("add_edit_photo", { p_listing: id, p_path: p() })).error?.message).toBe("Máximo 15 fotos.");
    expect((await owner.rpc("discard_edit", { p_listing: id })).data).toEqual([a, b]);
    expect((await serviceClient().from("listing_edit_photos").select("id").eq("listing_id", id)).data).toEqual([]);
  });
  it("otro propietario no edita mi casa; un borrador no tiene ediciones", async () => {
    /* other.rpc save_edit/add_edit_photo/submit_edit/discard_edit on my active → 'No encontramos ese anuncio.'; owner save_edit on draft → 'Solo puede cambiar así una casa publicada.' */
  });
  it("Storage: con la edición en revisión no se sube; descartada, se vuelve a poder", async () => { /* … */ });
});
```

  Decision: `save_edit` validates the title length itself (5..60, message «El nombre de la casa debe tener entre 5 y 60 caracteres.») before writing, so the table check is only a safety net; the test asserts the RPC message.
- [ ] Step 2: `pnpm test:db tests/db/editar-casa.test.ts` → FAIL (functions missing).
- [ ] Step 3: Implement the migration.
- [ ] Step 4: `pnpm db:reset` (root), `pnpm db:types`, `pnpm test:db tests/db/editar-casa.test.ts` → PASS.
- [ ] Step 5: Commit — «Añade las RPCs de la edición de una casa publicada».

---

## Task 4: Migration 3 — admin review of an edit

**Files:** create `supabase/migrations/<ts>_editar_casa_revision.sql`; extend `tests/db/editar-casa.test.ts`; types; docs `CLAUDE.md` («Esquema»), `docs/architecture.md` (data section).

**Interfaces (SQL):**

```sql
public.review_edit(p_listing uuid, p_decision text, p_note text) returns text  -- returns 'approved' | 'changes'
-- not is_admin(): profile is_admin → 'Confirme el segundo código para revisar anuncios.' else 'Solo bnbtico puede revisar anuncios.'
-- no edit → 'No encontramos esa edición.'; status <> 'review' → 'Esta edición ya tiene una decisión.'
-- p_decision not in ('approve','changes') → 'Decisión no válida.'; 'changes' with empty note → 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'
-- approve: lock listing; public.listing_edit_check(l, e) (raises its message for the admin); place from edit_place when location changed;
--   set_config('app.allow_status','on',true); update listings set title/kind/bathroom_shared(null unless habitacion)/description/lat/lng/zone/zone_id/zone_source/province/canton/district = coalesce(edit, current);
--   approved + new > 15 → 'Máximo 15 fotos.'; insert listing_photos (listing_id, path, position) from listing_edit_photos ordered by position, positions max(current)+1…;
--   delete the edit; insert admin_actions (admin_id, action, target_listing_id) values (auth.uid(), 'edit.approve', p_listing)
-- changes: update listing_edits set status='changes', review_note=left(btrim(p_note),2000), reviewed_at=now(), reviewed_by=auth.uid(); admin_actions 'edit.changes' with reason
grant execute on function public.review_edit(uuid, text, text) to authenticated; revoke from public, anon
```

- [ ] Step 1: Add to `tests/db/editar-casa.test.ts` (admin = `signInAdmin()`, aal1 = `signIn("admin")`):

```ts
describe("revisión de una edición", () => {
  // Zona: take a real active zone within 5 km of the new pin from `select id, name from public.zones_near(9.6553, -82.7536, 5)` (seed data of 20261028070328_zonas.sql) and pin its id/name in the test.
  it("aprobar aplica nombre, descripción, tipo y ubicación, recalcula el lugar y conserva estado y primera publicación", async () => {
    const { id, publicId } = await h.seed({ status: "active", photos: 5 });
    const before = (await serviceClient().from("listings").select("status, first_published_at").eq("id", id).single()).data!;
    const desc = "Casa de madera frente a Playa Cocles, con terraza y hamacas, a cinco minutos a pie del pueblo y del arrecife.";
    await owner.rpc("save_edit", { p_listing: id, p_patch: { title: "Casa Coco frente al mar", description: desc, kind: "habitacion", bathroom_shared: true, lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zone_id: "704-puerto-viejo", zone_source: "list" } });
    const paths = [`${id}/${crypto.randomUUID()}`, `${id}/${crypto.randomUUID()}`];
    for (const path of paths) await owner.rpc("add_edit_photo", { p_listing: id, p_path: path });
    await owner.rpc("submit_edit", { p_listing: id });
    expect((await admin.rpc("review_edit", { p_listing: id, p_decision: "approve", p_note: "" })).data).toBe("approved");
    const after = (await serviceClient().from("listings").select("*").eq("id", id).single()).data!;
    expect(after).toMatchObject({ title: "Casa Coco frente al mar", description: desc, kind: "habitacion", bathroom_shared: true, zone: "Puerto Viejo", canton: "Talamanca", province: "Limón", status: before.status, first_published_at: before.first_published_at });
    const photos = (await serviceClient().from("listing_photos").select("path, position").eq("listing_id", id).order("position")).data!;
    expect(photos.slice(5)).toEqual([{ path: paths[0], position: 5 }, { path: paths[1], position: 6 }]);
    expect((await serviceClient().from("listing_edits").select("listing_id").eq("listing_id", id)).data).toEqual([]);
    expect((await h.anon.getPublic(publicId))?.title).toBe("Casa Coco frente al mar");
    expect((await serviceClient().from("admin_actions").select("action").eq("target_listing_id", id).eq("action", "edit.approve")).data).toHaveLength(1);
  });
  it("approve vuelve a validar: un cambio de tipo con 0 habitaciones se rechaza", async () => {
    // Carrera: se envía con 1 habitación; mientras espera, el dueño baja a 0 al momento (lo permite el tipo aprobado, completo).
    const { id } = await h.seed({ status: "active", draft: { kind: "completo", bedrooms: 1 } });
    await owner.rpc("save_edit", { p_listing: id, p_patch: { kind: "habitacion", bathroom_shared: false } });
    expect((await owner.rpc("submit_edit", { p_listing: id })).error).toBeNull();
    expect((await owner.rpc("update_listing_live", { p_listing: id, p_patch: { bedrooms: 0 } })).error).toBeNull();
    expect((await admin.rpc("review_edit", { p_listing: id, p_decision: "approve", p_note: "" })).error?.message).toBe("Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.");
  });
  it("pedir cambios exige nota; el propietario la ve y puede reenviar", async () => { /* changes "" → noteRequired; changes "La foto 2 tiene un teléfono." → edit status 'changes', review_note; owner save_edit + submit_edit → 'review' */ });
  it("quien no es admin y el admin sin segundo código no deciden", async () => {
    /* other → 'Solo bnbtico puede revisar anuncios.'; aal1 → 'Confirme el segundo código para revisar anuncios.'; decided twice → 'Esta edición ya tiene una decisión.' */
  });
  it("el admin lee ediciones y sus fotos; con aal1 no", async () => { /* admin.from('listing_edits') returns the row; aal1 returns [] */ });
});
```

- [ ] Step 2: `pnpm test:db tests/db/editar-casa.test.ts` → FAIL (`review_edit` missing).
- [ ] Step 3: Implement. Update `CLAUDE.md` «Esquema» sentence to: «Los cambios de estado de una casa pasan por las RPCs (`submit_listing`, `review_listing`); el trigger `listings_protect` bloquea cualquier otro camino y congela el contenido fuera de `draft`/`changes`: una casa publicada cambia con `update_listing_live` (datos al momento) o con una edición revisada (`listing_edits`: `save_edit`, `submit_edit`, `discard_edit`, `review_edit`) y nunca vuelve a `draft`.» Add the two tables to the data part of `docs/architecture.md` (one paragraph: one edit per house, owner/admin select only, writes by RPC, approved version stays public).
- [ ] Step 4: `pnpm db:reset`, `pnpm db:types`, `pnpm test:db tests/db/editar-casa.test.ts tests/db/admin-casas.test.ts tests/db/admin-aal2-purga.test.ts` → PASS.
- [ ] Step 5: Commit — «Añade la revisión del admin de una edición».

---

## Task 5: Owner API — adapters, fake and contract

**Files:** modify `src/domain/api.ts`, `src/domain/rows.ts`, `src/data/postgrest/owner.ts`, `src/data/fake/{db,owner}.ts`; create `src/data/fake/edits.ts`, `tests/contract/edit.contract.ts`, `tests/unit/contract-edit-fake.test.ts`, `tests/db/contract-edit-postgrest.test.ts`; modify `tests/db/postgrest-harness.ts` («reopened» seed), `tests/contract/owner-listings.contract.ts`, `tests/unit/fake-harness.ts` (if needed).

**Interfaces:**

```ts
// domain/api.ts — OwnerListingsApi
/** Datos al momento de una casa publicada (RPC update_listing_live). */
updateLive(id: string, patch: LivePatch): Promise<void>;
/** Guarda en la edición (la crea si no hay); null si quedó sin cambios y se borró (RPC save_edit). */
saveEdit(id: string, patch: EditPatch): Promise<ListingEdit | null>;
submitEdit(id: string): Promise<void>;
/** Borra la edición en cualquier estado y después los objetos de sus fotos nuevas (RPC discard_edit + Storage). */
discardEdit(id: string): Promise<void>;
// reopenForEdit stays; on an active house it now fails with «Solo bnbtico puede cambiar el estado de un anuncio.»

// domain/rows.ts
export type EditRow = Pick<Database["public"]["Tables"]["listing_edits"]["Row"], "status" | "review_note" | "title" | "kind" | "bathroom_shared" | "description" | "lat" | "lng" | "zone" | "zone_id" | "zone_source" | "submitted_at"> & { listing_edit_photos: PhotoRow[] };
export function fromEditRow(row: EditRow | null | undefined, url: PhotoUrl): ListingEdit | null;
export function toLivePatch(p: LivePatch): Record<string, Json>;   // camel → snake keys of update_listing_live
export function toEditPatch(p: EditPatch): Record<string, Json>;   // camel → snake keys of save_edit
export function fromListingRow(row, photoRows, url, editRow?: EditRow | null): Listing; // edit = fromEditRow(editRow)

// data/postgrest/owner.ts
const OWN_COLUMNS = "*, listing_photos(id, path, position), listing_edits(status, review_note, title, kind, bathroom_shared, description, lat, lng, zone, zone_id, zone_source, submitted_at, listing_edit_photos(id, path, position))";

// data/fake/db.ts
export interface FakeEdit { listingId: string; status: EditStatus; reviewNote: string | null; title: string | null; kind: Kind | null; bathroomShared: boolean | null; description: string | null; lat: number | null; lng: number | null; zone: string | null; zoneId: string | null; zoneSource: ZoneSource | null; submittedAt: string | null; reviewedAt: string | null }
// FakeDb: readonly edits = new Map<string, FakeEdit>(); editPhotos: FakePhoto[] = []; editPhotosOf(listingId): FakePhoto[]; clear() resets both

// data/fake/edits.ts — the SQL rules in TypeScript, used by fake owner/photos/admin
export function editStore(db: FakeDb): {
  published(listingId: string, owner: string): FakeListing;       // own_published_listing (same messages)
  start(l: FakeListing): FakeEdit;                                 // start_edit
  save(l: FakeListing, patch: EditPatch): FakeEdit | null;         // save_edit
  check(l: FakeListing, e: FakeEdit): Located | null;              // listing_edit_check, throws DomainError("validation"); returns the place when the location changed (uses fake locationOf, moved/exported from fake/owner.ts)
  live(l: FakeListing, patch: LivePatch): void;                    // update_listing_live
  toEdit(listingId: string, url: PhotoUrl): ListingEdit | null;
  dropIfEmpty(listingId: string): void;
};
```

The `"reopened"` seed (an active house turned back to draft, a legacy state) is rewritten in `postgrest-harness.ts` as SQL: `sql(\`begin; select set_config('app.allow_status','on',true); update public.listings set status = 'draft' where id = '${id}'; commit;\`)`. Comment: legacy state, since this migration no owner can reach it.

- [ ] Step 1: Write `tests/contract/edit.contract.ts` → `export function editContract(name: string, makeHarness: () => Promise<ListingsHarness>)`, owner part:

```ts
it("updateLive cambia el precio al momento: la ficha pública lo muestra y la casa sigue activa", async () => {
  const s = await h.seed({ status: "active" });
  await me.updateLive(s.id, { nightlyPriceCrc: 55000 });
  expect((await h.anon.getPublic(s.publicId))?.nightlyPriceCrc).toBe(55000);
  expect((await me.getOwn(s.id))).toMatchObject({ status: "active", nightlyPriceCrc: 55000, edit: null });
});
it("updateLive rechaza un borrador y parqueo sin tipo, con los mensajes de la base", async () => {
  expect((await rejection(me.updateLive((await h.seed({ status: "draft" })).id, { capacity: 3 }))).message).toBe("Solo puede cambiar así una casa publicada.");
  expect((await rejection(me.updateLive((await h.seed({ status: "active" })).id, { features: ["parking"], parkingPaid: null }))).message).toBe("Indique si el parqueo es gratuito o de pago.");
});
it("saveEdit crea la edición; getOwn y listOwn la traen; la ficha pública no cambia", async () => {
  const s = await h.seed({ status: "active" });
  const e = await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
  expect(e).toMatchObject({ status: "open", title: "Casa Coco frente al mar", description: null, location: null, photos: [] });
  expect((await me.getOwn(s.id))?.edit?.title).toBe("Casa Coco frente al mar");
  expect((await me.listOwn()).find((l) => l.id === s.id)?.edit?.status).toBe("open");
  expect((await h.anon.getPublic(s.publicId))?.title).toBe("Cabina Cahuita");
});
it("saveEdit con el valor aprobado devuelve null y no deja edición", async () => { /* … */ });
it("submitEdit: vacía no; en revisión ya no se guarda; descartar la quita en cualquier estado", async () => {
  const s = await h.seed({ status: "active" });
  await me.saveEdit(s.id, { title: "Casa Coco frente al mar" });
  await me.submitEdit(s.id);
  expect((await me.getOwn(s.id))?.edit).toMatchObject({ status: "review" });
  expect((await rejection(me.saveEdit(s.id, { title: "Otra Casa Coco" }))).message).toBe("Ya hay una edición en revisión. Espere la respuesta o descártela.");
  await me.discardEdit(s.id);
  expect((await me.getOwn(s.id))?.edit).toBeNull();
  expect((await rejection(me.submitEdit(s.id))).message).toBe("No encontramos esa edición.");
});
it("submitEdit rechaza un nombre corto y una zona lejana", async () => { /* title "Casa" at saveEdit → «El nombre de la casa debe tener entre 5 y 60 caracteres.»; location 10 km → «La zona elegida queda a más de 5 km del punto. Elija otra.» at submitEdit */ });
it("una casa ajena no se edita", async () => { /* other.saveEdit(mine) → «No encontramos ese anuncio.» */ });
```

  In `owner-listings.contract.ts` change «una casa activa vuelve a borrador…» to «una casa activa ya no vuelve a borrador: solo bnbtico cambia ese estado» (expects `ONLY_BNBTICO`, status stays `active`, link stays `active`). Runners: `tests/unit/contract-edit-fake.test.ts` (`editContract("fake en memoria", async () => fakeHarness())`) and `tests/db/contract-edit-postgrest.test.ts` (same pattern as `contract-owner-postgrest.test.ts`).
- [ ] Step 2: `pnpm test tests/unit/contract-edit-fake.test.ts` and `pnpm test:db tests/db/contract-edit-postgrest.test.ts` → FAIL (`me.updateLive is not a function`).
- [ ] Step 3: Implement adapter (`db.rpc("update_listing_live", { p_listing, p_patch: toLivePatch(patch) })`; `save_edit` returns the row without photos, so the adapter re-reads `listing_edit_photos` only if the row is not null: `select listing_edit_photos(id, path, position)` from `listing_edits` with `.eq("listing_id", id)`; `discardEdit` → rpc then `db.storage.from("listings").remove(paths.flatMap(photoObjectPaths))`), and the fake (rules from `edits.ts`, the same messages). Fake `reopenForEdit` refuses `active` with «Solo bnbtico puede cambiar el estado de un anuncio.». Rewrite the «reopened» seed.
- [ ] Step 4: `pnpm test`, `pnpm typecheck`, `pnpm test:db` (whole db project: the reopened-seed failures from Task 2 must be gone) → PASS.
- [ ] Step 5: Commit — «Añade la edición al adaptador del propietario, al fake y a la suite de contrato».

---

## Task 6: Photos API for edits

**Files:** modify `src/domain/api.ts` (`PhotosApi`), `src/data/postgrest/photos.ts`, `src/data/fake/photos.ts`, `tests/contract/edit.contract.ts` (photos part), `tests/contract/photos.contract.ts` (published house cases).

**Interfaces:**

```ts
// PhotosApi
/** Registra una carpeta subida como foto nueva de la edición (la crea si no hay). Aprobadas + nuevas ≤ 15. */
addEditPhoto(listingId: string, folder: string): Promise<Photo>;
/** Quita una foto nueva (las demás se recompactan) y después sus objetos; si la edición queda vacía, se borra. */
removeEditPhoto(photoId: string): Promise<void>;
reorderEditPhotos(listingId: string, photoIds: string[]): Promise<void>;
// remove(photoId) on a published house: refuses the last approved photo with EDIT_MESSAGES.lastPhoto
// upload(listingId, …) is unchanged: Storage decides (listing_photo_uploadable)
```

Fake Storage rules change with the SQL: `putObject` allows `editable(listingId) || uploadable-published (owner, published, no edit in review)`; `deleteObjects` deletes only names owned by the user **and** unreferenced by `db.photos`/`db.editPhotos` (`photo_unreferenced`). Fake `guard` splits into add (published → `newPhotosReviewed`) and remove/reorder (published allowed; last-photo rule).

- [ ] Step 1: Contract cases (`edit.contract.ts`, photos part; uploads with `h.photos("owner").upload(id, variants())` as in `photos.contract.ts`):

```ts
it("una foto nueva se sube y registra en la edición; la ficha pública no la ve", async () => {
  const s = await h.seed({ status: "active", photos: 5 });
  const folder = await ph.upload(s.id, variants());
  const p = await ph.addEditPhoto(s.id, folder);
  expect(p).toMatchObject({ path: folder, position: 0 });
  expect((await h.owner("owner").getOwn(s.id))?.edit?.photos.map((x) => x.path)).toEqual([folder]);
  expect((await h.anon.getPublic(s.publicId))?.photos).toHaveLength(5);
});
it("quitar la única foto nueva borra la edición y los tres objetos", async () => { /* removeEditPhoto → getOwn.edit null; h.objects(id) excludes folder */ });
it("descartar con dos fotos nuevas borra sus objetos y deja los de las aprobadas", async () => { /* two uploads+addEditPhoto, discardEdit → objects of both gone; seeded approved paths untouched */ });
it("en una casa publicada se ordena y se quita al momento, pero no la última foto ni con add", async () => {
  const s = await h.seed({ status: "active", photos: 2 });
  const ids = (await h.owner("owner").getOwn(s.id))!.photos.map((p) => p.id);
  await ph.reorder(s.id, [...ids].reverse());
  expect((await h.anon.getPublic(s.publicId))?.photos.map((p) => p.path)).toEqual([...s.photoPaths].reverse());
  await ph.remove(ids[0]!);
  expect((await rejection(ph.remove(ids[1]!))).message).toBe("Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.");
  expect((await rejection(ph.add(s.id, await ph.upload(s.id, variants())))).message).toBe("Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.");
});
it("con la edición en revisión no se suben ni registran fotos nuevas", async () => { /* submitEdit; upload → UPLOAD_FAILED_MESSAGE; addEditPhoto → inReview */ });
it("aprobadas + nuevas ≤ 15", async () => { /* seed photos 14; one addEditPhoto ok, second → «Máximo 15 fotos.» */ });
```

  In `photos.contract.ts`, the «fuera de borrador o cambios pedidos no se toca nada» case keeps `review` and drops `active` (now covered here).
- [ ] Step 2: `pnpm test tests/unit/contract-edit-fake.test.ts tests/unit/contract-photos-fake.test.ts` → FAIL.
- [ ] Step 3: Implement adapter (`add_edit_photo`, `remove_edit_photo` then Storage remove, `reorder_edit_photos`) and fake.
- [ ] Step 4: `pnpm test`, `pnpm test:db tests/db/contract-edit-postgrest.test.ts tests/db/contract-photos-postgrest.test.ts` → PASS.
- [ ] Step 5: Commit — «Añade las fotos nuevas de una edición al adaptador, al fake y al contrato».

---

## Task 7: Admin API for edits

**Files:** modify `src/domain/api.ts` (`AdminListingsApi`), `src/domain/review.ts`, `src/data/postgrest/admin.ts`, `src/data/fake/admin.ts`, `tests/contract/edit.contract.ts` (admin part), `tests/contract/subscription.contract.ts`.

**Interfaces:**

```ts
// domain/review.ts
export type EditDecision = "approve" | "changes";
export const EDIT_REVIEW_SAVED: Record<EditDecision, string> = { approve: "Cambios aprobados. La ficha ya los muestra.", changes: "Cambios pedidos. El propietario verá su mensaje." };
export function editQueueOrder(items: QueueItem[]): QueueItem[]; // listing.edit.submittedAt ascending
// AdminListingsApi
/** Ediciones en revisión, la que más espera primero; cada casa con su edición (listing.edit). Sin ser admin, []. */
editQueue(): Promise<QueueItem[]>;
/** La casa aprobada con su edición y las fotos de las dos; null si no hay edición o no es admin. */
getEdit(listingId: string): Promise<QueueItem | null>;
/** RPC review_edit. Motivo obligatorio para pedir cambios (reviewNoteRefusal). */
reviewEdit(listingId: string, decision: EditDecision, note: string): Promise<void>;
// postgrest: ADMIN_COLUMNS gains the listing_edits embed (same column list as OWN_COLUMNS);
// editQueue: listings with `listing_edits!inner(...)` and .eq("listing_edits.status", "review"), then editQueueOrder
```

- [ ] Step 1: Contract cases:

```ts
it("la cola de ediciones trae las enviadas, la que más espera primero, con su resumen", async () => {
  const a = await h.seed({ status: "active", draft: { title: "Casa A" } });
  const b = await h.seed({ status: "active", draft: { title: "Casa B" } });
  for (const s of [b, a]) { await me.saveEdit(s.id, { title: `${s === a ? "Casa A" : "Casa B"} renovada` }); await me.submitEdit(s.id); }
  await me.saveEdit((await h.seed({ status: "active" })).id, { title: "Sin enviar todavía" });
  const q = await admin.editQueue();
  expect(q.map((i) => i.listing.title)).toEqual(["Casa B", "Casa A"]);
  expect(editSummary(q[0]!.listing.edit!)).toBe("nombre");
});
it("aprobar aplica la edición: la ficha pública cambia y la edición desaparece", async () => { /* reviewEdit approve → getPublic title new; getOwn.edit null; editQueue [] */ });
it("pedir cambios guarda la nota; el propietario la ve y reenvía", async () => { /* changes "La foto 2 tiene un teléfono." → getOwn.edit {status:"changes", reviewNote}; saveEdit+submitEdit → review */ });
it("validación y acceso: nota obligatoria, ya decidida, no admin y aal1", async () => {
  /* reviewEdit changes "" → REVIEW_MESSAGES.noteRequired; twice → «Esta edición ya tiene una decisión.»; h.admin("owner").editQueue() → []; getEdit → null; reviewEdit → REVIEW_MESSAGES.adminOnly; h.admin("aal1") → REVIEW_MESSAGES.mfaRequired on all three */
});
```

  `subscription.contract.ts` «volver a aprobar tras editar conserva la plaza y el fin de la oferta» becomes «aprobar una edición conserva la plaza, el fin de la oferta y el estado» (`saveEdit` title → `submitEdit` → `admin.reviewEdit(approve)` → `mine(a.id)` equals `before`; `offerTaken()` is 1).
- [ ] Step 2: `pnpm test tests/unit/contract-edit-fake.test.ts` → FAIL.
- [ ] Step 3: Implement adapter and fake (`reviewEdit` approve uses `editStore.check` and appends photos, deletes the edit; changes sets status/note).
- [ ] Step 4: `pnpm test`, `pnpm typecheck`, `pnpm test:db` (whole) → PASS.
- [ ] Step 5: Commit — «Añade la revisión de ediciones al adaptador del admin, al fake y al contrato».

---

## Task 8: Client data layer, routes and size entries

**Files:** create `src/client/edit.ts`; modify `src/client/owner.ts` (remove `useReopen`), `src/client/shell.tsx` (routes, preload), `.size-limit.json`; create stub screens `src/client/screens/casa-editable.tsx` (`export function EditableFicha`) and `src/client/screens/editar.tsx` (`export function EditarCampoScreen`) that render a heading only (replaced in Tasks 9–11); unit test `tests/unit/edit-cache.test.ts`.

**Interfaces:**

```ts
// client/edit.ts
export function useUpdateLive(userId: string, l: Pick<Listing, "id" | "publicId">): UseMutationResult<void, Error, LivePatch, { previous: Listing | null | undefined }>;
//   onMutate: cancel ["own-listing", userId, id] and ["own-listings", userId]; patchCached(patch); onError: restore previous (detail and list); onSettled: refresh(client, userId, l)
export function useSaveEdit(userId: string, l: Pick<Listing, "id" | "publicId">): UseMutationResult<ListingEdit | null, Error, EditPatch>;
//   onSuccess: patchCached({ edit }); onSettled: invalidate own-listing(s)
export function useSubmitEdit(userId, l): UseMutationResult<void, Error, void>;   // onSuccess: patchCached({ edit: { ...edit, status: "review", reviewNote: null } })
export function useDiscardEdit(userId, l): UseMutationResult<void, Error, void>;  // onSuccess: patchCached({ edit: null })
export const editScreens = () => import("./screens/editar");   // in lazy-screens.ts if imported from more than one place
// shell.tsx
//   privateFlow: createRoute({ path: "/propietario/casas/$id/editar/$campo", component: lazyRouteComponent(() => import("./screens/editar"), "EditarCampoScreen") })
//   adminFlow:   createRoute({ path: "/admin/ediciones/$id", component: adminScreen("RevisarEdicionScreen") })  (adminScreen union widened; stub export in admin.tsx)
//   prefetchTabs(): also void import("./screens/casa-editable") for owners
```

- [ ] Step 1: Write `tests/unit/edit-cache.test.ts` with a `QueryClient`, the fake API injected the way `own-listings-hint.test.ts`/`owner-inquiries.test.ts` do (or by mocking `../src/client/owner` `api`): `useUpdateLive` via `renderHook`-free call of its options (export `updateLiveOptions(client, userId, l)` that `useUpdateLive` wraps, so the test calls `onMutate`/`onError` directly): after `onMutate({ nightlyPriceCrc: 55000 })` the cached detail has 55000; after `onError` it is back to 42000; the list entry follows.
- [ ] Step 2: `pnpm test tests/unit/edit-cache.test.ts` → FAIL.
- [ ] Step 3: Implement; remove `useReopen` and its import in `propietario.tsx` together with the «Editar la ficha · vuelve a revisión» row and the «Estuvo publicada. Está editándola…» note in `Detail` (those houses now open the editable ficha in Task 9). Update `tests/e2e/propietario.spec.ts`: delete «editar una casa activa pide confirmación, la reabre y deja de verse» (replaced by `editar-casa.spec.ts`).
- [ ] Step 4: **Chunk census.** `VITE_WA_GUESTS="+506 6000 0000" pnpm build`; list prefixes (command of Task 0 step 2) and diff with the pre-flight list. Add to `.size-limit.json`: `!dist/client/assets/casa-editable-*.js`, `!…/editar-*.js`, `!…/edit-*.js` (and any other new prefix) to the initial entry; new entries «Ficha editable · trozo diferido (la ficha de una casa publicada; se precarga con las pantallas del propietario)» (`casa-editable-*.js` + the shared `edit-*.js` hooks chunk) 5 KB, «Editar un dato · trozo diferido (las pantallas de cada dato de una casa publicada)» (`editar-*.js`) 6 KB. `pnpm size` → all green; initial entry within ±0.3 KB of pre-flight; «Pantallas de las pestañas» ≤ 24.5 KB (removing the reopen row and `useReopen` must pay for `isPublished` and the lazy switch).
- [ ] Step 5: `pnpm typecheck && pnpm test` → PASS. Commit — «Añade las mutaciones de la edición, las rutas y sus trozos diferidos».

---

## Task 9: The editable ficha

**Files:** `src/client/screens/casa-editable.tsx`, `src/client/screens/propietario.tsx` (switch + exports + card label), `src/styles/global.css`, `tests/e2e/editar-casa.spec.ts` (first scenarios), `docs/diseno-v1.md` l.37, `docs/decisiones.md` (new entry on top, dated 2026-10-29).

**Interfaces:**

```tsx
// propietario.tsx
const EditableFicha = lazy(() => import("./casa-editable").then((m) => ({ default: m.EditableFicha })));
// CasaPropietarioScreen: l && isPublished(l) → <Suspense fallback={<SkeletonCard />}><EditableFicha listing={l} userId={userId} /></Suspense>; else today's Detail (never-published houses keep it and the wizard)
// export PayNotice, SubscriptionLink, StatsLine, ShareButtonInline (or B's equivalents from preflight)
// Mis casas card: B's cardLabel(l, l.edit, billing) — the label on the photo shows the edit state

// casa-editable.tsx
export function EditableFicha({ listing, userId }: { listing: Listing; userId: string }): JSX.Element;
function EditBanner({ listing, userId }: { listing: Listing; userId: string }): JSX.Element | null;
function FieldRow({ listing, field }: { listing: Listing; field: FormField }): JSX.Element;   // <Link className="list-item" to="/propietario/casas/$id/editar/$campo">
function fieldValue(l: ListingDraft, field: FormField): string;   // Nombre: title · Tipo: «Alojamiento completo» | «Habitación · baño privado|compartido» · Personas: «4 personas · 2 habitaciones · 1 baño» · Características: FEATURE_LABEL joined «, » or «Ninguna marcada» · Descripción: text (CSS 1-line clamp) or «Sin descripción» · Precio: «₡42 000 / noche» + « · Mensual: ₡650 000 / mes» | « · Mensual: a negociar» · Ubicación: locationLine(l) (pending: the edit's zone name)
```

Layout (mockup 08a–08c; order top to bottom): `FlowHeader` (back → `/propietario/casas`, title = name, «Ver ficha» when `can(l, "share")`) is rendered by `CasaPropietarioScreen`; then (1) subscription block on top only if `payment_due` (`PayNotice`) or `inactive` (`card-sun`: heading «Suscripción parada», body «{nombre} no aparece en Explorar y el enlace de su ficha no funciona. Actívela para que vuelvan a escribirle.», `btn-sun` «Activar suscripción» → `SubscriptionLink` `#pago=CT-####` (F changes it to `?casa=`), small «₡2 900 al mes, sin permanencia» from `MONTHLY_FEE_CRC`); (2) `EditBanner` (arena; open: title + summary line, «Enviar a revisión» `btn-primary` + «Descartar cambios» `btn-link`; review: title, «Descartar cambios»; changes: «Le pedimos cambios en la edición», the note, both buttons); (3) cover photo (800 variant, fixed box like `.detail-photo`) with the status pill (B's label) top left and the photo pill `photoPill(approved, new)` as a `Link` to `…/editar/fotos`; (4) intro note; (5) field rows in `FIELD_ORDER`, each with a tag: reviewed fields «Revisión» or, with a pending value, the pending value as the row's small line and tag «Sin enviar» (open/changes) / «En revisión» (review); immediate fields no tag; (6) «Compartir ficha» filled (`ShareButtonInline` primary) with the `bnbtico.com/casa/CT-####` line, only when `can(l, "share")`; (7) «WhatsApp de esta casa» read-only list item; (8) `StatsLine`; (9) «Suscripción» row at the bottom when not on top. «Descartar cambios» asks `window.confirm(EDIT_COPY.discardConfirm)`. «Enviar a revisión» errors show in `.note[role="alert"]` (e.g. «No hay cambios que enviar.»). An empty edit (`isEmptyEdit`) shows no banner.

- [ ] Step 1: Write `tests/e2e/editar-casa.spec.ts` (serial, `postgrestHarness`, `injectSession(page, "owner")`, image route stub as in `fotos-arrastrar.spec.ts`) — scenario «la ficha editable de una casa activa»: open `/propietario/casas/${id}`; expect rows «Nombre», «Tipo», «Personas, habitaciones y baños», «Características», «Descripción», «Precio», «Ubicación» in that order; «Revisión» tag count 4; «5 fotos · Editar»; «Compartir ficha»; no «Editar la ficha», no «Anuncio visible», no «Descartar borrador»; then `h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" })`, reload: banner «Cambios sin enviar: nombre», the Nombre row shows «Casa Coco frente al mar» with «Sin enviar»; Mis casas card label «Edición sin enviar» and the house appears once; «Descartar cambios» (accept dialog) → banner gone, `getOwn(id).edit` is null. Scenario «inactiva: el bloque ocre arriba» (seed active, `h.billing("owner").stop(id)`): «Suscripción parada» before the cover; «Activar suscripción» links to `/propietario/suscripcion#pago=${publicId}`.
- [ ] Step 2: Build + `pnpm test:e2e editar-casa.spec.ts` → FAIL (stub screen).
- [ ] Step 3: Implement. CSS: reuse `.list-item`, `.photo`, `.pill`, `.note-arena`; add only `.tag-rev` (arena pill, 11 px, `--fg-muted` text) and `.photo-pill` (bottom-right pill on the cover) with token colours; no new colours. Docs: replace `docs/diseno-v1.md` l.37 «Detalle de mi casa» with the editable ficha (published) / today's detail (never published); add the decisions entry `## 2026-10-29 · Editar una casa publicada sin sacarla de Explorar` at the top of `docs/decisiones.md` (bullets: immediate vs reviewed fields; one edit per house in `listing_edits` (open → review → aplicada o changes), «Descartar cambios» always; no «Rechazar» for edits; published houses never return to draft (`reopenForEdit`/`useReopen` out for active); the approved version stays public; Storage upload rule decision from Task 2; three migrations instead of one; banner copy follows the spec (no «Le avisamos por WhatsApp», out of scope); «Suscripción parada» heading with the mockup body).
- [ ] Step 4: Chunk census (Task 8 step 4 command), `pnpm size`, `pnpm test`, `pnpm typecheck`, `pnpm test:e2e editar-casa.spec.ts propietario.spec.ts navegacion.spec.ts` → PASS. If «Ficha editable» > 5 KB: remove duplication first (reuse `propietario.tsx` pieces); never raise the limit; if it still does not fit, report DONE_WITH_CONCERNS with the measurement.
- [ ] Step 5: Commit — «Añade la ficha editable de una casa publicada».

---

## Task 10: Field screens (nombre, tipo, ubicación, capacidad, características, descripción, precio)

**Files:** `src/client/screens/editar.tsx`, `src/client/publish/fields.tsx` (export `ChoiceCards`, `Counter`, `BathroomChoice`, `FeatureChips`, `MonthlyQuestion`, `TitleField`, `DescriptionField`), `src/client/publish/step-form.tsx` (export `ReadyScope`), `.size-limit.json`, `tests/e2e/editar-casa.spec.ts`, `docs/publicacion.md`.

**Interfaces:**

```tsx
// step-form.tsx
/** Lets a form outside StepForm know when its fields are ready (LocationStep's useStepReady). */
export function ReadyScope({ onReady, children }: { onReady: (ready: boolean) => void; children: ReactNode }): JSX.Element;
// editar.tsx
export function EditarCampoScreen(): JSX.Element;  // route params id, campo; editFieldFromParam(campo) null or listing not published → <Navigate to="/propietario/casas/$id" replace />; "fotos" → <EditPhotos/> (Task 11)
function EditFieldForm({ listing, field, userId }: { listing: Listing; field: FormField; userId: string }): JSX.Element;
function FieldInputs({ field, draft, listing, userId }: { field: FormField; draft: ListingDraft; listing: Listing; userId: string }): JSX.Element;
//   nombre: TitleField · descripcion: DescriptionField · tipo: kind ChoiceCards + BathroomChoice when the selected kind is habitacion (kind state lifted with onChange) · ubicacion: LocationStep inside ReadyScope · capacidad: three Counters (no BathroomChoice) · caracteristicas: FeatureChips · precio: nightly input + MonthlyQuestion (same markup as StepFields case 8)
```

Behaviour: `FlowHeader` (back → ficha, title `FIELD_TITLES[field]`), `<form noValidate>`, sticky bar with «Guardar» (`btn-primary btn-block`), disabled while saving or while `ReadyScope` says not ready. Values shown: reviewed fields from `mergeEdit(listing, listing.edit)`, immediate from the approved listing. Submit → `parseField` → `planEdit`: error → `.note[role="alert"]`; `{ immediate: {} }` → back without toast; immediate → `useUpdateLive.mutate` → success: `toast(EDIT_COPY.savedLive)` + navigate to the ficha; error: the screen shows `toDomainError(e).message`, cache reverted; reviewed → `useSaveEdit.mutate` → success: `toast(EDIT_COPY.savedEdit)` + ficha; error: message. Reviewed field while `listing.edit?.status === "review"`: inputs inside `<fieldset disabled>`, note `EDIT_COPY.readOnly`, no «Guardar». Back without saving discards (nothing stored).

- [ ] Step 1: e2e scenarios in `editar-casa.spec.ts` (spec Playwright 1 and 2, plus the error path):
  1. «cambiar el precio: al momento, en la ficha pública y en Explorar» — ficha → «Precio» → fill «Precio por noche» `55 000` → «Guardar» → toast «Guardado. Ya se ve en su ficha.» and URL back to `/propietario/casas/${id}`; `/casa/${publicId}` (reload) shows «₡55 000»; `/explorar` lists the house.
  2. «cambiar el nombre: la ficha pública sigue igual hasta aprobar» — «Nombre» → «Casa Coco frente al mar» → «Guardar» → toast «Guardado. Envíelo a revisión cuando termine.»; `/casa/${publicId}` still «Cabina Cahuita»; Mis casas label «Edición sin enviar»; ficha «Enviar a revisión» → banner «Edición en revisión: nombre · normalmente en menos de 24 horas»; Mis casas «Edición en revisión»; «Nombre» screen: input disabled, note «Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.», no «Guardar»; «Precio» still editable.
  3. «si la base rechaza el precio, la pantalla lo dice y nada cambia» — `page.route("**/rest/v1/rpc/update_listing_live", …400 P0001 «Indique el precio por noche en colones.»)` → message in `.note[role="alert"]`; after back, the ficha row still «₡42 000 / noche».
  4. «tipo habitación pide el baño» — select «Habitación», «Guardar» without bath → «Indique si el baño es privado o compartido.»; choose «Compartido» → saved.
- [ ] Step 2: Build + `pnpm test:e2e editar-casa.spec.ts` → FAIL.
- [ ] Step 3: Implement. Chunk census: importing `fields.tsx`, `step-form.tsx`, `location-step.tsx` from `editar.tsx` splits them out of `publicar-*.js` into shared chunk(s); each shared chunk gets its own new entry («Campos del asistente · trozo diferido compartido por publicar y editar», measured gz rounded up to the next 0.5 KB) and a `!` exclusion in the initial entry; «Asistente de publicar» keeps 15 KB over what is left; «Editar un dato» ≤ 6 KB. `docs/publicacion.md`: new section «Casa publicada (2026-10-29)»: what changes at once and what goes to review.
- [ ] Step 4: `pnpm size`, `pnpm test`, `pnpm typecheck`, `pnpm test:e2e editar-casa.spec.ts publicar.spec.ts ubicacion.spec.ts` → PASS.
- [ ] Step 5: Commit — «Añade las pantallas para cambiar cada dato de una casa publicada».

---

## Task 11: Photo editor of a published house

**Files:** create `src/client/publish/photo-grid.tsx`; modify `src/client/publish/photos.tsx` (wizard adapter over `PhotoGrid`), `src/client/screens/editar.tsx` (`EditPhotos`), `.size-limit.json`, `tests/e2e/editar-casa.spec.ts`; existing `tests/e2e/fotos-arrastrar.spec.ts` and `fotos.spec.ts` must stay green unchanged.

**Interfaces:**

```tsx
// publish/photo-grid.tsx
export interface PhotoSource {
  listingId: string;
  photos: Photo[];                 // draggable, in order; the first is «Portada»
  pending: Photo[];                // after them, tag «En revisión», not draggable, removable (wizard: [])
  counter: { text: string; short: boolean };   // wizard: «{n} de 5–15»; editor: «{n} de 15» (approved + new)
  room: number;                    // photos that can still be added (15 − approved − new − in flight is computed inside)
  canAdd: boolean;                 // editor: false while the edit is in review
  register(folder: string): Promise<unknown>;   // wizard: photos.add; editor: photos.addEditPhoto
  remove(photo: Photo, pending: boolean): Promise<void>;  // wizard: photos.remove; editor: remove | removeEditPhoto
  reorder(ids: string[]): Promise<void>;        // photos.reorder (approved/draft only)
  reread(): Promise<void>;
}
export function PhotoGrid({ source, userId, header }: { source: PhotoSource; userId: string; header?: ReactNode }): JSX.Element;
// photos.tsx: export function PhotoUploader({ listing, userId }) → <PhotoGrid source={wizardSource(listing)} …/> (same DOM, texts and behaviour as today)
// editar.tsx: function EditPhotos({ listing, userId }) → FlowHeader «Fotos» + counter, <PhotoGrid source={editSource(listing)} />, footnote, sticky «Listo» (Link to the ficha)
```

Upload queue per listing (`queueFor`) moves into `photo-grid.tsx` unchanged. Errors from the base (e.g. lastPhoto) show through `photosErrorMessage` (validation kind keeps the message).

- [ ] Step 1: e2e (spec Playwright 5 and 6):
  5. «descartar con dos fotos nuevas borra la edición y sus objetos» — open `…/editar/fotos`, `setInputFiles` two photos (`foto("beach.jpg")`, `foto("loft.jpg")`), expect two tiles with «En revisión» after the approved ones and counter «7 de 15»; «Listo» → pill «5 fotos · 2 nuevas en revisión · Editar», banner «Cambios sin enviar: 2 fotos nuevas»; «Descartar cambios» (accept) → `getOwn(id).edit` null and `h.objects(id)` has no object of the two new folders (poll).
  6. «ordenar arrastrando en una casa activa se ve al momento en la ficha pública» — `realPhotos(id)` for loading tiles, drag photo 3 onto tile 1 with `helpers/touch.ts` (pattern of `fotos-arrastrar.spec.ts` `drag`), wait for the `reorder_listing_photos` request; `/casa/${publicId}` first hero image src is the dragged photo's 800 variant.
  Plus: «quitar la última foto aprobada se rechaza» (seed `photos: 1`): tap «Quitar foto 1» → alert «Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.».
- [ ] Step 2: Build + `pnpm test:e2e editar-casa.spec.ts` → FAIL.
- [ ] Step 3: Implement. Chunk census: `photo-grid` (+ the drag/queue modules it pulls) becomes a chunk shared by `photos-*.js` and `editar-*.js`: give it its own new entry «Rejilla de fotos · trozo diferido compartido por el paso 7 y el editor de fotos» (measured, rounded up to 0.5 KB) and the `!` exclusion; «Fotos del asistente» stays 5 KB over what is left.
- [ ] Step 4: `pnpm size`, `pnpm test`, `pnpm typecheck`, `pnpm test:e2e editar-casa.spec.ts fotos-arrastrar.spec.ts fotos.spec.ts` → PASS.
- [ ] Step 5: Commit — «Añade el editor de fotos de una casa publicada sobre la rejilla del paso 7».

---

## Task 12: Admin — queue section and edit review

**Files:** modify `src/client/screens/admin.tsx` (section in `AnunciosScreen`, `RevisarEdicionScreen`), `src/client/admin.ts` or `src/client/edit.ts` (`adminEditsQuery`, `adminEditQuery`, `useReviewEdit`), create `src/client/edit-map-leaflet.ts`, `.size-limit.json`, `tests/e2e/editar-casa.spec.ts`, docs `docs/diseno-v1.md` §18 (admin), `docs/pruebas-manuales-revision-ux.md` (U numbers from preflight).

**Interfaces:**

```tsx
export const adminEditsQuery = (userId: string) => queryOptions({ queryKey: ["admin-edits", userId] as const, queryFn: async () => (await adminApi()).editQueue(), staleTime: 0 });
export const adminEditQuery = (userId: string, id: string) => queryOptions({ queryKey: ["admin-edit", userId, id] as const, queryFn: async () => (await adminApi()).getEdit(id), staleTime: 0 });
export function useReviewEdit(userId: string): UseMutationResult<void, Error, { item: QueueItem; decision: EditDecision; note: string }>; // optimistic: removes the item from ["admin-edits"]; on error puts it back and sets the review outcome «failed» with the base message; success outcome EDIT_REVIEW_SAVED[decision]
export function RevisarEdicionScreen(): JSX.Element;    // route /admin/ediciones/$id
function EditDiff({ item }: { item: QueueItem }): JSX.Element;
// edit-map-leaflet.ts
export function drawTwoPoints(el: HTMLElement, before: { lat: number; lng: number; label: string }, after: { lat: number; lng: number; label: string }): () => void;
```

Screen: `AnunciosScreen` adds a section «Ediciones por revisar» (only when non-empty), oldest first: cover (480), CT-####, name, owner, «Edición: {editSummary}», links to `/admin/ediciones/$id`. `RevisarEdicionScreen`: header «Revisar edición»; one block per changed field with «Antes» / «Ahora» (name and type side by side; description: the new text, the old one inside `<details><summary>Antes</summary>`; location: one map box with both points labelled with the zone names (fixed-size box, `drawTwoPoints` imported lazily; arena box if it fails); new photos: grid of the edit's photos); unchanged fields folded in `<details><summary>Lo que no cambia</summary>` (reuse the facts line of `ReviewDetail`); the same three-checkbox checklist as `ReviewForm`; note textarea; «Aprobar cambios» (`btn-primary`), «Pedir cambios» (`btn-ghost`, outline; note required via `reviewNoteRefusal("changes", note)`); after deciding → `/admin`. No «Rechazar».

- [ ] Step 1: e2e (spec Playwright 3 and 4), owner edits via the API, admin via `injectSession(page, "admin")` + `secondCode(page)`:
  3. «el admin aprueba: la ficha muestra el nombre nuevo y el aviso desaparece» — `saveEdit` title + `submitEdit`; `/admin` shows «Ediciones por revisar» with «Edición: nombre»; open it: «Antes» «Cabina Cahuita», «Ahora» «Casa Coco frente al mar»; no «Rechazar»; «Aprobar cambios» → `/admin`; `/casa/${publicId}` shows «Casa Coco frente al mar»; owner session: ficha without banner, Mis casas label «Activa».
  4. «el admin pide cambios: el propietario ve la nota, corrige y reenvía» — «Pedir cambios» without note → «Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.»; with «Use un nombre sin mayúsculas sostenidas.» → owner ficha banner «Le pedimos cambios en la edición» + note; Mis casas «Cambios pedidos en la edición»; «Nombre» editable again → save → «Enviar a revisión» → «Edición en revisión: nombre · normalmente en menos de 24 horas».
- [ ] Step 2: Build + `pnpm test:e2e editar-casa.spec.ts` → FAIL.
- [ ] Step 3: Implement. Chunk census: `edit-map-leaflet-*.js` gets `!` in the initial entry and a new entry «Mapa de la revisión de una edición · trozo diferido» 2 KB (Leaflet stays in `leaflet-*.js`); «Zona del admin» stays ≤ 12 KB — if it does not fit, move `RevisarEdicionScreen` into its own module `screens/revisar-edicion.tsx` with a new entry (never raise 12 KB). Docs: `docs/diseno-v1.md` §18 admin gains «Ediciones por revisar» and the diff screen; manual tests: new section «Editar una casa publicada (2026-10-29)» with U{n}–U{n+3}: (1) change price and features on the phone, check the public ficha from another phone; (2) change name + add a photo, send, check Mis casas label; (3) admin on another phone approves; owner sees no banner and the new photo last; (4) admin asks for changes, owner corrects and resends, then discards a second edit with a new photo.
- [ ] Step 4: `pnpm size`, `pnpm test`, `pnpm typecheck`, `pnpm test:e2e editar-casa.spec.ts admin.spec.ts admin-casas.spec.ts` → PASS.
- [ ] Step 5: Commit — «Añade la revisión de ediciones en la zona del admin».

---

## Task 13: Final verification

**Files:** none new (fixes only).

- [ ] Step 1: From the repo root `pnpm db:reset`; from `apps/app`: `pnpm typecheck` → 0 errors; `pnpm test` → all pass (count ≥ preflight + new); `pnpm test:db` → all pass.
- [ ] Step 2: `VITE_WA_GUESTS="+506 6000 0000" pnpm build` → OK (architecture test inside); chunk census against `.size-limit.json` (every prefix either in the initial entry or excluded and in one deferred entry); `pnpm size` → all green; compare every pre-existing entry with the preflight values: no limit changed (`git diff <preflight-commit> -- .size-limit.json` shows only new entries and new `!` lines).
- [ ] Step 3: `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e` (full, one worker) → all pass, no hydration warnings.
- [ ] Step 4: `pnpm lighthouse` → ficha and shell gates green. Repo root: `pnpm test:prototype` → pass.
- [ ] Step 5: `grep -rn "useReopen\|Editar la ficha\|dejará de verse\|Estuvo publicada. Está editándola" apps/app/src` → nothing. Check docs updated: `docs/decisiones.md` (top entry 2026-10-29), `docs/diseno-v1.md` (l.37, §18), `CLAUDE.md` («Esquema»), `docs/architecture.md`, `docs/publicacion.md`, `docs/pruebas-manuales-revision-ux.md`. Commit any fix — «Verifica la edición de casas publicadas: pruebas, tamaños y documentación».

---

## Self-review notes (spec coverage and resolved ambiguities)

- Spec §1 layout → Task 9 (order follows mockup 08a: Nombre, Tipo, Personas, Características, Descripción, Precio, Ubicación; mockup wins on looks). §2 field screens → Task 10, photos → Task 11. §3 one edit at a time → Tasks 3, 5 (DB + contract), banner/labels → Task 9. §4 admin → Tasks 4, 7, 12. §5 removals → Tasks 1 (`can`), 5 (`reopenForEdit` refuses active), 8 (`useReopen`, rows, note). Data → Tasks 2–4. Testing list → DB Tasks 2–4, contract 5–7, Vitest 1, Playwright 9–12 (all six spec scenarios), manual 12. Documentation → Tasks 4, 9, 10, 12.
- Resolved: (a) Storage upload on a published house is allowed **without** an existing edit (the first photo is uploaded before `add_edit_photo` creates it), refused while in review. (b) Three migrations (`editar_casa_publicada`, `editar_casa_ediciones`, `editar_casa_revision`) instead of one, so each task commits green. (c) `MIN_PHOTOS_TO_APPROVE` does not exist before E; D uses `MIN_PHOTOS_PUBLISHED = 1` for «remove the last photo» and `review_edit` does not re-check a photo minimum (new photos only add). (d) Title max read from `TITLE_MAX` in TS; SQL helpers carry «E: 5–32» comments so E updates `listing_edit_check`/`save_edit` with `submit_listing`. (e) Frozen-row message «Esta casa está publicada…» only for published rows; `review`/`rejected` keep the old one. (f) Banner copy follows the spec (no «Le avisamos por WhatsApp»: no automatic WhatsApp, out of scope); heading «Suscripción parada» (spec) with the mockup's body. (g) Pending location shows the edit's zone name (the edit has no cantón). (h) New photos are not draggable in the editor; `reorder_edit_photos` exists (spec) but the UI does not use it. (i) The editable ficha lives in its own chunk `casa-editable-*.js` from the start (tabs chunk had 0.04 KB headroom). (j) An immediate screen with no change goes back without a request or toast. (k) One new contract file `edit.contract.ts` instead of growing three existing ones.
- Type consistency: `ListingEdit`, `LivePatch`, `EditPatch`, `EditDecision`, `FormField` defined in Task 1/7 and used unchanged in Tasks 5–12; `fromListingRow(row, photos, url, editRow)` used by owner and admin adapters.
