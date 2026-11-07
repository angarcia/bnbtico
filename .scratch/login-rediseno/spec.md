# Especificación: rediseño del ingreso (WhatsApp por código inverso)

Estado: **lista para implementar; D1 resuelta (no avisar por WhatsApp); cuatro pruebas técnicas previas (ticket 01) y revisión UI/UX antes del ticket 05**.
Fecha: 2026-11-06. Origen: sesión de diseño con Daniel. Si algo de aquí contradice `CLAUDE.md`, avisar antes de implementar.

Lectura obligatoria antes de tocar nada: `CLAUDE.md`, `docs/architecture.md`, `docs/diseno-v1.md`, `docs/decisiones.md` (entradas del 2026-10-21, 10-23 y 11-04), `docs/telemetria.md`, `CONTEXT.md` (glosario).

## 0. Resumen

Hoy: ingreso solo por código de WhatsApp que Twilio Verify **envía** (Supabase Phone Auth). Cuesta ≈ 0,065 USD por código, se repite en cada dispositivo y abre la puerta al «SMS pumping».

Nuevo:

1. **Entrada = código inverso por WhatsApp (A′).** La persona toca un botón; se abre WhatsApp con un mensaje ya escrito (`wa.me`) hacia el **número de verificación** de bnbtico; lo envía. Un webhook recibe el mensaje con el número del remitente (autenticado por WhatsApp) y, en un solo paso, **crea la cuenta o reconoce la existente, inicia la sesión del dispositivo y marca el WhatsApp como verificado**. bnbtico no envía nada.
2. **Métodos añadidos, solo para anfitriones:** código por correo, Google o Apple (sin contraseñas), a elegir. Son atajos para entrar sin repetir A′ y vías de recuperación. **A los invitados nunca se les ofrece ni se les pide un método añadido** (decisión de Daniel, 2026-11-06: es fricción sin beneficio): un invitado en un dispositivo nuevo repite A′. Las **cuentas solo se crean por A′** (excepto administradores).
3. **Sesión de ~1 año** para invitados y anfitriones.
4. **Prueba de acceso reciente** (10 minutos) exigida en SQL para acciones sensibles.
5. **Apps nativas:** envoltorio Capacitor, bloqueo opcional con biometría; passkeys en v1.1.

Objetivos medibles: verificación completada en < 30 s (mediana); coste por verificación ≤ 0,006 USD con Twilio; ≤ 5 % de verificaciones que necesiten el respaldo; cero códigos enviados por bnbtico salvo respaldo.

## 1. Decisiones vinculantes

| # | Decisión |
|---|---|
| 1 | Entrada por A′: crea o reconoce la cuenta, inicia sesión y verifica el número en un solo paso. |
| 2 | Métodos añadidos (**solo anfitriones**): correo (código de 6 dígitos), Google, Apple; los tres disponibles en la v1 para la mejor experiencia del anfitrión. Sin contraseñas. Passkeys: v1.1. |
| 3 | Proveedor de WhatsApp: Twilio en la v1, detrás de una interfaz `WhatsAppInbound` (cambiable a Meta Cloud API sin tocar el flujo). |
| 4 | Respaldo: código enviado por Twilio Verify **solo** tras fallar A′, con topes. No es la vía por defecto. |
| 5 | Se pide ingresar solo al tocar «Contactar por WhatsApp» (y, opcional, al guardar favoritos entre dispositivos). Explorar y favoritos locales siguen sin cuenta. |
| 6 | Nombre: se pide una vez, en el primer «Contactar»; se precarga si Google/Apple lo dieron. |
| 7 | Unión de métodos: un correo solo se une a la cuenta si es verificado e idéntico; los correos de retransmisión de Apple se vinculan desde Cuenta. |
| 8 | Un número verificado por cuenta; un número solo puede pertenecer a una cuenta; cambiarlo exige prueba de acceso reciente + A′ con el número nuevo (el viejo sigue activo hasta entonces). |
| 9 | El anfitrión ve nombre y WhatsApp del invitado (con `consent_share_phone`, igual que hoy) con un sello «WhatsApp verificado». |
| 10 | Sesiones: invitados y anfitriones ~1 año con rotación y detección de reutilización; administradores ~12 h con TOTP (plan Pro). Duraciones configurables. |
| 11 | Prueba de acceso reciente: 10 minutos; acciones: cambiar WhatsApp de contacto, cambiar correo, vincular/desvincular métodos, borrar cuenta, añadir/cambiar método de pago. Pausar o cerrar una casa **no**. Exigida en SQL desde el JWT. |
| 12 | Recuperación: invitado repite A′ desde el mismo número o usa un método añadido (si perdió el número y no tenía método, cuenta nueva); anfitrión: método añadido (obligatorio) + A′; último recurso, soporte manual por WhatsApp. |
| 13 | Correo: SMTP propio con SPF/DKIM en `bnbtico.com` (Resend candidato); código de 6 dígitos, 10 min, 5 intentos, límites por correo e IP. |
| 14 | Cuentas existentes: solo datos de prueba; se borran. Daniel y Ana se reinscriben como administradores con correo real + TOTP. |
| 15 | Apps: Capacitor; Google/Apple nativos con `signInWithIdToken`; tokens en Keychain/Keystore. |
| 16 | Supabase Pro como objetivo de producción. |
| 17 | Número de verificación: uno solo, dedicado, de Costa Rica (+506), SIM física, registrado como remitente de WhatsApp en Twilio. Separado de los dos números de soporte. |
| 18 | Cuentas solo por A′ (administradores aparte). Un Google/Apple no vinculado no crea cuenta: la app pide primero verificar el WhatsApp. |
| 19 | Biometría v1: bloqueo opcional local de la app nativa. Passkeys: v1.1. La biometría nunca sustituye la verificación del WhatsApp. |
| 20 | Método añadido: **nunca se ofrece ni se pide a los invitados**; **obligatorio para anfitriones al publicar**, a elegir entre correo, Google o Apple. La prueba de acceso reciente de un invitado (p. ej. cambiar su número) se hace con A′. |

## 2. Fuera de alcance

Veriff e identidad; passkeys (v1.1); WhatsApp distinto por casa (diferido, ver decisión del 2026-10-24); chat interno; pasarela de pago; migración de cuentas reales (no existen); valoraciones.

## 3. Prerrequisitos externos (no los resuelve el código)

Los gestiona Daniel; el ticket 01 y el 09 dejan lista la parte de código y la guía en `docs/configuracion-supabase.md`.

1. **SIM física de Costa Rica** (titular con cédula) activa y mantenida; borrar cualquier cuenta de WhatsApp normal que tenga; registrarla como remitente con el *Self Sign-up* de la consola de Twilio. Si Twilio o Meta no la aceptan, parar y avisar (plan B: número virtual de Twilio para Costa Rica, con documentos legales; o volver a la opción A).
2. Cuenta de empresa de Meta (Business Manager) y nombre «bnbtico» + logo aprobados, para que el chat muestre la marca y no solo el número.
3. Proveedor de correo (Resend candidato): dominio `bnbtico.com` verificado con SPF/DKIM; credenciales SMTP en Supabase.
4. Apple Developer (Services ID y clave `.p8` para el ingreso web con Apple; para nativo basta el ID de app) y proyecto de Google Cloud (clientes web, iOS y Android). **Apple y «Ocultar mi correo»:** si un anfitrión oculta su correo, Apple le da una dirección de reenvío; según lo que se recuerda (no verificado), los correos de bnbtico solo llegan si el dominio de envío está registrado en el portal de desarrolladores de Apple («Sign in with Apple for Email Communication»). Registrar `bnbtico.com` (y la dirección remitente) y **probar** que el aviso de nuevo dispositivo llega a una cuenta de Apple con el correo oculto antes de dar por buena la regla de que todo anfitrión recibe el aviso por correo. Ofrecer Apple siempre junto a Google (regla de Apple 4.8, según se recuerda; confirmar en la revisión de la tienda).
5. Supabase Pro antes del lanzamiento (tiempos de sesión por rol, protección de contraseñas filtradas no aplica).
6. Bypass de Cloudflare Access para `/webhooks/whatsapp` (como ya existe para `/webhooks/stripe` y `/_pruebas/*`).

## 4. Arquitectura

### 4.1 Piezas

- **Cliente** (`apps/app/src/client`, `src/domain`, `src/data`): nueva interfaz `AuthApi` (ver 4.6) con adaptador PostgREST/Supabase y **fake en memoria**, más **suite de contrato** contra ambos (convención del repositorio).
- **Worker** (`src/server`): endpoints de verificación, webhook entrante de WhatsApp (Twilio), alta/lectura de cuentas con la service role, generación de la sesión, respaldo por Twilio Verify. La service role key solo vive aquí.
- **Postgres**: tablas nuevas con RLS, RPCs `security definer` solo para `service_role`, comprobación de prueba de acceso reciente, restricciones de unicidad.
- **Supabase Auth (GoTrue)**: sigue siendo quien emite y refresca las sesiones. Registros de usuario **desactivados** (`enable_signup = false`): ningún método crea usuarios por sí solo; solo la API de administración (desde el worker) lo hace.

### 4.2 Modelo de datos (nueva migración en `supabase/migrations/`; nunca SQL de esquema a mano)

Toda tabla nueva lleva políticas y prueba de contrato **antes** de cualquier pantalla (regla del repositorio).

`verification_challenges` (acceso solo `service_role`; RLS activada sin políticas para `anon`/`authenticated`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `purpose` | text check in (`sign_in`,`verify_phone`,`change_phone`,`recover`) | `sign_in` = entrar o crear; `verify_phone` = cuenta con sesión que aún no tiene número verificado (no ocurre en v1 salvo migraciones de datos); `change_phone`; `recover` = reservado, mismo flujo que `sign_in` |
| `code_hash` | text unique | HMAC-SHA256(código, `VERIFY_CODE_PEPPER`); el código nunca se guarda en claro |
| `device_secret_hash` | text | hash del secreto aleatorio que genera el dispositivo; sin él nadie más puede canjear el resultado |
| `account_id` | uuid null → `profiles` | solo para `change_phone` (cuenta con sesión y prueba de acceso reciente) |
| `pending_name` | text null | nombre capturado antes de crear la cuenta |
| `status` | text check in (`pending`,`claimed`,`consumed`,`expired`,`cancelled`,`conflict`) | |
| `claimed_phone` | text null | E.164 del remitente |
| `claimed_account_id` | uuid null | cuenta resuelta por el webhook |
| `expires_at` | timestamptz | creación + 10 min |
| `created_at`, `claimed_at`, `consumed_at` | timestamptz | |
| `ip_hash` | text | hash con sal de la IP (solo para límites y auditoría) |

`whatsapp_inbound_events`: `message_sid text pk`, `from_phone`, `received_at`, `outcome text` (`claimed`,`no_code`,`expired`,`conflict`,`rate_limited`,`replay`). Idempotencia y auditoría; se recorta a 30 días con la tarea diaria existente.

`profiles`:
- índice único parcial: `create unique index profiles_phone_verified_uq on profiles (phone) where phone_verified_at is not null;` (un número verificado, una cuenta).
- `phone` y `phone_verified_at` **no** se pueden escribir desde el cliente: comprobar los `grant` por columna actuales y revocar lo que haga falta; solo las RPC de servicio los modifican.
- El trigger `handle_new_user` (hoy exige `new.phone is not null`) debe sustituirse: el worker crea el usuario con correo sintético interno (4.5), `raw_user_meta_data` con el nombre y un trigger crea el perfil para todo usuario nuevo; `phone`/`phone_verified_at` los fija la RPC `complete_verification` con la service role. Los triggers `handle_phone_confirmed` y `on_auth_user_phone_confirmed` se retiran junto con Phone Auth (ticket 09).

RPC (solo `service_role`; todas con `set search_path`, pruebas en `tests/db`):
- `claim_verification(p_code_hash text, p_from_phone text, p_message_sid text) returns table(challenge_id uuid, outcome text, account_id uuid)`: registra el evento (idempotente por `message_sid`); busca el reto `pending` no vencido; aplica reglas de 4.4; no crea usuarios (lo hace el worker con la API de administración, porque SQL no puede crear usuarios de auth de forma soportada).
- `complete_verification(p_challenge_id uuid, p_account_id uuid)`: tras crear o localizar el usuario; fija `phone`, `phone_verified_at`, nombre si el perfil está vacío; marca el reto `claimed`.
- `consume_verification(p_challenge_id uuid, p_device_secret_hash text)`: devuelve `claimed_account_id` una sola vez y marca `consumed`.
- `require_recent_auth(p_max_age interval default '10 minutes')` (`stable`, para usar dentro de otras RPC; ver 4.7).
- `my_login_methods()` (`security definer`, para el usuario autenticado): proveedores y correo de `auth.identities`, sin datos sensibles.

### 4.3 Endpoints del worker

Todos devuelven errores neutros (nunca revelan si un número tiene cuenta). Todos con límites (4.9).

1. `POST /api/verificacion` — body `{ purpose, name?, deviceSecretHash, turnstileToken? }`; `Authorization: Bearer <jwt>` solo para `change_phone`.
   - Genera un código aleatorio (8 caracteres del alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, formato `BT-XXXX-XXXX`; criptográficamente aleatorio), guarda el hash, devuelve `{ challengeId, code, waUrl, expiresAt }`.
   - `waUrl` = `https://wa.me/<WHATSAPP_VERIFY_NUMBER>?text=` + texto codificado (ver 6.1).
   - Valida Turnstile en la web; en las apps, el mecanismo alternativo del ticket 10.
2. `POST /api/verificacion/:id/estado` — header `X-Device-Secret` (el secreto en claro; el servidor lo hashea y compara). Responde `{ status: 'pending' }`, `{ status: 'ready', tokenHash, tokenType }` (una sola vez), `{ status: 'expired' }` o `{ status: 'conflict', reason }`. Si el reto está `claimed`, el worker genera el enlace de acceso con la API de administración (4.5), lo devuelve y marca `consumed`.
3. `POST /webhooks/whatsapp` — Twilio. Valida **siempre** la firma `X-Twilio-Signature` (HMAC-SHA1 con `TWILIO_AUTH_TOKEN` sobre URL completa + parámetros ordenados; comparación en tiempo constante). Extrae `From` (`whatsapp:+506…` → E.164), `Body`, `MessageSid`; busca el patrón del código en el texto (tolerante a espacios, mayúsculas y al texto extra); llama a `claim_verification`; si resulta `claimed`, crea o localiza el usuario y llama a `complete_verification`. **No responde nada por WhatsApp, nunca** (respuesta HTTP 200 con cuerpo vacío / TwiML vacío; decisión D1: bnbtico no envía ningún mensaje por WhatsApp en este flujo).
4. `POST /api/verificacion/respaldo/enviar` y `/respaldo/verificar` (respaldo, decisión 4): llama a Twilio Verify desde el worker (no por Supabase Phone Auth). Solo disponible cuando el reto lleva al menos 90 s esperando o la persona toca «No puedo enviar el mensaje». Topes: 3 envíos/día por número, 30/hora en todo el proyecto, 1 por 30 s.
5. `POST /_pruebas/whatsapp/entrante` — **fake** para local y CI: acepta `{ from, body }` y ejecuta la misma ruta que el webhook. 404 en producción; exige el secreto de Vault `bnbtico_test_clock` (mismo patrón que `/_pruebas/oferta`).

Interfaz (en `src/server`, junto a `WhatsAppSender` de `reminders.ts`): `WhatsAppInbound { verifySignature(req): boolean; parse(req): { from: string; body: string; messageId: string } }` con adaptadores `twilio` y `fake`. Variables: `WHATSAPP_INBOUND` (`twilio`|`fake`), `WHATSAPP_VERIFY_NUMBER` (público, E.164), `VERIFY_CODE_PEPPER` (secreto), `TWILIO_AUTH_TOKEN` (ya existe).

### 4.4 Reglas de resolución del número (webhook)

Dado un reto `pending` no vencido y el `From` normalizado a E.164:

| Propósito | Situación del número | Resultado |
|---|---|---|
| `sign_in` | pertenece a una cuenta verificada | el reto queda `claimed` con esa cuenta (el dispositivo entra en ella; el nombre pendiente se ignora) |
| `sign_in` | no pertenece a ninguna | el worker crea la cuenta (nombre = `pending_name`), `complete_verification` |
| `change_phone` | pertenece a **otra** cuenta | `conflict` (`phone_in_use`); nada cambia |
| `change_phone` | libre | se aplica sobre `account_id`; el número anterior deja de ser el verificado en ese momento |
| cualquiera | el código no existe, venció o ya se usó | no hacer nada y registrar `outcome`; sin respuesta |

Un número de otro país es válido (E.164 completo); normalizar con la utilidad existente (`src/domain/phone.ts`).

### 4.5 Creación de usuarios y sesiones desde el worker (requiere la prueba S1)

Supabase no crea sesiones a partir de un evento externo. Diseño propuesto (patrón conocido, a validar en el ticket 01):

1. El worker crea el usuario con `auth.admin.createUser({ email: '<uuid>@wa.bnbtico.invalid', email_confirm: true, user_metadata: { full_name } })`. El correo sintético es interno, nunca se envía nada a él, y se reemplaza por el real si la persona añade un correo (`auth.admin.updateUserById`). El dominio reservado `.invalid` ya se usa para administradores (`20261023164211_admin_totp_correo.sql`).
2. Para dar sesión al dispositivo: `auth.admin.generateLink({ type: 'magiclink', email })` **no envía correo** y devuelve `hashed_token`; el worker lo entrega al dispositivo que presenta el secreto correcto; el dispositivo llama a `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` y obtiene una sesión completa (access + refresh token). El token es de un solo uso y de corta vida.
3. `enable_signup = false` impide que cualquier otro método cree usuarios; la API de administración sigue pudiendo.

Si S1 demuestra que esto no funciona, alternativas a evaluar y proponer **antes** de seguir: (a) firmar un JWT propio (no se puede refrescar: descartado salvo que se rediseñe la sesión); (b) usar Supabase Phone Auth solo como contenedor de sesión con un hook; (c) volver a la opción A. No improvisar: parar y consultar.

### 4.6 Interfaz de dominio (`src/domain/api.ts`, reemplaza `start/verify/resend/pending`)

Esbozo (entidades en inglés, textos en español en la UI):

```ts
export type VerificationPurpose = "sign_in" | "change_phone";
export type VerificationState =
  | { status: "pending"; expiresAt: number }
  | { status: "ready" }                       // la sesión ya está abierta en este dispositivo
  | { status: "expired" }
  | { status: "conflict"; reason: "phone_in_use" };

export interface AuthApi {
  /** Crea el reto y devuelve el enlace de WhatsApp. `name` solo en el primer contacto. */
  beginVerification(input: { purpose: VerificationPurpose; name?: string }, captchaToken?: string): Promise<{ challengeId: string; waUrl: string; expiresAt: number }>;
  /** Espera hasta `ready`/`expired`/`conflict`; consulta al volver a primer plano y cada pocos segundos con retroceso. */
  watchVerification(challengeId: string, onChange: (s: VerificationState) => void): () => void;
  /** Respaldo (decisión 4). */
  sendFallbackCode(challengeId: string, phone: string): Promise<void>;
  verifyFallbackCode(challengeId: string, code: string): Promise<void>;

  loginMethods(): Promise<LoginMethod[]>;                       // correo, google, apple
  addEmail(email: string): Promise<void>; confirmEmail(code: string): Promise<void>;
  signInWithEmail(email: string): Promise<void>; verifyEmailCode(email: string, code: string): Promise<void>;
  signInWithProvider(provider: "google" | "apple"): Promise<void>;   // redirección en web; nativo en apps
  linkProvider(provider: "google" | "apple"): Promise<void>;
  unlinkMethod(method: LoginMethod): Promise<void>;                  // exige prueba de acceso reciente
  reauthenticate(method: "email" | "google" | "apple" | "whatsapp"): Promise<void>;

  session(): Promise<Session | null>;
  onSessionChange(listener: (s: Session | null) => void): () => void;
  profile(): Promise<Account | null>;
  updateProfile(patch: ProfilePatch): Promise<Account>;
  logout(): Promise<void>;
}
```

`MfaApi` (TOTP de administradores) no cambia. `Account` conserva `phoneVerified`. Eliminar `PendingOtp`, el enfriamiento de 30 s por número y el estado pendiente en `sessionStorage` (`pendingOtpStore`), salvo para el respaldo. Revisar `src/domain/account.ts`, `data/postgrest/auth.ts`, `data/fake/auth.ts`, `client/sign-in.tsx`, `client/session.ts`, `shared/contact-flow.ts`, `domain/contact-return.ts` y los tests de contrato.

Reglas de rendimiento: nada de esto entra en el JS inicial. El código de verificación y de métodos se carga bajo demanda en el trozo de «ingresar» (patrón actual: `import("./supabase-data")`); respetar los presupuestos (JS privado < 160 KB gz, puertas de CI). `hasStoredSession()` sigue evitando descargar supabase-js sin sesión.

### 4.7 Prueba de acceso reciente (decisión 11)

Función SQL `require_recent_auth(p_max_age interval default '10 minutes')`: lee `auth.jwt()->'amr'` (lista de `{method, timestamp}`) y falla con un error de dominio (`reauth_required`) si el último método de autenticación tiene más de `p_max_age`. Se llama **dentro** de las RPC sensibles (mismo patrón que `aal2` en `is_admin()`): cambiar el WhatsApp de contacto (`change_phone` al crear el reto y al aplicarlo), cambiar correo, vincular o desvincular métodos, borrar cuenta (si existe), añadir o cambiar el método de pago (donde hoy se crea la sesión de pago, `/api/pago/sesion`, el worker también comprueba el claim con el JWT). No se aplica a pausar/cerrar casas ni a la actividad normal.

Para renovar la prueba: `reauthenticate(...)` → correo (código nuevo), Google/Apple (nuevo `signInWithIdToken`/redirección) o A′ repetido. **Prueba S2:** confirmar que (a) cada uno de estos métodos actualiza el `amr` del nuevo JWT, (b) el refresco del token **no** actualiza `amr` (si lo hiciera, la prueba no valdría). Si el refresco renueva el sello, almacenar la hora de la última autenticación en una tabla propia con RPC.

### 4.8 Sesiones

Valores por defecto de Supabase que se conservan: access token de 1 h; rotación del refresh con detección de reutilización; cierre de sesión que revoca. Invitados y anfitriones: sin límite de duración propio; **si se quiere tope de ~1 año, usar la configuración de sesiones del plan Pro** (time-box). Administradores: tope de ~12 h (Pro) y `aal2` por TOTP como hoy (`is_admin()` exige `aal2`). Valores configurables, no fijos en el código.

### 4.9 Límites y abuso (valores iniciales; ajustables con datos reales)

- `POST /api/verificacion`: 5/min y 20/hora por IP; 10/hora por dispositivo (cookie/almacenamiento firmado); Turnstile en la web.
- Webhook: 10 mensajes/hora por `From`; 60/min global; todo lo que no case con un reto vigente se registra y se ignora (sin respuesta, para no dar pistas).
- `…/estado`: sondeo con retroceso (inmediato al volver a primer plano con `visibilitychange`, luego cada 2 s, creciendo a 5 s; parar a los 10 min). Presupuesto de peticiones: ≈ 20–40 por verificación; documentar el efecto en el plan gratuito de Workers y, si pesa, mover a canal de Realtime (decisión D3).
- Correo: límites de Supabase (`[auth.rate_limit]`) + SMTP propio; Turnstile (captcha de Supabase Auth) en el envío del código; 6 dígitos, 10 min, 5 intentos; cuenta nunca revelada («Si el correo está vinculado, le llegará un código»).
- El código inverso es de 8 caracteres aleatorios (≈ 8,5 × 10¹¹ combinaciones) con vida de 10 min y límite por remitente: adivinar un código vigente no es viable.

### 4.10 Amenazas conocidas (documentar en el código y probar)

1. **Phishing por enlace de A′ (suplantación del dispositivo).** Un atacante genera un reto en su dispositivo y convence a la víctima de tocar su enlace `wa.me` y pulsar «Enviar»: el dispositivo del atacante entra con la cuenta de la víctima. El texto prellenado no basta (el atacante puede escribir el suyo). Mitigaciones obligatorias en la v1: (a) el texto prellenado incluye «Envíe este mensaje solo si usted lo pidió en bnbtico»; (b) **aviso de nuevo dispositivo por correo** a las cuentas que tengan correo (todos los anfitriones); (c) las acciones sensibles exigen prueba de acceso reciente con el **método añadido** (el atacante no lo tiene), así que un anfitrión no pierde número de contacto, correo, método de pago ni cuenta; (d) **D1, resuelta por Daniel (2026-11-06): no se avisa por WhatsApp.** Los invitados, que no tienen correo, quedan sin aviso de nuevo dispositivo: **riesgo aceptado** (sin pagos ni datos sensibles; lo que expone es su lista de consultas y la posibilidad de contactar anfitriones haciéndose pasar por ella). Documentar el riesgo en `docs/decisiones.md`.
2. **Código ajeno en mi dispositivo.** Adivinar/sustituir un código vigente metería a la víctima en una cuenta del atacante: lo cubre la entropía del código, el límite por remitente y el secreto de dispositivo.
3. **Reutilización o robo del número (cambio de SIM, número reciclado).** Riesgo aceptado en invitados; en anfitriones lo contiene el método añadido + prueba de acceso reciente.
4. **Enumeración de números:** no hay pantalla que reciba un número; los errores son neutros.
5. **Inundación del webhook** (spam al número de verificación): firma obligatoria, idempotencia, límites por remitente, sin respuesta.
6. **Token robado:** sesiones largas pero revocables; operaciones sensibles protegidas en SQL.
7. **Cuenta de WhatsApp de bnbtico suspendida por Meta:** el respaldo (Twilio Verify) cubre mientras se resuelve; monitorizar el fallo.

## 5. Flujos

### 5.1 Invitado, primer contacto

1. Ficha → «Contactar por WhatsApp» (la hoja de contacto guarda lo escrito, como hoy).
2. Sin sesión: se pide el nombre (si falta) y se muestra «Verifique su WhatsApp» (6.1).
3. `beginVerification({ purpose: 'sign_in', name })` → `waUrl`; botón abre WhatsApp (en escritorio, QR/enlace a WhatsApp Web).
4. La persona envía el mensaje; el webhook crea la cuenta; la app, que observa con `watchVerification`, recibe `ready`, canjea el `tokenHash` con `verifyOtp` y la sesión queda abierta.
5. Se registra la consulta (`create_inquiry`, que ya exige `phone_verified_at`) y se abre el WhatsApp del anfitrión con el mensaje redactado, como hoy (`shared/contact-flow.ts`).
6. Pantalla de cierre con la propuesta opcional de método añadido (6.2).

### 5.2 Invitado que vuelve o entra en otro dispositivo

Los invitados no tienen métodos añadidos: repiten A′ (`sign_in`); el número ya tiene cuenta, así que el dispositivo entra en ella; el nombre no se pide. Un anfitrión entra con su método añadido (Apple, Google o correo, un toque o un código); si lo prefiere o no puede, también por A′.

### 5.3 Anfitrión (publicar)

Se mantiene la regla del 2026-11-04 (pasos 1–6 guardados en el teléfono hasta llegar a las fotos). Al llegar a las fotos sin cuenta: A′ (igual que el invitado) y luego **añadir un método** (correo, Google o Apple) como paso obligatorio antes de enviar a revisión (`submit_listing` debe comprobar que la cuenta tiene un método añadido y devolver un error de dominio claro; la UI lo pide antes). El número verificado se copia a `listings.whatsapp_phone` como hoy (`listings_alta_segura`).

### 5.4 Cambiar el número de contacto (anfitrión)

Cuenta → WhatsApp → «Cambiar»: prueba de acceso reciente con el método añadido → `beginVerification({ purpose: 'change_phone' })` con la sesión → A′ con el número nuevo → el número anterior sigue activo hasta que `claim_verification` aplica el cambio. Si el nuevo pertenece a otra cuenta: «Ese WhatsApp ya pertenece a otra cuenta.»

### 5.5 Añadir método (solo anfitriones)

Cuenta → «Formas de ingresar» (visible solo para anfitriones; los invitados no la ven) y el paso obligatorio antes de enviar una casa a revisión: correo (`addEmail` → código → `confirmEmail`; reemplaza el correo sintético) o proveedor (`linkProvider`). Desvincular exige prueba de acceso reciente y **nunca deja a un anfitrión sin ningún método añadido** (error de dominio).

### 5.6 Ingresar con un Google/Apple/correo sin cuenta vinculada

`signInWithProvider`/`signInWithEmail` con `enable_signup = false` devuelve «usuario no encontrado». La app muestra: «No encontramos una cuenta con este [Google]. Primero verifique su WhatsApp.» y lleva a A′. Al terminar A′ ofrece vincular ese proveedor.

### 5.7 Recuperación

Invitado: A′ desde el mismo número, o método añadido. Anfitrión: método añadido + A′. Sin ningún acceso: soporte manual por WhatsApp (los números de soporte existentes), con comprobación manual; fuera de la app.

### 5.8 Administradores

Se crean por script de administración (correo real + TOTP) y no por A′. Reutilizar `seed_admin`/`admin_totp_correo`; retirar el correo ficticio `@admin.bnbtico.invalid` de los administradores y exigir correo real. `is_admin()` conserva `aal2`.

### 5.9 Respaldo por código enviado

Aparece solo si A′ no se completa (≥ 90 s) o la persona toca «No puedo enviar el mensaje». Pide el número, envía un código por Twilio Verify desde el worker (con los topes de 4.3), y al verificarlo el resultado es idéntico al de A′ (mismo `consume_verification`). Registrar su uso (telemetría) para vigilar que no pase de ≈ 5 %.

## 6. Pantallas y textos (propuestas para la revisión UI/UX)

**Puerta UX antes de construir la interfaz:** `docs/diseno-v1.md` y `design/pantallas/` mandan sobre aspecto y copy. Los bocetos de abajo son propuesta de contenido, no diseño visual; pasarlos por la revisión UI/UX (el flujo de prompts que ya se usa en otras funciones) y, si hace falta, actualizar el diseño v1 **antes** de implementar el ticket 05. Español de Costa Rica, tratando al usuario de **usted**. Sin voseo ni tuteo.

### 6.1 Verificar WhatsApp (hoja)

- Título: «Verifique su WhatsApp».
- Texto: «Para escribirle al anfitrión necesitamos saber que usted es una persona real. Toque el botón: WhatsApp se abrirá con un mensaje listo. Solo tiene que enviarlo. Es solo la primera vez.»
- Botón principal: «Verificar con WhatsApp».
- Mensaje prellenado: «Verificar mi cuenta bnbtico: BT-XXXX-XXXX. Envíe este mensaje solo si usted lo pidió en bnbtico.»
- Aclaración visible antes de tocar: el nombre y número de verificación (con el nombre «bnbtico» si Meta aprueba el perfil) y que bnbtico **no** le responderá.
- Espera: «Esperando su mensaje… Envíelo en WhatsApp y vuelva aquí.» (se actualiza solo al volver a primer plano).
- Escritorio: «¿Está en una computadora? Escanee este código con su teléfono.» (QR del `waUrl`).
- Éxito: «¡Listo! Su WhatsApp está verificado.»
- Vencido: «El código venció. Toque el botón para generar otro.»
- Número ya en otra cuenta (solo cambio de número): «Ese WhatsApp ya pertenece a otra cuenta. Ingrese con ella o use otro número.»
- Respaldo (tras 90 s o «No puedo enviar el mensaje»): «¿No puede enviar el mensaje? Podemos mandarle un código por WhatsApp.»

### 6.2 Tras el primer contacto

- **Invitados:** nada. No se les propone ningún método (decisión 20): terminan el contacto y se abre el WhatsApp del anfitrión. En las apps nativas, y solo ahí, una propuesta opcional única: «Bloquear la app con Face ID / huella» (6.6).
- **Anfitriones:** el paso obligatorio de 6.4 (no hay propuesta opcional).

### 6.3 Cuenta → «Formas de ingresar» (solo anfitriones)

Lista: WhatsApp verificado (número, «Cambiar»), correo, Google, Apple, con «Añadir» y «Quitar» (este último con prueba de acceso reciente). Texto de ayuda: «Con cualquiera de estas formas puede entrar sin repetir la verificación de WhatsApp.» Mantener la línea informativa «Pronto podrá verificar también su identidad (opcional).».

### 6.4 Anfitrión: paso previo a enviar a revisión

«Para publicar, añada una forma de ingresar. Así podrá recuperar su cuenta y cambiar datos importantes con seguridad.» Botones «Continuar con Apple», «Continuar con Google» y «Usar mi correo» (Apple siempre junto a Google). No se puede avanzar sin una.

### 6.5 Prueba de acceso reciente

Hoja: «Confirme que es usted» con los métodos que la cuenta tiene (Apple, Google, correo, WhatsApp) y «Cancelar». Vigencia de 10 min: tras confirmar, no vuelve a pedirse en ese lapso.

### 6.6 Bloqueo con biometría (solo apps nativas)

Ajuste en Cuenta: «Bloquear la app con Face ID / huella» (oculto en web y PWA). Con él activo, al volver a la app tras 1 minuto en segundo plano pide la biometría o el código del teléfono. Es un bloqueo local: no sustituye ninguna verificación.

### 6.7 Avisos de nuevo dispositivo

Correo: «Se inició sesión en su cuenta de bnbtico desde un dispositivo nuevo (ciudad aproximada, fecha y hora). Si no fue usted, escríbanos por WhatsApp.» Solo por correo (anfitriones): no hay aviso por WhatsApp (D1).

## 7. Configuración

- `supabase/config.toml` (local): `[auth] enable_signup = false`; retirar `[auth.sms]`, `[auth.sms.test_otp]` y `[auth.sms.twilio_verify]` y el `rate_limit.sms_sent` (ticket 09); `[auth.email]` con `otp_length = 6`, `otp_expiry = 600`; `[auth.external.google]` y `[auth.external.apple]`; `additional_redirect_urls` con los orígenes de la app; `[auth.mfa.totp]` se conserva; MFA por teléfono se mantiene apagado. En el proyecto alojado, los mismos ajustes desde el panel (documentar en `docs/configuracion-supabase.md`).
- Web: Google y Apple por **redirección con PKCE** (`signInWithOAuth`), **no** con el script de Google Identity Services: la CSP (`script-src 'self'`) no admite terceros en la zona privada. Probar la redirección dentro de la PWA instalada en iOS.
- Worker: variables de 4.3 en `wrangler.jsonc` y secretos en GitHub/Cloudflare; documentar en `docs/configuracion-supabase.md` y `docs/telemetria.md`.
- Tipos y datos: tras cada migración `pnpm db:al-dia`, `pnpm db:types` y, si cambia lo que se crea, `scripts/casas-de-prueba.mjs` en el mismo commit (regla del 2026-11-06).

## 8. Telemetría (balizas propias, sin datos personales; ver `docs/telemetria.md`)

Eventos: `verification_started`, `verification_completed` (con duración), `verification_expired`, `verification_conflict`, `verification_fallback_offered`, `verification_fallback_used`, `login_method_added` (tipo), `login_method_removed`, `reauth_required`, `reauth_completed`, `new_device_alert_sent`. Embudo para la revisión UX: toque en «Contactar» → inicio de verificación → mensaje enviado (cambio a `ready`) → consulta registrada. Alarmas: tasa de respaldo > 5 %, tiempo de verificación > 60 s (p75), fallos de firma del webhook.

## 9. Datos de prueba y migración

- **No hay cuentas reales** que migrar. El ticket 09 borra los usuarios de prueba de `bnbtico-pruebas` (**solo con la autorización expresa de Daniel y listando antes qué se borra**) y reinscribe a Daniel y Ana como administradores con correo real + TOTP (API de administración con la sesión de la CLI, sin entrar a la web; ver `docs/pruebas-manuales.md` 1.2).
- Local: `pnpm datos:prueba` y los arneses (`tests/db`, `tests/contract`, `tests/e2e`) crean usuarios con la API de administración o con el endpoint fake `/_pruebas/whatsapp/entrante`; ya no hay `[auth.sms.test_otp]`. Los anfitriones `8800 0001–0003`, el cliente `8800 0004` y los números `8888 1234`, `8777 0001`, `8888 9999`, `8899 0001` se reemplazan por helpers equivalentes (misma intención, mismos nombres siempre que sea posible).
- Migración con datos: un `UPDATE` sobre `listings` necesita `app.allow_status` (ver memoria del proyecto «Migraciones con datos»); `db reset` local no lo detecta. Probar contra la base alojada antes del push (`db push` antes de `git push`, PostGIS en `extensions`).

## 10. Pruebas (primero la prueba, luego el código)

- **Vitest (dominio):** parseo y normalización del código inverso; reglas de 4.4; límites; plantillas de mensajes; estados de `VerificationState`.
- **Suite de contrato** de `AuthApi` contra el fake y contra PostgREST (`tests/contract/auth.contract.ts`, `tests/db/contract-auth-postgrest.test.ts`).
- **Pruebas de base** (`tests/db`): RLS y grants de las tablas nuevas; `claim_verification` (idempotencia por `message_sid`, vencimiento, conflicto); índice único de número; `require_recent_auth` con JWT simulados (con y sin `amr` reciente); `submit_listing` rechaza anfitriones sin método añadido; el cliente no puede escribir `phone`/`phone_verified_at`.
- **Worker:** firma de Twilio (válida, inválida, reutilizada); webhook sin código, con código vencido, repetido; límites; `…/estado` solo entrega el resultado una vez y solo con el secreto correcto; el endpoint fake responde 404 en producción.
- **Playwright (Pixel 7):** primer contacto de punta a punta con el endpoint fake; ingreso con correo (código desde Mailpit/captura local); Google/Apple con proveedor simulado; anfitrión que añade método antes de enviar a revisión; cambio de número con prueba de acceso reciente; vencimiento; respaldo; CSP sin violaciones; hidratación sin avisos. Mostrar la UI y obtener visto bueno **antes** de la e2e completa; correr la e2e una vez antes del commit, no en cada ajuste.
- **CI:** `size-limit` (JS privado < 160 KB gz), hidratación, Lighthouse (ficha en frío < 2,0 s, shell instalado < 2,5 s).
- Commits en español, imperativo, un commit por paso completo con pruebas en verde, **sin línea de coautoría**.

## 11. Documentación a actualizar al cerrar

`CLAUDE.md` (regla «WhatsApp verificado por código es lo único obligatorio» y el listado de Supabase local/números de prueba), `docs/decisiones.md` (entrada preparada en el Anexo A de esta especificación), `docs/pruebas-manuales.md` (recorridos de cliente, anfitrión y admin), `docs/entorno-local.md`, `docs/configuracion-supabase.md`, `docs/telemetria.md`, `docs/antes-de-produccion.md` (SIM, Meta, SMTP, Apple/Google, Pro, tarifas), `docs/architecture.md` (sesión y seguridad), `docs/design.md` o `docs/diseno-v1.md` (pantallas nuevas tras la revisión UX).

## 12. Decisiones abiertas y puntos a verificar

- **D1 · Aviso por WhatsApp de nuevo dispositivo: RESUELTA, no avisar (Daniel, 2026-11-06).** bnbtico no envía ningún mensaje por WhatsApp en el flujo de ingreso (el respaldo de la decisión 4 es la única excepción, y lo pide la persona). Los anfitriones reciben el aviso de nuevo dispositivo por correo (con el caso de Apple y «Ocultar mi correo» de la sección 3); los invitados quedan sin aviso, riesgo aceptado (ver §4.10, 1d). Si algún día se quiere cubrir a los invitados sin enviar nada, una opción sin coste de mensajes es una lista de «dispositivos con sesión» en Cuenta con «Cerrar sesión en los demás»; **no está en el alcance**.
- **D2 · Obtener la SIM y el registro en Meta/Twilio** (sección 3): sin esto no se puede probar el webhook real. Mientras tanto se trabaja con el fake.
- **D3 · Sondeo frente a Realtime** para `…/estado` si el presupuesto de peticiones del plan gratuito de Workers aprieta (se mide en el ticket 03).
- **D4 · Tarifas oficiales** de Meta (mensajes entrantes y de servicio) y de Twilio (entrantes, salientes, número propio): confirmar en sus páginas oficiales antes del lanzamiento (las cifras de esta especificación salen de blogs y de la página de Twilio, no de la de tarifas de Meta; ver Anexo B).
- **Pruebas técnicas** (ticket 01): S1 sesión desde el worker; S2 sello `amr` y refresco; S3 Twilio recibe en el número real y Meta acepta la SIM; S4 redirección OAuth en la PWA instalada de iOS; S5 (nativo, ticket 10) `signInWithIdToken` y `linkIdentity` con plugins de Capacitor.

## 13. Orden de trabajo

Tickets en `issues/` (cada uno con «Bloqueado por» y «No tocar»): 01 pruebas técnicas → 02 esquema → 03 worker → 04 AuthApi y contrato → 05 UI de contacto y publicación (tras la puerta UX) → 06 métodos añadidos → 07 prueba de acceso reciente → 08 límites, avisos por correo y telemetría → 09 respaldo, retirada de Phone Auth, datos y documentación → 10 apps nativas (cuando exista el proyecto Capacitor). Un ticket por vez; desplegar en `nueva.bnbtico.com` y que Daniel pruebe cada uno antes del siguiente (ronda de cambios sin regresiones).

## 14. Aceptación global

1. Un invitado nuevo contacta a un anfitrión con **un solo paso de verificación**, sin recibir ningún código, en < 30 s (mediana) en el perfil móvil de CI.
2. Ningún camino envía un código saliente salvo el respaldo, con sus topes.
3. Un anfitrión no puede enviar una casa a revisión sin método añadido, y no puede cambiar número, correo ni método de pago sin prueba de acceso reciente (comprobado en SQL).
4. Un número verificado pertenece a una sola cuenta.
5. La CSP, la hidratación, `size-limit` y Lighthouse siguen en verde; sin violaciones nuevas.
6. Las pruebas de amenazas de 4.10 (1–7) tienen su prueba o su nota de riesgo aceptado.
7. Los recorridos de `docs/pruebas-manuales.md` reflejan el flujo nuevo.

## Anexo A · Entrada preparada para `docs/decisiones.md`

No está escrita en `docs/decisiones.md`. Pegarla arriba (la más reciente primero) cuando Daniel y Ana aprueben la especificación, con la fecha del día, y después actualizar `CLAUDE.md` (regla «WhatsApp verificado por código es lo único obligatorio» y la sección de Supabase local).

> ## 2026-11-06 · Ingreso por WhatsApp con código inverso; métodos añadidos sin contraseñas
>
> - **Decisión:** el ingreso deja de enviar códigos. La persona envía a bnbtico, por WhatsApp, un código que le muestra la app («código inverso»); el webhook lee el número del remitente y, en un solo paso, crea o reconoce la cuenta, inicia la sesión del dispositivo y marca el WhatsApp como verificado. Código por correo, Google y Apple son **métodos añadidos solo para anfitriones** (obligatorios al publicar; a los invitados nunca se les ofrece, por ser fricción sin beneficio); nunca crean cuentas (excepto administradores). Un invitado en un dispositivo nuevo repite el código inverso. Sin contraseñas. Sesión de ~1 año; **prueba de acceso reciente** (10 min, en SQL) para acciones sensibles. Bloqueo biométrico opcional en las apps (v1); passkeys en v1.1.
> - **Por qué:** cada código enviado cuesta ≈ 0,065 USD (Twilio Verify), los invitados no pagan y ingresan varias veces, y el envío abre la puerta al «SMS pumping». El mensaje entrante cuesta ≈ 0,005 USD con Twilio (0 con la API de Meta directa), no envía nada a números ajenos y mantiene el requisito de personas reales verificadas. Ana pidió reducir a un solo paso el primer contacto. Los métodos añadidos dan recuperación y entrada rápida sin repetir el paso.
> - **Alternativas descartadas:** código de Twilio enviado una vez por cuenta (más caro, expuesto a «SMS pumping», dos pasos); sin verificación de teléfono (no garantiza personas reales); correo y contraseña (contraseñas que robar y reiniciar); Google/Apple creando cuentas (casos de números ya existentes en otra cuenta).
> - **Reglas:** un número verificado por cuenta; cambiarlo exige prueba de acceso reciente y verificar el número nuevo; los anfitriones deben añadir correo, Google o Apple antes de enviar a revisión; el aviso de nuevo dispositivo va solo por correo (anfitriones). **No se avisa por WhatsApp** (decisión de Daniel): los invitados no tienen correo y quedan sin aviso, riesgo aceptado porque no hay pagos ni datos sensibles; expone sus consultas y que alguien contacte anfitriones haciéndose pasar por ellos. La amenaza concreta es que un atacante haga enviar a una víctima el mensaje de su enlace de verificación; la mitigan el texto del mensaje, la entropía del código y que las acciones sensibles de los anfitriones exigen su método añadido.
> - **Número de verificación:** uno solo, de Costa Rica (+506), con SIM física registrada como remitente de WhatsApp en Twilio, separado de los números de soporte.
> - **Cambios en reglas vigentes:** el WhatsApp verificado sigue siendo requisito para publicar y contactar, pero ya no es la credencial de ingreso ni se envía; se retira Phone Auth de Supabase; se deja de usar el correo ficticio de los administradores; se retira el «riesgo de enumeración de números» del 2026-10-23 (el ingreso ya no pide un número).
> - **Pendiente:** tarifas oficiales de Meta y Twilio, SIM, perfil de empresa de Meta, SMTP, Apple/Google (incluido el registro del dominio de envío en Apple), plan Pro. Detalle y tickets en `.scratch/login-rediseno/`.

## Anexo B · Fuentes consultadas (2026-11-06)

- [WhatsApp Business Platform: Pricing (Meta)](https://developers.facebook.com/docs/whatsapp/pricing): los mensajes de usuario a negocio no se cobran; los mensajes «Service» vuelven a cobrarse desde el 1 de octubre de 2026 (1 000 gratis al mes por número).
- [Twilio WhatsApp Messaging Pricing](https://www.twilio.com/en-us/whatsapp/pricing): 0,005 USD por mensaje, entrante o saliente.
- [Twilio: Register WhatsApp senders using Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) y [Help Center: registrar un número propio para WhatsApp en Twilio](https://help.twilio.com/articles/360052171393-Can-I-register-my-own-phone-number-for-WhatsApp-on-Twilio-): el número debe poder recibir SMS o llamada de voz.
- [Twilio: Costa Rica Regulatory Guidelines](https://www.twilio.com/en-us/guidelines/cr/regulatory) y [Voice Pricing, Costa Rica](https://www.twilio.com/en-us/voice/pricing/cr): solo «números internacionales» desde 1,15 USD/mes; documentos legales en Costa Rica.
- [Supabase: Native Mobile Auth Support for Google and Apple Sign in](https://supabase.com/blog/native-mobile-auth) y [referencia de `signInWithIdToken`](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken).
- `docs/viabilidad-y-proyecciones.md` (Twilio Verify ≈ 0,065 USD por verificación en el modelo; Supabase Pro con 100 000 usuarios activos al mes).
