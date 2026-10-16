# Configurar Supabase y Twilio para `pruebas.bnbtico.com`

Guía paso a paso (2026-10-15). Todo lo que requiere crear cuentas, aceptar condiciones o pegar claves lo hace una persona; la CLI del repo solo aplica la migración. El proyecto de **producción** se crea igual en la fase 7, con otro nombre.

## 0. Qué vas a crear

| Pieza | Para qué | Coste |
|---|---|---|
| Proyecto Supabase `bnbtico-pruebas` | Base de datos, login por teléfono, fotos | Plan Free |
| Servicio Twilio Verify | Enviar el código por WhatsApp (o SMS) | Céntimos por código |
| Variables en Vercel (entorno Preview) | Que `pruebas.bnbtico.com` use lo anterior | — |

## 1. Proyecto en Supabase

1. Entrá en <https://supabase.com/dashboard> y creá una organización si no tenés (plan Free).
2. **New project**: nombre `bnbtico-pruebas`, región **East US (North Virginia)** o la más cercana a Costa Rica, y una **contraseña de base de datos** larga. Guardala en tu gestor de contraseñas: hace falta en el paso 3.
3. Esperá a que el proyecto termine de aprovisionarse (1–2 minutos).
4. Anotá dos valores (el botón **Connect**, arriba del panel, pestaña «App Frameworks» → Next.js, los muestra juntos):
   - **Project URL** (`https://<ref>.supabase.co`), en **Project Settings → Data API**. El **ref** son las 20 letras minúsculas que Supabase asigna al proyecto; también se ven en la barra de direcciones del panel (`…/dashboard/project/<ref>`).
   - **Publishable key** (`sb_publishable_…`), en **Project Settings → API Keys**. Es la que va en la app como `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Las claves `secret` no se usan en la app.

## 2. Aplicar el esquema

Desde la raíz del repo, con la CLI que ya está instalada:

```sh
pnpm exec supabase login
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

`login` abre el navegador para autorizar la CLI. `link` pide la contraseña de la base del paso 1. `db push` aplica `supabase/migrations/0001_init.sql` (tablas, RLS, triggers de perfil). Para comprobarlo: **Table Editor** debe mostrar `profiles`, `listings`, etc., y **Database → Triggers** los dos triggers `on_auth_user_*` sobre `auth.users`.

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

## 5. Variables en Vercel

Proyecto `bnbtico` → **Settings → Environment Variables**, entorno **Preview** (rama `develop`):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL del paso 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key del paso 1 |
| `SESSION_SECRET` | `openssl rand -base64 48` (mínimo 32 caracteres; sin él la app no arranca) |
| `NEXT_PUBLIC_STAGE` | `pruebas` |
| `PREVIEW_PASSWORD` | La contraseña de `pruebas.bnbtico.com` |
| `NEXT_PUBLIC_WA_OWNERS` / `NEXT_PUBLIC_WA_GUESTS` | Números de atención en E.164, cuando existan |
| `NEXT_PUBLIC_GA_ID` | vacío, para no ensuciar Analytics con pruebas |

Después, **Deployments → Redeploy** del último despliegue de `develop` (las variables `NEXT_PUBLIC_*` se fijan al compilar).

## 6. Comprobar desde un móvil

1. Abrí `https://pruebas.bnbtico.com/cuenta` en el teléfono, con la contraseña de pruebas.
2. Creá una cuenta con **tu número real de Costa Rica**. Debe llegar el código por WhatsApp en segundos. Si llega por SMS o no llega, mirá **Authentication → Logs** en Supabase y **Monitor → Logs** en Twilio.
3. Entrá, editá el perfil, cerrá sesión y volvé a entrar. Esperá 1 hora o más con la pestaña abierta y recargá: la sesión debe seguir viva (refresco en el proxy).
4. En **Table Editor → profiles** debe estar tu fila con `phone_verified_at` relleno.

Si el código por WhatsApp no llega a números ticos, se pasa a SMS (desactivar el canal WhatsApp en Twilio Verify) y se anota en `decisiones.md`, como prevé el plan.

## 7. Cuando el proyecto exista

- Los cambios de esquema van en **migraciones nuevas** (`pnpm exec supabase migration new <nombre>`), nunca editando `0001_init.sql`.
- Los datos de prueba se borran antes del lanzamiento (`docs/plan-implementacion.md`, fase 7).
- El proyecto de producción se crea en la fase 7 repitiendo estos pasos con `bnbtico-prod`, variables en el entorno **Production** de Vercel y Twilio en modo producción o la API de Meta.
