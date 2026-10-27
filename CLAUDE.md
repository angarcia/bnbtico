# bnbtico (repo CasaTica)

Catálogo de casas en alquiler en Costa Rica, con foco inicial en el Caribe (Limón). Los propietarios publican; los clientes les escriben **por WhatsApp directo**. bnbtico no gestiona reservas ni pagos entre partes: cobra una suscripción por casa activa al propietario, sin comisiones. `AGENTS.md` es un enlace simbólico a este archivo: una sola fuente de instrucciones.

## Lo primero

1. **El diseño v1 manda** (desde 2026-10-20): `docs/diseno-v1.md` y las pantallas de `design/pantallas/` fijan aspecto, estructura y copy de cada pantalla; tokens en `design/tokens/tokens.json` 0.2.0 y logo en `design/logo/`. El prototipo (`design/prototype/casatica-prototipo.html` + módulos, vista **Móvil**) sigue siendo la referencia de comportamiento donde el diseño no diga otra cosa; sus pruebas en `tests/prototype/*.cjs` deben pasar. Si dos documentos se contradicen, manda el más reciente.
2. **Móvil primero.** Web para el teléfono en bnbtico.com (PWA); la vista web es un derivado. App en tiendas después del lanzamiento, envolviendo la misma web.
3. **El plan de construcción está en `docs/plan-implementacion.md`.** Fases 0–7, qué entra en v1 y qué no. No lanzar a trozos: todo se prueba en `pruebas.bnbtico.com` y bnbtico.com se abre cuando la v1 esté completa.
4. **Las decisiones y su porqué están en `docs/decisiones.md`** (la más reciente arriba). Si cambias una decisión, anótala ahí el mismo día.
5. Trabajamos en español. UI en español de Costa Rica tratando al usuario de **usted** («¿No encuentra lo que busca?», «Toque el corazón…», «Puede añadirlo después»): suena tico, respetuoso y de confianza. Sin voseo ni tuteo en la interfaz (decisión 2026-10-20).

## Reglas de producto vigentes (2026-10-15)

- **WhatsApp es el único canal.** Cliente → propietario: botón «Contactar por WhatsApp» que abre `wa.me` con un mensaje redactado (casa, fechas, personas). Propietario → cliente: desde Mis consultas, directo a WhatsApp. Usuarios → bnbtico: dos números de WhatsApp, uno para clientes y otro para propietarios. Sin chat interno, sin números intermediarios, sin flujo de reclamaciones en la app.
- **WhatsApp verificado por código es lo único obligatorio** para publicar o contactar. Explorar y guardar favoritos no requiere cuenta.
- **Veriff (identidad) es opcional y queda fuera de la v1** (va en v1.1). En v1 no se muestra nada de identidad.
- **Estados de una casa:** Pendiente de revisión → Pendiente de pago → Activa → Inactiva (si el propietario para la suscripción). Las casas con oferta gratuita saltan «Pendiente de pago» hasta que termina la oferta. Avisos por WhatsApp y en la app a 90/30/7/0 días del fin de la oferta, con enlace `#pago=CT-xxxx` a la pantalla de método de pago. El enlace de una ficha parada o pendiente de pago deja de funcionar. «Añadir método de pago» solo aparece mientras no hay método y toca avisar.
- **Precios en colones**, siempre orientativos; el cliente puede verlos convertidos a dólares (solo visualización). Nunca «total a pagar».
- **Caribe por defecto:** Explorar arranca en Limón; en los filtros solo aparecen provincias con casas; una casa aprobada de otra zona añade su provincia.
- **Características (una sola lista, igual al publicar y al filtrar):** Piscina, Mascotas, Wifi, Aire acondicionado, Parqueo, Cargador eléctrico, Niños pequeños gratis, Frente al mar, Rancho/BBQ.
- **Modalidad y tipo (diseño v1):** una casa es Vacacional, Mensual o las dos, con un precio por modalidad; es Alojamiento completo o Habitación (con baño privado o compartido).
- «Mensual» en vez de «Largo plazo» en toda la UI (la landing no se toca).
- Los propietarios podrán valorar a los clientes; no hay reseñas de casas.
- Promoción de lanzamiento: primeras 50 casas 12 meses gratis, siguientes 50 seis meses, siguientes 100 tres meses; después ₡2.900 al mes por casa, sin permanencia (₡9.900 hasta el 2026-10-27).

## Arquitectura vigente (decisión 2026-10-21; fase R construida en `apps/app`, pendiente del corte)

- **App client-first:** Vite + React 19 + TanStack Router + TanStack Query, TypeScript estricto. Vive en `apps/app` (tickets 01–12 de la fase R construidos el 2026-10-23) y pasa a `apps/web` al cortar (guion en `docs/corte-fase-r.md`). La zona con sesión es un shell estático (service worker) que habla **directamente con PostgREST** con el JWT del usuario; la caché de Query se persiste en IndexedDB; escrituras optimistas. **Una sola ruta con SSR**: `/casa/CT-####`, renderizada por el worker (`renderToString`); el mapa y lo que dependa de la sesión se montan tras hidratar, en cajas de tamaño fijo; una prueba de CI falla ante avisos de hidratación. Portada = HTML estático (`apps/app/public/portada.html`, sin JS): el worker la sirve en `/` en producción hasta el lanzamiento (`LAUNCHED` distinto de `"true"`: todo lo demás responde 404 con la portada) y con `/?pronto=1` en pruebas y local, donde `/` sigue llevando a Explorar. Explorar anónimo en cliente.
- **Worker Hono en Cloudflare Workers** (`src/server`): SSR de la ficha, portada, sitemap, robots, `POST /vitals|/errors|/events`, purga de caché (la llama Postgres con `pg_net` y Vault), cron diario (keep-alive y recorte de telemetría); en la fase 5, webhooks de pago y cron de avisos (outbox). La service role key solo vive en el worker. Despliegue con GitHub Actions (`wrangler-action`): `develop` → `nueva.bnbtico.com` (luego `pruebas.bnbtico.com`), `main` → bnbtico.com (entorno `production`, aún sin rutas); las pruebas van delante del deploy, incluida la puerta de Lighthouse. Planes gratuitos de Workers y Supabase hasta que salten sus disparadores (ver `docs/decisiones.md`).
- **Postgres es el backend.** RLS + grants por columna = autorización; RPCs plpgsql = invariantes y transiciones (toda transición es una RPC, la llame el navegador, el worker o `pg_cron`). Reglas del dominio: módulo `src/domain` sin imports de framework; cadenas de PostgREST solo en el adaptador; una interfaz `ListingsApi` con adaptador PostgREST y fake en memoria y **una suite de contrato** contra ambos; tipos generados con `supabase gen types` versionados; una función de consulta por pantalla; invariantes en SQL, flujos en TypeScript. Toda tabla nueva lleva políticas y prueba de contrato **antes** de cualquier pantalla.
- **Seguridad (condiciones aceptadas):** CSP estricta (`script-src 'self'`, sin inline ni terceros en la zona privada; GA fuera de ahí); prohibido `dangerouslySetInnerHTML` (lint); sesión de supabase-js en localStorage detrás de un adaptador de almacenamiento; Turnstile en el formulario del código; **admin con segundo factor exigido en SQL** (`auth.jwt()->>'aal' = 'aal2'` en `is_admin()`), por **app de autenticación (TOTP)**, no por teléfono (decisión 2026-10-23: el MFA por teléfono es del plan Pro de Supabase).
- **Presupuestos (p75 de usuarios reales en Costa Rica):** toque < 50 ms; pantalla visitada < 100 ms sin red; pantalla nueva con sesión < 300 ms; ficha LCP < 1,5 s; PWA instalada < 500 ms; JS privado < 150 KB gz. Puertas en CI: `size-limit`, hidratación, Lighthouse (ficha en frío < 2,0 s y shell instalado < 2,5 s en el perfil móvil). Medición real con `web-vitals` (balizas propias, `docs/telemetria.md`). Daniel prueba desde Vancouver (latencia parecida a Costa Rica); para ancho de banda y CPU, DevTools «Slow 4G» + CPU 4×.
- **Imágenes:** tres variantes JPEG 480/800/1600 generadas en el navegador al subir, `<casa>/<uuid>/<tamaño>.jpg`, caché de un año, `srcset` + `lazy`.

## Convenciones de código (aplicación real, desde la fase 0)

- `apps/web` **hasta el corte de la fase R**: Next.js (App Router) + TypeScript estricto, en Vercel; no recibe más cambios salvo los imprescindibles. `apps/app`: la app nueva (se prueba desde `apps/app` con `pnpm typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`, `lighthouse`). `supabase/`: Postgres con RLS, Storage, `pg_cron`. Sin `apps/mobile`, sin `packages/*`, sin Turborepo.
- Entidades en inglés (`Listing`, `Inquiry`, `Subscription`); copy en español.
- Dinero como entero en colones + `currency`; formato `₡95 000`; cifras tabulares. Dólares solo al mostrar.
- IDs públicos de casa `CT-####`. Enlaces `bnbtico.com/casa/CT-####`.
- Pruebas: Vitest (lógica) y Playwright en viewport móvil (flujos). Primero la prueba, luego el código.
- Commits en español, imperativo. Un commit por paso completo con pruebas en verde.

## Entornos y herramientas (2026-10-19)

- `main` → bnbtico.com (solo portada hasta el lanzamiento); `develop` → pruebas.bnbtico.com (contraseña, Supabase `bnbtico-pruebas`, GA apagado). Cambios de portada: en `main` y luego merge a `develop`. **Durante la fase R:** la app nueva (`apps/app`) se despliega desde `develop` a `nueva.bnbtico.com` en Cloudflare Workers con GitHub Actions, protegida con Cloudflare Access; Vercel sigue sirviendo la app vieja hasta el corte. El corte (DNS, Access de `pruebas`, Vault, retirar `nueva`, borrar `apps/web` y renombrar, merge a `main`, Vercel fuera) sigue `docs/corte-fase-r.md` y no se hace sin la aprobación de Daniel del plan de pruebas. Local de la app nueva: siempre con `supabase start` (no hay proveedor demo). El pendiente de ES256/`getClaims` ya no aplica: ningún servidor verifica JWT.
- Supabase local: `pnpm db:start` / `pnpm db:reset`; `apps/web/.env.local` (no versionado) apunta a él y lleva `SUPABASE_SERVICE_ROLE_KEY` (clave de servicio local, solo para las pruebas `tests/db` y `casas.spec.ts`; la app nunca la usa). Sin variables la app usa el proveedor demo (código 123456) y las pantallas de casas avisan que necesitan Supabase. Números de prueba `8888 1234`, `8777 0001`, `8888 9999` y `8899 0001` (**admin en local**, marcado por `seed_admin`) con código 123456. En `bnbtico-pruebas` los admins son Daniel y Ana (ver `docs/pruebas-manuales-fase-r.md`, A2); `8899 0001` ya no es admin allí. Tras tocar `config.toml`: `supabase stop && supabase start` (`db reset` no lo recarga). `supabase migration new` lee de stdin si no es terminal: en scripts, `< /dev/null`.
- Esquema: nuevas migraciones con `pnpm exec supabase migration new <nombre>` y `pnpm exec supabase db push`; `0001_init.sql` no se edita más. Los cambios de estado de una casa pasan por las RPCs (`submit_listing`, `review_listing`); el trigger `listings_protect` bloquea cualquier otro camino y congela el contenido fuera de `draft`/`changes`. Admin = `profiles.is_admin`. Columnas sensibles: `revoke`/`grant` por columna o vista, además de RLS (la tabla `listings` solo la leen dueño y admin; el público usa `listings_public`).
- Local: `.claude/launch.json` arranca la web vieja (`web`) y la nueva (`app`, Vite + worker en un proceso); Playwright con `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, un solo worker (comparte base y números de prueba) y en Playwright el aviso de los formularios se localiza con `.note[role="alert"]` en la app vieja (Next añade su propio `role="alert"`); `/?pronto=1` muestra la portada (en las dos apps). `apps/web/AGENTS.md` lo genera Next y no se versiona.
- Commits sin línea de coautoría. No acceder a pruebas.bnbtico.com desde herramientas: las comprobaciones del despliegue las hace Daniel; los logs y datos del proyecto Supabase sí se consultan con la API de administración (sesión de la CLI).

## Convenciones del prototipo (mientras siga siendo la referencia)

- Servirlo con `python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype` y abrir `http://127.0.0.1:8765/casatica-prototipo.html`. Estado solo en memoria salvo lo guardado en `localStorage` (cuenta, estado de casas).
- Cada cambio va en un módulo nuevo `design/prototype/<tema>.js` que envuelve `SCREENS[...]` o la función global que toque (`{const previous=X; X=(...)=>...}`) y termina con `render();`. Los cambios de hoy que afectan solo a móvil comprueban `S.dev==='phone'`. Se añade el `<script>` al final del HTML y una prueba `tests/prototype/<tema>.cjs`.
- No regenerar el logo (`design/prototype/assets/bnbtico-original.png`); tokens en `design/tokens/tokens.json`.
- No dar por verificado un cambio de UI por leer el HTML: abrirlo (Playwright o navegador) en vista Móvil.

## Documentación

- `docs/plan-implementacion.md` — fases de construcción, alcance de v1, stack. **Manda sobre `roadmap.md`.**
- `docs/decisiones.md` — registro de decisiones con fecha, la más reciente arriba.
- `docs/antes-de-produccion.md` — lo decidido que se deja para antes del lanzamiento (p. ej. protección contra el abuso del envío de códigos). Revisar al cortar a producción.
- `docs/corte-fase-r.md` — guion del corte de la fase R: pasos en orden con su vuelta atrás, renombrado `apps/app` → `apps/web`, migración pendiente de fotos (`supabase/migrations-pendientes/`) y decisiones abiertas (Google Analytics en la portada).
- `docs/pruebas-manuales-fase-r.md` — plan de pruebas manual único de la fase R desde el teléfono (acciones previas de Daniel y recorridos).
- `docs/pruebas-manuales-revision-ux.md` — plan de pruebas manual de la revisión UX del 2026-10-26/27 (`.scratch/revision-ux/`); manda sobre el de la fase R donde no coincidan.
- `docs/telemetria.md` — balizas de Web Vitals, errores y eventos, consultas p75, CSP, Turnstile y cron.
- `docs/copias-de-seguridad.md` — copia diaria con `pg_dump` a R2 y prueba mensual de restauración.
- `docs/design.md` — pantallas, flujos, calendario, sistema de diseño.
- `docs/configuracion-supabase.md` — cómo crear el proyecto de Supabase y Twilio Verify; variables y secretos de GitHub y Cloudflare que usa el despliegue de la app nueva (y las de Vercel, hasta el corte); paso 8: migraciones de la fase 2 y cuenta admin.
- `docs/pruebas-manuales-fase-2.md` — plan de pruebas manual de la app vieja en pruebas.bnbtico.com (fases 0–2); para la app nueva manda el de la fase R.
- `docs/publicacion.md`, `docs/contacto-whatsapp.md`, `docs/busqueda-asistida.md` — reglas por área. Donde hablen de identidad obligatoria, solicitud/aceptación o reclamaciones, están superadas por las reglas de arriba.
- `docs/architecture.md` — arquitectura vigente (2026-10-21): piezas, los cuatro caminos de petición, sesión y seguridad, módulo de dominio, presupuestos, costes. La versión anterior está en `docs/historico/architecture-hasta-2026-10-21.md`.
- `.scratch/fase-r/spec.md` — especificación de la fase R (reescritura client-first); `.scratch/` es el rastreador de issues local de las skills (ver «Agent skills» abajo).
- `docs/business-model.md`, `docs/vision.md`, `docs/pitch.md`, `docs/marketing.md` — contexto; revisar contra las reglas vigentes antes de citarlos.
- `docs/identidad-y-seguridad.md`, `docs/privacidad-verificaciones.md`, `docs/guia-verificacion-finca.md` — Veriff y titularidad: v1.1 y después.
- `docs/reclamaciones.md`, `docs/chat-privado.md`, `docs/contacto-privado.md`, `docs/roadmap.md`, `docs/resumen-*.md`, `docs/historico/` — históricos. `docs/historico/CLAUDE-hasta-2026-10-12.md` es la versión anterior de este archivo, con todas las notas fechadas.

## Dirección de producto fuera del lanzamiento

Veriff opcional (v1.1), cobro real con pasarela local (Tilopay / ONVO / Greenpay), app en tiendas, valoraciones de clientes, comunidad entre propietarios (idea, no requisito), titularidad registral opcional (exploración, no v1).

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/` in this repo (committed); no external tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as the `Status:` line of each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
