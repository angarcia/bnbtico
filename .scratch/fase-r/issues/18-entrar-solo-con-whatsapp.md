# 18: Entrar solo con el WhatsApp (un único flujo)

**Qué construir:** Ingresar pide primero el WhatsApp (con el selector de país). Si el número tiene cuenta se envía el código y entra; si no, pide el nombre y después envía el código. Desaparece «Ya tengo cuenta».

**Bloqueado por:** 17

**Status:** ready-for-agent

- [ ] `AuthApi.start({ phone, name? })` devuelve `"sent"` o `"needs-name"`. Sin nombre intenta `signInWithOtp` con `shouldCreateUser: false`; si GoTrue responde que no hay usuario (`otp_disabled`), no se ha enviado nada y devuelve `"needs-name"`. Con nombre, `shouldCreateUser: true`. Nunca se envían dos códigos por un mismo toque; el enfriamiento de 30 s y el tope de un código por segundo se respetan.
- [ ] El número pendiente guarda si la cuenta se acaba de crear (`mode: "register"`) o ya existía (`"login"`); «¡Listo! Su cuenta está creada» solo tras crear una cuenta sin correo.
- [ ] Contrato de cuenta actualizado en el fake y en Supabase local (número con cuenta → enviado; sin cuenta → pide nombre sin enviar; con nombre → crea; nombre corto).
- [ ] Pantalla: paso del número; paso del nombre con el número a la vista y «Cambiar número»; sin «Ya tengo cuenta» ni `?modo=entrar` (un enlace viejo con `modo=entrar` abre el mismo flujo). Turnstile: un token por envío.
- [ ] Riesgo de enumeración de números documentado en `docs/decisiones.md` (aceptado o mitigado).
- [ ] Playwright (número con cuenta → código → entra; número nuevo → nombre → código → «¡Listo!»), capturas Pixel 7 y 360 px; `docs/pruebas-manuales-fase-r.md` B6–B10c al día. Baterías en verde.
