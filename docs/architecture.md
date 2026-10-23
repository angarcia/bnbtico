# Arquitectura de bnbtico (vigente desde el 2026-10-21)

Resumen de la arquitectura decidida el 2026-10-21 tras la revisión de las fases 0–2. El porqué de cada decisión y las alternativas descartadas están en `docs/decisiones.md` (entrada 2026-10-21); el calendario de construcción, en `docs/plan-implementacion.md` (fase R); la especificación de la reescritura, en `.scratch/fase-r/spec.md`. La versión anterior de este documento (monorepo, Expo, MapLibre) está en `docs/historico/architecture-hasta-2026-10-21.md` y no está vigente.

## La idea en una frase

El navegador es el cliente de Postgres. La app es un shell estático que habla con PostgREST con el JWT del usuario; la autorización la hace la base de datos (RLS y grants por columna) y toda transición de estado es una RPC en plpgsql. El único código de servidor es un worker pequeño que renderiza la ficha pública, sirve el sitemap, recibe balizas y, en la fase 5, webhooks y un cron.

## Piezas

| Pieza | Qué es | Dónde corre |
|---|---|---|
| App | Vite + React 19 + TanStack Router (rutas y parámetros tipados) + TanStack Query (caché persistida en IndexedDB) | Navegador; shell precacheado por un service worker |
| Worker | Hono. SSR de `/casa/CT-####` con `renderToString`, `/sitemap.xml`, `/robots.txt`, `POST /vitals`, `/errors`, `/events`, purga de caché; fase 5: `POST /webhooks/pagos/:proveedor` y cron diario | Cloudflare Workers (plan gratuito hasta un disparador medido), assets estáticos en el mismo worker |
| Base de datos | Postgres con RLS en todas las tablas, grants por columna, vista `listings_public`, RPCs (`submit_listing`, `review_listing`, `set_listing_available`, `listing_link_state`, RPCs de fotos), trigger `listings_protect`, `pg_cron`/`pg_net` | Supabase (`bnbtico-pruebas` ahora; `bnbtico-prod` en el lanzamiento), us-east-1 |
| Auth | Supabase Auth por teléfono, canal WhatsApp (Twilio Verify); JWT ES256; MFA por app de autenticación (TOTP) para admin | Supabase |
| Storage | Bucket `listings` público para leer, escritura del dueño por carpeta con RLS; tres variantes JPEG por foto | Supabase |
| Despliegue | GitHub Actions: pruebas → build → `wrangler deploy`; `develop` → `nueva.bnbtico.com` (luego `pruebas.bnbtico.com`), `main` → `bnbtico.com` | GitHub + Cloudflare |

No hay API intermedia, ni server actions, ni cookies de sesión en el servidor, ni servicio propio. La service role key solo existe en el entorno del worker.

## Cuatro caminos de petición

1. **Ficha pública desde WhatsApp** (`/casa/CT-1042`). El CDN de Cloudflare sirve el HTML cacheado de esa URL. Si no está en caché, el worker lee `listings_public` con la anon key, renderiza la página con React en servidor, inyecta Open Graph, la precarga del hero y el JSON de la casa en un `<script type="application/json">`, y responde con `s-maxage` largo. El navegador pinta foto, título y precio con el HTML; el JavaScript hidrata después; el mapa y lo que depende de la sesión se montan tras hidratar en cajas de tamaño fijo. Una aprobación, una edición o un cambio de disponibilidad purgan esa URL por la API de la zona (la purga por etiqueta es solo Enterprise; una casa tiene una URL, así que basta). Es la **única ruta con SSR**.
2. **Pantalla pública en la app** (Explorar, Filtros). Shell desde el service worker; datos de `listings_public` y `provinces_with_listings` por PostgREST con la anon key, cacheados por Query (60 s) y persistidos; la moneda es estado local.
3. **Pantalla con sesión** (Mis casas, Publicar, Cuenta, Admin). Shell desde el service worker; la pantalla se pinta desde la caché de Query sin red y se refresca en segundo plano con el JWT; las escrituras son optimistas (navegar primero, guardar en segundo plano, deshacer con el mensaje de la base si falla). Cada pantalla tiene una función de consulta que devuelve el objeto de la pantalla.
4. **Trabajo de servidor** (fase 5). El worker recibe el webhook de la pasarela, comprueba la firma, inserta en `payment_events` (clave única por proveedor y evento: idempotencia) y llama a la RPC `apply_payment_event`. `pg_cron` encola los avisos a 90/30/7/0 días en `subscription_reminders` (patrón outbox) y el cron diario del worker los envía por WhatsApp y marca `sent_at`. La reapertura a medianoche es una sentencia SQL en `pg_cron`.

## Sesión y seguridad

- supabase-js guarda la sesión en localStorage detrás de un adaptador de almacenamiento (Capacitor la moverá a Keychain/Keystore). Token de acceso de 1 h, rotación del refresh con detección de reutilización, logout que revoca.
- El riesgo asumido es XSS con robo de token. Contramedidas obligatorias: CSP estricta (`script-src 'self'`, sin inline ni terceros en la zona privada), prohibición de `dangerouslySetInnerHTML` por lint, Turnstile en el formulario del código, y **MFA por app de autenticación (TOTP) para admin exigida en SQL** (`auth.jwt()->>'aal' = 'aal2'` en políticas y RPCs de admin).
- Lo que expone un token robado: las casas del propio usuario (con su dirección exacta), sus favoritos y consultas; nunca dinero. El de admin, además, los teléfonos de todos los perfiles y la cola de revisión: por eso el `aal2`.
- El número de WhatsApp del propietario es público por diseño en una casa activa; la dirección exacta y las coordenadas exactas no salen de `listings` (la vista las desplaza 150–499 m).

## Módulo de dominio

Un módulo TypeScript sin imports de framework: tipos generados de la base (`supabase gen types`, versionados y comprobados en CI), esquemas zod y validación por paso, mapeo tipado de filas, `describe(listing)` (precio principal, unidad, situación, enlace para compartir) y `can(listing, acción)` que refleja las reglas SQL. Dos interfaces, `ListingsApi` y `AuthApi`, con dos adaptadores cada una: PostgREST (el único archivo que importa supabase-js y conoce las columnas) y un fake en memoria que aplica propiedad y estados. **Una sola suite de contrato** corre contra los dos, así el fake no puede desviarse de la RLS. Invariantes en SQL; flujos en TypeScript; sin nuevo plpgsql de flujo.

## Rendimiento

Presupuestos como p75 de usuarios reales en Costa Rica: toque < 50 ms; pantalla visitada < 100 ms sin red; pantalla nueva con sesión < 300 ms; ficha LCP < 1,5 s; PWA instalada < 500 ms; JS inicial privado < 150 KB gz. Puertas en CI: `size-limit`, prueba de hidratación, Lighthouse CI (móvil, CPU 4×, RTT 150 ms). Medición real con `web-vitals` → `web_vitals` (país del encabezado de Cloudflare). Las fotos se suben en tres variantes JPEG (480/800/1600) con caché de un año y `srcset` + `lazy`.

## Costes y disparadores

0 USD hasta el lanzamiento (Workers y Supabase gratuitos) más Twilio. Workers de pago (5 USD) ante un error de límite de CPU, p95 de `cpuTime` > 7 ms o > 50 000 peticiones/día. Supabase Pro (25 USD) a 800 MB de Storage, 4 GB de egreso al mes o 400 MB de base. Desde la primera semana: copia diaria con `pg_dump` a R2 desde GitHub Actions.

## Lo que no está (a propósito)

API propia, servicio en Go (opción cuando el worker pase de ~1 500 líneas o un trabajo dure > 30 s), SSR fuera de la ficha, escrituras offline, Realtime, Sentry, WebP, transformaciones de imagen en servidor, páginas por provincia. Cada una tiene su disparador o su fase en `docs/decisiones.md`.
