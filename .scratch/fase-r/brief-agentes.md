# Encargo común para los agentes de la fase R

Cada ticket de la fase R lo implementa un agente nuevo. Este archivo es el contexto y las reglas comunes; el encargo concreto dice qué ticket toca.

## Lee primero (en este orden)

1. `CLAUDE.md` — instrucciones del repo; mandan sobre todo.
2. `.scratch/fase-r/spec.md` — especificación de la fase R.
3. Tu ticket en `.scratch/fase-r/issues/NN-*.md` (lista de aceptación).
4. Las secciones «Cierre», «Avance» o «Despliegue» de los tickets ya hechos en la misma carpeta: dicen qué existe y qué decisiones se tomaron.

## Estado del código (`apps/app`)

- Vite + React 19 + TanStack Router (rutas por código, sin plugin; `parseSearch`/`stringifySearch` propios con URLSearchParams) + TanStack Query (caché pública persistida en IndexedDB, `src/client/persist.ts`) + worker Hono en Cloudflare con `@cloudflare/vite-plugin`. TypeScript estricto.
- `src/domain/`: dominio sin frameworks (solo `zod` o `zod/mini`; lo vigila `tests/unit/architecture.test.ts`): `listing`, `filters`, `step-forms`, `describe`, `can`, `errors` (`DomainError` + `toDomainError`), `rows`, `api` (interfaces `ListingsApi` = `PublicListingsApi` + `OwnerListingsApi` + `photos` + `admin`, y `AuthApi`), `money`, `image`, `seo`, `share`, `phone`, `cantones`, `geo`, `currency`, `database.types` (generado: `pnpm --filter app db:types`; el CI falla si no coincide con las migraciones).
- `src/data/postgrest/` es el ÚNICO sitio que importa supabase-js. `src/data/fake/` es el fake en memoria (`FakeDb` en `db.ts`). Cada capacidad nueva de la API lleva su suite de contrato en `tests/contract/*.contract.ts`, que corre contra el fake en `tests/unit/` y contra PostgREST en `tests/db/` (arneses: `tests/unit/fake-harness.ts`, `tests/db/postgrest-harness.ts`, interfaz en `tests/contract/harness.ts`).
- `src/server/`: worker (`app.ts` con `createApp` y dependencias inyectables, `render.tsx`). Única ruta SSR: `/casa/CT-####`. `src/client/main.tsx`: hidrata la ficha si hay `<script id="ssr-data">`; si no, carga el shell (router) bajo demanda.
- `src/client/`: router y pantallas (Explorar, Filtros, ficha dentro de la SPA, placeholders de Favoritos y Mi cuenta). `src/shared/`: componentes que usan worker y navegador (ficha, `Picture`, moneda, mapa, iconos, páginas de estado).
- Estilos en `src/styles/global.css` (sistema «Sol y sal», tokens del diseño v1). Nada de `style={{}}`: habrá CSP sin `unsafe-inline`; crea clases.
- Referencia de comportamiento y copy: la app vieja en `apps/web` (Next). **No se toca**, solo se lee: pantallas en `apps/web/app/(app)/…`, componentes en `apps/web/src/components/…`, lógica en `apps/web/src/lib/…`, pruebas en `apps/web/tests/{unit,db,e2e}`. Diseño: `docs/diseno-v1.md` y `design/pantallas/*.html`.

## Cómo se prueba

- Desde `apps/app`: `pnpm typecheck`, `pnpm test` (unitarias + contrato contra el fake + costura HTTP del worker), `pnpm test:db` (contra Supabase local), `pnpm build`, `pnpm size` (zona privada < 150 KB gz), `pnpm test:e2e` (Playwright Pixel 7 contra `vite preview`; antes `pnpm dev:vars` y `pnpm build`).
- En este Mac Playwright necesita `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, un solo worker.
- Supabase local suele estar arrancado; si no, `pnpm db:start` en la raíz. Tras tocar `supabase/config.toml`: `pnpm exec supabase stop && pnpm exec supabase start` (`db reset` no lo recarga).
- Números de prueba con código `123456` (local y pruebas): `+50688881234` (cliente), `+50687770001` (propietario), `+50688889999`, `+50688990001` (admin, lo marca `seed_admin`). Supabase limita a un código por segundo y número: los arneses ya reintentan. Tope local de 30 SMS por hora (`[auth.rate_limit] sms_sent`); no lo agotes con bucles.
- Migraciones nuevas: `pnpm exec supabase migration new <nombre> < /dev/null` desde la raíz; aplicar solo en local con `pnpm exec supabase migration up --local`; después `pnpm --filter app db:types`. `0001_init.sql` no se edita.
- No des por verificado un cambio de UI leyendo el código: ábrelo (Playwright o captura con Chrome en viewport Pixel 7).

## Reglas que no se negocian

- Primero la prueba, luego el código. Todo en verde antes de confirmar: `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`.
- UI en español de Costa Rica tratando de **usted**. Entidades en inglés. Comentarios solo cuando el porqué no es obvio. Sin dependencias nuevas fuera de lo que pide el ticket.
- **No** toques `apps/web`. **No** hagas push. **No** accedas a `pruebas.bnbtico.com` ni a `nueva.bnbtico.com`. **No** modifiques el proyecto Supabase alojado (nada de `supabase db push` ni de la API de administración) ni nada en Cloudflare o GitHub: lo que haga falta allí va al informe como acción pendiente.
- Commits locales en español, en imperativo, **sin** línea `Co-Authored-By` ni ninguna coautoría. Deja fuera de los commits `.agents/`, `.claude/skills/` y `skills-lock.json` (no son tuyos).
- Al terminar, añade a tu ticket una sección `## Cierre (fecha)` con evidencias (números de cada batería, tamaño gz) y marca los puntos de la lista. Lo que necesite una acción manual de Daniel o quede pendiente se queda sin `[x]` y se explica. Status: `done` o `ready-for-human`.
- Si una decisión del ticket choca con la realidad (una API que cambió, algo imposible), elige la opción más conservadora, documéntala en el cierre y menciónala en el informe.
- No avances a otros tickets.

## Informe final (máximo ~25 líneas)

Qué construiste, hash(es) de commit, resultados de cada batería (números), tamaño gz de la zona privada, desviaciones del ticket, migraciones nuevas (aplicadas solo en local) y la lista explícita de acciones manuales de Daniel (o «ninguna»).
