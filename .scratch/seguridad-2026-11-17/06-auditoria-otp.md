# Auditoría del acceso por código y del envío por WhatsApp (historia #72, segv1-auditoria-otp)

Fecha: 2026-11-20. Solo lecturas: configuración de Auth de `bnbtico-pruebas` con la API de administración de Supabase
(sesión de la CLI, salida filtrada: ningún secreto se imprimió ni se guarda aquí), el log del despliegue de develop (run
44832047692) y el código en `50a35d1`. Sin mensajes reales, sin pruebas de fuerza bruta, sin cambiar nada.
Producción (`3bstays-prod`) **aún no existe**: todos sus controles quedan «no verificable» y se fijan al crearla (#73).

## Matriz

Estados: ✅ verificado · ❌ ausente o distinto de lo documentado · ❔ no verificable desde aquí (lo comprueba Ana).

| # | Control | Pruebas (`bpxiggdzgzolcazaaboj`) | Producción | Evidencia |
|---|---|---|---|---|
| 1 | Proyecto correcto | ✅ el worker de pruebas apunta a `bpxiggdzgzolcazaaboj` | ❔ no existe | `wrangler.jsonc` `env.pruebas.vars.SUPABASE_URL` |
| 2 | **Captcha exigido por Supabase Auth** | ❌ `security_captcha_enabled: false`, proveedor `hcaptcha`, sin secreto | ❔ | GET `/config/auth` |
| 3 | **Widget Turnstile en la app** | ❌ el build de pruebas no lleva sitekey (`VITE_TURNSTILE_SITE_KEY` vacía): la app no carga el widget y pide el código sin token | ❔ | log del job `deploy`; `src/client/turnstile.ts:4` |
| 4 | Llamada directa a Auth sin pasar por la app | ❌ consecuencia de 2: `POST /auth/v1/otp` no exige token; solo frenan los límites 5–7 | ❔ | 2 (no se probó con una llamada real: no hacía falta y enviaría a Twilio) |
| 5 | Tope de envíos del proyecto | ✅ `rate_limit_sms_sent: 30` por hora (lo que propone `antes-de-produccion.md`) | ❔ | GET `/config/auth` |
| 6 | Intervalo mínimo entre códigos al mismo número | ❌ `sms_max_frequency: 5` s. `supabase/config.toml` dice que el alojado conserva 60 s; la app impone 30 s solo en el navegador | ❔ | GET `/config/auth`; `config.toml:28`; `RESEND_COOLDOWN_MS` |
| 7 | Límites de pedir y verificar código por IP | ✅ `rate_limit_otp: 30`, `rate_limit_verify: 30` (valores por defecto) | ❔ | GET `/config/auth` |
| 8 | Proveedor y canal | ✅ `sms_provider: twilio_verify` con credenciales definidas; la app pide siempre `channel: whatsapp` | ❔ | GET `/config/auth`; `src/data/postgrest/auth.ts:43` |
| 9 | Servicio de Verify solo con WhatsApp (sin SMS de respaldo) | ❔ en Twilio | ❔ | Twilio → Verify → Services |
| 10 | Países permitidos (Geo permissions) | ❔ en Twilio; el selector de la app admite todos a propósito en pruebas | ❔ | Twilio → Verify → Settings |
| 11 | Caducidad e intentos del código | ❔ con `twilio_verify` los pone Twilio (por defecto 10 min y 5 intentos); `sms_otp_exp: 60` de Supabase no rige ese camino | ❔ | Twilio → Verify → Services → el servicio |
| 12 | Alerta de gasto | ❔ en Twilio | ❔ | Twilio → Billing → Usage Triggers |
| 13 | **Códigos fijos** | ❌ 7 números con código fijo hasta el 2026-12-31: 5 de prueba documentados (`8888 1234`, `8777 0001`, `8888 9999`, `8899 0001`, `8777 0002`) y **los 2 admins reales** (`+1 778 … 9837`, `+1 778 … 8492`) | ❔ (no debe tener ninguno real) | GET `/config/auth` (`sms_test_otp`, números enmascarados) |
| 14 | Segundo factor del admin | ✅ TOTP activo; MFA por teléfono apagado (decisión 2026-10-23); `is_admin()` exige aal2 en SQL | ❔ | GET `/config/auth`; migraciones |
| 15 | Hooks que desvíen el envío | ✅ `hook_send_sms_enabled: false` | ❔ | GET `/config/auth` |

## Qué significa

- **Riesgo prioritario: la combinación 2 + 3 + 4.** En pruebas nada distingue a un programa de una persona al pedir códigos.
  Lo que acota el gasto es el tope de 30 envíos por hora del proyecto (5) y los límites por IP (7). Con Twilio Verify por
  WhatsApp el atacante no cobra comisión (el «SMS pumping» deja de compensarle) **si** el servicio de Verify no tiene SMS
  de respaldo y los países están acotados (9, 10: sin verificar). Consecuencia: hasta comprobar 9 y 10, el coste máximo
  es 30 envíos/hora × 24 h al precio de Verify; con el SMS de respaldo activo y países abiertos, a precios de SMS
  internacional.
- **Códigos fijos de los admins (13):** cualquiera que conozca el teléfono de Daniel o de Ana entra en su cuenta con
  `123456`, a nivel aal1. No obtiene poderes de admin (exigen TOTP), pero sí la cuenta de esa persona (Mis casas, Cuenta).
  Está documentado y aceptado para pruebas (`antes-de-produccion.md`, «Envío real de códigos», paso 4); en producción no
  debe existir. Prioridad alta al crear `3bstays-prod`; en pruebas, decisión de Ana (ver plan).
- **Intervalo de 5 s (6):** la documentación dice 60 s y no es así. Con el captcha apagado, un mismo número puede recibir
  un código cada 5 s hasta el tope del proyecto. Barato de corregir.
- No se encontraron duplicados de este trabajo: `antes-de-produccion.md` ya lista las capas (canal, países, Turnstile,
  tope, alerta) y este informe las verifica; #73 es su aplicación. No hay otra historia importada para lo mismo.

## Plan de remediación para #73 (cada paso con su comprobación y su reversión)

Pruebas primero; producción nace con el resultado (decisión D5 del contrato de privacidad). Ana hace los cambios en los
paneles; los de Supabase Auth se pueden hacer con la API de administración si Ana lo autoriza.

1. **Intervalo entre códigos a 60 s** (Auth → Rate limits / `sms_max_frequency: 60`). Comprobar: GET `/config/auth`.
   Revertir: volver a 5. Sin efecto en las pruebas automáticas (corren en local, `config.toml` con 1 s).
2. **Turnstile de punta a punta en pruebas.** (a) Widget en Cloudflare para `pruebas.3bstays.com` (y el dominio
   `workers.dev` si se sigue usando desde la red corporativa); (b) variable `TURNSTILE_SITE_KEY` del entorno de pruebas en
   GitHub y desplegar; comprobar en el log de `deploy` que la variable ya no va vacía; (c) **después**, en Supabase Auth:
   captcha activo, proveedor `turnstile`, la secret key. Orden importante: activar (c) antes de (b) deja a todos sin
   poder pedir código. Comprobar: GET `/config/auth` (`security_captcha_enabled: true`, `turnstile`) e Ingresar desde el
   teléfono. Revertir: apagar el captcha en Auth (inmediato); el widget sin captcha en Auth no estorba.
3. **Twilio (Ana, panel):** servicio de Verify solo con WhatsApp; Geo permissions con la lista corta de países; Usage
   Trigger a 20 USD/mes. Comprobar con captura de cada pantalla (sin SIDs ni tokens). Revertir: reactivar en el mismo panel.
4. **Códigos fijos de los admins:** opción A (recomendada para producción, obligatoria allí): sin números reales en
   `sms_test_otp`; los admins entran con su código real por WhatsApp más su TOTP. Requiere Twilio de pago con Verify
   propio (pasos 1–3 de «Envío real de códigos»). Opción B (pruebas, mientras Twilio siga en prueba): mantenerlos, como hoy,
   aceptando el riesgo de 13. Comprobar: GET `/config/auth` sin los dos `+1 778`. Revertir: volver a añadirlos (acceso de
   emergencia si Twilio falla), nunca en producción.
5. **Al crear `3bstays-prod`:** 1, 2 y 3 aplicados desde el primer día, `sms_test_otp` vacío, `rate_limit_sms_sent: 30`, y
   repetir esta matriz con su `ref`.

## Pendiente de Ana (para cerrar la matriz)

- Twilio: capturas de Verify → Services (canales del servicio, caducidad e intentos), Verify → Settings → Geo permissions y
  Billing → Usage Triggers (9–12).
- Cloudflare: si existe ya un widget de Turnstile y para qué dominios (3).
- ~~Decisión sobre los códigos fijos de los admins en pruebas~~: **B**, decidido por Ana el 2026-11-20 (se mantienen en pruebas hasta tener Twilio de pago; en producción, ninguno).
