# 18: Entrar solo con el WhatsApp (un único flujo)

**Qué construir:** Ingresar pide primero el WhatsApp (con el selector de país). Si el número tiene cuenta se envía el código y entra; si no, pide el nombre y después envía el código. Desaparece «Ya tengo cuenta».

**Bloqueado por:** 17

**Status:** done (2026-10-26)

- [x] `AuthApi.start({ phone, name? })` devuelve `"sent"` o `"needs-name"`. Sin nombre intenta `signInWithOtp` con `shouldCreateUser: false`; si GoTrue responde que no hay usuario (`otp_disabled`), no se ha enviado nada y devuelve `"needs-name"`. Con nombre, `shouldCreateUser: true`. Nunca se envían dos códigos por un mismo toque; el enfriamiento de 30 s y el tope de un código por segundo se respetan.
- [x] El número pendiente guarda si la cuenta se acaba de crear (`mode: "register"`) o ya existía (`"login"`); «¡Listo! Su cuenta está creada» solo tras crear una cuenta sin correo.
- [x] Contrato de cuenta actualizado en el fake y en Supabase local (número con cuenta → enviado; sin cuenta → pide nombre sin enviar; con nombre → crea; nombre corto).
- [x] Pantalla: paso del número; paso del nombre con el número a la vista y «Cambiar número»; sin «Ya tengo cuenta» ni `?modo=entrar` (un enlace viejo con `modo=entrar` abre el mismo flujo). Turnstile: un token por envío.
- [x] Riesgo de enumeración de números documentado en `docs/decisiones.md` (aceptado o mitigado).
- [x] Playwright (número con cuenta → código → entra; número nuevo → nombre → código → «¡Listo!»), capturas Pixel 7 y 360 px; `docs/pruebas-manuales-fase-r.md` B6–B10c al día. Baterías en verde.

## Añadido (2026-10-26) · Ingresar para contactar (revisión UX C2)

Acordado con Daniel en la revisión UX (`.scratch/revision-ux/2026-10-26-revision-ux.md`, C2). Verificar el WhatsApp sigue siendo obligatorio para contactar; lo que cambia es que el paso se lea como parte de escribirle al propietario y no como crear una cuenta. Vale solo cuando Ingresar se abre desde la hoja de contacto (`next=/casa/CT-####?contacto=1`); el Ingresar normal queda como dice el resto del ticket.

- [x] **Hoja de contacto:** sin sesión verificada, el botón dice «Continuar» (no «Abrir WhatsApp», porque todavía no lo abre); la nota de debajo se mantiene («Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.»). Con sesión sigue diciendo «Abrir WhatsApp».
- [x] **Ingresar en modo contacto:** cabecera «Escribirle a <nombre del propietario>» en vez de «Ingresar»; H1 «Un paso y le escribe a <nombre>»; la tarjeta de la casa (foto, nombre de la casa, «<nombre> · WhatsApp verificado») **arriba**, antes del paso del número, y también en el paso del nombre si la cuenta es nueva. Sin «No tengo acceso a mi WhatsApp» ni otros enlaces secundarios. La palabra «Ingresar» no aparece en ninguna pantalla de este camino (tampoco en la del código).
- [x] **Tras el código, directo a WhatsApp:** la ficha reabre la hoja con «Abriendo WhatsApp…», registra la consulta y abre el chat sin un segundo toque (`proceedToWhatsApp`, `location.assign`, que el iPhone no bloquea). Si la base dice que no, la hoja se queda abierta con su mensaje, como hoy. En este camino no se muestra «¡Listo! Su cuenta está creada» ni la invitación al correo: la invitación queda en Mi cuenta para la próxima visita.
- [x] **Playwright, de punta a punta:** cliente sin cuenta → ficha → Contactar → Continuar → número → nombre → código → navegación a `wa.me` con el mensaje redactado; y lo mismo con un número que ya tiene cuenta (sin el paso del nombre). Como mucho 4 toques desde la ficha hasta WhatsApp (Contactar, Continuar, Recibir código, Verificar) más los campos.

## Añadido (2026-10-26) · Errores por campo y un solo control de país (revisión UX A6)

- [x] **Errores por campo**, debajo de su campo y con el foco en él: número vacío → «Escriba su número de WhatsApp»; número con formato o longitud que no valen → «Ese número no parece válido para el país elegido.»; nombre vacío (paso del nombre) → «Escriba su nombre»; nombre corto → el mensaje del contrato. Nunca el error del número cuando el campo está vacío.
- [x] **Un solo control de país:** fuera el campo «País de su WhatsApp»; la caja del prefijo junto al número pasa a ser el selector (chip compacto «+506 ▾»). Al abrirlo, la lista muestra el nombre del país y su prefijo («Costa Rica (+506)»); Costa Rica por defecto. Etiqueta accesible «País de su WhatsApp» en el selector. Capturas a 360 px con la barra inferior (ticket 17).

## Cierre (2026-10-26)

- **API:** `StartInput = { phone; name? }`, `start(): Promise<"sent" | "needs-name">` (`src/domain/api.ts`); `validateStart` y `isNoAccount` en `domain/account.ts`. Adaptador PostgREST: sin nombre `shouldCreateUser: false` y, si GoTrue dice `otp_disabled`, «needs-name» sin escribir el número pendiente; con nombre, `shouldCreateUser: true`. Fake igual.
- **Contrato** (fake y Supabase local): número sin cuenta → «needs-name» sin pendiente y, al momento, con el nombre → «sent» con `mode: register` (prueba que el primer intento no gasta el tope de un código por segundo); número con cuenta → «sent» con `mode: login`; validación con y sin nombre.
- **Pantalla:** `EntryForm` en dos pasos (número → «Es su primera vez en bnbtico» con nombre y «Cambiar número»); sin «Ya tengo cuenta». El contenedor de Turnstile queda montado entre pasos (con `key` en el formulario el segundo envío esperaba un token que no llegaba: lo cazó `seguridad.spec.ts`).
- **Pruebas:** `cuenta.spec.ts` reescrita (registro en dos pasos con nombre vacío, entrada directa con cuenta, `?modo=entrar`, «Cambiar número», otro país), `contacto-cuenta.spec.ts`, `fase3.spec.ts`, `favoritos.spec.ts`, `seguridad.spec.ts` (los dos envíos llevan su token, `create_user` false y luego true), `captcha.test.ts`, `account.test.ts`.
- **Docs:** `docs/decisiones.md` (flujo y riesgo de enumeración aceptado), `docs/pruebas-manuales-fase-r.md` B6, B7, B9d, B10–B10c, `docs/pruebas-manuales-fase-3.md` B3a/B3b.
- **Baterías:** typecheck y build en verde; unitarias 645/645; base 165/165; Playwright 102/102; Lighthouse ficha 1,61 s, shell 0,28 s; zona privada 140,24 KB gz. Capturas Pixel 7 y 360 px de los dos pasos. Sin migraciones.
- **Para Daniel:** nada que configurar. En el alojado, Twilio Verify con `shouldCreateUser: false` responde igual que GoTrue local (sin envío); conviene confirmarlo en B6 con un número de prueba nuevo.
