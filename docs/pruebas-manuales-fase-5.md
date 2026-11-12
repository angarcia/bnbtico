# Plan de pruebas manual · fase 5 (suscripción, estados y avisos) en nueva.bnbtico.com

Fecha: 2026-10-27 (tickets 01–08 de `.scratch/fase-5/`). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas` en Cloudflare, Supabase `bnbtico-pruebas`). Desde la red corporativa, donde `nueva.bnbtico.com` no carga, use `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev` (mismo worker y misma base; no pasa por Access). Se ejecuta **desde el teléfono**, con un iPhone y un Android si es posible, después de desplegar. Complementa a `docs/pruebas-manuales-fase-r.md`, `-fase-3.md`, `-fase-4.md` y `-revision-ux.md` (lo de esas fases no se repite aquí). Marque cada casilla y, si algo falla, anote el número del paso (ver C).

**Qué se prueba:** la oferta de lanzamiento de cada casa, los avisos a 90/30/7/0 días (en la app y por WhatsApp, con el sandbox de Twilio), la casa que queda «Pendiente de pago» y su enlace bloqueado, guardar una tarjeta **de prueba** en Stripe (no se cobra nada), parar y reactivar la suscripción, y lo que dicen Cuenta, Inicio, Mis casas, el detalle de la casa y Casas del admin. El paso del tiempo se simula con el **reloj de pruebas**: una llamada (`curl`) deja una casa con N días de oferta, corre el trabajo del día y manda los avisos pendientes **al momento** (el cron horario del worker solo los manda de 08:00 a 17:59 de Costa Rica).

**Use una casa de prueba, no las de verdad:** el recorrido gasta la oferta de la casa que use (al final queda con el plan de pago, sin cobrar nada) y cada aviso sale una sola vez por casa y umbral. Para repetir el plan hace falta otra casa nueva.

**Frescura de la ficha:** como en la fase 4, la purga tras cada cambio de estado borra la copia de la ficha del dominio de `worker_purge_url` (`https://nueva.bnbtico.com`). Compruebe la ficha bloqueada y la de vuelta en `nueva.bnbtico.com` desde los datos del teléfono. Si en `workers.dev` una ficha sale vieja, no es un fallo de la fase 5 (anótelo igual, con el dominio).

La parte A va antes, **una acción cada vez y en este orden**. La migración de la fase 5 (`20261027202238_fase5_suscripcion`) **ya está aplicada** en `bnbtico-pruebas` (2026-10-27, con autorización de Daniel): las 2 casas activas tienen las plazas 1 y 2 y el trabajo `bnbtico-suscripciones` (`5 6 * * *`) está activo. No hay que aplicar nada en la base salvo el secreto de A5.

---

## A. Acciones previas (Daniel)

### A1. Stripe en modo de prueba (cuenta de Ana) · bloquea: B7

Todo en **modo de prueba** (interruptor «Test mode» / «Entorno de prueba» arriba a la derecha del panel de Stripe). Nada en modo real.

1. Entrar en `https://dashboard.stripe.com` con la cuenta de Ana y activar **Test mode**.
2. **Developers → API keys** → «Secret key» → «Reveal test key» → copiar la clave, que empieza por **`sk_test_`**. (Si empieza por `sk_live_`, está en modo real: pare. El worker rechaza las claves `live`.) Guárdela para A3.
3. **Developers → Webhooks** (o «Workbench → Event destinations») → **Add destination** / «Añadir destino».
4. Origen de los eventos: «Your account». Versión de la API: la que proponga. Payload: **Snapshot**.
5. Eventos: buscar y marcar solo **`checkout.session.completed`** → Continuar.
6. Tipo de destino: **Webhook endpoint** → URL: `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev/webhooks/stripe` → crear.
7. En el destino creado, «Signing secret» → **Reveal** → copiar el valor, que empieza por **`whsec_`**. Guárdelo para A3.

### A2. Twilio: sandbox de WhatsApp · bloquea: B3–B5

1. Entrar en `https://console.twilio.com`. En la portada de la consola (Account Info) copiar el **Account SID** (empieza por `AC…`) y el **Auth Token** («Show»). Guárdelos para A3.
2. **Messaging → Try it out → Send a WhatsApp message** (sandbox de WhatsApp). Ahí salen el **número del sandbox** (p. ej. `+1 415 523 8886`) y el código para unirse, del tipo `join <dos-palabras>`.
3. **Desde el teléfono que va a recibir los avisos** (el WhatsApp de la cuenta propietaria de la casa de prueba; con Ana, `+1 778 347 8492`): mandar por WhatsApp al número del sandbox el texto exacto `join <dos-palabras>`. Debe contestar que el teléfono quedó unido al sandbox.
4. Anote el número del sandbox en E.164 sin espacios (`+14155238886`) y el número que se unió (`+17783478492`).

**Dos reglas del sandbox** (para B3–B5): la unión dura **3 días** (después hay que volver a mandar `join …`), y Twilio solo entrega texto libre si ese teléfono **escribió al sandbox en las últimas 24 horas**. Antes de cada sesión de pruebas, mande cualquier mensaje («hola») al número del sandbox desde ese teléfono.

### A3. Secretos de GitHub · bloquea: despliegue con pagos y avisos

GitHub → el repositorio → **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Uno cada vez, con el nombre **exacto**:

| Nombre | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | la `sk_test_…` de A1.2 |
| `STRIPE_WEBHOOK_SECRET` | la `whsec_…` de A1.7 |
| `TWILIO_ACCOUNT_SID` | el `AC…` de A2.1 |
| `TWILIO_AUTH_TOKEN` | el Auth Token de A2.1 |
| `TWILIO_WHATSAPP_FROM` | el número del sandbox en E.164, sin `whatsapp:` (`+14155238886`) |
| `WHATSAPP_ALLOWLIST` | los números que pueden recibir avisos, en E.164 separados por comas (`+17783478492`; añada el suyo si también va a recibir). Los demás se omiten para siempre |
| `TEST_CLOCK_SECRET` | un valor aleatorio largo: en la terminal del Mac, `openssl rand -hex 32`. **Guárdelo**: lo necesita en los `curl` de B |

Nada de esto se sube nunca desde `main` (el workflow lo vacía) y en producción los pagos y los avisos están apagados igualmente. `PAYMENTS=stripe`, `WHATSAPP_SENDER=twilio` y `PUBLIC_ORIGIN=https://nueva.bnbtico.com` ya van en `wrangler.jsonc`: no hay que tocar variables en el panel de Cloudflare.

### A4. Cloudflare Access: rutas sin PIN · bloquea: B (en `nueva.bnbtico.com`)

Cloudflare → **Zero Trust → Access → Applications** → la aplicación de `nueva.bnbtico.com`. Como se hizo con `/casa/*` y `/_purge/*` (`docs/pruebas-manuales-fase-r.md`, A4), añadir dos aplicaciones o reglas **Bypass · Everyone**:

1. `nueva.bnbtico.com/webhooks/*` (para que un webhook dirigido a `nueva` no choque con el PIN; el de A1 va a `workers.dev`, que no pasa por Access).
2. `nueva.bnbtico.com/_pruebas/*` (para poder lanzar los `curl` del reloj contra `nueva` si hiciera falta; los de este plan van a `workers.dev`).

La ruta `/_pruebas/*` sigue cerrada sin el `TEST_CLOCK_SECRET` (401) y sin el secreto de Vault de A5 (409).

### A5. Secreto de Vault del reloj de pruebas en `bnbtico-pruebas` · bloquea: B2–B5

Supabase → proyecto `bnbtico-pruebas` → **SQL Editor** → ejecutar:

```sql
select vault.create_secret('on', 'bnbtico_test_clock');
```

Comprobar: `select name from vault.secrets where name = 'bnbtico_test_clock';` → una fila. Sin él, el `curl` de B responde 409 «El reloj de pruebas no está habilitado.». **Nunca** en el proyecto de producción. Al terminar todas las pruebas de la fase, se puede borrar con `delete from vault.secrets where name = 'bnbtico_test_clock';`.

### A6. Desplegar y comprobar · bloquea: todo B

1. `git push origin develop`. El workflow `app` pasa las pruebas (incluido el recorrido `fase5.spec.ts`) y la puerta de Lighthouse y despliega. Comprobar en GitHub → Actions que el run está verde y que en el paso «Secretos del worker» no hay errores.
2. Cloudflare → **Workers & Pages → `bnbtico-pruebas` → Settings → Trigger events / Triggers**: **un solo cron, `17 * * * *`** (antes era `17 9 * * *`). Si aparecen dos, borrar el viejo.
3. Comprobar que el reloj responde (desde el Mac; sustituya el secreto):

   ```sh
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://bnbtico-pruebas.ana-garcia-saiz.workers.dev/_pruebas/oferta/CT-0000 \
     -H "authorization: Bearer otro" -H "content-type: application/json" -d '{"diasRestantes":90}'
   ```

   Debe dar **401** (sin el secreto bueno). Si da 404, `TEST_CLOCK_SECRET` no llegó al worker (A3).
4. Supabase → **Database → Cron**: siguen activos `bnbtico-reabrir-casas` (`0 6 * * *`) y `bnbtico-suscripciones` (`5 6 * * *`).

(En el runner de Linux, `frescura.spec.ts` y `fase4.spec.ts` se omiten porque la base de Docker no llega al preview: es esperado. `fase5.spec.ts` sí corre allí.)

---

## B. Recorridos

Quién hace de quién: **Ana** (`+1 778 347 8492`, unida al sandbox en A2) de propietaria; **Daniel** de admin (con su app de autenticación) y de cliente, sin sesión, en una pestaña privada. Copy que debe verse: trato de usted, importes como «₡2 900», fechas como «25 ene 2027» en las tarjetas y «25 de enero» en las frases.

Los `curl` se lanzan desde el Mac (o cualquier terminal). Prepare una vez:

```sh
export BASE=https://bnbtico-pruebas.ana-garcia-saiz.workers.dev
export SECRETO='<el TEST_CLOCK_SECRET de A3>'
export CASA=CT-XXXX   # el número de la casa de prueba de B1
reloj() { curl -sS -X POST "$BASE/_pruebas/oferta/$CASA" -H "authorization: Bearer $SECRETO" -H "content-type: application/json" -d "{\"diasRestantes\":$1}"; echo; }
```

Cada `reloj N` responde un JSON con `promoEndsOn` (el nuevo último día gratis), `day` (`paid`, `paymentDue`, `queued`) y `reminders` (`claimed`, `sent`, `retry`, `unknown`, `skipped` y, en `outcomes`, el texto enviado). Antes de B3, Ana manda «hola» al sandbox (regla de las 24 h).

### Oferta al aprobar

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B0 | Daniel (admin): Admin → Casas | Lista con buscador «Nombre, CT-#### o propietario» y chips «Todas · Activas · Por pagar · Inactivas» con su número. Las 2 casas activas de antes con «Gratis hasta 22 oct 2027» / «24 oct 2027» e insignia «Activa» | ☐ |
| B1 | Ana: «Publicar mi casa» → una casa nueva de prueba → enviar a revisión. Anotar su `CT-####` en `CASA` | «¡Listo! Su casa está en revisión». En el paso de envío, la línea de la oferta dice los meses del tramo que le tocaría («gratis 12 meses») | ☐ |
| B1a | Ana: Cuenta | Tarjeta «Suscripción» con «<casa> · En revisión · ₡0»; «Próximo cobro: ₡0 · sin método de pago»; fila «Método de pago · Ninguno todavía · tarjeta» | ☐ |
| B2 | Daniel aprueba la casa (con el código de su app de autenticación) | «Aprobada y publicada». En Admin → Casas aparece con «Gratis hasta <hoy + 12 meses>» y «Activa»; el chip «Activas» sube en uno | ☐ |
| B2a | Ana: Inicio | Tarjeta de la oferta: «Su casa está entre las primeras 50: **12 meses gratis**, hasta el <fecha>. Después, ₡2 900 al mes por casa, sin permanencia.» y «Quedan N de 50» (N = 50 − plazas asignadas, 47 si nadie más publicó). Sin tarjeta ocre de aviso | ☐ |
| B2b | Ana: Mis casas | La casa con «Activa», «Gratis hasta el <fecha>», «Compartir ficha» y «Calendario»; **sin** «Añadir método de pago» | ☐ |
| B2c | Ana: Cuenta → «Ver detalle» (o Inicio → «Ver mi suscripción») | «Promoción y suscripción»: la casa con «Activa», «Gratis hasta el …», «Parar suscripción» y «Avisos por WhatsApp: 90, 30 y 7 días antes y el último día.»; «Método de pago: Ninguno todavía» con «Puede añadirlo cuando le avisemos.»; tramos «Primeras 50 casas: 12 meses gratis…» y «Cómo funciona» | ☐ |
| B2d | Daniel, pestaña privada: la ficha `nueva.bnbtico.com/casa/<CASA>` y Explorar | Ficha con «Contactar por WhatsApp»; la casa sale en Explorar | ☐ |

### Avisos a 90, 30, 7 y 0 días

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B3 | `reloj 90` | JSON con `"queued":1` y `"sent":1`. A los pocos segundos llega a Ana por WhatsApp (desde el número del sandbox): «Hola, <nombre>. Somos bnbtico. La oferta gratuita de «<casa>» termina el <fecha dentro de 90 días>: hasta entonces no se le cobra nada. Para que su casa siga saliendo en bnbtico después, añada un método de pago aquí: https://nueva.bnbtico.com/propietario/suscripcion#pago=<CASA> Desde esa fecha, ₡2 900 al mes por casa, sin permanencia; puede pararla cuando quiera.» | ☐ |
| B3a | Repetir `reloj 90` | `"queued":0` y `"claimed":0`: **no llega ningún WhatsApp más** | ☐ |
| B3b | Ana toca el enlace del WhatsApp | Abre «Promoción y suscripción» con su casa **resaltada** (borde verde) y a la vista. Tarjeta ocre «Su oferta gratuita termina en 90 días» con «…También se lo recordamos por WhatsApp.», botón ocre «Añadir método de pago» y debajo «Aviso de los 90 días enviado el <hoy>». **No** sale el texto del WhatsApp («Hola, …») | ☐ |
| B3c | Abrir el enlace en un navegador **sin sesión** (otro teléfono o pestaña privada) | Pide ingresar; tras el código, vuelve a la misma pantalla con la casa resaltada | ☐ |
| B3d | Ana: Inicio y Mis casas | Inicio: tarjeta ocre con el nombre de la casa, «Su oferta gratuita termina en 90 días» y «Añadir método de pago». Mis casas: «Compartir ficha» + «Calendario» y debajo el botón ocre | ☐ |
| B3e | Ana: Mis casas → la casa (detalle) | Tarjeta ocre del aviso; fila «Suscripción · Gratis hasta el …» que lleva a la pantalla. «Anuncio visible» sigue como antes | ☐ |
| B4 | `reloj 30` y luego `reloj 7` | Cada uno: `"sent":1` y llega un WhatsApp con el mismo texto y la fecha nueva; en la app «…termina en 30 días» y «…termina en 7 días»; la línea de avisos suma cada envío | ☐ |
| B5 | `reloj 0` | Llega: «Hola, <nombre>. Somos bnbtico. La oferta gratuita de «<casa>» termina hoy. Si no añade un método de pago, desde mañana su casa deja de mostrarse en bnbtico: <enlace> Hoy todavía no se le cobra nada; después, ₡2 900 al mes por casa, sin permanencia; puede pararla cuando quiera.» En la app, «Su oferta gratuita termina hoy». La ficha sigue activa | ☐ |
| B5a | Si en B3–B5 el JSON dice `"skipped":1` o no llega nada | `skipped`: el número de la cuenta no está en `WHATSAPP_ALLOWLIST` (A3). `retry` o `unknown`: anote el JSON y mire C5. Sin WhatsApp pero `"sent":1`: el teléfono no escribió al sandbox en 24 h o la unión caducó (A2) | ☐ |

### Fin de la oferta sin método: Pendiente de pago

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B6 | `reloj -1` | `"paymentDue":1`, `"claimed":0` (ningún WhatsApp) | ☐ |
| B6a | Daniel, pestaña privada, **a los pocos segundos**: `nueva.bnbtico.com/casa/<CASA>` | «Este enlace ya no está activo», «Este anuncio está fuera del catálogo hasta que el propietario regularice su suscripción.», «Si ya habló con el propietario por WhatsApp…» y «Ver otras casas en el Caribe». Sin botón de contacto | ☐ |
| B6b | Daniel: Explorar; y Favoritos si la había guardado | La casa ya no sale en ninguno | ☐ |
| B6c | Ana: Mis casas | Casilla «1 por pagar»; la tarjeta con «Pendiente de pago», «La ficha vuelve a verse al pagar.» y **solo** el botón ocre «Añadir método de pago» | ☐ |
| B6d | Ana: el detalle de la casa | Tarjeta ocre «Su oferta gratuita terminó el <ayer>» y «La ficha está oculta y el enlace no funciona hasta que añada un método de pago…»; «Compartir ficha» apagado con «Disponible cuando la casa vuelva a estar activa» | ☐ |
| B6e | Ana: Inicio y Cuenta | Inicio: tarjeta ocre de la casa pendiente. Cuenta: «<casa> · Pendiente de pago» | ☐ |
| B6f | Daniel: Admin → Casas → chip «Por pagar» | La casa con «Oferta vencida el <ayer> · sin método de pago» e insignia ocre «Por pagar» | ☐ |

### Método de pago con Stripe (modo de prueba)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B7 | Ana: «Promoción y suscripción» → «Añadir método de pago» | Se abre la página de **Stripe** (dominio `checkout.stripe.com`, aviso de modo de prueba), en español, para guardar una tarjeta sin cobrar | ☐ |
| B7a | Tarjeta `4242 4242 4242 4242`, vencimiento futuro (p. ej. `12/30`), CVC `123`, el resto cualquiera → Guardar | Vuelve a «Promoción y suscripción»: «Guardando su método de pago…» y en pocos segundos «Método de pago guardado. No se cobra nada hasta que termine la oferta.» La casa: «Activa», «Suscripción activa desde el <hoy> · ₡2 900 al mes», sin botón ocre. «Método de pago: Visa ···· 4242 · vence 12/30» con «Cambiar» | ☐ |
| B7b | Si en vez de eso sale «Lo estamos confirmando; aparecerá en unos minutos.» | El webhook tardó o falló: recargar al minuto. Si no aparece, Stripe → Developers → Webhooks → el destino → últimos eventos (código de respuesta) y anótelo (C) | ☐ |
| B7c | Daniel, pestaña privada, a los pocos segundos: la ficha | Vuelve con «Contactar por WhatsApp» (mismo enlace). Sale otra vez en Explorar | ☐ |
| B7d | Ana: Cuenta | «Próximo cobro: ₡2 900 · <fecha>» (informativo: no se cobra nada en esta fase); fila «Método de pago · Visa ···· 4242» | ☐ |
| B7e | Ana: «Cambiar» → en Stripe, «Atrás»/cerrar sin guardar | Vuelve a la pantalla sin cambios y sin mensaje de guardado | ☐ |

### Parar y reactivar

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B8 | Ana: «Parar suscripción» | Hoja «¿Parar la suscripción de <casa>? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.» con «Cancelar». Cancelar: nada cambia | ☐ |
| B8a | «Parar suscripción» → confirmar | Al instante «Inactiva», «Parada el <hoy> · no se cobra» y «Reactivar» | ☐ |
| B8b | Daniel, pestaña privada, a los pocos segundos: la ficha | «Este enlace ya no está activo» con «El propietario paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.» Sin botón de contacto. No sale en Explorar | ☐ |
| B8c | Ana: Mis casas y el detalle | Mis casas: «Parada · no aparece en Explorar» y «Reactivar» (contorno). Detalle: «Compartir ficha» apagado con su línea | ☐ |
| B8d | Daniel: Admin → Casas → «Inactivas» | «Parada por el propietario el <hoy>» e insignia «Inactiva» | ☐ |
| B9 | Ana: «Reactivar» | Al instante «Activa» con «Suscripción activa desde el …» | ☐ |
| B9a | Daniel, pestaña privada, a los pocos segundos: la ficha | Vuelve con «Contactar por WhatsApp»; sale en Explorar | ☐ |
| B9b | Modo avión → «Parar suscripción» → confirmar | Cambia un momento y vuelve a «Activa» con «Sin conexión. Revise su internet e intente de nuevo.» | ☐ |

### Las otras casas y el contador

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B10 | Ana (o la propietaria de las 2 casas de antes): Mis casas | Las otras casas no cambiaron en todo el recorrido: «Gratis hasta el …», sin aviso | ☐ |
| B10a | Inicio | «Quedan N de 50» igual que en B2a (parar o vencer una casa no devuelve su plaza) | ☐ |
| B10b | Supabase → SQL Editor: `select l.public_id, r.days_before, r.status, r.sent_at from subscription_reminders r join listings l on l.id = r.listing_id order by r.queued_at;` | Una fila por umbral de la casa de prueba (90, 30, 7, 0), todas `sent`, sin repetidas | ☐ |

---

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/fase-5/` (uno por fallo):

1. El número del paso (p. ej. «B6a») y qué esperaba.
2. Captura de pantalla o grabación con la hora. Para B6a, B7c, B8b y B9a: el dominio (`nueva.bnbtico.com` o `workers.dev`), cuántos segundos esperó y si abrió una pestaña nueva.
3. Teléfono, sistema y navegador (p. ej. «iPhone 15, iOS 26, Safari» o «Pixel 7, Chrome, app instalada») y si tenía red.
4. Para los `curl`: la respuesta JSON entera (no lleva datos de tarjeta; el texto del WhatsApp sí).
5. Para los avisos: `select l.public_id, r.days_before, r.status, r.attempts, r.last_error, r.provider_ref, r.sent_at from subscription_reminders r join listings l on l.id = r.listing_id order by r.queued_at desc limit 10;`. En Twilio: Monitor → Logs → Messaging (estado del mensaje con ese `provider_ref`).
6. Para el pago: `select provider, type, result, received_at from payment_events order by received_at desc limit 5;` y, en Stripe (modo de prueba), Developers → Webhooks → el destino → el evento y su respuesta.
7. Si apareció un mensaje en la app (abajo o en la tarjeta de la casa), el texto exacto. Para errores de la app: `select build, message, count(*) from client_errors group by 1, 2 order by 3 desc limit 10;`. Para el despliegue: el enlace al run de GitHub Actions.
