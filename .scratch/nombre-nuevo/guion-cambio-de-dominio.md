# Guion del cambio de dominio a 3bstays.com (2026-11-11)

Status: ready-for-human

**Qué cambia en el código** (rama `marca-3bstays`):

- Pruebas pasa de `nueva.bnbtico.com` a **`pruebas.3bstays.com`**.
- Los workers pasan de `bnbtico-*` a **`3bstays-*`**.
- `PUBLIC_ORIGIN` pasa a `https://pruebas.3bstays.com`.
- Hay tres migraciones nuevas.

**Orden obligatorio:** bloque A completo, después B (merge) y después C. Si se hace el merge antes de A:

- falla el despliegue, porque la zona no existe; o
- pruebas queda **abierto al público**, porque falta Access.

**Bloque A, en corto:** A1 (zona y nameservers), A2 (Access), A4 (Zone ID y tokens) y A5 (la Site URL de Supabase; las migraciones las aplico yo). A3 no aplica. A6 pasa a después del despliegue.

**Quién puede hacer cada cosa.** Cada paso pide acceso a una cuenta. Algunas son de Ana (Stripe y, probablemente, Cloudflare y GitHub `angarcia/bnbtico`): si Daniel no tiene acceso, lo hace Ana.

**Estado comprobado el 2026-11-11** en el registro oficial de `.com`:

- `3bstays.com` está registrado en GoDaddy (el 2026-11-10), con los nameservers de GoDaddy (`ns55`/`ns56.domaincontrol.com`) y **sin DNSSEC**.
- `tresbstays.com` y `threebstays.com` también están en GoDaddy, con una página de aparcamiento y sin correo (MX).

Ninguno de los tres usa correo ni DNSSEC, así que nada se rompe al cambiar de nameservers.

---

## A · Antes del merge

### A1 · Cloudflare: añadir la zona 3bstays.com

El dominio **sigue registrado en GoDaddy**: la renovación y el pago siguen allí. Solo cambia quién responde al DNS, que pasa a ser Cloudflare. No hace falta transferir el dominio.

**En Cloudflare** (la misma cuenta donde está hoy `bnbtico.com`):

1. Entrar en https://dash.cloudflare.com con la cuenta que tiene la zona `bnbtico.com` y el worker `bnbtico-pruebas`.
2. En la página de la cuenta (Account Home), pulsar **«+ Add»** → **«Connect a domain»** (en algunas versiones del panel, «Add a domain» u «Onboard a domain»).
3. Escribir `3bstays.com`. Dejar marcado **«Quick scan for DNS records»**. Pulsar **Continue**.
4. Elegir el plan **Free**. Continue.
5. **Revisar los registros DNS** importados. Cloudflare copia los que tenga GoDaddy: normalmente dos registros `A` de `@` que apuntan a la página de aparcamiento (`15.197.225.128` y `3.33.251.168`) y un `CNAME www`.
   - **Borrarlos todos.** Así no hay ningún registro previo para `pruebas` y la página de GoDaddy deja de salir.
   - Continue.
6. Cloudflare muestra **dos nameservers**, del estilo `xxxx.ns.cloudflare.com` y `yyyy.ns.cloudflare.com`. **Copiarlos tal cual**: cada cuenta tiene los suyos.
7. Dejar esa pestaña abierta.

**En GoDaddy:**

8. Entrar en https://dcc.godaddy.com/control/portfolio (Mi cuenta → **Mis productos** → **Dominios**).
9. Abrir **3bstays.com** → pestaña **DNS** → sección **Nameservers** (o «Servidores de nombres») → **Change nameservers**.
10. Elegir **«I'll use my own nameservers»** («Usaré mis propios servidores de nombres»).
11. Borrar los que haya y pegar los **dos de Cloudflare**, uno por casilla. **Save**.
12. GoDaddy avisa de que el DNS de GoDaddy, la página de aparcamiento y el reenvío dejarán de funcionar. Confirmar: es lo que queremos.

**De vuelta en Cloudflare:**

13. Pulsar **«Check nameservers now»**. La zona pasa de *Pending* a **Active** en cuanto el registro de `.com` publica el cambio: suele tardar entre 10 minutos y un par de horas, y como máximo 24 h. Cloudflare manda un correo al activarla.
14. **Cómo comprobarlo:** en la lista de dominios de Cloudflare, `3bstays.com` aparece con el estado **Active**. Desde un terminal fuera de la red corporativa:
    ```bash
    dig +short NS 3bstays.com
    ```
    Tienen que salir los dos `*.ns.cloudflare.com`.
15. En la zona `3bstays.com` → **SSL/TLS** → **Overview**: dejar **Full (strict)**, o el modo que tenga hoy `bnbtico.com`.

**No seguir con B hasta que la zona esté Active.** Los pasos A2–A6 sí se pueden hacer mientras se espera.

### A2 · Cloudflare Access: proteger pruebas.3bstays.com

No se crean aplicaciones nuevas: **a cada aplicación existente se le añade el destino `pruebas.3bstays.com`** con el mismo path. Las políticas se conservan.

Zero Trust → **Access** → **Applications** → en cada aplicación, **⋯** → **Edit** → **+ Add public hostname**. Subdomain `pruebas`, Domain `3bstays.com` y, en Path, el mismo que el destino viejo, sin `/` inicial. Después, **Save application**.

| Aplicación (política) | Destinos que hay hoy en `nueva.bnbtico.com` | Destinos que se añaden en `pruebas.3bstays.com` |
|---|---|---|
| bnbtico nueva (Emails) | sin path | sin path |
| bnbtico nueva · purga (Bypass para todos) | `_purge/*` | `_purge/*` |
| nueva (Bypass para todos) | `ical/*` | `ical/*` |
| bnbtico nueva · fichas públicas (Bypass para todos) | `casa/*`, `assets/*`, `fonts/*`, `icons/*`, `favicon.ico`, `logo-horizontal.png`, `sw.js`, `manifest.webmanifest` | los mismos 8; recomendado añadir también `og.jpg`, en los dos dominios, para la vista previa al compartir por WhatsApp |
| refactor (Emails) | `refactor.bnbtico.com` | `refactor.3bstays.com`, solo si se sigue usando el entorno refactor |

No hay excepciones para `webhooks/*` ni `_pruebas/*`: Stripe llama a la URL de workers.dev, que no pasa por Access (ver A6).

**Comprobación:** en la lista, cada aplicación muestra sus destinos de `pruebas.3bstays.com`. La prueba real va en C1. Los destinos de `nueva.bnbtico.com` se quitan en C7.

### A3 · Turnstile: no aplica hoy

Todavía no hay widget: Turnstile está pendiente en `docs/antes-de-produccion.md` (punto 3). Sin `VITE_TURNSTILE_SITE_KEY`, la app pide el código sin token. Cuando se active, el widget se crea directamente con `pruebas.3bstays.com` y `3bstays.com`.

### A4 · Cloudflare: Zone ID y tokens → secretos de GitHub

**Zone ID de la zona nueva:**

1. Cloudflare → abrir la zona **3bstays.com** → **Overview**. En la columna derecha, abajo, sección **API** → **Zone ID** → **Click to copy**.

**Token para purgar la caché de la zona nueva:**

2. Arriba a la derecha, el icono de usuario → **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token** («Get started»):
   - Token name: `3bstays purga de caché`.
   - Permissions: `Zone` · `Cache Purge` · `Purge`.
   - Zone Resources: `Include` · `Specific zone` · `3bstays.com`.
   - **Continue to summary** → **Create Token** → **copiar el token**: solo se muestra una vez.

**Token de despliegue**, que ya existe:

3. En la misma lista de **API Tokens**, buscar el que usa GitHub para desplegar. Tiene los permisos Workers Scripts Edit, Workers Routes Edit, DNS Edit y Cache Purge; el nombre puede ser «GitHub deploy» o parecido. Pulsar **⋯ → Edit**.
4. En **Zone Resources**:
   - si pone `All zones from an account`, no hay que tocar nada;
   - si pone `Specific zone · bnbtico.com`, añadir otra fila `Include · Specific zone · 3bstays.com`.
   - **Continue to summary** → **Update token**. **El valor del token no cambia**, así que GitHub no se toca.

**En GitHub** (https://github.com/angarcia/bnbtico):

5. **Settings** → **Secrets and variables** → **Actions**. Los secretos están en **Repository secrets**. Si alguno no aparece ahí, mirar en **Environments** → `pruebas` o `Production`.
6. `CLOUDFLARE_ZONE_ID` → ✏️ **Update** → pegar el Zone ID del paso 1 → **Update secret**.
7. `CLOUDFLARE_PURGE_TOKEN` → ✏️ **Update** → pegar el token del paso 2 → **Update secret**.
8. Los demás secretos no cambian: CI los sube al worker nuevo en cada despliegue.

### A5 · Supabase (proyecto `bnbtico-pruebas`)

1. https://supabase.com/dashboard → proyecto **bnbtico-pruebas** → **Authentication** → **URL Configuration**:
   - **Site URL**: `https://pruebas.3bstays.com` → **Save**.
   - **Redirect URLs** → **Add URL**: `https://pruebas.3bstays.com` y `https://3bstays.com`. Dejar las viejas hasta C7.
2. **Migraciones.** Las tres de la rama:
   - `20261111182621_marca_3bstays`: mensajes de error.
   - `20261111184714_marca_3bstays_internos`: `source` `'support'`, correo de los admins y trabajos de pg_cron.
   - `20261111190830_marca_3bstays_candado_y_reloj`: candado de la promoción y reloj de pruebas. Renombra sola el secreto de Vault `bnbtico_test_clock` a `3bstays_test_clock`.

   Son compatibles con la app que está desplegada ahora, así que se pueden aplicar antes del merge, y deben aplicarse antes: la regla es aplicar las migraciones en pruebas antes del `git push`. **Lo hago yo** cuando me lo diga:
   - primero `supabase db push --linked --dry-run`, para que vean la lista;
   - después el `db push`;
   - y compruebo los trabajos de cron, la restricción de `source` y el secreto renombrado.
3. **No cambiar todavía** `worker_purge_url`: se cambia en C2, cuando el dominio nuevo ya responda.

### A6 · Stripe: se hace después del despliegue (C2b)

Stripe llama a la URL de **workers.dev** del worker, que no pasa por Access. El worker nuevo tiene otra URL, así que el webhook solo puede cambiarse cuando `3bstays-pruebas` exista. Ver **C2b**.

---

## B · Merge y despliegue

1. Me avisan de que A1 está **Active** y A2–A6 hechos. Yo aplico las migraciones (A5.2), empujo la rama y abro el PR a `develop`.
2. Merge del PR, **sin empujar nada más a `develop` mientras corre su CI**. Si no, el despliegue falla por el aviso de vigencia.
3. En GitHub → **Actions**, el workflow de la app del commit del merge:
   - Pasan las pruebas.
   - El paso de despliegue crea el worker **`3bstays-pruebas`** y el dominio personalizado `pruebas.3bstays.com`. Cloudflare añade solo el registro DNS y el certificado.
   - Si falla con un error de permisos en la zona, revisar A4.3. Si falla con «zone not found», la zona todavía no está Active (A1).
4. En Cloudflare → **Workers & Pages** aparece `3bstays-pruebas`. En **Settings** → **Domains & Routes**: `pruebas.3bstays.com` (Active) y la URL de workers.dev.

## C · Después del despliegue

### C1 · Comprobar desde el teléfono (fuera de la red corporativa)

- [ ] `https://pruebas.3bstays.com` pide el login de Access. Después de entrar, carga Explorar con el logo de 3bstays.
- [ ] **Ingresar** con un número de prueba: llega el código y se entra. La sesión de antes ya no está: es lo esperado.
- [ ] Una ficha `https://pruebas.3bstays.com/casa/CT-####`, abierta en una ventana privada, se ve **sin** Access.
- [ ] **El iCal**, sin cookies, desde un terminal fuera de la red corporativa:
  ```bash
  curl -sI https://pruebas.3bstays.com/ical/<token>.ics
  ```
  Tiene que dar `200` y `content-type: text/calendar`; no un `302` al login. El token sale de la tarjeta «Exportar a Airbnb» de una casa de prueba.
- [ ] Desde la red corporativa, usar la URL de workers.dev: `https://3bstays-pruebas.ana-garcia-saiz.workers.dev`. Confirmar el subdominio exacto en Workers & Pages.

### C2 · Supabase: Vault `worker_purge_url`

1. Proyecto `bnbtico-pruebas` → **SQL Editor** → **New query**:
   ```sql
   select vault.update_secret(id, new_secret => 'https://pruebas.3bstays.com')
   from vault.secrets where name = 'worker_purge_url';
   select name, decrypted_secret from vault.decrypted_secrets where name = 'worker_purge_url';
   ```
2. La segunda consulta tiene que mostrar `https://pruebas.3bstays.com`. También puedo hacerlo yo por la API de administración.
3. **Comprobar:** editar el precio de una casa activa (o pausarla y reanudarla) y abrir su ficha en una ventana privada: se ve el cambio al momento.

### C2b · Stripe (modo de prueba, cuenta de Ana): el webhook al worker nuevo

1. En Cloudflare → **Workers & Pages** → `3bstays-pruebas` → **Settings** → **Domains & Routes**: copiar la URL de workers.dev. Debería ser `https://3bstays-pruebas.ana-garcia-saiz.workers.dev`.
2. https://dashboard.stripe.com, en **Test mode** o en el *sandbox* que se use → **Developers** → **Webhooks** (o **Workbench** → **Webhooks**).
3. Abrir el destino que apunta a `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev/webhooks/stripe` → **⋯ → Edit destination** → **Endpoint URL** `https://3bstays-pruebas.ana-garcia-saiz.workers.dev/webhooks/stripe`. Mismos eventos (`checkout.session.completed`). **Save**.
4. Al editar la URL, el *signing secret* (`whsec_…`) no cambia, así que GitHub no se toca. Si se crea un destino nuevo, su `whsec_…` va al secreto de GitHub `STRIPE_WEBHOOK_SECRET`, y hay que volver a desplegar.
5. **Comprobar:** en la app, Suscripción → «Añadir método de pago» → tarjeta de prueba `4242 4242 4242 4242`. Al volver, la casa muestra el método guardado. En Stripe, el evento sale **200** en el destino.

### C3 · Airbnb (solo las casas de prueba conectadas)

1. En la app, **Calendario** → la casa → tarjeta **«Exportar a Airbnb»** → copiar el enlace nuevo (`https://pruebas.3bstays.com/ical/…`).
2. En Airbnb → el anuncio → **Disponibilidad** → **Sincronizar calendarios** → quitar el calendario importado con la URL vieja → **Importar calendario** → pegar el enlace nuevo → nombre «3bstays».
3. El UID de los eventos también cambió: la primera lectura sustituye todos los bloqueos de una vez, sin dejar noches libres por el camino.

### C4 · Probadores y admins

- Los probadores tienen que volver a entrar: la app borra lo que había guardado con la marca anterior.
- Admins: su correo de relleno pasa a `@admin.3bstays.invalid`. El segundo factor actual sigue funcionando. Para que la app de autenticación muestre «3bstays» (opcional): Cuenta → seguridad → dar de baja el factor y darlo de alta otra vez.

### C5 · Nombres que ve el usuario fuera del repositorio

- **Twilio Verify** (el SMS «Su código de … es»): https://console.twilio.com → **Verify** → **Services** → el servicio → **Friendly name** `3bstays` → Save. Si Supabase usa Twilio de este proyecto, el próximo SMS ya dice 3bstays.
- **WhatsApp de atención** (los dos números): en WhatsApp Business → **Ajustes** → **Herramientas para la empresa** → **Perfil de empresa** → **Nombre** `3bstays`, y la foto de perfil con el icono nuevo (`design/logo/3bstays-2026-11-10/05-redes/`). Si son números de la API de Meta, el cambio de nombre se pide en WhatsApp Manager y Meta lo revisa.
- **Stripe**: **Settings** → **Business** → **Public details** → **Public business name** `3bstays` y **Statement descriptor** `3BSTAYS`.

### C6 · Lo que cambia para mí (Claude)

- Actualizar la memoria con la URL de workers.dev definitiva.
- Comprobar en las Actions que el despliegue y Lighthouse pasaron.

### C7 · Limpieza, uno o dos días después, cuando todo funcione

1. Cloudflare → **Workers & Pages** → `bnbtico-pruebas` → **Settings** → abajo, **Delete**. Lo mismo con `bnbtico-refactor` y `bnbtico-production`, si existen. Al borrar el worker también se quita el registro DNS de `nueva.bnbtico.com`.
2. **Zero Trust** → **Access** → **Applications**: borrar las aplicaciones de `nueva.bnbtico.com`.
3. **Turnstile**: quitar `nueva.bnbtico.com` de los hostnames.
4. **Supabase** → URL Configuration: quitar de Redirect URLs las de `bnbtico.com`.
5. **API Tokens**: si había un token de purga solo para `bnbtico.com`, borrarlo.

### C8 · Las dos alternativas (cuando haya tiempo)

Para cada uno de `tresbstays.com` y `threebstays.com`:

1. Repetir **A1 completo**: añadir la zona en Cloudflare, borrar los registros de aparcamiento y cambiar los nameservers en GoDaddy.
2. Cuando la zona esté Active → **DNS** → **Records** → **Add record**:
   - `A`, Name `@`, IPv4 `192.0.2.1`, Proxy **naranja (Proxied)**;
   - y `CNAME`, Name `www`, Target el propio dominio, Proxied.

   La IP es de relleno: Cloudflare responde antes de llegar a ella.
3. **Rules** → **Redirect Rules** → **Create rule** (regla personalizada, sin plantilla):
   - Si: *All incoming requests*.
   - Then: **Dynamic**, expresión `concat("https://3bstays.com", http.request.uri.path)`, código **301**, marcar **Preserve query string**.
   - Deploy.
4. **Comprobar:** `curl -sI https://tresbstays.com/casa/CT-1234` da `301` con `location: https://3bstays.com/casa/CT-1234`.

### Más adelante, no hoy

- Las redirecciones de `bnbtico.com` y `pruebas.bnbtico.com` (siguen en Vercel), según lo que diga el abogado.
- El bucket de copias `bnbtico-copias`. Producción tendrá el suyo.
