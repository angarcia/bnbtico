# Configurar Supabase y Twilio para `pruebas.bnbtico.com`

> **Aplicación vigente (`apps/app`, paquete `app`):** se despliega con GitHub Actions a Cloudflare Workers; sus variables y secretos están en la sección 10. Desde la retirada de Next (2026-11-04), las secciones 5 y 6 (Vercel, contraseña de pruebas, proxy) son referencia histórica de los despliegues conservados, no instrucciones para construir esta rama. No modificar Vercel ni sus secretos como parte de la retirada (`docs/corte-fase-r.md`).

Guía paso a paso (2026-10-15). Todo lo que requiere crear cuentas, aceptar condiciones o pegar claves lo hace una persona; la CLI del repo solo aplica la migración. El proyecto de **producción** se crea igual en la fase 7, con otro nombre.

## 0. Qué vas a crear

| Pieza | Para qué | Coste |
|---|---|---|
| Proyecto Supabase `bnbtico-pruebas` | Base de datos, login por teléfono, fotos | Plan Free |
| Servicio Twilio Verify | Enviar el código por WhatsApp (o SMS) | Céntimos por código |
| Variables y secretos de GitHub (sección 10) | Que el worker de Cloudflare y el navegador usen lo anterior | — |
| Variables en Vercel (entorno Preview), hasta el corte | Que la app vieja de `pruebas.bnbtico.com` use lo anterior | — |

## 1. Proyecto en Supabase

1. Entrá en <https://supabase.com/dashboard> y creá una organización si no tenés (plan Free).
2. **New project**: nombre `bnbtico-pruebas`, región **East US (North Virginia)** o la más cercana a Costa Rica, y una **contraseña de base de datos** larga. Guardala en tu gestor de contraseñas: hace falta en el paso 3.
3. Esperá a que el proyecto termine de aprovisionarse (1–2 minutos).
4. Anotá dos valores (el botón **Connect**, arriba del panel, pestaña «App Frameworks» → Next.js, los muestra juntos):
   - **Project URL** (`https://<ref>.supabase.co`), en **Project Settings → Data API**. El **ref** son las 20 letras minúsculas que Supabase asigna al proyecto; también se ven en la barra de direcciones del panel (`…/dashboard/project/<ref>`).
   - **Publishable key** (`sb_publishable_…`), en **Project Settings → API Keys**. Es la que va en el navegador como `VITE_SUPABASE_ANON_KEY`. Las claves `secret` nunca se usan en el navegador.

## 2. Aplicar el esquema

Desde la raíz del repo, con la CLI que ya está instalada:

```sh
pnpm exec supabase login
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

`login` abre el navegador para autorizar la CLI. `link` pide la contraseña de la base del paso 1. `db push` aplica todas las migraciones de `supabase/migrations/` que falten (la inicial y las de cada fase). Para comprobarlo: **Table Editor** debe mostrar `profiles`, `listings`, etc., y **Database → Triggers** los dos triggers `on_auth_user_*` sobre `auth.users`.

> **No ejecutes `supabase config push`.** El `config.toml` del repo tiene un Twilio de relleno, números de prueba y un límite de 1 s que son **solo para local**. El proyecto alojado se configura en el panel, como sigue.

## 3. Twilio Verify

La **prueba gratuita** actual de Twilio es una experiencia guiada: números que asigna Twilio, hasta 5 destinatarios verificados, solo tu país de registro, caduca a los 30 días y **no permite crear un servicio de Verify propio** (al pulsar «Create new» pide upgrade). Supabase necesita el Service SID de un servicio tuyo, así que conectar Twilio a Supabase requiere pasar a cuenta de pago. Por eso el orden es:

1. **Primero, gratis: comprobar que WhatsApp llega a Costa Rica.** Creá la cuenta en <https://www.twilio.com/try-twilio> (Limited trial). Verificá tu móvil en **Phone Numbers → Verified Caller IDs**. En el panel de Verify del trial, usá «Try it out» con el canal WhatsApp hacia tu número. Si el código llega, la pregunta del plan está respondida; si no, se usa SMS para los códigos (anotarlo en `decisiones.md`).
2. **Mientras tanto, pruebas.bnbtico.com funciona con Supabase real sin Twilio** gracias a los números de prueba del paso 4 (código fijo 123456, no se envía nada). Twilio solo hace falta cuando alguien entra con su número real.
3. **Cuando toque enviar a números reales: upgrade.** Tarjeta y recarga mínima de 20 USD (saldo que se gasta en códigos). Twilio pide entonces el **Primary Customer Profile** de Trust Hub: es un perfil de cumplimiento, no «crear bnbtico». Se puede rellenar como **Individual** (nombre y dirección propios); la opción individual/empresa no se puede cambiar después. Si más adelante existe la empresa en Costa Rica, se abre otra cuenta de Twilio a su nombre y se cambian las tres claves en Supabase.
4. Con la cuenta de pago: **Verify → Services → Create new**, nombre `bnbtico`. Anotá el **Service SID** (`VA…`). En **Settings → Channels** activá **WhatsApp** además de SMS. Si Twilio pide registrar un remitente de WhatsApp propio, seguí su asistente; mientras tanto el canal SMS funciona igual.
5. Activá **Fraud Guard** en los ajustes de Verify: bloquea envíos masivos a números de pago. Es gratis.
6. Anotá en **Account → API keys & tokens**: **Account SID** (`AC…`) y **Auth Token**.

## 4. Login por teléfono en Supabase

En el panel del proyecto, **Authentication → Sign In / Providers → Phone**:

1. **Enable phone provider**: sí.
2. **SMS provider**: `Twilio Verify`. Pegá Account SID, Auth Token y Verify Service SID.
3. **Enable phone confirmations**: sí.
4. **Test phone numbers and OTPs** (opcional pero recomendable para Playwright y para no gastar): `50688881234=123456, 50687770001=123456, 50688889999=123456`.
5. Guardar.

Luego **Authentication → Rate Limits**: dejá el envío de SMS en 30 por hora (valor por defecto) y «mínimo entre envíos al mismo número» en 60 s. La app ya impone 30 s por su lado y muestra los segundos que faltan si Supabase responde con su límite.

En **Authentication → URL Configuration**: Site URL `https://pruebas.bnbtico.com`. No hace falta nada más para OTP por teléfono.

**Sesión:** `[auth.sessions] timebox` e `inactivity_timeout` se dejan sin poner en local, `bnbtico-pruebas` y producción: la sesión no caduca mientras se use (decisión 2026-10-29). Revisarlo en el panel de Auth → Sessions al crear un proyecto.

## 5. Variables en Vercel (app vieja, hasta el corte)

Proyecto `bnbtico` → **Settings → Environment Variables**, entorno **Preview** (rama `develop`):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL del paso 1, **sin ruta**: `https://<ref>.supabase.co` (no la URL de REST que termina en `/rest/v1`; la app la recorta si se pega por error, pero mejor evitarlo) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key del paso 1 |
| `SESSION_SECRET` | `openssl rand -base64 48` (mínimo 32 caracteres; sin él la app no arranca) |
| `NEXT_PUBLIC_STAGE` | `pruebas` |
| `PREVIEW_PASSWORD` | La contraseña de `pruebas.bnbtico.com` |
| `NEXT_PUBLIC_WA_OWNERS` / `NEXT_PUBLIC_WA_GUESTS` | Números de atención en E.164, cuando existan |
| `NEXT_PUBLIC_GA_ID` | `off`, para no ensuciar Analytics con pruebas (Vercel no admite valores vacíos; cualquier valor que no sea `G-…` lo desactiva) |

Después, **Deployments → Redeploy** del último despliegue de `develop` (las variables `NEXT_PUBLIC_*` se fijan al compilar).

## 6. Comprobar desde un móvil (app vieja, hasta el corte)

Para la app nueva manda `docs/pruebas-manuales-fase-r.md`.

1. Abrí `https://pruebas.bnbtico.com/cuenta` en el teléfono, con la contraseña de pruebas.
2. Creá una cuenta con **tu número real de Costa Rica**. Debe llegar el código por WhatsApp en segundos. Si llega por SMS o no llega, mirá **Authentication → Logs** en Supabase y **Monitor → Logs** en Twilio.
3. Entrá, editá el perfil, cerrá sesión y volvé a entrar. Esperá 1 hora o más con la pestaña abierta y recargá: la sesión debe seguir viva (refresco en el proxy).
4. En **Table Editor → profiles** debe estar tu fila con `phone_verified_at` relleno.

Si el código por WhatsApp no llega a números ticos, se pasa a SMS (desactivar el canal WhatsApp en Twilio Verify) y se anota en `decisiones.md`, como prevé el plan.

## 7. Cuando el proyecto exista

**Migraciones y despliegue son pasos distintos.** El workflow de la app comprueba migraciones contra Supabase local del runner, pero no aplica el esquema al proyecto alojado. Antes de publicar código que use nuevas tablas/RPCs, verificarlo localmente y preparar por separado la aplicación de sus migraciones en el proyecto de pruebas correcto. Revisar primero `supabase db push --linked --dry-run`; solo después, con autorización para ese entorno, aplicar la lista revisada y comprobar las RPCs antes de probar la pantalla. Un build o merge correcto no acredita que la base alojada esté al día. En #5 faltaban las migraciones `20261108020000` y `20261108021000`: Ana las aplicó y confirmó la recuperación. La migración de #6 está validada en local y pendiente de aplicación/validación alojada; no aplicarla remotamente como parte de sus pruebas unitarias o de contrato.

- Los cambios de esquema van en **migraciones nuevas** (`pnpm exec supabase migration new <nombre>`), nunca editando `0001_init.sql`.
- Los datos de prueba se borran antes del lanzamiento (`docs/plan-implementacion.md`, fase 7).
- El proyecto de producción se crea en la fase 7 repitiendo estos pasos con `bnbtico-prod`, variables en el entorno **Production** de Vercel y Twilio en modo producción o la API de Meta.

## 8. Fase 2: casas, fotos y admin

1. **Migraciones.** Desde la raíz: `pnpm exec supabase db push`. Aplica `…_fase2_casas.sql` (columnas, RPCs, trigger de protección, bucket y políticas de Storage, vista pública), `…_fase2_tipo_sin_default.sql`, `…_fase2_permisos.sql` (privilegios por columna, tabla `listings` cerrada al público, coordenadas desplazadas en la vista) y `…_diseno_v1.sql` (modalidad Vacacional/Mensual, Alojamiento completo/Habitación, mensajes en usted). Comprobar en **Database → Functions** que existen `submit_listing`, `review_listing`, `listing_link_state` y `seed_admin`.
2. **Bucket de fotos.** La migración inserta el bucket `listings` en `storage.buckets`. Si **Storage** no lo muestra, crearlo a mano: nombre `listings`, público, límite 10 MiB, tipos `image/jpeg` e `image/webp`. Las políticas ya están en la migración.
3. **Cuenta admin de pruebas: `8899 0001`** (código `123456`, nombre «Admin bnbtico»). Ya está creada y marcada con `is_admin` en `bnbtico-pruebas` (2026-10-19, por la API de administración: número añadido a los códigos de prueba de Authentication → Phone, usuario creado con el teléfono confirmado y `select seed_admin('+50688990001')`). Es el mismo número admin que en local. Para hacer admin a otra cuenta (por ejemplo la tuya real cuando haya Twilio): creá la cuenta desde la app y, en **SQL Editor**, `select seed_admin('+506XXXXXXXX');` (el editor corre como `postgres`; `anon` y `authenticated` no pueden llamarla). Al volver a entrar, Mi cuenta muestra «Revisión de anuncios · admin» y `/admin` abre la cola.
4. **Comprobar desde el móvil:** seguir `docs/pruebas-manuales-fase-2.md` (bloques A–H): publicar una casa con fotos de la cámara → aprobarla con `8899 0001` → mandar el enlace `pruebas.bnbtico.com/casa/CT-####` por WhatsApp a otro teléfono y ver la vista previa y la ficha.


## 9. Fase R, ticket 11: protección de bots, filas por petición y copias

1. **Migración** `20261023084120_telemetria.sql` (tablas `web_vitals`, `client_errors`, `events`, sin acceso para `anon` ni `authenticated`): `pnpm exec supabase db push`, junto con las pendientes de los tickets 07–09.
2. **Turnstile.** Cloudflare → Turnstile → Add widget: nombre «bnbtico», dominios `nueva.bnbtico.com` (y `bnbtico.com` al cortar), modo «Managed». Copiar la **sitekey** a la variable de GitHub `TURNSTILE_SITE_KEY` y desplegar. Después, en Supabase → Authentication → **Attack Protection** (o Bot and Abuse Protection) → «Enable Captcha protection», proveedor Turnstile, con la **secret key** del widget. **Ojo:** desde ese momento todo envío de código sin token falla, también el de la app vieja de `pruebas.bnbtico.com` (no manda token): activarlo cuando `nueva.bnbtico.com` sea la que se prueba, o al cortar.
3. **Filas por petición.** Project Settings → **Data API** → «Max rows» = `200` → Save (equivale a `db-max-rows`; local: `[api] max_rows = 200`). Comprobar: `curl "$SUPABASE_URL/rest/v1/listings_public?select=public_id" -H "apikey: $ANON" -I` no devuelve más de 200 filas (cabecera `Content-Range` con `Prefer: count=exact`).
4. **Twilio:** Console → Billing → Usage triggers / alertas de gasto (p. ej. 20 USD al mes) para que un abuso de códigos no salga caro.
5. **Copias:** secretos de GitHub de `docs/copias-de-seguridad.md` (`SUPABASE_DB_URL` del Session pooler, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`), ejecutar el workflow «copia» a mano una vez y comprobar el archivo en R2.

## 10. App nueva: GitHub y Cloudflare en lugar de Vercel

El workflow `.github/workflows/app.yml` construye, prueba y despliega `apps/app` (rama `develop` → entorno `pruebas`, worker `bnbtico-pruebas`; `main` → entorno `production`, worker `bnbtico-production`). `.github/workflows/backup.yml` hace la copia diaria. Nombres exactos en GitHub → Settings → Secrets and variables → Actions. Donde dice «variable o secreto», el workflow lee `vars.X || secrets.X`: vale cualquiera de las dos pestañas.

| Nombre | Dónde | Para qué |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secreto | `wrangler deploy` y versiones de vista previa. Permisos: Workers Scripts edit, Account Settings read, Workers Routes edit, DNS edit, Cache Purge (guía del ticket 01). |
| `CLOUDFLARE_ACCOUNT_ID` | secreto | Cuenta de Cloudflare del despliegue. |
| `SUPABASE_URL` | variable o secreto | `VITE_SUPABASE_URL` del build (navegador y CSP). El worker de pruebas lleva la suya en `wrangler.jsonc` (`env.pruebas.vars`). |
| `SUPABASE_ANON_KEY` | variable o secreto | `VITE_SUPABASE_ANON_KEY` del build y secreto `SUPABASE_ANON_KEY` del worker (ficha, sitemap, cron). |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto | Solo el worker: escritura de la telemetría y recorte en el cron. Nunca llega al navegador. |
| `PURGE_SECRET` | secreto | Secreto del worker para `POST /_purge/CT-####`; el mismo valor va en Vault como `worker_purge_secret`. |
| `CLOUDFLARE_ZONE_ID` | secreto | Se sube al worker como `CF_ZONE_ID` (purga por URL en la zona `bnbtico.com`). |
| `CLOUDFLARE_PURGE_TOKEN` | secreto | Se sube como `CF_PURGE_TOKEN` (token con Cache Purge de la zona). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | secretos | Fase 5: envío de los avisos de fin de oferta por WhatsApp (Twilio, sandbox en pruebas). Sin ellos el envío está apagado y los avisos esperan en cola. |
| `TWILIO_WHATSAPP_FROM` | secreto | Número E.164 del remitente de WhatsApp (el del sandbox de Twilio en pruebas), sin `whatsapp:`. |
| `WHATSAPP_ALLOWLIST` | secreto | Números E.164 (separados por comas) que pueden recibir avisos en pruebas; los demás se omiten. Con Twilio en pruebas es obligatoria: sin ella, el envío está apagado. |
| `TEST_CLOCK_SECRET` | secreto | Abre `POST /_pruebas/oferta/CT-####` (reloj de pruebas). Nunca se sube desde `main` y el worker de producción responde 404 igualmente; además hace falta en Vault `bnbtico_test_clock = 'on'`. |
| `STRIPE_SECRET_KEY` | secreto | Fase 5: clave `sk_test_…` de Stripe en modo de prueba (cuenta de Ana) para guardar el método de pago sin cobrar. El worker rechaza `sk_live_`/`rk_live_`; nunca se sube desde `main`. Sin ella, `POST /api/pago/sesion` y `/webhooks/stripe` responden 503. |
| `STRIPE_WEBHOOK_SECRET` | secreto | Fase 5: `whsec_…` del destino de webhook de Stripe (`checkout.session.completed` → `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev/webhooks/stripe`). Nunca desde `main`. |
| `TURNSTILE_SITE_KEY` | variable o secreto | `VITE_TURNSTILE_SITE_KEY` (pública). La secret key de Turnstile va en Supabase Auth, no en GitHub. |
| `WA_OWNERS`, `WA_GUESTS` | variable o secreto | `VITE_WA_OWNERS` / `VITE_WA_GUESTS`: números de atención de Ayuda en E.164. |
| `SUPABASE_DB_URL` | secreto | Copia diaria: cadena del Session pooler. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | secretos | Copia diaria a R2. |
| `R2_BUCKET`, `BACKUP_PREFIX` | variable o secreto (opcionales) | Por defecto `bnbtico-copias` y `bnbtico-pruebas`. |

**Variables del worker en `wrangler.jsonc`** (no en el panel: cada despliegue las reescribe). Fase 5, entorno `pruebas`: `PAYMENTS=stripe` (pasarela; sin sus secretos, 503), `WHATSAPP_SENDER=twilio` (remitente; sin sus secretos o sin `WHATSAPP_ALLOWLIST`, apagado y los avisos esperan en cola) y `PUBLIC_ORIGIN=https://nueva.bnbtico.com` (base del enlace `#pago=` del aviso; pasa a `https://pruebas.bnbtico.com` al cortar). En producción, pagos y avisos apagados en esta fase. En local, `pnpm dev:vars` escribe en `apps/app/.dev.vars` `PAYMENTS=fake` con `FAKE_PAYMENTS_SECRET` (pasarela falsa `/_pago-falso/…`, solo `ENVIRONMENT=local`), `WHATSAPP_SENDER=fake` y un `TEST_CLOCK_SECRET` aleatorio.

Los secretos que falten no se suben al worker (la purga responde 503 y las balizas se descartan sin la service role). Hoy los secretos son de repositorio y valen para los dos entornos: antes del primer push a `main` conviene pasarlos a GitHub Environments (`docs/corte-fase-r.md`, paso 9).

**En Stripe** (modo de prueba, cuenta de Ana): la clave secreta y un destino de webhook con `checkout.session.completed`. **En Twilio:** el sandbox de WhatsApp, con el teléfono de pruebas unido («join <código>», dura 3 días). Pasos en `docs/pruebas-manuales-fase-5.md`, A1–A2.

**En Cloudflare** (panel, no en el repo): zona `bnbtico.com`; worker `bnbtico-pruebas` con el dominio personalizado `nueva.bnbtico.com` (`pruebas.bnbtico.com` tras el corte); Zero Trust → Access con la aplicación de `nueva.bnbtico.com` y sus bypass `/casa/*`, `/_purge/*` y, desde la fase 5, `/webhooks/*` y `/_pruebas/*`; widget de Turnstile con los hostnames donde se ingresa. **En Supabase** (`bnbtico-pruebas`): los secretos de Vault `worker_purge_url` (hoy `https://nueva.bnbtico.com`; al cortar, `https://pruebas.bnbtico.com`) y `worker_purge_secret`; desde la fase 5, `bnbtico_test_clock = 'on'` (solo pruebas: abre el reloj de pruebas; nunca en producción); protección de bots con la secret key de Turnstile; MFA TOTP activo; «Max rows» 200.
