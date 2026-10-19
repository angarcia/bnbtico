# Fase 2 · Publicar, aprobar y ver · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un propietario publica su casa desde el móvil, el admin la aprueba y cualquiera abre `bnbtico.com/casa/CT-####` con la casa completa y vista previa en WhatsApp; el flujo entero pasa en Playwright contra Supabase local.

**Architecture:** Next.js App Router con Server Components y Server Actions que usan el cliente de Supabase del usuario; RLS y funciones `security definer` en Postgres son la única capa de permisos. Un módulo `src/lib/listings/` concentra tipos, validación, consultas y filtros. Las fotos van del navegador a Supabase Storage; el mapa usa Leaflet con teselas de OpenStreetMap.

**Tech Stack:** Next 16.4 (App Router, TS estricto), React 19, Supabase (Postgres 17, RLS, Storage, `@supabase/ssr` 0.12), Leaflet 1.9, Vitest 5, Playwright 1.64 (Pixel 7).

**Spec:** `docs/superpowers/specs/2026-10-19-fase-2-publicar-aprobar-ver-design.md`

## Global Constraints

- UI en español de Costa Rica con voseo; «Mensual», nunca «Largo plazo»; «propietario», no «owner», en copy nuevo.
- Dinero: enteros en colones; `formatCRC` → `₡95 000`; dólares solo al mostrar con `FX_CRC_PER_USD = 510`. Nunca «total a pagar».
- IDs públicos `CT-####`; enlaces `bnbtico.com/casa/CT-####`.
- Nada de Veriff ni identidad en pantalla. Sin contacto real (botón deshabilitado «Disponible pronto»).
- Características: exactamente las 9 del enum `feature`, mismo orden en publicar, filtrar y ficha.
- Esquema solo con migraciones nuevas (`pnpm exec supabase migration new <nombre>`); `0001_init.sql` no se toca.
- La app nunca usa `SUPABASE_SERVICE_ROLE_KEY`; solo las pruebas.
- Pruebas primero: Vitest en `apps/web/tests/unit`, integración de base en `apps/web/tests/db`, flujos en `apps/web/tests/e2e` en viewport móvil.
- Commits en español, imperativo, sin línea de coautoría. Un commit por tarea con pruebas en verde (`pnpm typecheck && pnpm lint && pnpm test`).
- Las pruebas de la fase 1 (`cuenta.spec.ts`, `smoke.spec.ts`, unit) siguen pasando.
- Todos los comandos se ejecutan desde la raíz del repo salvo que se indique `apps/web`.

## Review Focus

1. **Precio escrito con separadores («95.000», «95 000»)** → se acepta como 95000; «95,50» o «95.5» se rechaza. Prueba en Tarea 2 (`parseColones`).
2. **Foto HEIC o formato que el navegador no decodifica** → mensaje «Ese formato no se puede subir. Usá JPG o PNG.» y no se crea fila. Prueba en Tarea 4 (`acceptsImage`).
3. **Doble toque en «Enviar a revisión»** → la segunda llamada a `submit_listing` falla con «Este anuncio ya está en revisión.» y el botón está deshabilitado mientras envía. Prueba en Tarea 1 (db) y Tarea 5 (botón `disabled` con `pending`).
4. **`/casa/ct-1001` en minúsculas o con espacios** → se normaliza a `CT-1001`; formato inválido → 404 sin consultar. Prueba en Tarea 7 (`parsePublicId`).
5. **Filtros de precio con mín > máx o provincia sin casas en la URL** → se intercambian mín y máx; la provincia cae al valor por defecto. Prueba en Tarea 8 (`parseFilters`).

---

## Mapa de archivos

**Base de datos**
- `supabase/migrations/<ts>_fase2_casas.sql` — columnas, bucket y políticas de Storage, trigger de protección, RPCs, vista, `seed_admin`.
- `supabase/config.toml` — número de prueba `50688990001`.
- `apps/web/tests/db/fase2.test.ts` — integración contra Supabase local (se salta sin `SUPABASE_SERVICE_ROLE_KEY`).

**Lib**
- `apps/web/src/lib/supabase/server.ts` — `supabaseServer()`; `browser.ts` — `supabaseBrowser()`; `storage.ts` — `photoUrl()`.
- `apps/web/src/lib/listings/schema.ts` — tipos, constantes, `validateStep`, `validateAll`, `normalize`, `parseColones`, `parseStepForm`, etiquetas de estado.
- `apps/web/src/lib/listings/repo.ts` — consultas y RPCs.
- `apps/web/src/lib/listings/session.ts` — `requireOwnerSession`, `requireAdmin`.
- `apps/web/src/lib/listings/filters.ts`, `geo.ts`, `share.ts`.
- `apps/web/src/lib/currency.ts` — cookie ₡/$.

**Acciones**
- `apps/web/src/actions/listings.ts`, `apps/web/src/actions/admin.ts`, `apps/web/src/actions/currency.ts`.

**Componentes**
- `apps/web/src/components/publish/step-form.tsx`, `step-fields.tsx`, `location-picker.tsx`, `photo-uploader.tsx`.
- `apps/web/src/components/listing/owner-card.tsx`, `share-button.tsx`, `gallery.tsx`, `approx-map.tsx`, `readonly-calendar.tsx`, `currency-toggle.tsx`, `listing-card.tsx`, `status-badge.tsx`.
- `apps/web/src/components/explore/filters.tsx`.
- `apps/web/src/components/admin/review-form.tsx`.

**Rutas (todas bajo `apps/web/app/(app)/`)**
- `propietario/page.tsx` (panel), `propietario/publicar/page.tsx`, `propietario/publicar/[id]/[paso]/page.tsx`, `propietario/casas/page.tsx`, `propietario/casas/[id]/page.tsx`.
- `admin/page.tsx`, `admin/casas/[id]/page.tsx`.
- `casa/[publicId]/page.tsx` (dentro del grupo `(app)` para heredar `Shell` y la barrera de etapa; la especificación lo dejaba abierto).
- `explorar/page.tsx`.
- `apps/web/app/sitemap.ts`, `apps/web/app/globals.css`.

**Pruebas**
- `apps/web/tests/unit/listings-schema.test.ts`, `listings-filters.test.ts`, `geo.test.ts`, `share.test.ts`, `currency.test.ts`, `image.test.ts`.
- `apps/web/tests/e2e/casas.spec.ts`, `apps/web/tests/e2e/helpers/supabase-admin.ts`, `apps/web/tests/e2e/helpers/session.ts`.

---

### Tarea 1: Migración `0002` y pruebas de base de datos

**Files:**
- Create: `supabase/migrations/<ts>_fase2_casas.sql` (vía `pnpm exec supabase migration new fase2_casas`)
- Modify: `supabase/config.toml:41-45`
- Modify: `apps/web/vitest.config.mts` (añadir `tests/db/**/*.test.ts` al `include`)
- Modify: `apps/web/.env.local` (no versionado): `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY de \`pnpm exec supabase status -o env\`>`
- Test: `apps/web/tests/db/fase2.test.ts`

**Interfaces:**
- Produces (SQL): columnas `listings.canton text not null default ''`, `listings.min_nights int not null default 1`, `listings.min_months int`, `listings.parking_paid boolean`, `listings.monthly_mode text check (monthly_mode in ('amount','contact'))`; RPC `submit_listing(p_listing uuid) returns listing_status`; `review_listing(p_listing uuid, p_decision text, p_note text) returns listing_status`; `set_listing_available(p_listing uuid, p_available boolean) returns void`; `listing_link_state(p_public_id text) returns text`; `seed_admin(p_phone text) returns void`; bucket `listings`; vista `listings_public` recreada con las columnas nuevas; política `listings_owner_delete` (solo `status = 'draft'`).

- [ ] **Paso 1: Escribir la prueba de integración**

`apps/web/tests/db/fase2.test.ts`, con `describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)`. Carga `.env.local` al inicio con `process.loadEnvFile(new URL("../../.env.local", import.meta.url).pathname)` dentro de `try/catch`. Usa `@supabase/supabase-js`:

- `admin = createClient(url, serviceKey, { auth: { persistSession: false } })`.
- Helper `signIn(phone)`: cliente anónimo, `signInWithOtp({ phone })` + `verifyOtp({ phone, token: "123456", type: "sms" })`; devuelve el cliente con sesión. Teléfonos: dueño `+50687770001`, otro usuario `+50688881234`, admin `+50688990001`.
- `beforeAll`: `admin.from("listings").delete().not("id","is",null)`; `admin.rpc("seed_admin", { p_phone: "+50688990001" })` tras iniciar sesión una vez con ese número para que exista el perfil.

Casos:
```ts
it("el dueño crea un borrador y la fila nace con CT-#### y status draft")
  // insert { owner_id, title:"", province:"Limón", capacity:1, bedrooms:1, bathrooms:1, nightly_price_crc:1, whatsapp_phone:"+50687770001" } → public_id matches /^CT-\d{4,}$/, status "draft"
it("el dueño no puede activar su propia casa")
  // update { status: "active" } → error.message contains "Solo bnbtico puede cambiar el estado"
it("submit_listing rechaza sin 5 fotos")
  // rpc submit_listing → error.message "Agregá al menos 5 fotos."
it("submit_listing pasa a review con datos completos y falla al repetir")
  // insertar 5 listing_photos (path `${id}/${i}.jpg`), completar título/descr/canton/zone/lat/lng/precio → "review"; segunda llamada → error "Este anuncio ya está en revisión."
it("otro usuario no ve la casa en review ni puede enviarla")
  // select by id → 0 filas; rpc → error
it("review_listing exige motivo para cambios y rechazo")
  // admin rpc { p_decision:"changes", p_note:"  " } → error "Escribí un motivo"
it("review_listing aprueba, registra admin_actions y marca is_owner")
  // → "active"; admin_actions con action "listing.approve"; profiles.is_owner del dueño true
it("anon ve la casa activa en listings_public y listing_link_state devuelve active")
  // cliente anon: select listings_public eq public_id → 1 fila con canton, min_nights; rpc listing_link_state → "active"
it("set_listing_available oculta consultas sin sacar la ficha")
  // dueño rpc false → listings_public.available false
it("una casa parada por el dueño vuelve a draft y el enlace queda blocked")
  // dueño update { status:"draft" } permitido → listing_link_state → "blocked"; listings_public → 0 filas
it("el dueño borra solo borradores")
  // delete borrador → ok; delete de una active (otra fila) → 0 filas afectadas
it("seed_admin no es ejecutable por un usuario normal")
  // cliente dueño rpc seed_admin → error (permission denied)
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
pnpm db:start && pnpm --filter web exec vitest run tests/db
```
Esperado: FAIL (columnas y funciones inexistentes).

- [ ] **Paso 3: Escribir la migración**

`pnpm exec supabase migration new fase2_casas` y rellenar:

1. `alter table listings add column canton …, min_nights …, min_months …, parking_paid …, monthly_mode …` con los checks de Interfaces.
2. `create policy listings_owner_delete on listings for delete using (owner_id = auth.uid() and status = 'draft');`
3. Trigger `listings_protect` (`before update on listings`, `security definer`): si `not is_admin()` y `current_setting('app.allow_status', true) is distinct from 'on'`: `owner_id`, `public_id`, `reviewed_at`, `reviewed_by`, `review_note` no pueden cambiar («No podés cambiar ese dato.»); `status` solo puede cambiar a `'draft'` desde `'active'`, `'changes'` o `'rejected'`; cualquier otro cambio de estado → `raise exception 'Solo bnbtico puede cambiar el estado de un anuncio.'`.
4. `submit_listing`: `security definer`, `set search_path = public`. Comprobaciones en este orden, cada una con su mensaje: dueño (`owner_id = auth.uid()`, si no «No encontramos ese anuncio.»); estado `review` → «Este anuncio ya está en revisión.»; estado distinto de `draft`/`changes` → «Este anuncio no se puede enviar en su estado actual.»; `kind` presente; `title <> ''` y `description <> ''` → «Completá el título y la descripción.»; `province <> ''`, `canton <> ''`, `zone <> ''` → «Completá provincia, cantón y zona aproximada.»; `lat`/`lng` no nulos → «Marcá en el mapa la ubicación aproximada.»; `capacity >= 1`; `bathrooms >= 1`; `bedrooms >= 1` salvo `kind = 'apartamento'`; `nightly_price_crc > 0` y `min_nights >= 1`; si `accepts_monthly`: `monthly_mode` no nulo («Elegí indicar un precio mensual o Consultar con el propietario.»), con `'amount'` `monthly_price_crc > 0`; si no acepta: `monthly_mode`, `monthly_price_crc`, `min_months` nulos; `'parking' = any(features)` ⇒ `parking_paid` no nulo («Indicá si el parqueo es gratuito o de pago.»), si no ⇒ nulo; `count(listing_photos) between 5 and 15` («Agregá al menos 5 fotos.» / «Máximo 15 fotos.»). Luego `perform set_config('app.allow_status','on',true); update listings set status='review', review_note=null where id = p_listing; return 'review';`.
5. `review_listing`: exige `is_admin()` («Solo bnbtico puede revisar anuncios.»), estado `review` («Este anuncio ya tiene una decisión.»), `p_decision in ('approve','changes','reject')`; `p_note` recortada ≤ 2000; para `changes`/`reject` nota obligatoria («Escribí un motivo de hasta 2000 caracteres para pedir cambios o rechazar.»); `approve` exige ≥ 5 fotos («Pedí al menos 5 fotos antes de aprobar.»). Con `set_config` como arriba: actualiza `status` (`active` | `changes` | `rejected`), `review_note = nullif(nota,'')`, `reviewed_at = now()`, `reviewed_by = auth.uid()`; inserta `admin_actions (admin_id, action, target_listing_id, reason)` con `listing.approve` | `listing.changes` | `listing.reject`; al aprobar `update profiles set is_owner = true where id = owner_id`. Devuelve el estado nuevo.
6. `set_listing_available`: dueño y `status = 'active'` («Solo podés cambiar la disponibilidad de una casa activa.»); `update listings set available = p_available, reopen_at = null`.
7. `listing_link_state`: `security definer`, `stable`; `select case when status='active' then 'active' when status='draft' then null else 'blocked' end from listings where public_id = p_public_id`. `grant execute … to anon, authenticated`.
8. `seed_admin`: `security definer`; `update profiles set is_admin = true where phone = p_phone`; `revoke execute on function seed_admin(text) from public, anon, authenticated`.
9. Storage: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('listings','listings',true,10485760,'{image/jpeg,image/webp}') on conflict (id) do nothing;` Políticas sobre `storage.objects` para `insert`, `update`, `delete` a `authenticated`: `bucket_id = 'listings' and exists (select 1 from listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid())`; `select` para `public` con `bucket_id = 'listings'`.
10. `drop view listings_public; create view listings_public as … ` igual que en `0001` más `canton, min_nights, min_months, parking_paid, monthly_mode`.
11. `config.toml`: añadir `50688990001 = "123456"` en `[auth.sms.test_otp]`.

- [ ] **Paso 4: Aplicar y ejecutar**

```bash
pnpm db:reset && pnpm --filter web exec vitest run tests/db
```
Esperado: PASS en los 12 casos.

- [ ] **Paso 5: Commit**

```bash
git add supabase apps/web/vitest.config.mts apps/web/tests/db
git commit -m "Fase 2: migración de casas (columnas, Storage, protección de estado, RPCs de envío y revisión, seed de admin)"
```

---

### Tarea 2: Clientes de Supabase, `isAdmin` en la cuenta y módulo `schema.ts`

**Files:**
- Create: `apps/web/src/lib/supabase/server.ts`, `browser.ts`, `storage.ts`
- Create: `apps/web/src/lib/listings/schema.ts`
- Modify: `apps/web/src/lib/auth/types.ts` (añadir `isAdmin: boolean` a `Account`)
- Modify: `apps/web/src/lib/auth/supabase.ts:48-60` (seleccionar `is_admin`, usar `supabaseServer`-compatible factory), `apps/web/src/lib/auth/demo.ts` (`isAdmin: false`)
- Modify: `apps/web/tests/unit/helpers/fake-supabase.ts`, `apps/web/tests/unit/auth-contract.test.ts` (campo nuevo)
- Test: `apps/web/tests/unit/listings-schema.test.ts`

**Interfaces:**
- Produces:
  - `supabaseServer(): Promise<SupabaseClient | null>` (cookies de Next; `null` sin variables).
  - `supabaseBrowser(): SupabaseClient` (`createBrowserClient` con `NEXT_PUBLIC_*`).
  - `photoUrl(path: string, base = process.env.NEXT_PUBLIC_SUPABASE_URL): string` → `${origin}/storage/v1/object/public/listings/${path}`.
  - En `schema.ts`:
    ```ts
    export type Kind = "casa" | "apartamento" | "habitacion";
    export type Feature = "pool" | "pets" | "wifi" | "ac" | "parking" | "ev" | "kids_free" | "beachfront" | "bbq";
    export type MonthlyMode = "amount" | "contact";
    export type ListingStatus = "draft" | "review" | "changes" | "rejected" | "payment_due" | "active" | "inactive";
    export type Step = 1 | 2 | 3 | 4 | 5;
    export const FEATURES: readonly [Feature, string][]; // Piscina, Mascotas, Wifi, Aire acondicionado, Parqueo, ⚡ Cargador eléctrico, Niños pequeños gratis, Frente al mar, Rancho / BBQ
    export const PROVINCES: readonly string[]; // Guanacaste, Puntarenas, Limón, Alajuela, San José, Heredia, Cartago
    export const DEFAULT_PROVINCE = "Limón";
    export const KIND_LABELS: Record<Kind, string>; // Casa, Apartamento, Habitación
    export const STEP_NAMES = ["Alojamiento", "Ubicación", "Detalles", "Fotos", "Precio"] as const;
    export const MAX_PHOTOS = 15; export const MIN_PHOTOS = 5;
    export const STATUS_LABELS: Record<ListingStatus, { label: string; badge: string }>;
    // draft Borrador badge-mute · review Pendiente de revisión badge-warn · changes Cambios solicitados badge-warn ·
    // rejected Rechazada badge-bad · payment_due Pendiente de pago badge-warn · active Activa badge-ok · inactive Inactiva badge-mute
    export interface ListingDraft {
      kind: Kind | null; acceptsMonthly: boolean | null;
      province: string; canton: string; zone: string; lat: number | null; lng: number | null;
      capacity: number | null; bedrooms: number | null; bathrooms: number | null;
      title: string; description: string; features: Feature[]; parkingPaid: boolean | null;
      photoCount: number;
      nightlyPriceCrc: number | null; minNights: number | null;
      monthlyMode: MonthlyMode | null; monthlyPriceCrc: number | null; minMonths: number | null;
    }
    export interface Photo { id: string; path: string; position: number; url: string }
    export interface Listing extends ListingDraft {
      id: string; publicId: string; ownerId: string; status: ListingStatus; available: boolean;
      reviewNote: string | null; whatsappPhone: string; createdAt: string; updatedAt: string; photos: Photo[];
    }
    export const emptyDraft: () => ListingDraft;
    export function parseColones(input: string): number | null; // null = vacío; NaN = inválido
    export function parseStepForm(step: Step, fd: FormData): Partial<ListingDraft>;
    export function normalize(d: ListingDraft): ListingDraft;
    export function validateStep(step: Step, d: ListingDraft): string | null;
    export function validateAll(d: ListingDraft): { step: Step; error: string } | null;
    ```
  - Campos de formulario (nombres `name=`): `kind`, `acceptsMonthly` (`"yes"|"no"`), `province`, `canton`, `zone`, `lat`, `lng`, `capacity`, `bedrooms`, `bathrooms`, `title`, `description`, `features` (múltiple, valores `Feature`), `parkingPaid` (`"free"|"paid"|""`), `nightlyPriceCrc`, `minNights`, `monthlyMode`, `monthlyPriceCrc`, `minMonths`.

- [ ] **Paso 1: Escribir las pruebas de `schema.ts`**

```ts
describe("parseColones", () => {
  it.each([["95000", 95000], ["95.000", 95000], ["95 000", 95000], ["₡95 000", 95000]])("acepta %s", (i, o) => expect(parseColones(i)).toBe(o));
  it.each(["95,50", "95.5", "abc", "-1"])("rechaza %s", (i) => expect(Number.isNaN(parseColones(i))).toBe(true));
  it("vacío es null", () => expect(parseColones("  ")).toBeNull());
});
describe("validateStep", () => {
  it("paso 1 exige tipo y respuesta mensual explícita") // null → "Elegí Casa, Apartamento o Habitación."; kind ok, acceptsMonthly null → "Respondé si aceptás alquiler mensual."
  it("paso 2 exige provincia de la lista, cantón, zona y pin") // "Completá provincia, cantón y zona aproximada." · lat null → "Marcá en el mapa la ubicación aproximada."
  it("paso 3: estudio con 0 habitaciones pasa; casa con 0 falla")
  it("paso 3: habitaciones vacías o 1.5 fallan, no se convierten en 0")
  it("paso 3: baños 0 falla; parqueo marcado sin tipo falla con 'gratuito o de pago'")
  it("paso 4: 4 fotos falla, 5 pasa, 16 falla con 'Máximo 15 fotos.'")
  it("paso 5: precio NaN o 0 falla; minNights 0 falla")
  it("paso 5: mensual sin modo falla; amount sin importe falla; contact pasa con importe null; minMonths '' pasa y 0 falla")
});
describe("normalize", () => {
  it("quitar parqueo limpia parkingPaid")
  it("acceptsMonthly=false limpia monthlyMode, monthlyPriceCrc y minMonths")
  it("monthlyMode=contact limpia monthlyPriceCrc")
});
describe("parseStepForm", () => {
  it("paso 3 lee features múltiples y parkingPaid 'paid' → true, 'free' → false, '' → null")
  it("paso 5 usa parseColones para precios")
});
describe("validateAll", () => {
  it("devuelve el primer paso con error", () => expect(validateAll(emptyDraft())).toEqual({ step: 1, error: "Elegí Casa, Apartamento o Habitación." }));
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
pnpm --filter web exec vitest run tests/unit/listings-schema.test.ts
```
Esperado: FAIL («Cannot find module»).

- [ ] **Paso 3: Implementar `schema.ts`**

Mensajes exactos de `validateStep`:
- 1: «Elegí Casa, Apartamento o Habitación.» · «Respondé si aceptás alquiler mensual.»
- 2: «Completá provincia, cantón y zona aproximada.» · «Marcá en el mapa la ubicación aproximada.»
- 3: «Indicá cuántas personas pueden alojarse (mínimo 1).» · «Indicá las habitaciones ofrecidas; solo un apartamento tipo estudio puede tener 0.» · «Indicá el número de baños disponibles (mínimo 1).» · «Completá el título y la descripción.» · «Indicá si el parqueo es gratuito o de pago.»
- 4: «Agregá al menos 5 fotos.» · «Máximo 15 fotos.»
- 5: «Indicá un precio por noche en colones, mayor que cero y sin decimales.» · «Indicá la estancia mínima en noches.» · «Elegí indicar un precio mensual o Consultar con el propietario.» · «Indicá un precio mensual válido.» · «La estancia mínima en meses debe ser un número entero mayor que cero.»

`parseColones`: quita `₡`, espacios (incluido ` `) y puntos como separador de miles solo si el patrón es `^\d{1,3}(\.\d{3})+$`; una coma o un punto decimal → `NaN`.

- [ ] **Paso 4: Implementar clientes de Supabase y `isAdmin`**

`server.ts` reutiliza el patrón de `lib/auth/index.ts` (`jar`) con `createServerClient`; `lib/auth/supabase.ts` añade `is_admin` al `select` y `isAdmin: !!data.is_admin`; `demo.ts` fija `isAdmin: false`; actualizar `fake-supabase.ts` y la prueba de contrato para el campo.

- [ ] **Paso 5: Ejecutar todo**

```bash
pnpm --filter web typecheck && pnpm --filter web test
```
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add apps/web/src apps/web/tests/unit
git commit -m "Fase 2: tipos y validación del anuncio, clientes de Supabase para datos e isAdmin en la cuenta"
```

---

### Tarea 3: Repositorio, sesión y formulario de publicación (pasos 1, 2, 3 y 5)

**Files:**
- Create: `apps/web/src/lib/listings/repo.ts`, `apps/web/src/lib/listings/session.ts`
- Create: `apps/web/src/actions/listings.ts`
- Create: `apps/web/src/components/publish/step-form.tsx`, `step-fields.tsx`, `location-picker.tsx`
- Create: `apps/web/app/(app)/propietario/publicar/page.tsx`, `apps/web/app/(app)/propietario/publicar/[id]/[paso]/page.tsx`
- Modify: `apps/web/app/(app)/propietario/page.tsx` (panel real), `apps/web/app/globals.css` (clases `steps`, `badge-warn`, `badge-bad`, `badge-sun`, `field`, `listing`, `photo`, `photos-grid`, `cta-bar`, `seg`, `amen`, `gallery`, `avatar`, `map-box`)
- Modify: `apps/web/package.json` (`leaflet`, `@types/leaflet`)
- Modify: `apps/web/playwright.config.ts` (cargar `.env.local` con `process.loadEnvFile` en `try/catch`)
- Create: `apps/web/tests/e2e/helpers/session.ts`, `apps/web/tests/e2e/helpers/supabase-admin.ts`
- Test: `apps/web/tests/e2e/casas.spec.ts` (primer caso)

**Interfaces:**
- Consumes: `schema.ts`, `supabaseServer`, `auth()`.
- Produces (`repo.ts`, todas reciben `db: SupabaseClient` como primer argumento):
  ```ts
  createDraft(db, ownerId: string, ownerPhone: string): Promise<{ id: string; publicId: string }>;
  getOwnListing(db, id: string): Promise<Listing | null>;
  listOwnListings(db): Promise<Listing[]>;          // más recientes primero, con fotos
  saveStep(db, id: string, patch: Partial<ListingDraft>): Promise<void>; // aplica normalize sobre el merge
  findResumableDraft(db): Promise<Listing | null>;  // el borrador más reciente en 'draft'
  deleteDraft(db, id: string): Promise<Result>;
  toRow(d: Partial<ListingDraft>): Record<string, unknown>; fromRow(row, photos): Listing; // exportadas para pruebas
  ```
  `session.ts`:
  ```ts
  requireOwnerSession(nextPath: string): Promise<{ db: SupabaseClient; account: Account }>; // redirect("/cuenta?next=…") sin sesión; redirect("/propietario?sin-supabase=1") sin db
  requireAdmin(): Promise<{ db: SupabaseClient; account: Account }>; // notFound() si no hay db, sesión o isAdmin
  ```
  `actions/listings.ts`:
  ```ts
  createDraftAction(): Promise<void>;             // crea y redirect(`/propietario/publicar/${id}/1`)
  resumeDraftAction(fd: FormData): Promise<void>; // redirect al paso 1 del id dado
  saveStepAction(prev: ActionState, fd: FormData): Promise<ActionState>; // fd: id, step; valida, guarda, redirect al paso siguiente; en paso 5 redirige a /propietario/casas (el envío llega en Tarea 5)
  ```
  `location-picker.tsx` (cliente): `<LocationPicker province={string} lat={number|null} lng={number|null} />` renderiza `<input type="hidden" name="lat">`, `name="lng"` y un `div` con Leaflet; pin arrastrable con `L.divIcon({ className: "pin-icon" })`; centro inicial `PROVINCE_CENTERS[province]` zoom 9 sin pin, zoom 13 con pin; clic en el mapa coloca el pin; texto bajo el mapa «Mostramos una zona aproximada (radio ~500 m). La dirección exacta solo la compartís vos cuando lo decidás.»
  `PROVINCE_CENTERS`: Limón [9.98,-83.03], Guanacaste [10.63,-85.44], Puntarenas [9.98,-84.84], Alajuela [10.02,-84.21], San José [9.93,-84.08], Heredia [10.00,-84.12], Cartago [9.86,-83.92].
- Rutas: `/propietario/publicar` → si hay borrador reanudable, tarjeta «Tenés un borrador sin enviar» con botones «Seguir con el borrador» (`resumeDraftAction`) y «Empezar otro» (`createDraftAction`); si no, llama a `createDraftAction` directamente. `/propietario/publicar/[id]/[paso]` → `ScreenTitle` «Publicar alojamiento» con `right` «Paso n de 5», `div.steps` con 5 `span` (clase `on` hasta el paso actual), `StepForm`.

- [ ] **Paso 1: Escribir el primer flujo de Playwright**

`tests/e2e/helpers/session.ts`: `registerAndEnter(page, name, phone)` (reproduce el inicio de `cuenta.spec.ts`: `/cuenta`, nombre, WhatsApp, código 123456, «Ahora no · continuar») y `switchToOwner(page)` (`/cuenta` → «¿Tenés una casa? Publicala»).
`tests/e2e/helpers/supabase-admin.ts`: `serviceClient()` con `SUPABASE_SERVICE_ROLE_KEY`; `resetListings()` (borra `listings`); `makeAdmin(phone)` (rpc `seed_admin`).

`tests/e2e/casas.spec.ts`:
```ts
test.describe.configure({ mode: "serial" });
test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "Necesita Supabase local");
test.beforeAll(async () => { await resetListings(); });

test("el borrador se guarda paso a paso y sobrevive a recargar", async ({ page }) => {
  await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
  await switchToOwner(page);
  await page.getByRole("link", { name: "Publicar casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("alert")).toContainText("Elegí Casa, Apartamento o Habitación.");
  await page.getByLabel("Tipo de alojamiento *").selectOption("casa");
  await page.getByLabel("¿Aceptás alquiler mensual? *").selectOption("yes");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/2$/);
  await page.getByLabel("Provincia *").selectOption("Limón");
  await page.getByLabel("Cantón *").fill("Talamanca");
  await page.getByLabel("Zona / playa / barrio *").fill("Manzanillo");
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/3$/);
  await page.getByLabel("Máximo de personas *").fill("5");
  await page.getByLabel("Número de habitaciones ofrecidas *").fill("2");
  await page.getByLabel("Número de baños disponibles *").fill("2");
  await page.getByLabel("Parqueo").check();
  await page.getByLabel("Tipo de parqueo *").selectOption("free");
  await page.getByLabel("Frente al mar").check();
  await page.getByLabel("Título *").fill("Casa Manzanillo, a pie de playa");
  await page.getByLabel("Descripción *").fill("Casa de madera a 80 m de la playa, con rancho y hamacas.");
  await page.reload();
  await expect(page.getByLabel("Título *")).toHaveValue(""); // lo no guardado se pierde…
  await page.goBack(); // …pero el paso 2 sigue guardado
  await page.goto(page.url().replace(/\/3$/, "/2"));
  await expect(page.getByLabel("Cantón *")).toHaveValue("Talamanca");
});
```
(El caso completo del formulario sigue en las Tareas 4 y 5; aquí basta que pasos 1 y 2 persistan y que el paso 3 renderice sus campos.)

- [ ] **Paso 2: Ejecutar y ver que falla**

```bash
cd apps/web && CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm exec playwright test tests/e2e/casas.spec.ts
```
Esperado: FAIL (no existe «Publicar casa»).

- [ ] **Paso 3: Implementar `repo.ts` y `session.ts`**

`toRow`/`fromRow` mapean camelCase ↔ snake_case (`capacity`, `bedrooms`, `bathrooms`, `features`, `parking_paid`, `nightly_price_crc`, `min_nights`, `accepts_monthly`, `monthly_mode`, `monthly_price_crc`, `min_months`, `review_note`, `whatsapp_phone`, `public_id`, `owner_id`). `photoCount = photos.length`. `createDraft` inserta `{ owner_id, status: 'draft', title: '', province: 'Limón', capacity: 1, bedrooms: 1, bathrooms: 1, nightly_price_crc: 1, whatsapp_phone }` y devuelve `id, public_id`. Nota: los valores iniciales de `capacity`, `bedrooms`, `bathrooms`, `nightly_price_crc` cumplen los `check` pero el formulario los muestra vacíos mientras `title === ''`… no: `fromRow` devuelve los números tal cual; `step-fields` muestra `value=""` cuando el campo numérico vale el centinela `1` y el borrador aún no pasó ese paso. Para evitar esa ambigüedad, `createDraft` guarda también `description = ''` y `step-fields` usa `draft.title === "" && value === 1 ? "" : value` solo para `capacity`, `bedrooms`, `bathrooms`; para `nightlyPriceCrc` el centinela `1` siempre se muestra vacío (ningún precio real es ₡1).

- [ ] **Paso 4: Implementar acciones, páginas y componentes**

`StepForm` (cliente, `useActionState(saveStepAction)`): `<form action>` con `hidden id`, `hidden step`, `{children}` (campos), error en `<div class="note" role="alert">`, botones «Atrás» (enlace al paso anterior, deshabilitado en 1) y «Continuar» (`disabled={pending}`); en paso 5 el botón dice «Enviar a revisión» (hasta la Tarea 5 solo guarda).
`step-fields.tsx` (servidor) exporta `StepFields({ step, draft, whatsapp })` con el copy de la especificación §5:
- Paso 1: `<h3>Tu alojamiento vacacional</h3>`, párrafo «Todos los anuncios son de alquiler vacacional. También podés aceptar alquiler mensual.», select «Tipo de alojamiento *» (placeholder «Seleccioná una opción»), select «¿Aceptás alquiler mensual? *» (placeholder, Sí/No), nota «Respondé Sí o No para continuar; no elegimos por vos.»
- Paso 2: `<h3>¿Dónde está?</h3>`, select «Provincia *» con `PROVINCES`, «Cantón *» (`maxLength 80`), «Zona / playa / barrio *» (`maxLength 120`), `LocationPicker`, párrafo «Solo ubicación aproximada. No incluyás la dirección exacta; la compartís directamente cuando lo decidás.»
- Paso 3: `<h3>Detalles del alojamiento</h3>`, «Máximo de personas *», «Número de habitaciones ofrecidas *» con nota «Contá solo las habitaciones que ofrecés. En apartamentos tipo estudio podés indicar 0.», «Número de baños disponibles *»; `<h3>Características principales</h3>` «Marcá lo que ofrece tu alojamiento.» y 9 casillas `name="features"` con las etiquetas de `FEATURES` (la casilla Parqueo lleva `id="feature-parking"`); select «Tipo de parqueo *» (`name="parkingPaid"`, opciones «Gratuito»=`free`, «De pago»=`paid`, placeholder) dentro de un `<div hidden>` que se muestra con la casilla mediante un pequeño componente cliente `ParkingToggle`; «Título *» (`maxLength 100`), «Descripción *» (`textarea rows 4 maxLength 3000`), nota «Sin enlaces, teléfonos ni publicidad de agencias. El contenido se revisa antes de publicar.»
- Paso 5: `<h3>Precio orientativo</h3>`, «Precio por noche (₡) *» (`inputMode="numeric"`), párrafo «Los precios se ingresan en colones (₡). Los clientes pueden verlos convertidos a dólares solo como referencia.», «Estancia mínima (noches) *»; si `acceptsMonthly`: `<h3>Alquiler mensual</h3>`, select «Precio mensual *» («Indicar precio mensual orientativo»=`amount`, «Consultar con el propietario»=`contact`), «Precio mensual (₡) *» visible solo con `amount` (`MonthlyToggle` cliente), nota con `contact` «Se mostrará «Consultar precio mensual con el propietario».», «Estancia mínima del alquiler mensual (meses, opcional)»; nota «Precios orientativos. bnbtico no gestiona reservas ni pagos entre las partes.»; tarjeta «WhatsApp de tu cuenta» con `formatPhone(whatsapp)` y «Un único número para todos tus anuncios. No se muestra en la ficha pública.»
- Paso 4 muestra por ahora «Las fotos llegan en el siguiente paso del plan» (se sustituye en Tarea 4).

Panel `/propietario`: `ScreenTitle` «Tu panel», saludo «Hola, {nombre}» (si hay sesión), botón primario «Publicar casa» (`Link` a `/propietario/publicar`), sección «Mis casas» con `listOwnListings` (tarjetas simples: título o «Borrador sin título», badge de `STATUS_LABELS`) o «Todavía no publicaste ninguna casa.» Si `?sin-supabase=1` o `supabaseServer()` es null: `note` «Esta pantalla necesita Supabase. En local: `pnpm db:start`.»

- [ ] **Paso 5: Ejecutar**

```bash
pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test
cd apps/web && CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm exec playwright test
```
Esperado: PASS (incluidos `cuenta.spec.ts` y `smoke.spec.ts`).

- [ ] **Paso 6: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "Fase 2: formulario de publicación con borrador persistente, mapa con pin y panel del propietario"
```

---

### Tarea 4: Fotos a Storage

**Files:**
- Create: `apps/web/src/lib/image.ts` (puro, probable con Vitest), `apps/web/src/components/publish/photo-uploader.tsx`
- Modify: `apps/web/src/lib/listings/repo.ts` (fotos), `apps/web/src/actions/listings.ts` (acciones de fotos), `apps/web/src/components/publish/step-fields.tsx` (paso 4)
- Test: `apps/web/tests/unit/image.test.ts`; `apps/web/tests/e2e/casas.spec.ts` (extender el primer caso hasta el paso 4)

**Interfaces:**
- `image.ts`:
  ```ts
  export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
  export const MAX_SIDE = 1600;
  export function acceptsImage(file: { type: string; name: string }): boolean; // por tipo o extensión .jpg/.jpeg/.png/.webp; HEIC/HEIF → false
  export function targetSize(w: number, h: number, maxSide = MAX_SIDE): { w: number; h: number }; // escala proporcional, nunca agranda
  export function photoPath(listingId: string, uuid: string): string; // `${listingId}/${uuid}.jpg`
  ```
- `repo.ts`: `addPhoto(db, listingId, path): Promise<Photo>` (position = fotos actuales); `removePhoto(db, listingId, photoId): Promise<Result>` (borra el objeto de Storage y la fila, y recompacta `position`); `setCover(db, listingId, photoId): Promise<Result>` (esa foto a 0, el resto desplazado).
- `actions/listings.ts`: `addPhotoAction(listingId, path): Promise<ActionState & { photo?: Photo }>`; `removePhotoAction(listingId, photoId)`; `setCoverAction(listingId, photoId)`. Las tres revalidan `/propietario/publicar/${id}/4`.
- `PhotoUploader` (cliente): props `{ listingId: string; photos: Photo[] }`. `<input type="file" accept="image/*" multiple>` con etiqueta «Agregar fotos»; por archivo: `acceptsImage` → si no, mensaje «Ese formato no se puede subir. Usá JPG o PNG.»; decodifica con `createImageBitmap`, dibuja en `canvas` con `targetSize`, `toBlob("image/jpeg", 0.85)`, sube con `supabaseBrowser().storage.from("listings").upload(photoPath(listingId, crypto.randomUUID()), blob, { contentType: "image/jpeg" })`, luego `addPhotoAction`. Cuadrícula `photos-grid` con la portada (posición 0, etiqueta «Portada»), botones «Hacer portada» y «Quitar» por foto; `<p role="status">{n} fotos</p>`; con ≥ 15 el input se deshabilita y aparece «Máximo 15 fotos.»; `hidden name="photoCount"` para que `saveStepAction` valide el paso 4 con `validateStep(4)`.

- [ ] **Paso 1: Pruebas unitarias de `image.ts`**

```ts
it("acepta jpg/png/webp por tipo o extensión y rechaza HEIC", …) // {type:"image/heic", name:"a.heic"} → false; {type:"", name:"b.JPG"} → true
it("targetSize reduce el lado mayor a 1600 y no agranda", …) // 4000×3000 → 1600×1200; 800×600 → 800×600
it("photoPath", () => expect(photoPath("abc", "u1")).toBe("abc/u1.jpg"));
```

- [ ] **Paso 2: Extender Playwright**

Tras el paso 3 del primer caso, rellenar y «Continuar» hasta el paso 4; generar 5 JPEG en el navegador:
```ts
const jpeg = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d")!; x.fillStyle = "#1f8a70"; x.fillRect(0, 0, 640, 480); return c.toDataURL("image/jpeg", 0.8).split(",")[1]; });
const files = Array.from({ length: 5 }, (_, i) => ({ name: `foto-${i}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(jpeg, "base64") }));
await page.getByLabel("Agregar fotos").setInputFiles(files);
await expect(page.getByRole("status")).toHaveText("5 fotos");
await page.getByRole("button", { name: "Continuar" }).click();
await expect(page).toHaveURL(/\/5$/);
```
Y antes de subir: con 4 fotos, «Continuar» muestra «Agregá al menos 5 fotos.»

- [ ] **Paso 3: Ejecutar y ver que falla**

```bash
pnpm --filter web exec vitest run tests/unit/image.test.ts
```
Esperado: FAIL.

- [ ] **Paso 4: Implementar `image.ts`, fotos en `repo.ts`, acciones y `PhotoUploader`; paso 4 en `step-fields`**

Paso 4 copy: `<h3>Fotos del alojamiento</h3>`, «Mínimo 5 fotos, con una portada. Sin teléfonos, enlaces ni publicidad de agencias.», `PhotoUploader`.

- [ ] **Paso 5: Ejecutar todo (unit, typecheck, lint, e2e)**

Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add apps/web
git commit -m "Fase 2: fotos del anuncio redimensionadas en el navegador y subidas a Storage"
```

---

### Tarea 5: Enviar a revisión y Mis casas

**Files:**
- Modify: `apps/web/src/lib/listings/repo.ts` (`submit`), `apps/web/src/actions/listings.ts` (`saveStepAction` paso 5 → submit; `deleteDraftAction`)
- Create: `apps/web/src/components/listing/status-badge.tsx`, `owner-card.tsx`
- Modify: `apps/web/app/(app)/propietario/casas/page.tsx` (sustituye el `Placeholder`)
- Test: `apps/web/tests/e2e/casas.spec.ts` (cerrar el primer caso)

**Interfaces:**
- `repo.ts`: `submit(db, id): Promise<Result>` → `db.rpc("submit_listing", { p_listing: id })`, traduce `error.message` tal cual (ya viene en español) o «No pudimos enviar el anuncio. Intentá de nuevo.» si está vacío.
- `saveStepAction` en paso 5: guarda, `validateAll` (si falla redirige al paso con error en `?error=`), `submit`, `redirect("/propietario/casas?enviada=1")`.
- `deleteDraftAction(fd)`: `id`; `redirect("/propietario/casas")`.
- `StatusBadge({ status, available })`: `STATUS_LABELS`; con `active && !available` muestra «No disponible» `badge-mute`.
- `OwnerCard({ listing, base })`: `article.listing` con portada (`photoUrl`) o bloque `photo` gris «Sin fotos»; título (`Link` a `/propietario/casas/${id}`) o «Borrador sin título»; `StatusBadge`; `formatCRC(nightlyPriceCrc) / noche` si hay precio real; si `reviewNote` y estado `changes`/`rejected`: `div.note` con «Nota de bnbtico: {reviewNote}»; en `draft`: botones «Seguir» (`Link` al paso 1) y «Descartar» (`form` → `deleteDraftAction`); en `active`: botón «Compartir ficha» (`ShareButton`, llega en Tarea 9; aquí un `Link` a `/casa/${publicId}` con el mismo texto).
- Página `/propietario/casas`: `ScreenTitle` «Mis casas» con `right` botón «Nueva» (`Link` a `/propietario/publicar`); si `?enviada=1`: `div.note role="status"` «Anuncio enviado a revisión. Te avisamos cuando esté listo.»; lista de `OwnerCard` o «Todavía no publicaste ninguna casa.»

- [ ] **Paso 1: Cerrar el caso de Playwright**

Tras llegar al paso 5:
```ts
await page.getByLabel("Precio por noche (₡) *").fill("85.000");
await page.getByLabel("Estancia mínima (noches) *").fill("2");
await page.getByLabel("Precio mensual *").selectOption("contact");
const submit = page.getByRole("button", { name: "Enviar a revisión" });
await submit.click();
await expect(page).toHaveURL(/\/propietario\/casas\?enviada=1/);
await expect(page.getByRole("status")).toContainText("Anuncio enviado a revisión");
await expect(page.getByText("Pendiente de revisión")).toBeVisible();
await expect(page.getByText("₡85 000")).toBeVisible();
```

- [ ] **Paso 2: Ejecutar y ver que falla** (Playwright). Esperado: FAIL en «Enviar a revisión».

- [ ] **Paso 3: Implementar `submit`, el paso 5 de la acción, `deleteDraftAction`, `StatusBadge`, `OwnerCard` y la página**

- [ ] **Paso 4: Ejecutar todo**. Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "Fase 2: envío a revisión y Mis casas con estados y notas del admin"
```

---

### Tarea 6: Admin · cola y revisión

**Files:**
- Modify: `apps/web/src/lib/listings/repo.ts` (`queue`, `getForAdmin`, `review`)
- Create: `apps/web/src/actions/admin.ts`, `apps/web/src/components/admin/review-form.tsx`, `apps/web/src/components/listing/gallery.tsx`
- Create: `apps/web/app/(app)/admin/page.tsx`, `apps/web/app/(app)/admin/casas/[id]/page.tsx`
- Modify: `apps/web/app/(app)/cuenta/page.tsx` (enlace «Revisión de anuncios» si `account.isAdmin`)
- Test: `apps/web/tests/e2e/casas.spec.ts` (segundo caso)

**Interfaces:**
- `repo.ts`:
  ```ts
  export interface QueueItem { listing: Listing; ownerName: string }
  queue(db): Promise<QueueItem[]>;   // status 'review' primero (created_at asc), luego decididas en 30 días (reviewed_at desc)
  getForAdmin(db, id): Promise<QueueItem | null>;
  review(db, id, decision: "approve" | "changes" | "reject", note: string): Promise<Result>; // rpc review_listing
  ```
  (`profiles` es legible por admin vía RLS; `select *, profiles!owner_id(full_name)`.)
- `actions/admin.ts`: `reviewAction(prev: ActionState, fd: FormData): Promise<ActionState>` con `id`, `decision`, `note`; `requireAdmin()`; en éxito `revalidatePath` y devuelve `{ ok: true }`.
- `Gallery({ photos, title })` (cliente): cuadrícula de miniaturas (botones «Ampliar foto n», la primera «Portada»); al elegir, bloque `aria-live="polite"` con «Foto n de N» (y « · Portada» si n = 1), imagen grande, «Anterior», «Siguiente», «Cerrar ampliación».
- `ReviewForm({ listingId, status, note, photoCount })` (cliente): si `status === "review"`: textarea «Motivo o indicaciones» (`maxLength 2000`, placeholder «Explicá qué debe corregir el propietario…», ayuda «Obligatorio para pedir cambios o rechazar; opcional al aprobar.»), error `role="alert"`, botones «Aprobar anuncio» (`disabled` si `photoCount < 5`), «Pedir cambios», «Rechazar anuncio» (cada uno `formAction` con `decision`). Si no: `div.note role="status"` con `<b>{STATUS_LABELS.label}</b>` y la nota o «Sin nota adicional.»
- `/admin`: `requireAdmin`; «Revisión de anuncios» con badge «{n} pendientes»; tarjetas con `ownerName`, título, «Enviado {fecha es-CR}», `StatusBadge`, botón «Revisar» (`Link`). Vacía: «No hay anuncios pendientes.»
- `/admin/casas/[id]`: `ScreenTitle` «Revisar anuncio» volver a `/admin`; tarjeta con `StatusBadge`, `publicId`, `h1` título, «Publicado por {ownerName}»; «Fotos (n)» con `Gallery` y, si `n < 5`, `note` «Faltan fotos: se requieren al menos 5 para aprobar.»; «Descripción» (`white-space: pre-wrap`); «Ubicación y alojamiento» (`dl`: Provincia, Cantón, Zona aproximada, Tipo, Máximo de personas, Habitaciones, Baños) con «Sin dirección exacta.»; mapa (`ApproxMap` de la Tarea 7; hasta entonces, texto «lat, lng»); «Características» (`dl` con las 9: Sí/No; Parqueo → «Gratuito» / «De pago» / «No»); «Precios y condiciones» (Precio por noche `formatCRC + " · orientativo"`, Mínimo de noches, Acepta alquiler mensual Sí/No, Precio mensual («Consultar con el propietario» o `formatCRC + " · orientativo"`), Mínimo de meses o «No informado»); «Revisión y decisión» con «Comprobá que fotos y descripción correspondan al anuncio y no incluyan teléfonos, enlaces ni publicidad de agencias.» y `ReviewForm`; botón «Volver a anuncios».

- [ ] **Paso 1: Segundo caso de Playwright**

```ts
test("el admin revisa: pedir cambios exige motivo; aprobar activa la casa", async ({ browser }) => {
  const ctx = await browser.newContext(devices["Pixel 7"]); const page = await ctx.newPage();
  await registerAndEnter(page, "Admin Prueba", "8899 0001");
  await makeAdmin("+50688990001");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Revisión de anuncios" })).toBeVisible();
  await expect(page.getByText("1 pendientes")).toBeVisible();
  await page.getByRole("link", { name: "Revisar" }).click();
  await expect(page.getByRole("heading", { name: "Casa Manzanillo, a pie de playa" })).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("Consultar con el propietario")).toBeVisible();
  await page.getByRole("button", { name: "Ampliar foto 1, portada" }).click();
  await expect(page.getByText("Foto 1 de 5 · Portada")).toBeVisible();
  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(page.getByRole("alert")).toContainText("Escribí un motivo");
  await page.getByRole("button", { name: "Aprobar anuncio" }).click();
  await expect(page.getByRole("status")).toContainText("Activa");
  await ctx.close();
});
```
Y un caso negativo: un usuario sin `isAdmin` recibe 404 en `/admin` (`expect(await page.goto("/admin")).toHaveProperty("status", 404)` usando el contexto del propietario).

- [ ] **Paso 2: Ejecutar y ver que falla**. Esperado: FAIL (404 en `/admin`).

- [ ] **Paso 3: Implementar**

- [ ] **Paso 4: Ejecutar todo**. Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "Fase 2: admin con cola de anuncios, revisión completa y decisiones con motivo"
```

---

### Tarea 7: Ficha pública con vista previa para WhatsApp

**Files:**
- Create: `apps/web/src/lib/listings/geo.ts`, `share.ts`, `apps/web/src/lib/currency.ts`, `apps/web/src/actions/currency.ts`
- Create: `apps/web/src/components/listing/approx-map.tsx`, `readonly-calendar.tsx`, `currency-toggle.tsx`
- Modify: `apps/web/src/lib/listings/repo.ts` (`getPublic`, `linkState`, `PublicListing`), `apps/web/app/sitemap.ts`, `apps/web/app/(app)/admin/casas/[id]/page.tsx` (usar `ApproxMap`)
- Create: `apps/web/app/(app)/casa/[publicId]/page.tsx`
- Test: `apps/web/tests/unit/geo.test.ts`, `share.test.ts`, `currency.test.ts`; `apps/web/tests/e2e/casas.spec.ts` (tercer caso)

**Interfaces:**
```ts
// geo.ts
export const JITTER_METERS = 500;
export function approximate(lat: number, lng: number, seed: string): { lat: number; lng: number };
export function distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number;
export function inCostaRica(lat: number, lng: number): boolean; // lat 8.0–11.3, lng -86.0 … -82.5
// share.ts
export function parsePublicId(raw: string): string | null; // trim, upper; /^CT-\d{4,}$/ o null
export function publicUrl(publicId: string, base: string): string; // `${base}/casa/${publicId}`
export function shareBase(env: { NEXT_PUBLIC_STAGE?: string; NODE_ENV?: string }, origin: string | null): string; // SITE_URL en producción sin stage; si no, origin ?? SITE_URL
export function previewText(l: { kind: Kind; zone: string; province: string; capacity: number; nightlyPriceCrc: number }): string;
// → `${KIND_LABELS[kind]} en ${zone}, ${province} · ${capacity} personas · ${formatCRC(price)} por noche · orientativo`
// currency.ts
export type Currency = "CRC" | "USD";
export const CURRENCY_COOKIE = "bnbtico_currency";
export function currentCurrency(): Promise<Currency>; // server-only
export function parseCurrency(v: string | undefined): Currency; // USD solo si === "USD"
// actions/currency.ts
export async function setCurrencyAction(fd: FormData): Promise<void>; // currency, next (safeNext) → cookie 1 año, redirect(next ?? "/explorar")
// repo.ts
export interface PublicListing { publicId; kind; title; description; province; canton; zone; lat: number|null; lng: number|null; capacity; bedrooms; bathrooms; features; parkingPaid; nightlyPriceCrc; minNights; acceptsMonthly; monthlyMode; monthlyPriceCrc; minMonths; available; ownerName; ownerWhatsappVerified: boolean; createdAt; photos: Photo[] }
getPublic(db, publicId): Promise<PublicListing | null>; // listings_public + listing_photos; lat/lng ya pasados por approximate(seed = publicId)
linkState(db, publicId): Promise<"active" | "blocked" | null>;
listActivePublicIds(db): Promise<{ publicId: string; updatedAt: string }[]>; // para el sitemap
```
- `ApproxMap({ lat, lng })` (cliente): Leaflet con `L.circle([lat,lng], { radius: 500 })`, zoom 14, sin pin, `dragging` y `scrollWheelZoom` desactivados. Debajo: «Ubicación aproximada. La dirección exacta la comparte el propietario.»
- `ReadonlyCalendar({ note })`: mes actual (`America/Costa_Rica`), fila L K M J V S D, celdas con el día sin cifras, cabecera «{Mes} {año}» en es-CR; debajo `<p class="xs muted">{note}</p>`.
- `CurrencyToggle({ currency, next })`: `div.seg aria-label="Moneda"` con dos botones en un `form action={setCurrencyAction}`: «₡ Colones» (`aria-pressed`), «$ Dólares».
- Página `/casa/[publicId]`:
  - `generateMetadata`: `parsePublicId` inválido → `{ title: "Ficha no disponible" }`; activa → `title: listing.title`, `description: previewText`, `alternates.canonical: publicUrl(id, SITE_URL)`, `openGraph { type: "article", title, description, url, images: [portada 1200×900] }`, `twitter.card = "summary_large_image"`; no activa → `robots: { index: false }`.
  - Render activo: `ScreenTitle` sin título con volver a `/explorar` y `right` = `ShareButton` (Tarea 9; hasta entonces nada); `Gallery` en modo lectura (misma `Gallery`); badges «✓ WhatsApp verificado» (si `ownerWhatsappVerified`) y «Ref {publicId}»; si `!available` badge «No disponible por ahora»; `h1` título; línea «{zone}, {canton}, {province}»; descripción `pre-wrap`; «Lo que ofrece» (`div.amen`): «{capacity} personas», «{bedrooms} habitaciones» (singular si 1), «{bathrooms} baños», y cada `FEATURES` presente (Parqueo con « · gratuito» / « · de pago»); «Disponibilidad y precio orientativo» con `CurrencyToggle` al lado y `ReadonlyCalendar` con nota «{precio} por noche, salvo los días marcados con otro precio. Precios orientativos.» (precio con `formatMoney(nightly, currency)`); si `currency === "USD"` añade «Precios convertidos a dólares solo para orientarte (≈ ₡510 por US$1). El propietario cobra en colones.»; si `acceptsMonthly`: «Mensual: {formatMoney} / mes · orientativo» o «Mensual: consultar precio con el propietario»; «Ubicación aproximada» con `ApproxMap`; tarjeta del propietario: `span.avatar` inicial, `b` nombre, «WhatsApp verificado · en bnbtico desde {año de createdAt}»; una `div.note.small`: «Sin comisiones: fechas, precio y pago los acordás con {primer nombre} por WhatsApp. bnbtico no procesa pagos; no transfieras sin confirmar la casa. Para escribirle necesitás tu WhatsApp verificado.»; `div.cta-bar`: precio una vez («{formatMoney} / noche» y «orientativo») y `button disabled` «Contactar por WhatsApp» con `small` «Disponible pronto».
  - `linkState === "blocked"`: `ScreenTitle` «Ficha no disponible», tarjeta «Este enlace ya no está activo», «Este anuncio no está disponible en este momento.», «Si ya hablaste con el propietario por WhatsApp, podés seguir esa conversación por tu cuenta.», `Link` «Explorar otras casas». `null` → `notFound()`.
- `sitemap.ts`: portada + `listActivePublicIds` con `supabaseServer()` (si es null, solo portada).

- [ ] **Paso 1: Pruebas unitarias**

```ts
// geo.test.ts
it("approximate es determinista y queda a ≤ 500 m", …) // dos llamadas iguales → mismo punto; distanceMeters ≤ 500 y > 0
it("seeds distintos dan puntos distintos")
it("inCostaRica", …) // 9.98,-83.03 true; 0,0 false
// share.test.ts
it.each([["ct-1001","CT-1001"],[" CT-1001 ","CT-1001"],["CT-12","" ],["casa",""]])("parsePublicId %s", (i,o)=>expect(parsePublicId(i) ?? "").toBe(o));
it("publicUrl", () => expect(publicUrl("CT-1001", "https://bnbtico.com")).toBe("https://bnbtico.com/casa/CT-1001"));
it("shareBase usa SITE_URL en producción y el origen en pruebas/local")
it("previewText", () => expect(previewText({ kind:"casa", zone:"Manzanillo", province:"Limón", capacity:5, nightlyPriceCrc:85000 })).toBe("Casa en Manzanillo, Limón · 5 personas · ₡85 000 por noche · orientativo"));
// currency.test.ts
it("parseCurrency: USD solo con 'USD'", …)
it("formatMoney en USD redondea al dólar con 510", () => expect(formatMoney(85000, "USD")).toBe("$167"));
```

- [ ] **Paso 2: Tercer caso de Playwright**

```ts
test("la ficha pública abre sin sesión con metadatos y moneda", async ({ browser }) => {
  const ctx = await browser.newContext(devices["Pixel 7"]); const page = await ctx.newPage();
  const publicId = await publicIdOf("Casa Manzanillo, a pie de playa"); // helper con serviceClient
  await page.goto(`/casa/${publicId.toLowerCase()}`);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Manzanillo, a pie de playa" })).toBeVisible();
  await expect(page.getByText("✓ WhatsApp verificado")).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("Piscina")).toHaveCount(0);
  await expect(page.locator(".cta-bar")).toContainText("₡85 000");
  await expect(page.getByText("Mensual: consultar precio con el propietario")).toBeVisible();
  await expect(page.getByRole("button", { name: /Contactar por WhatsApp/ })).toBeDisabled();
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain("Casa Manzanillo");
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(/storage\/v1\/object\/public\/listings\//);
  await page.getByRole("button", { name: "$ Dólares" }).click();
  await expect(page.locator(".cta-bar")).toContainText("$167");
  await expect(page.getByText(/≈ ₡510 por US\$1/)).toBeVisible();
  const r = await page.goto("/casa/CT-0001"); expect(r?.status()).toBe(404);
  await ctx.close();
});
```

- [ ] **Paso 3: Ejecutar y ver que falla** (unit y e2e). Esperado: FAIL.

- [ ] **Paso 4: Implementar**

`approximate`: hash FNV-1a del seed → ángulo `θ = (h % 360)` grados y distancia `d = 150 + (h >> 9) % 350` metros; `dLat = d·cos θ / 111_320`, `dLng = d·sin θ / (111_320·cos lat)`.

- [ ] **Paso 5: Ejecutar todo**. Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add apps/web
git commit -m "Fase 2: ficha pública con vista previa para WhatsApp, mapa aproximado, moneda y enlace inactivo"
```

---

### Tarea 8: Explorar con filtros

**Files:**
- Create: `apps/web/src/lib/listings/filters.ts`, `apps/web/src/components/explore/filters.tsx`, `apps/web/src/components/listing/listing-card.tsx`
- Modify: `apps/web/src/lib/listings/repo.ts` (`search`, `provincesWithListings`), `apps/web/app/(app)/explorar/page.tsx`
- Test: `apps/web/tests/unit/listings-filters.test.ts`; `apps/web/tests/e2e/casas.spec.ts` (cuarto caso)

**Interfaces:**
```ts
export const PEOPLE_OPTIONS = [0, 2, 4, 6, 8, 12] as const; export const BEDS_OPTIONS = [0, 1, 2, 3, 4] as const;
export interface Filters { prov: string; ppl: number; beds: number; features: Feature[]; min: number; max: number; open: boolean }
export function parseFilters(params: Record<string, string | string[] | undefined>, provinces: string[]): Filters;
// prov: si params.prov ∈ provinces o "Todas" → ese; si no → "Limón" si está en provinces, si no "Todas". ppl/beds fuera de lista → 0.
// features: claves de FEATURES con valor "1". min/max enteros ≥ 0 (parseColones, NaN → 0); si min > max > 0 se intercambian. open: params.mas === "1".
export function toSearchParams(f: Filters, defaults: { prov: string }): URLSearchParams; // omite valores por defecto y open
export function extrasCount(f: Filters): number; // (ppl>0)+(beds>0)+features.length+(min>0)+(max>0)
export function provinceChips(provinces: string[]): string[]; // ["Todas", ...PROVINCES.filter(p => provinces.includes(p))]
// repo.ts
search(db, f: Filters): Promise<PublicListing[]>; // province eq salvo "Todas"; capacity gte ppl; bedrooms gte beds; features contains; price gte/lte; order created_at desc; limit 60
provincesWithListings(db): Promise<string[]>;
```
- `ExploreFilters({ filters, provinces, count, currency })` (servidor, un `<form method="get" action="/explorar">`): «Zona» con chips de `provinceChips` (`Link` que conserva el resto de filtros, `aria-pressed`); «Para quiénes» con dos `select` («Personas»: «Cualquiera», «2+ personas»…; «Habitaciones»: «Cualquiera», «1+»…) con `onChange` → `form.requestSubmit()` vía un componente cliente mínimo `AutoSubmit`; bloque plegable (`open = filters.open || extrasCount > 0`): «Qué necesitan» con 9 chips `<label class="chip"><input type="checkbox" name={feature} value="1" hidden>…</label>` (envío al cambiar), «Precio por noche» con «Mín ₡» / «Máx ₡» (`inputMode="numeric"`, `aria-label` «Precio mínimo por noche» / «Precio máximo por noche») y botón «Aplicar»; botón-enlace «Más filtros» / «Menos filtros» (`?mas=1`) con badge `extrasCount` y «Limpiar» (enlace a `/explorar?prov=…`) si hay extras. Línea de resultados: «{n} casa(s){prov !== "Todas" ? " en " + prov : ""} · precios orientativos, acordalos con el propietario» y `CurrencyToggle` al lado; con USD la nota «Precios convertidos a dólares solo para orientarte (≈ ₡510 por US$1). Los propietarios fijan sus precios en colones.»
- `ListingCard({ listing, currency })`: `Link` a `/casa/${publicId}` con portada, título, «{zone}, {province}», «{capacity} personas · {bedrooms} habitaciones», `formatMoney(nightly, currency)` «/ noche».
- Página: `ScreenTitle` «¿A dónde vas?»; sin Supabase → `note`; sin casas en la base → «Todavía no hay casas publicadas.»; sin resultados → «Sin resultados con esos filtros.»

- [ ] **Paso 1: Pruebas unitarias**

```ts
it("Limón por defecto si tiene casas; Todas si no")
it("una provincia de la URL sin casas cae al valor por defecto")
it("ppl y beds fuera de lista → 0; features solo con '1'")
it("min > max se intercambian; precios con separadores se aceptan")
it("extrasCount no cuenta la provincia")
it("toSearchParams omite defaults", () => expect(toSearchParams(parseFilters({}, ["Limón"]), { prov: "Limón" }).toString()).toBe(""));
it("provinceChips respeta el orden del prototipo", () => expect(provinceChips(["Cartago","Limón"])).toEqual(["Todas","Limón","Cartago"]));
```

- [ ] **Paso 2: Cuarto caso de Playwright**

```ts
test("Explorar arranca en Limón, filtra y limpia", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByText("1 casa en Limón")).toBeVisible();
  await expect(page.getByRole("link", { name: "Limón" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Cartago" })).toHaveCount(0);
  await page.getByRole("link", { name: /Más filtros/ }).click();
  await page.getByLabel("Piscina").check();
  await expect(page.getByText("Sin resultados con esos filtros.")).toBeVisible();
  await expect(page.getByText(/Menos filtros/)).toContainText("1");
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page.getByText("1 casa en Limón")).toBeVisible();
  await page.getByRole("link", { name: "Casa Manzanillo, a pie de playa" }).click();
  await expect(page).toHaveURL(/\/casa\/CT-\d+/);
});
```

- [ ] **Paso 3: Ejecutar y ver que falla**. Esperado: FAIL.

- [ ] **Paso 4: Implementar**

- [ ] **Paso 5: Ejecutar todo**. Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add apps/web
git commit -m "Fase 2: Explorar con filtros en la URL, Limón por defecto y provincias con casas"
```

---

### Tarea 9: Detalle de la casa del propietario · compartir, disponibilidad, editar

**Files:**
- Create: `apps/web/src/components/listing/share-button.tsx`, `apps/web/app/(app)/propietario/casas/[id]/page.tsx`
- Modify: `apps/web/src/lib/listings/repo.ts` (`setAvailable`, `reopenForEdit`), `apps/web/src/actions/listings.ts` (`setAvailableAction`, `startEditAction`), `owner-card.tsx` (usar `ShareButton`), `app/(app)/casa/[publicId]/page.tsx` (`ShareButton` en `right`)
- Test: `apps/web/tests/e2e/casas.spec.ts` (quinto y sexto casos)

**Interfaces:**
```ts
// repo.ts
setAvailable(db, id, value: boolean): Promise<Result>;   // rpc set_listing_available
reopenForEdit(db, id): Promise<Result>;                   // update status 'draft' si status ∈ active|changes|rejected… solo 'active' cambia; 'changes' se edita sin tocar el estado
// actions/listings.ts
setAvailableAction(fd): Promise<void>;  // id, available "1"|"0"; revalidatePath
startEditAction(fd): Promise<void>;     // id; si active → reopenForEdit; redirect(`/propietario/publicar/${id}/1`)
```
- `ShareButton({ url, title, text })` (cliente): `navigator.share` si existe; si no `navigator.clipboard.writeText(url)` y muestra `role="status"` «Enlace copiado». Texto «Compartir ficha» (en la ficha pública, «Compartir»).
- `/propietario/casas/[id]`: `requireOwnerSession`; `getOwnListing` o `notFound()`; `ScreenTitle` título con volver a `/propietario/casas`; portada; tarjeta con precio y `StatusBadge` y texto por estado (`draft`: «Todavía no la enviaste a revisión.»; `review`: «La estamos revisando. Te avisamos cuando esté lista.»; `changes`/`rejected`: nota del admin; `active`: «Visible en bnbtico. Compartí el enlace con tus clientes.»); tarjeta «Ficha»: `ShareButton` (deshabilitado si no está activa) con `publicUrl(publicId, shareBase)` y «Enviá el enlace por WhatsApp o compartilo en tus redes.»; tarjeta «Gestión»: para `active`: form `setAvailableAction` con botón «Marcar no disponible» / «Marcar disponible» y texto «No disponible cierra consultas nuevas sin ocultar la ficha.»; botón «Editar» (`startEditAction`) con, si está activa, aviso previo «Tu casa dejará de verse mientras la revisamos.» y confirmación (`ConfirmSubmit` cliente con `confirm()`); para `changes`: «Corregir y reenviar» (`startEditAction`); para `draft`: «Seguir» y «Descartar borrador» (`deleteDraftAction`); `rejected`: sin acciones de edición, texto «Este anuncio fue rechazado. Si querés, publicá uno nuevo.»

- [ ] **Paso 1: Quinto y sexto casos de Playwright**

```ts
test("no disponible, editar y reenviar", async ({ page }) => {
  // sesión del propietario (registerAndEnter 8777 0001 de nuevo inicia sesión)
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: "Casa Manzanillo, a pie de playa" }).click();
  await page.getByRole("button", { name: "Marcar no disponible" }).click();
  await expect(page.getByText("No disponible")).toBeVisible();
  const publicId = await publicIdOf("Casa Manzanillo, a pie de playa");
  const guest = await (await browser.newContext(devices["Pixel 7"])).newPage();
  await guest.goto(`/casa/${publicId}`); await expect(guest.getByText("No disponible por ahora")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/publicar\/.+\/1$/);
  await guest.goto(`/casa/${publicId}`); await expect(guest.getByText("Este enlace ya no está activo")).toBeVisible();
  // avanzar 1→5 con Continuar (datos ya guardados) y Enviar a revisión
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();
});
test("pedir cambios: el propietario ve el motivo, corrige y reenvía", async ({ browser }) => {
  // admin: /admin → Revisar → textarea "Necesitamos fotos de la cocina." → Pedir cambios → status "Cambios solicitados"
  // propietario: /propietario/casas → note contiene "Nota de bnbtico: Necesitamos fotos de la cocina." → Corregir y reenviar → …→ Enviar a revisión → "Pendiente de revisión"
  // admin: /admin → "1 pendientes"
});
```

- [ ] **Paso 2: Ejecutar y ver que falla**. Esperado: FAIL.

- [ ] **Paso 3: Implementar**

- [ ] **Paso 4: Ejecutar todo**. Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "Fase 2: detalle de la casa del propietario con compartir, disponibilidad y edición con reenvío"
```

---

### Tarea 10: Documentación, limpieza y cierre

**Files:**
- Modify: `docs/decisiones.md` (entrada «2026-10-XX · Fase 2 construida en develop»), `docs/plan-implementacion.md` (sección Estado: fase 2 hecha, siguiente fase 3), `docs/configuracion-supabase.md` (paso 8 «Marcar tu cuenta como admin» + `db push` de la migración + bucket), `CLAUDE.md` (Entornos: número de prueba `8899 0001` como admin local; `SUPABASE_SERVICE_ROLE_KEY` solo pruebas)
- Modify: `apps/web/src/components/placeholder.tsx` (seguir usándolo solo en calendario y consultas)
- Delete: nada

- [ ] **Paso 1: Ejecutar la batería completa en frío**

```bash
pnpm db:reset && pnpm typecheck && pnpm lint && pnpm test && pnpm test:prototype
cd apps/web && CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm exec playwright test
```
Esperado: todo PASS. Además `AUTH_PROVIDER=demo pnpm exec playwright test tests/e2e/cuenta.spec.ts tests/e2e/smoke.spec.ts` PASS (fase 1 en demo).

- [ ] **Paso 2: Escribir la entrada de `decisiones.md`**

Debe recoger: casas solo en Supabase (demo solo para la cuenta); pin con Leaflet + OSM y jitter determinista de 500 m; admin por `is_admin` (`seed_admin` solo con clave de servicio, `8899 0001` en local); borrador en base de datos desde el paso 1; WhatsApp de la casa copiado del perfil y en solo lectura hasta la fase 3; aprobar pasa directo a `active` e `is_owner`; editar una casa activa la oculta hasta la nueva aprobación; trigger `listings_protect` (el dueño no puede cambiar el estado salvo a borrador); columnas nuevas; `monthly_mode` como columna; ficha dentro de `(app)`; tipo de cambio fijo 510; máximo 15 fotos y redimensión a 1600 px; «Contactar por WhatsApp» deshabilitado hasta la fase 3. Pendiente de Daniel: `db push`, admin en pruebas, prueba desde el móvil.

- [ ] **Paso 3: Actualizar `plan-implementacion.md`, `configuracion-supabase.md` y `CLAUDE.md`**

- [ ] **Paso 4: Commit**

```bash
git add docs CLAUDE.md apps/web
git commit -m "Fase 2 construida en develop: decisiones, estado del plan y guía de admin en Supabase"
```

---

## Autorrevisión del plan (hecha al escribirlo)

- **Cobertura:** §3 esquema → T1; §4 módulos → T2 (schema, clientes), T3 (repo, session, actions), T7 (geo, share, currency), T8 (filters); §5 pantallas → T3 (publicar, panel), T4 (fotos), T5 (Mis casas), T6 (admin), T7 (ficha), T8 (Explorar), T9 (detalle); §6 flujo → T1–T9; §7 errores → sin Supabase (T3 panel, T8), sesión caducada (`requireOwnerSession`, T3), RPC en español (T1/T5), foto fallida sin fila (T4), editar activa (T9), `public_id` inválido (T7), HTML escapado por React; §8 pruebas → unit T2/T4/T7/T8, db T1, e2e T3–T9; §9 orden → T1–T10; §10 dependencias → T3 (`leaflet`); §11 pendiente de Daniel → T10 docs.
- **Desvíos respecto a la especificación, anotados para `decisiones.md`:** columna `monthly_mode` (la especificación la derivaba del precio; sin columna, un borrador sin elegir y «consultar» eran indistinguibles); trigger `listings_protect` (la especificación no cubría que el dueño pudiera cambiar `status` por REST); «Editar» una casa activa la pasa a borrador al abrir el formulario (la especificación guardaba sobre la fila activa, lo que publicaba cambios sin revisar); ficha dentro de `(app)`.
- **Tipos:** `Listing`, `ListingDraft`, `Photo`, `PublicListing`, `Filters`, `QueueItem`, `Result`, `ActionState` nombrados igual en todas las tareas; `Result` y `ActionState` son los de `lib/auth/types.ts` y `actions/account.ts`.
