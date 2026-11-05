# Plan de implementación · bnbtico v1

Acordado el 2026-10-15. Este documento manda sobre `roadmap.md` (histórico) en todo lo que se contradigan.

## Qué es la v1

**La v1 es el prototipo** (`design/prototype/casatica-prototipo.html` con sus módulos), tal como se ve hoy en la vista Móvil, con dos excepciones:

- **Sin Veriff.** Nada de identidad en v1: ni sello «Identidad verificada», ni sugerencia al contactar o publicar, ni orden del catálogo por verificadas. Solo «WhatsApp verificado». Veriff completo pasa a la **v1.1**. El prototipo lo conserva porque es la referencia de hacia dónde va.
- **Sin cobro real.** La pantalla de método de pago existe y guarda la tarjeta, pero la pasarela se conecta después del lanzamiento. Con 12 meses gratis, el primer aviso llega a los 9 meses y el primer cargo al año: hay margen.

Todo lo que el prototipo oculta (reclamaciones, titularidad registral, planes por nivel, búsqueda con IA) queda fuera, igual que hoy. Tampoco entra «Pedir casa / Buscan casa» (la fase 6, aplazada el 2026-10-27 hasta después del lanzamiento; en su lugar, Explorar lleva al WhatsApp de atención a clientes).

## Cómo se construye

- **Móvil primero.** Web hecha para el teléfono, en **bnbtico.com**, que la gente abre desde el enlace de WhatsApp y puede añadir a su pantalla de inicio (PWA). La vista web existe pero es un derivado. La app en tiendas (envoltorio de esta misma web) viene después del lanzamiento.
- **Las fases son de construcción, no de lanzamiento.** Nadie de fuera ve nada hasta que todo esté. Cada fase se despliega en `pruebas.bnbtico.com` (protegida) para probarla con el móvil; durante la fase R la app nueva se despliega en `nueva.bnbtico.com` detrás de Cloudflare Access y la vieja sigue en `pruebas.bnbtico.com`. `bnbtico.com` muestra «muy pronto» hasta el día del lanzamiento.
- **Cada fase deja un flujo completo que se puede probar de punta a punta**, con sus pruebas automáticas en verde, su entrada en `decisiones.md` si cambió algo, y su commit.
- **El diseño v1 manda** (`docs/diseno-v1.md` y `design/pantallas/`, desde el 2026-10-20) en aspecto, estructura y copy. El prototipo (vista Móvil) y sus pruebas en `tests/prototype/` siguen siendo la referencia de comportamiento donde el diseño no diga otra cosa. Si dos documentos se contradicen, manda el más reciente.

## Stack (revisado el 2026-10-21; detalle y porqués en `decisiones.md`)

- **App client-first (PWA):** Vite + React 19 + TanStack Router + TanStack Query, en `apps/app`, paquete `app`, sin renombrado posterior (decisión 2026-11-04). La zona con sesión es un shell estático cacheado por un service worker que habla con PostgREST con el JWT del usuario; **una sola ruta con SSR**, `/casa/CT-####`, renderizada por un worker Hono para que WhatsApp y Google vean la ficha. La portada es HTML estático.
- **Worker Hono en Cloudflare Workers** (plan gratuito hasta que un disparador medido pida el de 5 USD): SSR de la ficha, sitemap, balizas de `web-vitals`/errores/eventos, y en la fase 5 webhooks de pago y cron de avisos. Despliegue con GitHub Actions: push a `develop` → pruebas → `nueva.bnbtico.com` (luego `pruebas.bnbtico.com`); push a `main` → bnbtico.com. Vercel solo sigue sirviendo la app vieja hasta el corte.
- `supabase/`: **Supabase** (Postgres con RLS, RPCs plpgsql para invariantes, Storage para fotos, `pg_cron`/`pg_net` para trabajos). Free hasta un disparador medido (Storage 800 MB, egreso 4 GB/mes, base 400 MB), luego Pro. Copia diaria con `pg_dump` desde GitHub Actions desde la primera semana. Proyecto local para desarrollar, uno de pruebas y uno de producción. **El navegador es el cliente de PostgREST**; no hay API intermedia ni server actions.
- **Presupuesto de infraestructura:** 0 USD hasta el lanzamiento; después, 10–20 USD/mes aceptados (Workers 5 USD y Supabase Pro 25 USD cuando sus disparadores salten).
- **Stack anterior (fases 0–2, retirado del repositorio en el ticket 09):** Next.js 16 App Router en Vercel Hobby con Server Components, Server Actions y proxy; se sustituyó porque el render por petición y la verificación de sesión por red en cada hop impedían la fluidez (`decisiones.md`, 2026-10-21). Vercel conserva sus despliegues, con builds desactivados, hasta un corte autorizado.
- **Códigos por WhatsApp:** Twilio Verify (canal WhatsApp) para arrancar; cuenta de empresa de Meta tramitándose desde la fase 0 para pasar a la API oficial cuando esté aprobada. Los avisos de suscripción salen por el mismo canal.
- **Pruebas:** Vitest para lógica (filtros, dinero, estados de casa, redacción de mensajes); una **suite de contrato** sobre `ListingsApi`/`AuthApi` que corre contra el fake en memoria y contra PostgREST en Supabase local (`tests/db`); Playwright en viewport móvil (Pixel 7) para los flujos (publicar → aprobar → ver ficha → contactar); y tres puertas en CI (`size-limit`, hidratación de la ficha, Lighthouse CI). Las pruebas del prototipo (`tests/prototype/*.cjs`) siguen siendo la referencia de comportamiento.
- Se retiran del repo `apps/mobile`, `packages/*` y Turborepo: una sola app, pnpm simple.

## Retirada de Next (2026-11-04)

El ticket 09 del refactor conservador retira solo los archivos versionados de `apps/web`, sus dependencias exclusivas y sus comandos. Conserva `apps/app`, el paquete `app`, la cobertura vigente y todos los presupuestos. No cambia datos, Vercel ni DNS. Los estados fechados de abajo documentan las fases anteriores; sus instrucciones de Next son históricas. Para desarrollar se sigue el `README.md`; para el corte, `docs/corte-fase-r.md`.

## Estado (2026-10-27)

**Fase 5 construida** sobre la app nueva (tickets 01–08 en `.scratch/fase-5/issues/`, en local y en `develop` sin desplegar): cada casa toma su plaza de la oferta de lanzamiento en la primera aprobación (12/6/3 meses por tramos; «Quedan N de 50» cuenta plazas asignadas), estados Activa → Pendiente de pago → Inactiva con parar y reactivar, enlace bloqueado con su motivo (410 «paró la suscripción» / «regularice su suscripción»), avisos a 90/30/7/0 días en la app y por WhatsApp (outbox en `subscription_reminders`, encolados por `pg_cron` y enviados por el cron horario del worker con Twilio sandbox en pruebas), método de pago guardado en Stripe en modo de prueba (Checkout `setup`, webhook firmado e idempotente; nada se cobra), pantalla «Promoción y suscripción» y la suscripción en Cuenta, Inicio, Mis casas, el detalle y Casas del admin; reloj de pruebas `POST /_pruebas/oferta/CT-####`. Recorrido completo en Playwright (`tests/e2e/fase5.spec.ts`, corre también en CI). La migración `20261027202238_fase5_suscripcion` **ya está aplicada en `bnbtico-pruebas`** (2026-10-27; las 2 casas activas con las plazas 1 y 2, trabajo `bnbtico-suscripciones` activo). **Pendiente:** las acciones previas de Daniel en `docs/pruebas-manuales-fase-5.md` (A1 Stripe de prueba y webhook, A2 sandbox de Twilio, A3 secretos de GitHub, A4 bypass de Access para `/webhooks/*` y `/_pruebas/*`, A5 secreto de Vault `bnbtico_test_clock`, A6 desplegar `develop` con un solo cron `17 * * * *`) y pasar ese plan desde el teléfono (iPhone y Android).

### Fase 6 y escritorio (2026-10-27)

**Fase 6 aplazada** hasta después del lanzamiento; su sustituto «¿No encuentra lo que busca?» (Explorar → WhatsApp de atención a clientes, evento `search_help_tap`) está construido y en `develop` sin desplegar; la migración `20261028010831_evento_ayuda_busqueda` **ya está aplicada en `bnbtico-pruebas`**. Pendiente: comprobar `WA_GUESTS` en GitHub y probarlo desde el teléfono al desplegar. **Pasada de escritorio en espera** hasta que el móvil esté definido y probado (borrador en `.scratch/escritorio/`).

### Estado de la fase 4 (2026-10-23; corregido el 2026-10-27)

**Fase 4 construida, aplicada y desplegada** sobre la app nueva (tickets 01–06 en `.scratch/fase-4/issues/`): calendario del propietario (pestaña Calendario, selección primero, noches ocupadas y precio ★ por día, guardado todo o nada por la RPC `save_listing_days`, también con la casa en revisión), «Disponible para consultas» con fecha de reapertura opcional y reapertura nocturna con `pg_cron` (`bnbtico-reabrir-casas`, 00:00 de Costa Rica), y la sección «Disponibilidad» en la ficha pública (ocupados, cifra solo en los ★, «Calendario cerrado» con la fecha), que se monta tras hidratar y se refresca en segundos con la purga de cada cambio. Reglas de `tests/prototype/calendar.cjs` portadas a Vitest (sin temporadas, fin de semana ni «Configurar tarifas»). Recorrido completo en Playwright (`tests/e2e/fase4.spec.ts`). La migración `20261024024441_fase4_calendario` ya está aplicada en `bnbtico-pruebas`, con `pg_cron` activo (`bnbtico-reabrir-casas`), y `develop` está desplegado en `nueva.bnbtico.com`. **Pendiente:** que Daniel pase `docs/pruebas-manuales-fase-4.md` desde el teléfono (iPhone y Android), incluida la reapertura a medianoche. Lo de las fases 3 y R sigue pendiente igual (abajo).

### Estado de la fase 3 (2026-10-23)

**Fase 3 construida** sobre la app nueva (tickets 01–06 y el cierre 08 en `.scratch/fase-3/issues/`, solo en local y en `develop` sin desplegar): hoja de contacto en la ficha con el mensaje redactado, cuenta obligatoria para contactar con vuelta a la hoja, consulta registrada por la RPC `create_inquiry` (que es lo único que entrega el número de la casa) y `wa.me` con el mensaje, Mis consultas del propietario con «Nueva», filtro por casa y contador en Inicio y en la pestaña, y favoritos sin cuenta sincronizados con la cuenta al ingresar. Recorrido completo en Playwright (`tests/e2e/fase3.spec.ts`). **WhatsApp distinto por casa aplazado** (ticket 07, decisión de Daniel): cada casa usa el WhatsApp de la cuenta. **Pendiente:** (1) aplicar la migración `20261023230813_fase3_consultas` en `bnbtico-pruebas` y desplegar `develop`; (2) que Daniel pase `docs/pruebas-manuales-fase-3.md` desde el teléfono (iPhone y Android). Lo de la fase R sigue pendiente igual (abajo).

### Estado de la fase R (2026-10-23)

**Fase R construida** (tickets 01–12 en `.scratch/fase-r/issues/`, desplegados desde `develop` en `nueva.bnbtico.com`): ficha SSR, Explorar y filtros, cuenta en el navegador, zona del propietario con el asistente de nueve pantallas y fotos en tres variantes, admin con segundo factor TOTP exigido en SQL, service worker y app instalable, CSP estricta, Turnstile, telemetría propia, copia diaria y puerta de Lighthouse. Mediciones locales en el cierre del ticket 12 (ficha LCP 1,60 s en Lighthouse, shell instalado 0,24 s, zona privada 145 KB gz de 150). **Pendiente:** (1) que Daniel haga las acciones previas y apruebe `docs/pruebas-manuales-fase-r.md` en `nueva.bnbtico.com`; (2) el corte (ticket 13), con la parte no destructiva ya hecha —portada estática en la app nueva, entorno `production` en «solo portada», migración de fotos preparada— y el resto en `docs/corte-fase-r.md`. Hasta el corte, Vercel sigue sirviendo `apps/web` en `pruebas.bnbtico.com` y `bnbtico.com`.

### Estado anterior (2026-10-21)

**Hecho.** Fases 0 y 1 cerradas. **Fase 2 construida, revisada y desplegada en pruebas.bnbtico.com el 2026-10-19.** **Siguiente: fase R** (reescritura client-first, abajo), decidida el 2026-10-21 tras revisar la arquitectura; la fase 3 arranca sobre la app nueva. La app vieja en `apps/web` no recibe más cambios salvo los imprescindibles para seguir probando.

- **Cuenta con WhatsApp verificado** completa en la app vieja, con dos proveedores intercambiables en `apps/web/src/lib/auth/`: `demo` (código 123456, cookies firmadas, sin Supabase) y `supabase` (Supabase Auth por teléfono + `profiles`). Endurecida el 2026-10-15 (detalle en `decisiones.md`). En la app nueva el proveedor demo desaparece y el OTP corre en el navegador contra Supabase Auth. **Falta Twilio real** para números de verdad (`docs/configuracion-supabase.md`, paso 3).
- **Diseño v1 «Sol y sal» aplicado el 2026-10-20** a todas las pantallas de las fases 1 y 2 y a la portada (`docs/diseno-v1.md`, `docs/decisiones.md`). Favoritos, calendario, consultas y landings siguen pendientes de sus fases.
- **Casas (fase 2):** formulario de publicación en cinco pasos con borrador en base de datos, fotos a Storage, admin en `/admin` (perfiles con `is_admin`), ficha pública `casa/CT-####` con vista previa para WhatsApp y mapa aproximado, Explorar con filtros en la URL y Limón por defecto, Mis casas con detalle de gestión. Módulo `apps/web/src/lib/listings/`; migraciones `fase2_casas`, `fase2_tipo_sin_default` y `fase2_permisos`. Decisiones y desvíos en `decisiones.md` (2026-10-19). Especificación y plan en `docs/superpowers/`.
- **Supabase de pruebas** (`bnbtico-pruebas`, ref `bpxiggdzgzolcazaaboj`) enlazado al repo; migración `0001` aplicada. Las tres migraciones de la fase 2 aplicadas el 2026-10-19, bucket `listings` creado y cuenta admin `8899 0001` marcada (`docs/configuracion-supabase.md`, paso 8). **Pendiente:** la comprobación desde el móvil con `docs/pruebas-manuales-fase-2.md`.
- **Supabase local** en Docker: `pnpm db:start` / `pnpm db:reset`; `apps/web/.env.local` apunta a él y lleva `SUPABASE_SERVICE_ROLE_KEY` (solo para las pruebas). Números de prueba `8888 1234`, `8777 0001`, `8888 9999` y `8899 0001` (admin) con código 123456. Tras tocar `config.toml`, `supabase stop && supabase start`.
- **Portada de bnbtico.com** (rama `main`): foto de Playa Negra, SEO, sitemap (ahora también con las fichas activas), JSON-LD. Pendiente de Daniel: Search Console.
- **Vercel**: `main` → bnbtico.com (solo portada), `develop` → pruebas.bnbtico.com con `PREVIEW_PASSWORD`, Supabase y `NEXT_PUBLIC_GA_ID=off`.
- **Para trabajar en local** (app vieja): `.claude/launch.json` arranca `pnpm --filter web dev`; Playwright usa el Chrome instalado con `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` y un solo worker; `next dev` genera `apps/web/AGENTS.md`, que no se versiona. La app nueva añade su propia entrada en `launch.json` en la fase R (Vite + worker en un proceso) y siempre necesita `supabase start`.

### Fase 3 · por dónde empezar (sobre la app nueva, tras la fase R)

1. Repasar en el prototipo (vista Móvil) `contacto-hoja.js`, `consultas-directo.js`, `listing-whatsapp.js`, `house-controls.js` y sus pruebas en `tests/prototype/`; reglas en `docs/contacto-whatsapp.md` (donde hable de solicitud/aceptación, manda `CLAUDE.md`: WhatsApp directo). Antes de cualquier pantalla: políticas RLS de `inquiries` y `favorites` con su prueba de contrato.
2. El botón «Contactar por WhatsApp» ya existe deshabilitado en la ficha; la tabla `inquiries` está en `0001`. El número de la casa (`listings.whatsapp_phone`) se copia del perfil al crear; editarlo por casa con verificación propia entra en esta fase.
3. Orden sugerido: hoja de contacto con fechas/personas y mensaje redactado → cuenta obligatoria para contactar (volver a la hoja con lo escrito) → registro de la consulta y apertura de `wa.me` → Mis consultas del propietario → favoritos → WhatsApp por casa.

## Fases

### Fase 0 · Base limpia
**Objetivo:** que exista un sitio donde desplegar y un repo que diga la verdad.
**Incluye:** reescritura de `CLAUDE.md` y alineación de docs (hecho el 2026-10-15); limpieza del monorepo; scaffold de `apps/web` con tokens de `design/tokens/tokens.json`, fuentes y logo; Supabase local con la migración inicial reescrita según el prototipo (casas, fotos, usuarios, consultas, suscripciones, calendario); Vercel conectado al repo; dominio bnbtico.com con «muy pronto» y `pruebas.bnbtico.com` (rama `develop`) con contraseña y `pruebas.bnbtico.com` con contraseña; Vitest y Playwright configurados con una prueba de humo cada uno.
**No incluye:** ninguna pantalla del producto.
**Hecho cuando:** `pnpm dev` levanta la web vacía con los tokens aplicados, `pnpm test` pasa, bnbtico.com responde con «muy pronto» y pruebas.bnbtico.com pide contraseña y muestra la misma web.

### Fase 1 · Cuenta con WhatsApp verificado
**Objetivo:** que una persona pueda crear su cuenta con su WhatsApp y volver a entrar.
**Incluye:** registro con nombre y número, código por WhatsApp (Twilio Verify), sesión persistente, Mi cuenta simplificada (como el prototipo: nombre, número, sello «WhatsApp verificado», editar perfil, cerrar sesión), botón «Escribile a bnbtico por WhatsApp» con los dos números por rol, cambio de rol cliente/propietario dentro de la misma cuenta.
**No incluye:** Veriff, recuperación de cuenta más allá de volver a pedir código.
**Hecho cuando:** desde un móvil real se crea una cuenta, llega el código por WhatsApp, se entra, se cierra sesión y se vuelve a entrar; la prueba de Playwright lo hace con un número de prueba de Twilio.
**Primer paso de la fase:** comprobar en una tarde que Twilio Verify por WhatsApp entrega códigos a números de Costa Rica. Si no, se usa SMS para los códigos y WhatsApp solo para el resto.

### Fase 2 · Publicar una casa, aprobarla y verla
**Objetivo:** que un propietario real publique su casa y, una vez aprobada, cualquiera la vea por su enlace.
**Incluye:** formulario de publicación en **nueve pantallas sin scroll** (desde el 2026-10-21; nació con cinco pasos): modalidad y tipo, dónde está, mapa, capacidad, características de la lista única, nombre y descripción, fotos a Storage, precio en colones por modalidad, enviar; estado «Pendiente de revisión»; admin mínimo (cola, revisión completa, aprobar/pedir cambios/rechazar con motivo); la casa aprobada aparece en el catálogo con su provincia y su `CT-####`; Explorar con filtros en la URL y pantalla de Filtros propia, Limón por defecto, solo provincias con casas; colones con visualización en dólares; ficha pública móvil según el diseño v1 (hero con contador de fotos, características con icono, zona aproximada con mapa, una sola nota y barra de precio; sin calendario ni tarjeta del propietario) con enlace `bnbtico.com/casa/CT-xxxx` y vista previa para WhatsApp; Mis casas con tarjeta ligera y detalle de gestión (editar, disponible/no disponible, compartir ficha).
**No incluye:** contacto, calendario editable, suscripción.
**Hecho cuando:** un propietario publica desde el móvil, el admin aprueba, y el enlace de la ficha abre en otro teléfono con la casa completa; el flujo entero está en Playwright.

### Fase R · Reescritura client-first (decidida el 2026-10-21)
**Objetivo:** que la misma v1 de las fases 1 y 2 se sienta como una app: respuesta visual al toque < 50 ms, pantalla ya visitada < 100 ms sin red, pantalla nueva con sesión < 300 ms, ficha pública LCP < 1,5 s, PWA instalada abierta en < 500 ms, JS inicial de la zona privada < 150 KB gz (objetivos p75 de usuarios reales en Costa Rica).
**Incluye, por orden de riesgo:** (1) esqueleto en `apps/app` con el pegamento SSR de `/casa/CT-####` (Hono + `renderToString` + hidratación) y la sesión OTP en cliente contra `bnbtico-pruebas`, desplegado en `nueva.bnbtico.com` con GitHub Actions desde el primer día; (2) módulo de dominio sin framework con tipos generados, `ListingsApi`, adaptador PostgREST, fake en memoria y suite de contrato, más la migración `cliente_directo` (RPCs de fotos, `photos` en la vista, topes por RLS); (3) Explorar, filtros y ficha con variantes de imagen 480/800/1600; (4) zona del propietario con el asistente de 9 pasos y subida directa de fotos; (5) admin con segundo factor exigido en SQL (`aal2`; por app de autenticación TOTP desde el 2026-10-23); (6) cuenta, ayuda, favoritos; (7) service worker con aviso de actualización; (8) CSP estricta, Turnstile, `web-vitals`, baliza de errores, copia `pg_dump`; (9) paridad y corte.
**No incluye:** ninguna pantalla nueva de las fases 3–6; cambios de diseño (manda `docs/diseno-v1.md`).
**Hecho cuando:** las 20 pruebas de base, la suite Playwright portada (Pixel 7), `docs/pruebas-manuales-fase-2.md` desde el móvil contra `nueva.bnbtico.com`, las tres puertas de CI (`size-limit`, hidratación, Lighthouse CI) y la vista previa de WhatsApp pasan; entonces se mueve el DNS, se borra la app vieja y `apps/app` pasa a ser `apps/web` (guion: `docs/corte-fase-r.md`). **Estado (2026-10-23):** tickets 01–12 construidos; falta la prueba manual de Daniel (`docs/pruebas-manuales-fase-r.md`, que sustituye a la de la fase 2 para la app nueva) y el corte.

### Fase 3 · Contacto por WhatsApp
**Objetivo:** que un cliente escriba a un propietario y el propietario lo vea.
**Incluye:** botón «Contactar por WhatsApp» (único, en la barra fija), hoja con llegada/salida/personas y el mensaje redactado solo que se actualiza al cambiar datos, consentimiento, apertura de `wa.me` con el número del owner; registro de la consulta; Mis consultas del owner (abre WhatsApp directo con el cliente); favoritos; cuenta obligatoria para contactar (si no hay sesión, se registra y vuelve a la hoja con lo que había escrito).
**No incluye:** Veriff y su sugerencia, valoraciones de clientes; **WhatsApp distinto por casa con verificación propia** (aplazado por Daniel el 2026-10-23: necesita enviar códigos con Twilio Verify desde el worker; mientras, cada casa usa el WhatsApp de la cuenta; diseño guardado en `.scratch/fase-3/issues/07-whatsapp-por-casa.md`).
**Especificación y tickets:** `.scratch/fase-3/`.
**Hecho cuando:** desde un móvil con sesión se abre WhatsApp con el mensaje correcto y el owner ve la consulta en su lista.

### Fase 4 · Calendario del propietario
**Objetivo:** que el owner mantenga disponibilidad y precios y la ficha lo refleje.
**Incluye:** el calendario simple decidido el 2026-10-20 (`decisiones.md`): marcar noches ocupadas y cambiar el precio de fechas concretas, no disponible con fecha de reapertura; la ficha pública muestra solo los días con precio distinto al base. Temporadas, fin de semana y «Configurar tarifas» del prototipo (`docs/design.md`) quedan fuera de v1.
**Especificación y tickets:** `.scratch/fase-4/` (construida el 2026-10-23; plan manual en `docs/pruebas-manuales-fase-4.md`).
**Hecho cuando:** un cambio hecho en el móvil del owner se ve en la ficha pública al instante y las reglas del prototipo (`tests/prototype/calendar.cjs`) pasan portadas a Vitest.

### Fase 5 · Suscripción, estados y avisos
**Objetivo:** que las casas tengan el ciclo de vida del prototipo sin cobrar todavía.
**Incluye:** oferta gratuita de lanzamiento (12 meses / 6 / 3 por tramos de 50 casas), estados pendiente de revisión → pendiente de pago → activa → inactiva, parar y reactivar, el enlace de la ficha deja de funcionar si la suscripción está parada o pendiente de pago, aviso en la app y por WhatsApp a 90/30/7/0 días con el enlace `#pago=`, pantalla «Promoción y suscripción» en Mi cuenta, «Añadir método de pago» solo en ventana de aviso y sin método; guardar la tarjeta en la pasarela elegida en modo de pruebas (tokenización), sin cargar.
**Dónde vive el código de servidor (decisión 2026-10-21):** webhooks de la pasarela en el worker Hono (firma → `payment_events(provider, event_id)` único → RPC `apply_payment_event`); avisos con patrón outbox (`pg_cron` encola en `subscription_reminders`, el cron del worker envía y marca `sent_at`); reapertura a medianoche en SQL con `pg_cron`. Sin servicio nuevo salvo que el worker pase de ~1 500 líneas o un trabajo dure más de 30 s.
**No incluye:** cargos reales, facturas.
**Especificación y tickets:** `.scratch/fase-5/` (construida el 2026-10-27; plan manual en `docs/pruebas-manuales-fase-5.md`). El «reloj adelantado» es el reloj de pruebas: acerca el fin de la oferta de una casa (`POST /_pruebas/oferta/CT-####`), no mueve la fecha.
**Hecho cuando:** con el reloj adelantado en pruebas, una casa recorre todos los estados, llegan los avisos por WhatsApp a un número de prueba y el enlace bloqueado muestra «Este enlace ya no está activo».

### Fase 6 · Búsqueda asistida («Buscan casa») — aplazada hasta después del lanzamiento (2026-10-27)
**Decisión de Daniel (2026-10-27, `decisiones.md`):** no entra en la v1. Con pocas casas al principio, una búsqueda llegaría a muy pocos propietarios y el cliente ve todo el catálogo en Explorar; es la parte que más complicaría la app. Se retoma después del lanzamiento (abajo). Lo analizado para retomarla está en `.scratch/fase-6/notas.md`.
**Sustituto en la v1:** en Explorar, «¿No encuentra lo que busca?» con un enlace al WhatsApp de atención a clientes, con un mensaje que ya lleva la zona y las personas de la búsqueda; bnbtico le ayuda a mano (ticket `.scratch/fase-6/issues/01-no-encuentra-whatsapp.md`).
**Cuando se retome, incluía:** el cliente publica lo que busca (zona, fechas, personas, imprescindibles, presupuesto), los propietarios compatibles lo ven en su panel y le escriben por WhatsApp con consentimiento del cliente; caducidad y límites del prototipo. **Hecho cuando:** un «Buscan casa» creado desde un móvil aparece al owner de una casa compatible y no al de una incompatible.

### Pasada de escritorio (antes de la fase 7; decidido el 2026-10-26)
**En espera (decisión de Daniel, 2026-10-27):** se hace cuando todas las pantallas del móvil estén definidas y probadas. El borrador ya hecho (inventario de 24 pantallas y maquetas de la navegación E01–E04: barra superior para el cliente, lateral de 232 px para propietario y admin, desde 1024 px) está en `.scratch/escritorio/inventario.md` y `design/pantallas/escritorio/`, sin aprobar.
**Objetivo:** toda la app con un diseño propio en ordenador, no solo la columna de teléfono centrada.
**Incluye:** primero el diseño en el lienzo (navegación de escritorio: barra superior o lateral, tomando como base la lateral de 232 px del admin del diseño v1; rejillas y anchos por pantalla) y después cada pantalla del cliente y del propietario, incluidas las de la fase 5 (la 6 quedó aplazada). Explorar y la ficha ya tienen versión de escritorio desde la revisión UX del 2026-10-26 (`.scratch/revision-ux/`).
**No incluye:** cambiar lo que carga el móvil (presupuestos y puertas de CI iguales).
**Hecho cuando:** cada pantalla se ve bien a 1280 px y a 1024 px, sin romper el móvil, con capturas de las dos.

### Fase 7 · Lanzamiento
**Objetivo:** abrir bnbtico.com.
**Incluye:** (la web ya vive en Cloudflare Workers desde la fase R; Vercel se da de baja en el corte) borrar datos de prueba, cargar las primeras casas reales con sus propietarios (ellos publican; nosotros acompañamos), privacidad y condiciones de uso publicadas, números de WhatsApp de bnbtico reales, Meta aprobada o Twilio en producción, prueba de restauración de la copia diaria (que existe desde la fase R) y decisión sobre Supabase Pro, un panel mínimo de salud sobre las tablas de errores y `web_vitals` y los Workers Logs, landing abierta.
**Hecho cuando:** un cliente que no conocemos escribe a un owner que no conocemos.

## Después del lanzamiento (en este orden salvo que cambie)

1. **v1.1 · Veriff opcional**: sello «Identidad verificada», sugerencia saltable al contactar y publicar, orden del catálogo. Requiere contrato con Veriff y la revisión jurídica pendiente (`privacidad-verificaciones.md`).
2. **Cobro real**: pasarela local (Tilopay / ONVO Pay / Greenpay, por decidir con sus condiciones) con tarjeta recurrente y SINPE Móvil; ₡2.900 al mes por casa. Requiere empresa y cuenta bancaria en Costa Rica.
3. **Búsqueda asistida («Buscan casa», la antigua fase 6)**: retomarla cuando el sustituto de WhatsApp lo pida (clientes que piden casa a menudo por el WhatsApp de atención) o cuando una provincia tenga muchas más casas de las que un cliente revisa a mano. Punto de partida: `.scratch/fase-6/notas.md`.
4. **App en tiendas**: envoltorio de la web (Capacitor) con compartir nativo y apertura nativa de WhatsApp, publicado en Google Play y App Store.

## En paralelo desde ya (no es código, y tarda más que el código)

- Empresa y cuenta bancaria en Costa Rica (pasarela, Meta, facturación).
- Cuenta de empresa de Meta para WhatsApp (verificación del negocio y plantillas); mientras, Twilio.
- Textos legales: privacidad y condiciones de uso, antes de la fase 7.
- Números de WhatsApp de bnbtico para clientes y para propietarios.

## Cómo trabajamos cada fase

1. Antes de tocar código, se repasa la pantalla en el prototipo (vista Móvil) y sus pruebas.
2. Primero la prueba (Vitest o Playwright), luego el código.
3. Se despliega a `pruebas.bnbtico.com` (`nueva.bnbtico.com` durante la fase R) y se prueba con el móvil de verdad.
4. Decisiones nuevas a `docs/decisiones.md`; cambios de alcance a este plan.
5. Commit por fase o por paso completo, en español e imperativo.
