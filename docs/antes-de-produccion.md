# Antes de abrir bnbtico.com a producción

Lista de cosas decididas que **no** se hacen todavía en pruebas, pero deben estar hechas antes del lanzamiento. Se revisa al cortar (ticket 13 de la fase R y lanzamiento de la v1). La más reciente arriba.

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
