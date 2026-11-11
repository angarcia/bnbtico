# Cambio de marca: de bnbtico a 3bstays

Status: needs-triage

Decisión del 2026-11-10 (ver `docs/decisiones.md`). Dominios: **3bstays.com** (principal), y tresbstays.com y threebstays.com como alternativas. Inventario hecho con `git grep` el 2026-11-10 en `develop`.

## Cuántas referencias hay

| Zona | Apariciones | Archivos | Qué hacer |
|---|---|---|---|
| `design/logo/` | ~2 300 | ~600 | No se toca. Es la marca anterior y queda como histórico. La nueva la pone Ana en su propia carpeta. |
| `apps/app/` | ~400 | ~140 (72 son pruebas) | Cambiar (bloque B). |
| `supabase/migrations/` | 63 | 33 | No se editan las migraciones aplicadas. Se añade una migración nueva (bloque C). |
| `design/prototype/` y `tests/prototype/` | ~140 | ~60 | Cambiar el copy visible y las pruebas que lo esperan. |
| `design/pantallas/` | 79 | 39 | Cambiar, si Ana lo pide: son la referencia de diseño. |
| `docs/` y raíz (`CLAUDE.md`, `CONTEXT.md`, `README.md`) | ~500 | ~40 | Cambiar los documentos vigentes. Los históricos no se tocan. |
| `.scratch/` | ~400 | ~100 | No se toca. Es el histórico de tickets. |
| `.github/workflows/` | 8 | 2 | Cambiar (bloque B). |

## Decisiones previas (Daniel y Ana)

1. **¿Se renombran ahora los identificadores internos?** Son las claves del teléfono `bnbtico-auth`, `bnbtico-query`, `bnbtico-fechas`, `bnbtico-favoritos`, `bnbtico-contacto:*` y `bnbtico_currency`. Recomiendo **renombrarlas ya**: la app no se ha lanzado y el coste es que los probadores tengan que volver a entrar y pierdan sus favoritos. Después del lanzamiento, renombrarlas obligaría a migrar los datos guardados en cada teléfono.
2. **Nombres de infraestructura que no ve el usuario:**
   - Trabajos de `pg_cron`: `bnbtico-reabrir-casas` y `bnbtico-suscripciones`.
   - El candado `hashtext('bnbtico.promo_slot')`.
   - El secreto de Vault `bnbtico_test_clock`.
   - El valor `source = 'bnbtico'` de las consultas.
   - Los correos `@admin.bnbtico.invalid`.
   - El bucket de R2 `bnbtico-copias`.
   - El proyecto de Supabase `bnbtico-pruebas`.

   Recomiendo **dejarlos como están**: renombrarlos tiene riesgo y nadie los ve. Como mucho, el valor `source` se puede pasar a `'support'` en la migración del bloque C.
3. **Subdominios de pruebas:** ¿`nueva.3bstays.com`, o directamente `pruebas.3bstays.com`? El corte de `docs/corte-fase-r.md` ya preveía pasar de `nueva.` a `pruebas.`, así que se puede aprovechar.
4. **Qué hacer con bnbtico.com.** Propuesta: redirigirlo con un 301 a 3bstays.com unos meses y después dejar de usarlo. Que el abogado confirme si conservarlo choca con la norma de Airbnb.
5. **Nombre del repositorio en GitHub (CasaTica).** Es opcional: GitHub redirige el nombre viejo.

## A · Marca visual (Ana): hecho en d40d18c (2026-11-11)

- [x] Biblioteca en `design/logo/3bstays-2026-11-10/` y `design/tokens/tokens.json`. Se mantiene el terracota #B44C30.
- [x] Iconos de la PWA, `favicon.ico`, `apple-touch-icon`, `og.jpg`, `logo-horizontal.png` y el logo de la portada.
- [x] Logo del prototipo. Conserva el nombre de archivo `bnbtico.svg`.
- [x] Las entregas antiguas de `design/logo/` tienen dentro la imagen nueva, pero conservan su nombre `bnbtico-*` como alias, para que el código no deje de encontrarlas.
- [ ] **Pendiente para el bloque B:**
  - Renombrar los archivos alias (`bnbtico.svg` y los `bnbtico-*.png` que use la app o el prototipo) y sus referencias. Hay que hacerlo en el mismo commit, porque si no se rompen las rutas.
  - Los `alt` y los textos con «bnbtico» al lado de los logos. Ana solo cambió las imágenes, no el copy (lo dice su decisión).
- [ ] Perfiles de redes y merchandising, cuando toque.

## B · Código de la app (un PR a `develop`)

**Lo que ve el usuario**
- [ ] `apps/app/index.html`: título y metadatos.
- [ ] `apps/app/public/manifest.webmanifest`: `name`, `short_name` y la ruta de los iconos.
- [ ] `apps/app/public/portada.html` y `portada/portada.css`: la portada sin JS.
- [ ] `src/domain/seo.ts`: título, descripción, canónica, Open Graph, sitemap y robots, con el origen `https://3bstays.com`.
- [ ] Pantallas con el nombre en el texto:
  - `chrome.tsx`, `sign-in.tsx`, `owner-ui.tsx`, `search-help.tsx`.
  - En `screens/`: `actividad`, `admin-*`, `calendario`, `casa-editable`, `cuenta-ayuda`, `cuenta-profile`, `propietario`, `suscripcion`.
  - En `shared/`: `listing-page`, `listing-description`, `status-pages`, `contact-sheet`.
- [ ] Mensajes de WhatsApp redactados y de soporte: `domain/whatsapp.ts`, `support.ts`, `support-numbers.ts`, `inquiry.ts`, `inquiry-note.ts`, `owner-notice.ts`.
- [ ] Avisos de la suscripción: `server/reminders.ts`, con el enlace `#pago=CT-xxxx` en el dominio nuevo.
- [ ] Mensajes de error del dominio: `domain/errors.ts`, `blocked.ts`, `admin-hold.ts`, `review.ts`, `payments.ts`, `subscription.ts`.
- [ ] Stripe: el nombre del producto y la descripción en `server/stripe.ts` y `fake-payments.ts`.

**Identificadores** (si se aprueba la decisión 1)
- [ ] `data/storage.ts` (`SESSION_STORAGE_KEY`), `client/persist.ts` (clave de IndexedDB), `domain/favorites.ts`, `domain/contact-return.ts`, `domain/currency.ts`, `BNBTICO_SUPPORT_CHECKED` y `bnbticoSw`. Usar un prefijo común nuevo, por ejemplo `3bstays-`.

**Despliegue y CI**
- [ ] `package.json` de la raíz: `"name": "bnbtico"`.
- [ ] `apps/app/wrangler.jsonc`:
  - `name` del worker. Ojo: cambia la carpeta de salida `dist/bnbtico/`, que usa `.github/workflows/app.yml` en tres sitios.
  - Entornos `bnbtico-refactor`, pruebas y producción.
  - `routes` y `PUBLIC_ORIGIN`.

  Se cambia el mismo día que el bloque D, no antes: si no, el worker de pruebas se queda sin ruta.
- [ ] `.github/workflows/app.yml`: las marcas `<!-- bnbtico:lighthouse -->` y `<!-- bnbtico:vista-previa -->` (al cambiarlas, el bot creará comentarios nuevos en los PR abiertos) y las rutas de `dist/`.
- [ ] `.github/workflows/backup.yml`: los valores por defecto `bnbtico-copias` y `bnbtico-pruebas`. Mejor no tocarlos si el bucket no cambia.
- [ ] `apps/app/scripts/`: deploy-target, Lighthouse y el resto de scripts con nombres `bnbtico-*-test-`.

**Pruebas**
- [ ] Unas 72 pruebas de la app (Vitest y Playwright) esperan textos o URLs con «bnbtico», entre ellas la puerta de Lighthouse y las de SEO, con `bnbtico.com/casa/CT-1042`. Hay que cambiarlas en el mismo PR. Primero la prueba, luego el código.
- [ ] `apps/app/src/data/fake/*`: los datos falsos usan `bnbtico.test` y textos de marca.

## C · Base de datos (una migración nueva)

- [ ] `pnpm exec supabase migration new marca_3bstays < /dev/null`.
- [ ] `create or replace` de las funciones que lanzan «Solo bnbtico puede…» y «Esta casa está bloqueada por bnbtico…». Hay que partir de la **última versión** de cada función, no de la primera: `admin_casas_acciones`, `revision_por_dato`, `publicar_v2`, `editar_casa_*`, `fase5_suscripcion` y `listings_protect`. Si el mensaje está en el trigger `listings_protect`, revisar que se conserva `app.allow_status`.
- [ ] Textos de los avisos del outbox de la suscripción, si llevan el nombre o el dominio.
- [ ] `pnpm db:al-dia`, `pnpm db:types` y `pnpm test:db`.
- [ ] Aplicar en `bnbtico-pruebas` con `db push` y comprobarlo **antes** del `git push`.

## D · Infraestructura fuera del repositorio (Daniel; exige autorización aparte, como el corte)

- [ ] **Cloudflare:** añadir la zona 3bstays.com (y las alternativas, con redirección 301 a la principal). Dominios propios del worker en pruebas y producción. Aplicación de **Cloudflare Access** para el subdominio de pruebas.
- [ ] **Turnstile:** añadir los nombres de host nuevos al widget. Si no, el formulario del código deja de funcionar.
- [ ] **Supabase Auth:** `Site URL` y `Redirect URLs`. El nombre del proyecto en el panel es opcional: el `ref` no cambia.
- [ ] **Twilio Verify:** el nombre del servicio («Su código de bnbtico es…»): es lo primero que ve el usuario al entrar.
- [ ] **Stripe (modo de prueba):** nombre de la cuenta, texto del extracto bancario, producto y URL del webhook.
- [ ] **WhatsApp:** nombre que se muestra en los dos números de atención (clientes y propietarios).
- [ ] **GitHub:** variables y secretos que lleven el dominio (`PUBLIC_ORIGIN` y la URL de Lighthouse), si están fuera de `wrangler.jsonc`.
- [ ] **Vercel / bnbtico.com:** la portada vigente pasa a ser una redirección 301 a 3bstays.com (decisión 4). Mientras tanto, no publicar nada nuevo con la marca vieja.
- [ ] **Google:** Search Console y Analytics de la portada con el dominio nuevo.
- [ ] **Redes:** @3bstays en Instagram, Facebook y TikTok (sin comprobar).

## E · Documentación

- [ ] `CLAUDE.md` (el título, «bnbtico (repo CasaTica)», el dominio, `nueva.`/`pruebas.` y la regla de no acceder a bnbtico.com), `CONTEXT.md` y `README.md`.
- [ ] Documentos vigentes: `plan-implementacion.md`, `architecture.md`, `diseno-v1.md`, `pruebas-manuales.md` (las URL de prueba), `entorno-local.md`, `configuracion-supabase.md`, `corte-fase-r.md`, `antes-de-produccion.md`, `telemetria.md`, `copias-de-seguridad.md`, `contacto-whatsapp.md`, `marketing.md` y la guía de marca.
- [ ] No se tocan: `docs/historico/`, `pruebas-manuales-fase-*`, `.scratch/` ni `decisiones.md` (las entradas antiguas cuentan lo que pasó con el nombre de entonces).

## Orden propuesto

1. Ana sube la marca (A). Daniel y Ana resuelven las decisiones previas.
2. PR con B (sin `wrangler.jsonc`), C y E, desplegado en el `nueva.bnbtico.com` de siempre: el copy ya dice 3bstays aunque el dominio sea el viejo.
3. Día del cambio de dominio: D, más `wrangler.jsonc`, `PUBLIC_ORIGIN` y Turnstile en un solo commit. Daniel prueba desde el teléfono.
4. Redirección de bnbtico.com (D) y avisos en redes.
5. Buscar «bnbtico» con `git grep` en lo vigente para confirmar que solo queda el histórico.
