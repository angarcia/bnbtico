# Antes de abrir bnbtico.com a producción

Lista de cosas decididas que **no** se hacen todavía en pruebas, pero deben estar hechas antes del lanzamiento. Se revisa al cortar (ticket 13 de la fase R y lanzamiento de la v1). La más reciente arriba.


## Para más adelante (no bloquea el lanzamiento) (2026-10-26)

- **Google Maps.** Decisión de Daniel: de momento seguimos con OpenStreetMap (gratis, sin terceros, compatible con la CSP estricta). Opciones para el futuro: (1) botón «Abrir en Google Maps» que abre la app del teléfono (sin clave ni coste; en la ficha pública solo con la zona aproximada, nunca la dirección exacta); (2) mapa de Google dentro de la app: necesita una clave con facturación (tarjeta) aunque el uso gratuito mensual cubra el arranque, y abrir la CSP a sus scripts.
- **Entrar sin código cada vez (passkeys).** Pendiente de discutir: comprobar si Supabase ofrece passkeys para iniciar sesión en el plan gratuito; si no, valorar montarlas en el worker. Recordar que Safari en iPhone borra la sesión de una web no instalada tras 7 días sin abrirla (la app instalada no).

## Calendario: reapertura nocturna, purga y ventana de 12 meses (2026-10-23, fase 4)

1. **`pg_cron` en producción, con alerta.** La migración `20261024024441_fase4_calendario` habilita `pg_cron` y registra `bnbtico-reabrir-casas` (`0 6 * * *`, 00:00 de Costa Rica), que llama a `reopen_due_listings()`. En el proyecto de producción: comprobar que el trabajo existe y está activo (`select jobname, schedule, active from cron.job;`) y, tras la primera noche, que corrió (`cron.job_run_details`, `status = 'succeeded'`). Poner una **alerta** si la reapertura falla o no corre: por ejemplo, que el cron diario del worker (keep-alive) consulte `cron.job_run_details` de las últimas 26 h y mande un evento a la telemetría (o un correo) si no hay un `succeeded`, o si queda alguna casa con `reopen_at < hoy CR` y `available = false`. Sin esto, una casa cerrada «hasta el 15 de enero» seguiría cerrada sin que nadie lo note.
2. **Secretos de purga de Vault apuntando a bnbtico.com.** En producción, `worker_purge_url` = `https://bnbtico.com` y `worker_purge_secret` = el `PURGE_SECRET` del entorno `production` del worker (en pruebas, al cortar, `https://pruebas.bnbtico.com`; `docs/corte-fase-r.md`). Sin ellos cada guardado del calendario, cada cierre y cada reapertura nocturna tardan hasta un día (`s-maxage`) en verse en la ficha. Probar guardando un día y abriendo la ficha desde otro teléfono.
3. **Ventana de 12 meses, revisar con propietarios reales.** Hoy se edita y se muestra de hoy a hoy + 365 días (y la fecha de reapertura, de mañana a +365). Preguntar a los primeros propietarios si les basta (temporada de diciembre reservada con más de un año, alquileres mensuales largos) antes de lanzar; cambiarla toca la RPC, `calendarWindow` del dominio y las pruebas.
4. **Tamaño de la zona privada: 139,5 de 150 KB gz.** Subió de 136,5 a 139,5 KB en la fase 4 casi entero por cómo Rolldown reparte los trozos al aparecer los del calendario (parte `start-shell` y saca `money`/`dates`/`geo` de `listing-page`), no por código nuevo en el arranque. Quedan ~10 KB para las fases 5–7. Antes de lanzar (o si una fase se acerca a 145): probar `codeSplitting`/grupos manuales de trozos para todo el build y volver a medir con `pnpm size` y `pnpm lighthouse`.

## Contacto por WhatsApp: límites, privacidad y conservación de las consultas (2026-10-23, fase 3)

1. **Límites de `create_inquiry`, revisar con datos reales.** Hoy: como mucho 20 casas distintas por cliente en 24 h, y una consulta por cliente y casa cada 7 días (repetir dentro de esos 7 días la renueva y la vuelve a poner como «Nueva»). Antes de lanzar, y otra vez al mes de lanzar, mirar en `inquiries` y en `events` (`inquiry_created`) cuántas casas contacta un cliente normal al día y cada cuánto repite; si el tope de 20 frena a gente real o se queda corto ante quien recoge números, ajustarlo en una migración (y en `INQUIRY_MESSAGES` si cambia el mensaje).
2. **Texto de privacidad.** La política de privacidad (y el aviso de la cuenta, si lo hay) debe decir, en usted: que al contactar una casa el propietario ve el **nombre y el WhatsApp** del cliente, además de las fechas, las personas y el mensaje; que bnbtico **guarda un registro de cada consulta** (quién, qué casa, cuándo, el mensaje y el número al que se le dirigió) y durante cuánto tiempo; y que los favoritos se guardan en el teléfono y, con sesión, en la cuenta. Hoy en la hoja solo dice «<Nombre> verá su nombre y su WhatsApp.».
3. **Conservación de las consultas, por decidir.** Hoy no se borra nada. Propuesta: 24 meses desde la última renovación (`updated_at`), con un trabajo de `pg_cron` que borre las más viejas, y borrado inmediato si el cliente o el propietario cierra su cuenta (hoy ya cae en cascada con la casa y con la cuenta del cliente). Decidirlo antes de escribir el texto de privacidad del punto 2.
4. **WhatsApp distinto por casa (aplazado en la fase 3).** Necesita enviar y comprobar un código con Twilio Verify desde el worker (diseño en `.scratch/fase-3/issues/07-whatsapp-por-casa.md`). Cuando se retome: Twilio de pago (sección siguiente), los secretos de Twilio en el worker, Geo Permissions también para esos códigos y revisar sus topes (5 envíos por casa y hora, 10 por propietario y día) con datos reales.

## Envío real de códigos con Twilio Verify (2026-10-23)

En pruebas no se envía ningún código real: todas las cuentas (incluidos los dos admins, `+1 778 347 9837` y `+1 778 347 8492`) entran como números de prueba con el código fijo `123456` (Supabase → Authentication → Sign In / Providers → Phone → «Test Phone Numbers and OTPs»). La prueba gratuita de Twilio no permite crear un servicio de Verify propio, que es lo que necesita Supabase (`docs/configuracion-supabase.md`, sección 3). Antes de producción:

1. Pasar Twilio a cuenta de pago (recarga mínima de 20 USD; perfil de cumplimiento como Individual) y crear el servicio de Verify `bnbtico` con el canal WhatsApp.
2. Poner Account SID, Auth Token y Verify Service SID en el proyecto de Supabase de producción (y en pruebas para probarlo antes).
3. Probar de punta a punta con un número real que no sea de prueba: registro, código por WhatsApp, reenvío a los 30 s.
4. Quitar los números reales de la lista de números de prueba (los dos admins incluidos) y dejar solo los de prueba que usan las pruebas automáticas, o ninguno en producción.

## Abuso del envío de códigos (2026-10-23)

Desde el 2026-10-23 el WhatsApp de un usuario puede ser de cualquier país (selector con Costa Rica por defecto y «Otro país»). Eso sube el riesgo de que alguien use el formulario del código para gastar el saldo de Twilio («SMS pumping»: el atacante cobra comisión por cada mensaje enviado a números suyos). En pruebas el selector queda abierto a todos los países a propósito; antes de producción, aplicar estas capas, de más a menos efectiva:

1. **Solo canal WhatsApp, sin respaldo por SMS.** Twilio → Verify → Services → el servicio de bnbtico: solo el canal WhatsApp activo. Por WhatsApp el atacante no cobra comisión, así que el abuso deja de compensarle. La app ya pide siempre el canal `whatsapp`.
2. **Países permitidos.** Twilio → Verify → Settings → **Geo permissions**: marcar solo los países donde se esperan clientes (Costa Rica y la lista corta del selector como punto de partida). Opcional: que el selector de la app ofrezca exactamente esos países, para que nadie elija uno que Twilio rechace.
3. **Turnstile activo.** Ya está construido (ticket 11). Crear el widget en Cloudflare para el dominio de producción, poner la sitekey en GitHub, desplegar y después activar la protección de bots (captcha) en Supabase Auth con la secret key. Detalle en `docs/pruebas-manuales-fase-r.md`, paso A5.
4. **Tope de envíos por hora en Supabase.** Authentication → **Rate Limits** → «SMS sent per hour»: un máximo para todo el proyecto (por ejemplo 30). Es el techo aunque falle todo lo demás.
5. **Alerta de gasto en Twilio.** Billing → **Usage Triggers**: aviso por correo al llegar a un importe mensual (por ejemplo 20 USD). No corta el servicio, pero avisa pronto.

Con 1, 2 y 4 el riesgo queda acotado; 3 lo cierra casi del todo; 5 es la red de seguridad.
