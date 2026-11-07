# 01 · Pruebas técnicas previas (spikes)

Status: ready-for-agent
Type: research
Blocked by: —

## Qué

Cuatro comprobaciones cortas que deciden si el diseño de `spec.md` se sostiene. Cada una termina con una nota de 5–15 líneas (qué se probó, resultado, qué cambia en la spec) añadida al final de este archivo bajo `## Resultados`. **Si alguna sale mal, parar y consultar a Daniel antes de seguir con el 02.**

## S1 · Sesión desde el worker (bloquea todo)

En Supabase local: crear un usuario con `auth.admin.createUser` (correo sintético `<uuid>@wa.bnbtico.invalid`, sin teléfono), generar `auth.admin.generateLink({ type: 'magiclink', email })` y canjear el `hashed_token` desde un cliente con `verifyOtp({ token_hash, type: 'magiclink' })`.

Comprobar: se obtiene sesión con refresh token y rotación; **no se envía ningún correo**; funciona con `enable_signup = false`; el enlace es de un solo uso y caduca; el usuario sigue pudiendo cambiar el correo con `admin.updateUserById` sin perder sesión; el perfil se crea con un trigger nuevo (no el actual, que exige `phone`).

## S2 · Sello de acceso reciente (`amr`)

Con sesiones obtenidas por magiclink, correo OTP y (simulado) `signInWithIdToken`: leer `auth.jwt()->'amr'` dentro de una función SQL de prueba. Comprobar que el `timestamp` refleja el último método y que **el refresco del token no lo actualiza**. Si el refresco lo renueva, proponer la alternativa de la spec (tabla propia con la última autenticación).

## S3 · Número real de WhatsApp (depende de D2; puede esperar)

Con la SIM registrada en Twilio: un mensaje real a `WHATSAPP_VERIFY_NUMBER` llega al webhook con `From` y `Body`; la firma `X-Twilio-Signature` se valida; medir el coste real del mensaje entrante. Si la SIM aún no existe, dejar la prueba escrita y marcarla pendiente; el resto de tickets avanza con el fake.

## S4 · Google/Apple por redirección en la PWA instalada

Probar `signInWithOAuth` con PKCE en la PWA instalada de iOS (modo independiente) y en Safari: ¿vuelve a la app y conserva la sesión? Documentar el comportamiento y si hace falta un camino alternativo (por ejemplo, solo código por correo dentro de la PWA).

## No tocar

El código de producción (esto es solo exploración), `docs/decisiones.md`, la base de pruebas alojada.

## Hecho cuando

Los resultados están escritos aquí y la spec se actualiza si alguna premisa cambió.
