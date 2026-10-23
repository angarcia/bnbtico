# Antes de abrir bnbtico.com a producción

Lista de cosas decididas que **no** se hacen todavía en pruebas, pero deben estar hechas antes del lanzamiento. Se revisa al cortar (ticket 13 de la fase R y lanzamiento de la v1). La más reciente arriba.

## Abuso del envío de códigos (2026-10-23)

Desde el 2026-10-23 el WhatsApp de un usuario puede ser de cualquier país (selector con Costa Rica por defecto y «Otro país»). Eso sube el riesgo de que alguien use el formulario del código para gastar el saldo de Twilio («SMS pumping»: el atacante cobra comisión por cada mensaje enviado a números suyos). En pruebas el selector queda abierto a todos los países a propósito; antes de producción, aplicar estas capas, de más a menos efectiva:

1. **Solo canal WhatsApp, sin respaldo por SMS.** Twilio → Verify → Services → el servicio de bnbtico: solo el canal WhatsApp activo. Por WhatsApp el atacante no cobra comisión, así que el abuso deja de compensarle. La app ya pide siempre el canal `whatsapp`.
2. **Países permitidos.** Twilio → Verify → Settings → **Geo permissions**: marcar solo los países donde se esperan clientes (Costa Rica y la lista corta del selector como punto de partida). Opcional: que el selector de la app ofrezca exactamente esos países, para que nadie elija uno que Twilio rechace.
3. **Turnstile activo.** Ya está construido (ticket 11). Crear el widget en Cloudflare para el dominio de producción, poner la sitekey en GitHub, desplegar y después activar la protección de bots (captcha) en Supabase Auth con la secret key. Detalle en `docs/pruebas-manuales-fase-r.md`, paso A5.
4. **Tope de envíos por hora en Supabase.** Authentication → **Rate Limits** → «SMS sent per hour»: un máximo para todo el proyecto (por ejemplo 30). Es el techo aunque falle todo lo demás.
5. **Alerta de gasto en Twilio.** Billing → **Usage Triggers**: aviso por correo al llegar a un importe mensual (por ejemplo 20 USD). No corta el servicio, pero avisa pronto.

Con 1, 2 y 4 el riesgo queda acotado; 3 lo cierra casi del todo; 5 es la red de seguridad.
