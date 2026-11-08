# Arquitectura de bnbtico (vigente desde el 2026-10-21)

Resumen de la arquitectura decidida el 2026-10-21 tras la revisión de las fases 0–2. El porqué de cada decisión y las alternativas descartadas están en `docs/decisiones.md` (entrada 2026-10-21); el calendario de construcción, en `docs/plan-implementacion.md` (fase R); la especificación de la reescritura, en `.scratch/fase-r/spec.md`. La versión anterior de este documento (monorepo, Expo, MapLibre) está en `docs/historico/architecture-hasta-2026-10-21.md` y no está vigente.

## La idea en una frase

El navegador es el cliente de Postgres. La app es un shell estático que habla con PostgREST con el JWT del usuario; la autorización la hace la base de datos (RLS y grants por columna) y toda transición de estado es una RPC en plpgsql. El único código de servidor es un worker pequeño que renderiza la ficha pública, sirve el sitemap, recibe balizas y, desde la fase 5, el webhook de la pasarela, la sesión de pago y un cron horario que envía los avisos.

## Piezas

La aplicación y el worker viven en `apps/app`, paquete `app`. La retirada de Next del repositorio (2026-11-04) no renombra ese directorio ni modifica los despliegues vigentes de Vercel. El corte de infraestructura sigue siendo una operación separada.

| Pieza | Qué es | Dónde corre |
|---|---|---|
| App | Vite + React 19 + TanStack Router (rutas y parámetros tipados) + TanStack Query (caché persistida en IndexedDB) | Navegador; shell precacheado por un service worker |
| Worker | Hono. SSR de `/casa/CT-####` con `renderToString`, `/sitemap.xml`, `/robots.txt`, `POST /vitals`, `/errors`, `/events`, purga de caché; fase 5: `POST /api/pago/sesion`, `POST /webhooks/stripe` (y la pasarela falsa `/webhooks/fake` + `/_pago-falso/*` solo en local), reloj de pruebas `POST /_pruebas/oferta/CT-####` (404 en producción) y cron horario `17 * * * *` | Cloudflare Workers (plan gratuito hasta un disparador medido), assets estáticos en el mismo worker |
| Base de datos | Postgres con RLS en todas las tablas, grants por columna, vista `listings_public`, RPCs (`submit_listing`, `review_listing`, `set_listing_available`, `listing_link_state`, RPCs de fotos y, desde la fase 5, `owner_billing`, `stop_subscription`/`resume_subscription`, `run_subscription_day`, `claim_reminders`/`finish_reminders`, `apply_payment_event`), trigger `listings_protect`, `pg_cron`/`pg_net` | Supabase (`bnbtico-pruebas` ahora; `bnbtico-prod` en el lanzamiento), us-east-1 |
| Auth | Supabase Auth por teléfono, canal WhatsApp (Twilio Verify); JWT ES256; MFA por app de autenticación (TOTP) para admin | Supabase |
| Storage | Bucket `listings` público para leer, escritura del dueño por carpeta con RLS; tres variantes JPEG por foto | Supabase |
| Despliegue | GitHub Actions: pruebas → build → `wrangler deploy`; `develop` → `nueva.bnbtico.com` (luego `pruebas.bnbtico.com`), `main` → `bnbtico.com` | GitHub + Cloudflare |

**Editar una casa publicada (2026-10-29).** Una casa publicada no vuelve a borrador: los datos al momento (capacidad, características, precios) cambian con `update_listing_live`, y los que pasan por revisión (nombre, tipo, descripción, ubicación y fotos nuevas) van a una edición: `listing_edits` (una por casa, clave `listing_id`; estados `open` → `review` → `changes`, y al aprobarse se borra) y `listing_edit_photos` (sus fotos nuevas, en la misma carpeta de Storage que las aprobadas). Las dos tablas solo se leen por RLS (el dueño y el admin con `aal2`); toda escritura va por RPCs `security definer` (`start_edit`, `save_edit`, `add_edit_photo`, `remove_edit_photo`, `reorder_edit_photos`, `submit_edit`, `discard_edit` y, del admin, `review_edit`, que aplica la edición a `listings` y `listing_photos` en una transacción). Mientras tanto la versión aprobada sigue pública: `listings_public`, el SSR y la búsqueda no leen las tablas de la edición.

No hay API intermedia, ni server actions, ni cookies de sesión en el servidor, ni servicio propio. La service role key solo existe en el entorno del worker.

## Cuatro caminos de petición

1. **Ficha pública desde WhatsApp** (`/casa/CT-1042`). El CDN de Cloudflare sirve el HTML cacheado de esa URL. Si no está en caché, el worker lee `listings_public` con la anon key, renderiza la página con React en servidor, inyecta Open Graph, la precarga del hero y el JSON de la casa en un `<script type="application/json">`, y responde con `s-maxage` largo. El navegador pinta foto, título y precio con el HTML; el JavaScript hidrata después; el mapa y lo que depende de la sesión se montan tras hidratar en cajas de tamaño fijo. Una aprobación, una edición o un cambio de disponibilidad purgan esa URL por la API de la zona (la purga por etiqueta es solo Enterprise; una casa tiene una URL, así que basta). Es la **única ruta con SSR**.
2. **Pantalla pública en la app** (Explorar, Filtros). Shell desde el service worker; datos de `listings_public` y `provinces_with_listings` por PostgREST con la anon key, cacheados por Query (60 s) y persistidos; la moneda es estado local.
3. **Pantalla con sesión** (Mis casas, Publicar, Cuenta, Admin). Shell desde el service worker; la pantalla se pinta desde la caché de Query sin red y se refresca en segundo plano con el JWT; las escrituras son optimistas (navegar primero, guardar en segundo plano, deshacer con el mensaje de la base si falla). Cada pantalla tiene una función de consulta que devuelve el objeto de la pantalla.
4. **Trabajo de servidor** (fase 5). **Pagos:** el navegador pide `POST /api/pago/sesion` con el JWT del usuario (el worker no lo verifica: llama a `payment_setup_context` con ese JWT y PostgREST lo valida) y navega a la página de Stripe Checkout en modo `setup` (guarda la tarjeta, no cobra; la CSP no cambia porque no hay script de terceros). Stripe avisa a `POST /webhooks/stripe`: el worker comprueba la firma (HMAC-SHA256, 5 min de tolerancia), pide el SetupIntent y llama a la RPC `apply_payment_event`, que inserta en `payment_events(provider, event_id)` (único: un evento repetido es `duplicate` y no hace nada), guarda marca/últimos 4/vencimiento e ids opacos en `payment_methods` y pasa las casas pendientes de pago de esa cuenta a activas. Detrás de `PaymentProvider` (Stripe REST con `fetch`, o falsa en local y CI). **Avisos (outbox):** `pg_cron` corre `run_subscription_day` a las 00:05 de Costa Rica (`bnbtico-suscripciones`): vence las ofertas y encola en `subscription_reminders` el umbral 90/30/7/0 de cada casa sin método (clave por casa y umbral: nunca se encola dos veces). El cron **horario** del worker (`17 * * * *`; lo diario —keep-alive, recorte, tipo de cambio— solo a las 09 UTC) reclama de 08:00 a 17:59 de Costa Rica un lote de ≤ 20 con `claim_reminders` (`for update skip locked`, quedan en `sending`), compone el texto con `reminderWhatsApp` del dominio, lo manda por `WhatsAppSender` (Twilio sandbox en pruebas, con lista de números permitidos; falso en local y CI; apagado en producción) y cierra con `finish_reminders` (`sent`; rechazo seguro → otra vez a la cola hasta 5 intentos; sin respuesta → `unknown`, nunca se reenvía). **Reloj de pruebas:** `POST /_pruebas/oferta/CT-####` con `Bearer TEST_CLOCK_SECRET` deja una casa con N días de oferta (`test_set_offer_days_left`, que exige el secreto de Vault `bnbtico_test_clock`, solo en pruebas y local), corre el día y un lote al momento; 404 en producción. La reapertura a medianoche es una sentencia SQL en `pg_cron`.

## Sesión y seguridad

### Importación de Airbnb (#5)

El navegador mantiene el calendario manual y lee `owner_calendar_days`/`airbnb_overview` por PostgREST con su JWT. `POST /api/calendarios/airbnb` es una integración externa del worker: la RPC `begin_airbnb_import` autoriza al dueño y reserva un intento antes de descargar. El worker no verifica el JWT por una vía propia. `airbnb_import_context` reclama el intento una sola vez y `finish_airbnb_import`, solo de servicio, publica una instantánea completa mediante transacción y versión. Reintentos del requestId no duplican la lectura; trabajos obsoletos no reviven conexiones suspendidas o eliminadas.

`airbnb_connections` guarda la URL privada y estado; `airbnb_blocks`, únicamente UID técnico e intervalos; `airbnb_import_attempts`, coordinación. Son tablas con RLS y sin grants al navegador, incluido admin. `listing_days` continúa siendo manual/precios. La proyección `effective_calendar_days` une ambas capas en una ventana de 366 fechas, sin expandir intervalos remotos ilimitados. Ficha, búsqueda y contacto usan la misma ocupación; el contacto se serializa contra el commit de importación. El público no recibe procedencia ni secretos. Admin conserva lectura/edición manual con aal2, sin gestión de conexiones.

Descarga: HTTPS hacia hosts exactos `www.airbnb.ca`/`www.airbnb.com`, ruta y token admitidos, cero redirecciones, plazo completo de 10 s, máximo 1 MiB y 5.000 eventos. El parser admite inicio/fin de día completo con salida excluida, rechaza horas/recurrencias y descarta todo texto personal. Error de red/contenido/tamaño conserva último conjunto válido y fecha de éxito; un calendario completo válido vacío retira solo importados. La purga por casa se solicita al publicar la instantánea, no depende de escribir `listing_days`.

El motor `runAirbnbImport` y la reclamación de servicio se reutilizan en el arnés opt-in local. #5 no añade exportación, interfaces de gestión de #7 ni cron #8. Al suspender administrativamente se invalidan intentos en vuelo; la ocupación anterior se conserva. La programación posterior consumirá el mismo motor para lecturas y recuperación. Guía reproducible: `docs/pruebas-manuales.md`, IC01–IC13. Tipos generados tras aplicar migraciones; firmas finales en `database.types.ts`.

### Sesión de la aplicación

- supabase-js guarda la sesión en localStorage detrás de un adaptador de almacenamiento (Capacitor la moverá a Keychain/Keystore). Token de acceso de 1 h, rotación del refresh con detección de reutilización, logout que revoca.
- El riesgo asumido es XSS con robo de token. Contramedidas obligatorias: CSP estricta (`script-src 'self'`, sin inline ni terceros en la zona privada), prohibición de `dangerouslySetInnerHTML` por lint, Turnstile en el formulario del código, y **MFA por app de autenticación (TOTP) para admin exigida en SQL** (`auth.jwt()->>'aal' = 'aal2'` en políticas y RPCs de admin).
- Lo que expone un token robado: las casas del propio usuario (con su dirección exacta), sus favoritos y consultas; nunca dinero. El de admin, además, los teléfonos de todos los perfiles y la cola de revisión: por eso el `aal2`.
- Ningún dato de tarjeta pasa por bnbtico (fase 5): la tarjeta se escribe en la página de la pasarela; la base guarda solo ids opacos (que el navegador no puede leer, por grants de columna), marca, últimos 4 y vencimiento; los logs del worker solo llevan id, tipo y resultado de cada evento.
- El número de WhatsApp del propietario es público por diseño en una casa activa; la dirección exacta y las coordenadas exactas no salen de `listings` (la vista las desplaza 150–499 m).

## Módulo de dominio

Un módulo TypeScript sin imports de framework: tipos generados de la base (`supabase gen types`, versionados y comprobados en CI), esquemas zod y validación por paso (los filtros de la URL se leen a mano para que zod no entre en el JS inicial, 2026-11-03), mapeo tipado de filas, `describe(listing)` (precio principal, unidad, situación, enlace para compartir) y `can(listing, acción)` que refleja las reglas SQL. Dos interfaces, `ListingsApi` y `AuthApi`, con dos adaptadores cada una: PostgREST (el único archivo que importa supabase-js y conoce las columnas) y un fake en memoria que aplica propiedad y estados. **Una sola suite de contrato** corre contra los dos, así el fake no puede desviarse de la RLS. Invariantes en SQL; flujos en TypeScript; sin nuevo plpgsql de flujo.

## Rendimiento

Presupuestos como p75 de usuarios reales en Costa Rica: toque < 50 ms; pantalla visitada < 100 ms sin red; pantalla nueva con sesión < 300 ms; ficha LCP < 1,5 s; PWA instalada < 500 ms; JS inicial privado < 160 KB gz (ampliación autorizada el 2026-11-04). Puertas en CI: `size-limit`, prueba de hidratación, Lighthouse CI (móvil, CPU 4×, RTT 150 ms). Medición real con `web-vitals` → `web_vitals` (país del encabezado de Cloudflare). Las fotos se suben en tres variantes JPEG (480/800/1600) con caché de un año y `srcset` + `lazy`.

## Costes y disparadores

0 USD hasta el lanzamiento (Workers y Supabase gratuitos) más Twilio. Workers de pago (5 USD) ante un error de límite de CPU, p95 de `cpuTime` > 7 ms o > 50 000 peticiones/día. Supabase Pro (25 USD) a 800 MB de Storage, 4 GB de egreso al mes o 400 MB de base. Desde la primera semana: copia diaria con `pg_dump` a R2 desde GitHub Actions.

## Lo que no está (a propósito)

API propia, servicio en Go (opción cuando el worker pase de ~1 500 líneas o un trabajo dure > 30 s), SSR fuera de la ficha, escrituras offline, Realtime, Sentry, WebP, transformaciones de imagen en servidor, páginas por provincia. Cada una tiene su disparador o su fase en `docs/decisiones.md`.
