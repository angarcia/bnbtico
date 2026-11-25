# Guía de desarrollo de 3bstays (entrada para agentes)

**Revisión documentada:** rama `develop`, commit `8843636` (2026-11-25). Las rutas, símbolos y scripts citados se comprobaron
contra ese árbol leyendo los archivos; esa comprobación no ejecuta pruebas. Lo que no se pudo comprobar está marcado **(sin
verificar)**.

Esta guía es un **mapa**: dice dónde está cada cosa, cómo se comunican las capas y qué pasos lleva cada tipo de cambio, y
enlaza la fuente de cada regla en lugar de copiarla. Si esta guía y su fuente no coinciden, manda la fuente, y la más reciente
de `docs/decisiones.md` sobre todas. Instrucciones generales y reglas de producto: [`CLAUDE.md`](../CLAUDE.md) (`AGENTS.md` es un
enlace a él).

**Mantenimiento:** actualice esta guía cuando cambie una carpeta, una pieza de la arquitectura, una flag, un script de
`package.json` o un paso del despliegue. Para lo demás, actualice la guía específica que se enlaza abajo.

## 1. Qué leer según la tarea

| Tarea | Fuente |
|---|---|
| Reglas de producto vigentes, entornos, convenciones | [`CLAUDE.md`](../CLAUDE.md) |
| Por qué es así algo (decisiones con fecha, la más reciente arriba) | [`decisiones.md`](decisiones.md) |
| Arquitectura: piezas, caminos de petición, sesión, carpetas del frontend | [`architecture.md`](architecture.md) |
| Fases, alcance de la v1 | [`plan-implementacion.md`](plan-implementacion.md) |
| Aspecto, estructura y textos de cada pantalla | [`diseno-v1.md`](diseno-v1.md), `design/pantallas/`, `design/tokens/tokens.json` |
| Componentes de la interfaz y la prueba de consistencia | [`componentes.md`](componentes.md) |
| Feature flags | [`feature-flags.md`](feature-flags.md) |
| Supabase local, cuentas de prueba, pruebas automáticas | [`entorno-local.md`](entorno-local.md) |
| Proyecto de Supabase, Twilio, secretos de GitHub y Cloudflare | [`configuracion-supabase.md`](configuracion-supabase.md) |
| Telemetría, CSP, Turnstile, cron | [`telemetria.md`](telemetria.md) |
| Calendarios de Airbnb (importar, exportar, ciclo) | [`operacion-airbnb.md`](operacion-airbnb.md) |
| Copias y restauración | [`copias-de-seguridad.md`](copias-de-seguridad.md) |
| Lo decidido que espera al lanzamiento | [`antes-de-produccion.md`](antes-de-produccion.md) |
| Comprobaciones manuales por pantalla | [`pruebas-manuales.md`](pruebas-manuales.md) |
| Historias: cuándo están listas, dónde viven | [`agents/historias-listas.md`](agents/historias-listas.md), [`agents/issue-tracker.md`](agents/issue-tracker.md) |
| Skills por rol (frontend, backend, devops, DBA, UX, PO) | `.scratch/skills/<skill>/SKILL.md` |

## 2. Mapa de carpetas

### Repositorio

| Carpeta | Qué hay |
|---|---|
| `apps/app/` | La única aplicación (paquete `app`): el navegador y el worker. |
| `supabase/migrations/` | Todo el esquema: tablas, RLS, grants, RPCs, triggers, `pg_cron`. Una migración nueva por cambio; `0001_init.sql` no se edita. |
| `supabase/datos-de-prueba/` | Fotos de las casas de prueba (las crea `apps/app/scripts/casas-de-prueba.mjs`). |
| `.github/workflows/` | `app.yml` (CI y despliegue) y `backup.yml` (copia diaria). |
| `design/` | Diseño v1: `pantallas/`, `tokens/`, `logo/` y el prototipo de referencia (`prototype/`). |
| `docs/` | Guías vigentes; `docs/historico/` y las guías marcadas como históricas en `CLAUDE.md` no mandan. |
| `.scratch/` | Especificaciones e historias (`.scratch/<tema>/`), capturas de revisión y las skills del repo (`.scratch/skills/`). |
| `tests/prototype/` | Pruebas del prototipo. |

### `apps/app/src`

| Carpeta | Responsabilidad | Puede importar |
|---|---|---|
| `domain/` | Reglas y tipos sin framework: validación (`listing-rules.ts`, `publish-rules.ts`, `edit-plan.ts`), `can.ts`, `describe.ts`, flags (`flags.ts`), interfaces de datos (`api.ts`: `ListingsApi`, `AuthApi`), tipos generados (`database.types.ts`). | Solo `domain/` |
| `data/postgrest/` | Adaptadores reales: el único sitio con cadenas de PostgREST y supabase-js. | `domain/` |
| `data/fake/` | Adaptador en memoria que cumple el mismo contrato (lo usan las pruebas). | `domain/` |
| `shared/ui/` | Componentes comunes de props cerradas (botones, campos, hojas, tarjetas, avisos, etiquetas). | React, `domain/` |
| `shared/` | Lo que pinta la ficha SSR sin router (ficha, mapa, contacto, moneda), `flags.ts`, `desktop.ts`, `share-button.tsx`. | `shared/ui/`, `domain/`, `data/` |
| `client/app/` | Arranque, rutas (`shell.tsx`), marcos (`chrome.tsx`), persistencia. | Todo |
| `client/<área>/` | Pantallas por área: `explorar/`, `propietario/` (con `publicar/`, `calendario/`, `suscripcion/`), `cuenta/`, `admin/`. Cada una con su CSS y su carpeta `copy/`. | Su carpeta, `comun/`, `shared/`, `domain/`, `data/` |
| `client/comun/` | Lo que usan dos o más áreas: sesión, claves de caché, `ScreenHeader`, `router-buttons.tsx` (`RouterButtonLink`, `RouterIconLink`…). | `shared/`, `domain/`, `data/` |
| `server/` | Worker Hono: `app.ts` (rutas), `render.tsx` (SSR de la ficha), `cron.ts`, `billing.ts`/`stripe.ts`, `reminders.ts`, `photo-sync.ts`, `airbnb*.ts`, `ical-*.ts`, `test-clock.ts`. | `domain/`, `shared/` |
| `sw/` | Service worker (`sw.ts`, `routes.ts`). | — |
| `styles/` | `tokens.css`, `base.css`, `global.css` (orden de capas). | — |

Las fronteras las vigila `tests/unit/architecture.test.ts` (con excepciones justificadas). La versión larga de esta tabla, con
el CSS por capas y los catálogos de textos, está en [`architecture.md`](architecture.md#carpetas-del-frontend).

`src/paraglide/` puede aparecer en un checkout local: no está versionada ni se usa (Paraglide se descartó, ver `decisiones.md`).

### Cómo se comunican las capas

1. **Pantalla pública o con sesión:** componente → función de consulta de su pantalla (fábrica de `queryOptions` en su área o
   en `client/comun/`) → adaptador de `data/postgrest/` → PostgREST con el JWT del usuario → RLS y grants deciden. La caché de
   Query se persiste en IndexedDB.
2. **Escritura:** mutación optimista → RPC plpgsql (toda transición de estado es una RPC) → si falla, se deshace y se enseña el
   mensaje de la base (mismo texto en el dominio y en el fake, ver §4).
3. **Ficha pública `/casa/CT-####`:** el worker lee `listings_public`, renderiza con `render.tsx` y el navegador hidrata. Es la
   única ruta con SSR.
4. **Trabajo de servidor:** el worker (con la service role key, que solo vive ahí) para pagos, avisos, fotos, Airbnb e iCal;
   el cron horario lo dispara `wrangler.jsonc` (`17 * * * *` y `17 */3 * * *`).

## 3. Frontend

- **Componentes:** antes de crear algo, búsquelo en `shared/ui/` y [`componentes.md`](componentes.md). `tests/unit/consistencia.test.ts`
  falla si una pantalla escribe a mano la clase de un componente (por ejemplo `icon-btn`: use `IconButton`, `IconButtonLink` o
  `RouterIconLink`), un color o radio suelto, o texto fuera de `copy/`.
- **Colocación:** las variantes de sitio van en uniones cerradas (`ButtonPlacement`, `IconButtonPlacement` en
  `shared/ui/button.tsx`; `CardPlacement` en `shared/ui/card.tsx`). Una colocación nueva se añade a la unión y a su CSS.
- **Estilos:** tokens en `styles/tokens.css` (salen de `design/tokens/tokens.json`); cada área en su hoja; el escritorio dentro
  de la misma hoja, en la capa `escritorio`. `useDesktop()` (`shared/desktop.ts`) decide la variante en React.
- **Textos:** en `client/<área>/copy/` (la ficha en `shared/copy/`), importados como `import * as X_COPY`; plurales con
  `domain/plural.ts`. Español de Costa Rica, tratando de **usted**.
- **Patrones aprobados recientes** (para reutilizar):
  - Botones de icono sobre una foto: `IconButton`/`RouterIconLink` con `tone="overlay"` (44 × 44, crema al 70 %), por encima
    del enlace estirado de la tarjeta y como hermanos de él, nunca dentro (`SharePhotoButton` en `client/propietario/owner-ui.tsx`,
    `OwnerCard` en `client/propietario/propietario.tsx`).
  - Acción flotante con texto: el aspecto de `.float-btn` («Ver ficha») y de `.photo-add` («＋ Añadir otra casa»), en
    `client/propietario/propietario.css`.
  - Compartir: `useShare` (`shared/share-button.tsx`): hoja del sistema y, sin ella, copiar el enlace.
- **Sesión y caché:** cada clave de Query se escribe una vez, en su fábrica (lo vigila `tests/unit/query-keys.test.ts`). Al
  cambiar de cuenta no deben quedar datos de la anterior en la caché persistida.
- **Presupuestos:** `apps/app/.size-limit.json` (JS inicial privado < 161 KB gz y un límite por trozo). Subir un límite es una
  decisión: se anota en `decisiones.md` con el motivo.

## 4. Backend y base de datos

- **Autorización en Postgres:** RLS en todas las tablas y grants por columna; `listings` solo la leen el dueño y el admin, el
  público usa la vista `listings_public`. Admin = `profiles.is_admin` **con** `aal2` (TOTP), exigido en SQL en `is_admin()`.
- **Transiciones:** solo por RPC (`submit_listing`, `review_listing`, `save_edit`, `review_edit_field`…). El trigger
  `listings_protect` bloquea cualquier otro camino y congela el contenido fuera de `draft`/`changes`. Una migración que
  actualiza filas de `listings` necesita antes `select set_config('app.allow_status', 'on', true);` (local no lo detecta porque
  siembra los datos después de migrar).
- **Contrato fake/real:** `tests/contract/*.contract.ts` definen el comportamiento; los ejecutan contra el fake
  `tests/unit/contract-*-fake.test.ts` y contra PostgREST `tests/db/contract-*-postgrest.test.ts`. Un mensaje de error de una RPC
  y su constante del dominio (p. ej. `DESCRIPTION_LENGTH_ERROR` en `domain/listing-rules.ts`) tienen que ser el **mismo texto**:
  la suite lo compara y `domain/field-errors.ts` lo usa para señalar el campo.
- **Migraciones:** `pnpm exec supabase migration new <nombre> < /dev/null`, luego `pnpm db:al-dia`, `pnpm db:types` y, si cambia
  lo que crean, `apps/app/scripts/casas-de-prueba.mjs`, todo en el mismo commit. En la base alojada, PostGIS vive en el esquema
  `extensions` (calificar `extensions.st_*`). Para cambiar una función, copie su **última** definición (busque la migración más
  reciente que la redefine) y cambie solo lo necesario; `create or replace` conserva los permisos.
- **Worker:** `src/server/app.ts` monta las rutas; no verifica JWT por su cuenta: llama a una RPC con el JWT del usuario y
  PostgREST lo valida. Webhooks idempotentes por `payment_events(provider, event_id)`.

## 5. Feature flags

Inventario, valores iniciales y procedimiento: [`feature-flags.md`](feature-flags.md). Hay cinco construidas (`exploreDates`,
`exploreNights`, `datePrices`, `externalCalendars`, `rooms`); la regla de `externalCalendars` en la base (#63) sigue
pendiente, con prioridad baja.

**Recorrido completo de `rooms` (habitaciones, apagada por defecto):**

1. **Definición:** `apps/app/src/domain/flags.ts` (`FLAG_NAMES`, `DEFAULT_FLAGS.rooms = false`, variable `FLAG_HABITACIONES`).
2. **Valor por entorno:** variable de GitHub `FLAG_HABITACIONES_PRUEBAS` / `_PRODUCCION`, que `.github/workflows/app.yml` pasa
   al build y al paso «Feature flags en la base».
3. **Build:** `apps/app/vite.config.ts` incrusta `__FLAGS__`; `apps/app/src/shared/flags.ts` expone `FLAGS` (única puerta, no
   leer `__FLAGS__`).
4. **Navegador:** Filtros (`client/explorar/filtros.tsx`, sección de tipo y «Dormitorios»), Buscar y la URL
   (`parseFilters`/`normalizeSearch` con `rooms`, en `client/explorar/buscar.tsx` y `client/app/shell.tsx`), la fila «Tipo» de la
   ficha editable (`client/propietario/casa-editable.tsx`) y `KindChoice` del asistente (`client/propietario/publicar/`).
5. **Base:** el despliegue escribe la tabla `feature_flags` con `set_feature_flags` (`apps/app/scripts/deploy-target.mjs`); los
   triggers `listings_rooms_flag` y `listing_edits_rooms_flag` (migración `20261117170000_habitaciones_flag.sql`) rechazan crear,
   enviar o editar a Habitación sin depender de lo que mande el navegador.
6. **Pruebas:** `tests/unit/flags.test.ts`, `tests/db/habitaciones-flag.test.ts`, `tests/db/feature-flags.test.ts`.
7. **Revertir:** poner el valor anterior en la variable y relanzar el trabajo `deploy`.

## 6. Integraciones y operación

| Integración | Dónde | Guía |
|---|---|---|
| Ingreso por WhatsApp (código) | Supabase Auth + Twilio Verify; Turnstile en el formulario | [`configuracion-supabase.md`](configuracion-supabase.md) |
| Avisos de la suscripción por WhatsApp | outbox `subscription_reminders`; `server/reminders.ts`; `WhatsAppSender` (sandbox en pruebas, falso en local, apagado en producción) | [`architecture.md`](architecture.md#cuatro-caminos-de-petición) |
| Pagos (modo de prueba) | `server/billing.ts`, `server/stripe.ts`, `server/fake-payments.ts`; RPC `apply_payment_event` | [`architecture.md`](architecture.md#cuatro-caminos-de-petición) |
| Fotos (buckets público y privado) | `server/photo-sync.ts`, `POST /api/fotos/sincronizar` y el cron | [`architecture.md`](architecture.md#piezas) |
| Airbnb e iCal | `server/airbnb*.ts`, `server/ical-*.ts` | [`operacion-airbnb.md`](operacion-airbnb.md) |
| Telemetría | `POST /vitals`, `/errors`, `/events` | [`telemetria.md`](telemetria.md) |
| Copias | `backup.yml` (diaria) | [`copias-de-seguridad.md`](copias-de-seguridad.md) |

**CI/CD (`.github/workflows/app.yml`):** trabajos `plan`, `quality`, `integration`, `report` y `deploy`. `develop` despliega a
`pruebas.3bstays.com` (protegida con Cloudflare Access) y `main` a 3bstays.com (aún sin rutas). El deploy va detrás de las
pruebas y de Lighthouse, y solo publica si su commit sigue siendo la cabeza de la rama: empujar otra vez a `develop` con la CI
anterior en marcha hace fallar ese deploy.

**Restricciones de acceso:** las comprobaciones en `pruebas.3bstays.com` las hace Daniel; las herramientas no acceden a ese
dominio ni a 3bstays.com. **La CI no aplica migraciones:** una migración se aplica en `bnbtico-pruebas` con
`pnpm exec supabase db push` (mirando la salida) **antes** de empujar el código que la necesita. El corte de infraestructura
([`corte-fase-r.md`](corte-fase-r.md)) exige autorización separada.

## 7. Comandos

Todos funcionan desde `apps/app` o desde la raíz (declarados en ambos `package.json`). Según `CLAUDE.md`, los ejecuta Ana salvo
petición expresa.

| Comando | Qué hace | Necesita |
|---|---|---|
| `pnpm dev` | Vite + worker en el puerto 5173 (antes, `db:al-dia`) | Supabase local |
| `pnpm typecheck` | `tsc` de la app y del service worker | — |
| `pnpm test` | Vitest, proyecto `unit` (incluye el contrato contra el fake) | — |
| `pnpm test:db` | Vitest, proyecto `db` (RLS, RPCs, contrato contra PostgREST) | Supabase local (Docker) |
| `pnpm build` | Prueba de arquitectura + `vite build` | — |
| `pnpm size` | `size-limit` y `scripts/js-inicial.mjs` | `pnpm build` antes |
| `pnpm test:e2e` | Playwright contra `dist/`, en viewport móvil | `pnpm build` antes (lo exige `tests/e2e/global-setup.ts`), Supabase local, `CHROMIUM_PATH` |
| `pnpm db:al-dia` | Aplica a la base local las migraciones que falten (`--reset` la deja igual que el repo) | Supabase local |
| `pnpm db:types` | Regenera `domain/database.types.ts` | Supabase local |
| `pnpm datos:prueba` | 10 casas con fotos y cuentas `8800 0001`–`0004` | Supabase local |

Las e2e y `test:db` vacían y siembran la base local: dos agentes no deben ejecutarlas a la vez sobre el mismo Supabase.

## 8. Tres recorridos reales

### A. Cambio de pantalla reutilizando componentes (historia #95, commit `8843636`)

Mover Compartir, Calendario y Consultas sobre la foto de las tarjetas de Mis casas.

1. **Localizar:** `OwnerCard` (`client/propietario/propietario.tsx`) y `HouseCardTop` (`client/propietario/house-card.tsx`).
2. **Reutilizar:** `IconButton` y `RouterIconLink` con `tone="overlay"`; `useShare` para compartir. Colocaciones nuevas
   `photo-share` y `house-tool` en `IconButtonPlacement`. Textos nuevos en `client/propietario/copy/owner.ts` (`sharePhoto`).
3. **Estilos:** `client/propietario/propietario.css` (`.photo-share`, `.photo-tools`), sin colores ni radios sueltos.
4. **Datos:** ninguno nuevo: las mismas condiciones `can(l, "share")` y `can(l, "available")` y el contador `newInquiries`.
5. **Comprobar:** capturas en móvil antes y después (`.scratch/acciones-foto-lista-casas/capturas/`) y visto bueno de Ana;
   `typecheck`, `test` (la consistencia detectó un `icon-btn` escrito a mano), `build`, `size` y las e2e de las pantallas tocadas
   (`tests/e2e/propietario.spec.ts` y otras que buscaban «Compartir ficha»).
6. **Documentar:** `diseno-v1.md`, `pruebas-manuales.md` y `decisiones.md`.

### B. Cambio de una regla de dominio y de la base (historia #94, commit `2129c3b`)

Quitar el mínimo de 80 caracteres de la descripción.

1. **Rastrear la regla en todas las capas:** `DESCRIPTION_MIN` (`domain/listing.ts`), `descriptionError` y
   `DESCRIPTION_LENGTH_ERROR` (`domain/listing-rules.ts`), los avisos (`domain/publish-rules.ts`, `fieldWarning` en
   `domain/edit.ts`), el contador (`DescriptionField` en `client/propietario/publicar/fields.tsx`), el fake (`data/fake/owner.ts`,
   `data/fake/edits.ts`) y las **últimas** definiciones SQL (la base ya solo exigía el máximo).
2. **Primero las pruebas:** unitarias, de base y e2e con los casos nuevos.
3. **Migración solo para lo que hace falta:** `20261125120000_descripcion_sin_minimo.sql` redefine `listing_edit_check`,
   `save_edit` y `listing_submit` copiando su última versión y cambiando solo el texto del error, para que el contrato fake/real
   siga dando el mismo mensaje. Sin cambio de firma, no hacen falta tipos nuevos.
4. **Comprobar:** `test`, `test:db`, `build` y las e2e de publicar y editar.
5. **Antes del push:** `supabase db push` en `bnbtico-pruebas`.

### C. Cambiar o añadir una flag

Siga el recorrido de `rooms` del §5. Para una flag nueva: añadirla a `FLAG_NAMES`, `DEFAULT_FLAGS` y `FLAG_VARIABLES`
(`domain/flags.ts`), a la columna de `feature_flags` y a `set_feature_flags` en una migración, a las dos listas de variables de
`app.yml`, a la tabla de [`feature-flags.md`](feature-flags.md) y a `docs/antes-de-produccion.md` si afecta al lanzamiento. Toda
regla de escritura la comprueba la base con `public.feature_flags()`, nunca con un valor del navegador.

## 9. Lo que aprendió Cloud (traspaso)

«Cloud» es el agente de Claude que trabajó en este repositorio. Su historial de conversaciones no está disponible: lo de abajo
sale del código, de `decisiones.md` y de sus notas de trabajo entre sesiones, que no viven en el repositorio.

**Patrones que conviene seguir:**

- Investigar el estado actual (código, decisión con fecha, commit y pruebas) antes de cambiar nada, y preguntar ante cualquier
  contradicción con una decisión vigente.
- En cambios de interfaz: capturas en móvil y visto bueno de Ana primero; las e2e completas de lo tocado una vez, antes del
  commit (tardan; no a cada ajuste). `pnpm typecheck` después de tocar una e2e: una variable sin uso rompió una vez la CI.
- Un cambio cada vez: commit, `db push` si hay migración, push, CI verde y prueba de Daniel antes del siguiente.
- Hacer el commit solo con los archivos de la tarea: otros agentes pueden estar trabajando en el mismo checkout.

**Lecciones con su motivo:**

- Una migración con `update listings` falló en `bnbtico-pruebas` y no en local (2026-10-27): falta `app.allow_status` (§4).
- Encadenar `db push … | grep … && git push` publicó código sin su esquema (2026-10-30): mirar la salida del `db push` a mano.
- Una base local que no recogía migraciones nuevas rompió las e2e de Ana (2026-11-06): de ahí `pnpm db:al-dia` en cada comando.
- `pnpm size` mide gzip: cambiar un trozo cambia los nombres con hash que importan otros y mueve unos bytes en trozos que no
  se tocaron (2026-11-25).
- La copia diaria salía en verde sin copiar nada por falta de secretos (2026-11-17): comprobar el log o el archivo antes de una
  migración con datos.

**Decisiones de trabajo conocidas solo por conversación** (Ana decide si se registran; lugar propuesto: `CLAUDE.md`, apartado
de convenciones):

1. Lo pequeño (textos, documentación, portada, UI de bajo riesgo) va directo a `develop`; las migraciones, la seguridad y la CI,
   con PR que abren Daniel o Ana (el token de `gh` de la sesión solo lee).
2. Sin cuerpo en los PR: basta el enlace de comparación.
3. No empujar dos veces seguidas a `develop` con la CI anterior en marcha (falla el deploy por vigencia).
4. En el Mac corporativo de Daniel no se ejecutan las e2e, la suite unitaria completa ni Docker sin su permiso expreso; en el Mac
   de Ana sí.

## 10. Estado por área (a esta revisión)

| Estado | Qué |
|---|---|
| **Implementado** | Fase R client-first (app, worker, PostgREST), publicación y edición dato a dato, revisión de admin con TOTP, suscripción con pagos en modo de prueba y avisos, calendarios de Airbnb (#5–#8), las cinco flags, buckets de fotos (#69), descripción sin mínimo (#94), acciones sobre la foto (#95, #92). |
| **Aprobado, pendiente** | Proyecto de producción `3bstays-prod` y lo de [`antes-de-produccion.md`](antes-de-produccion.md); corte de infraestructura ([`corte-fase-r.md`](corte-fase-r.md)); regla de `externalCalendars` en la base (#63). |
| **Fuera de la v1** | Veriff (v1.1), cobro real con pasarela local, app en tiendas, valoraciones de clientes. |
| **(sin verificar)** | El rediseño de Explorar acordado el 2026-11-03 (cabecera flotante, tarjeta a sangre 3:2) figuraba como pendiente en las notas de Cloud; contrastar con `decisiones.md` antes de darlo por hecho o por pendiente. |

## 11. Discrepancias encontradas (para que decida Ana)

- **Entorno de refactor en `CLAUDE.md`:** pide usar solo `bnbtico_refactor_01` (API 55321, DB 55322) y no ejecutar `start`,
  `reset` ni `stop`, pero `apps/app/.env.local` apunta al Supabase local de siempre (54321, contenedor `supabase_db_bnbtico`), que es
  el que usan `pnpm dev`, las pruebas y `pnpm datos:prueba`. Parece una nota de una fase de refactor ya cerrada. Impacto: un agente
  nuevo puede creer que no debe usar la base local normal. Propuesta: confirmar y quitarla o marcarla como histórica.
- **Límite del trozo de pestañas:** el commit `9ac9f84` ya lo superaba por 190 B. Se subió a 28,3 KB junto con #95 y #92
  (`decisiones.md`, 2026-11-25); conviene que quien hizo `9ac9f84` lo sepa.
