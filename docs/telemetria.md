# Telemetría, CSP y protección de bots (fase R, ticket 11)

Cómo sabe el operador qué tal va la app para usuarios reales, y qué la protege. Todo de primera parte: sin cookies, sin
terceros salvo Turnstile en Ingresar.

## Balizas

| Ruta del worker | Qué manda el navegador | Tabla |
|---|---|---|
| `POST /vitals` | LCP, INP y CLS de `web-vitals` (trozo `vitals-*.js` que se importa tras `load`), con la ruta de aterrizaje | `web_vitals` |
| `POST /errors` | errores no capturados y promesas rechazadas (como mucho 5 por carga), con mensaje, pila, ruta y build | `client_errors` |
| `POST /events` | `page_view` (una por ruta resuelta en el shell; una al hidratar la ficha SSR), `listing_view` (ficha montada; no se manda si quien la abre es su dueño, según la lista de casas propias que Mis casas deja en el teléfono, ni desde la vista previa del asistente: revisión UX A2 y C4), `whatsapp_tap` (marcador en el botón «Contactar por WhatsApp», que hoy está deshabilitado), `inquiry_created` (fase 3: consulta registrada con `create_inquiry`; solo la casa, nada personal; la base lo acepta desde la migración `fase3_consultas`), `wizard_step` (revisión UX C4: cada pantalla del asistente de publicar que se abre, con la casa y la ruta `/propietario/publicar/:id/<paso>`; migración `evento_paso_asistente`), `search_help_tap` (fase 6, ticket 01: toque de «Escribir a bnbtico por WhatsApp» en Explorar, «¿No encuentra lo que busca?»; sin casa y sin el mensaje ni los filtros: la ruta queda en `/explorar`; migración `evento_ayuda_busqueda`. Si la base aún no lo acepta, el worker responde 204 igual y registra `beacon_write_failed`), `search_submit` (2026-10-29: «Buscar» en la búsqueda; sin casa y sin valores, solo qué partes iban puestas en `search_flags`: `zona`, `fechas`, `personas`; «fechas» cuenta únicamente las fechas que de verdad se mandan), `publish_verify` (2026-10-29: se abre la verificación del WhatsApp de `/publicar/verificar` tras el paso 1; sin casa), `explore_map_open` (se abre el mapa a pantalla completa; sin casa) y `map_marker_tap` (toque en un marcador; con la casa); migración `explorar_fechas_y_zona` | `events` |

- El navegador usa `navigator.sendBeacon` (o `fetch` con `keepalive`): sobrevive a cerrar la pestaña o a salir hacia WhatsApp. Código en `src/shared/beacon.ts` y `src/client/vitals.ts`.
- Solo se guarda la **ruta** (sin consulta ni fragmento y con los uuid cambiados por `:id`), el tipo de página (`pageType` en `src/domain/telemetry.ts`: `inicio`, `explorar`, `filtros`, `buscar`, `ficha`, `favoritos`, `cuenta`, `ayuda`, `publicar`, `propietario`, `admin`, `otra`), el build (`__BUILD_ID__` = los 12 primeros caracteres del commit) y el **país**, que añade el worker desde `request.cf.country` (o la cabecera `CF-IPCountry`). Los errores llevan además el user agent (recortado a 300).
- `monthly_filter_tap` (el chip «Solo alquiler mensual») se fue con el modo mensual de Explorar (2026-11-02): el worker ya no lo acepta (400) y no se escribe; la base conserva el nombre en `events_name_check` por las filas de antes.
- El worker (`src/server/app.ts`) rechaza: otro origen (403), más de 8 KB (413, también por `Content-Length` antes de leer), JSON roto o fuera de forma (400). Escribe con la **service role** (`src/data/postgrest/telemetry.ts`, fetch a PostgREST) después de responder (`waitUntil`). Sin `SUPABASE_SERVICE_ROLE_KEY` responde 204 y descarta.
- Las tres tablas (migración `20261023084120_telemetria.sql`) tienen RLS sin políticas y **ningún privilegio** para `anon` ni `authenticated` (lo comprueba `tests/db/telemetria.test.ts`). Se leen desde el SQL Editor del proyecto o con la API de administración.
- **Retención:** el cron diario del worker borra lo de más de 90 días (`TELEMETRY_RETENTION_DAYS` en `src/server/cron.ts`), para no gastar el plan gratuito de la base.

## Consultas

p75 de LCP por tipo de página para usuarios en Costa Rica (últimos 28 días; el presupuesto de la ficha es < 1,5 s):

```sql
select page,
       round(percentile_cont(0.75) within group (order by value)) as lcp_p75_ms,
       count(*) as muestras
from public.web_vitals
where name = 'LCP'
  and country = 'CR'
  and created_at > now() - interval '28 days'
group by page
order by page;
```

Nota: la búsqueda a pantalla completa es la ruta `/explorar/buscar` (tipo de página `buscar`, trozo diferido). Aparece como fila propia en esta consulta; compare su p75 con el de `explorar` aparte: un trozo diferido sin precargar sube su LCP y no debe mezclarse con el de la lista.

Lo mismo para INP (`name = 'INP'`, ms; presupuesto de toque < 50 ms es más estricto que el «bueno» de Google, 200 ms) o CLS (`name = 'CLS'`, sin unidades). Otras útiles:

```sql
-- Errores más frecuentes de la última semana, por build
select build, message, count(*) from public.client_errors
where created_at > now() - interval '7 days' group by 1, 2 order by 3 desc limit 20;

-- Desde el 2026-10-27 la pantalla 3 (mapa) no existe: la 2, «¿Dónde está su casa?», la incluye. Los números de la ruta son ids
-- de pantalla, no posiciones; los datos de antes y después se comparan tal cual salvo el 3.
-- Asistente de publicar: cuántos borradores llegan a cada paso (30 días). La caída entre un paso y el siguiente dice
-- dónde se abandona; decidir con esto si sobra, se une o se reordena alguna pantalla (revisión UX C4).
select split_part(path, '/', 5)::int as paso, count(distinct listing_public_id) as borradores
from public.events where name = 'wizard_step' and created_at > now() - interval '30 days'
group by 1 order by 1;

-- Embudo de publicar sin cuenta (2026-10-29): page_view de /publicar -> publish_verify -> wizard_step en el paso 2
-- (/propietario/publicar/:id/2). La caída entre cada par dice dónde se pierde la gente antes y después de verificar.
-- «paso_2» es aproximado: cuenta también los borradores de propietarios que ya tenían sesión (no pasan por
-- publish_verify), así que puede salir mayor que «verificacion»; léalo como techo, no como conversión exacta.
select 'entrada' as etapa, count(*) from public.events where name = 'page_view' and path = '/publicar' and created_at > now() - interval '30 days'
union all select 'verificacion', count(*) from public.events where name = 'publish_verify' and created_at > now() - interval '30 days'
union all select 'paso_2', count(distinct listing_public_id) from public.events
where name = 'wizard_step' and path like '/propietario/publicar/%/2' and created_at > now() - interval '30 days';

-- «¿No encuentra lo que busca?» (fase 6): toques por semana (de Costa Rica) en las últimas 12 semanas. Cuando lleguen a
-- menudo, toca retomar «Buscan casa» (docs/decisiones.md, 2026-10-27).
select date_trunc('week', created_at at time zone 'America/Costa_Rica')::date as semana, count(*) as toques
from public.events where name = 'search_help_tap' and created_at > now() - interval '12 weeks'
group by 1 order by 1;

-- Búsquedas de Explorar (2026-10-29): cuántas llevaban zona, fechas y personas (12 semanas). No se guardan los valores.
select date_trunc('week', created_at at time zone 'America/Costa_Rica')::date as semana,
       count(*) as busquedas,
       count(*) filter (where 'zona' = any(search_flags)) as con_zona,
       count(*) filter (where 'fechas' = any(search_flags)) as con_fechas,
       count(*) filter (where 'personas' = any(search_flags)) as con_personas
from public.events where name = 'search_submit' and created_at > now() - interval '12 weeks'
group by 1 order by 1;

-- El propietario ve sus propias cifras con la RPC owner_listing_stats (visitas y consultas de 30 días, revisión UX A2).
-- Vistas de ficha y toques de WhatsApp por casa (30 días)
select listing_public_id, count(*) filter (where name = 'listing_view') as vistas, count(*) filter (where name = 'whatsapp_tap') as whatsapp
from public.events where created_at > now() - interval '30 days' and listing_public_id is not null
group by 1 order by 2 desc;
```

## CSP

Una sola fuente: `src/shared/security.ts` (`contentSecurityPolicy`, `securityHeaders`).

- **Ficha y páginas de estado** (HTML que genera el worker): las cabeceras van en la respuesta, también en la que se guarda en la caché del borde. Sin Turnstile (`frame-src 'none'`).
- **Shell y estáticos** (los sirve Workers Static Assets sin pasar por el worker): el build añade un bloque `/*` a `dist/client/_headers` (plugin `bnbtico:security-headers` en `vite.config.ts`) con la URL de Supabase de ese build (`VITE_SUPABASE_URL`, la misma que usa el navegador). Se eligió `_headers` y no pasar el shell por el worker para no gastar invocaciones del worker en cada navegación; `vite preview` respeta el archivo, así que Playwright corre con la CSP aplicada.
- En `vite dev` no hay CSP (Vite inyecta scripts en línea para React Refresh).
- Política: `default-src 'self'`; `script-src 'self'` (+ `https://challenges.cloudflare.com` en el shell); `style-src 'self'` **sin `'unsafe-inline'`** (no hay atributos `style` en el HTML; Leaflet y Turnstile cambian estilos por CSSOM, que la CSP no bloquea: comprobado en Playwright con mapas y Turnstile reales); `img-src 'self' data: blob:` + Supabase + teselas de OSM; `connect-src 'self'` + Supabase + teselas (el service worker las pide con fetch); `frame-src` solo Turnstile en el shell; `font-src`, `worker-src`, `manifest-src` `'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. Además `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` (geolocalización solo del propio origen, para «Usar mi ubicación»).
- El JSON de la ficha va en `<script type="application/json">`: es dato, el navegador no lo ejecuta y la CSP no lo bloquea.
- **Pruebas:** todas las de Playwright usan `tests/e2e/helpers/test.ts`, que falla ante cualquier violación en el documento de la app (evento `securitypolicyviolation` o aviso de consola). `seguridad.spec.ts` comprueba las cabeceras y que un script en línea inyectado no corre.
- **Regla de «lint»:** `tests/unit/architecture.test.ts` prohíbe `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML =`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, atributos `style={…}` en JSX y scripts o estilos en línea en `index.html`. Corre en `pnpm test` y **antes de `pnpm build`** (el script de build la ejecuta primero y falla si algo aparece). Se prefirió a ESLint para no añadir una cadena de dependencias por una regla.

## Turnstile

- Widget invisible («interaction-only») en **Ingresar** y en **Código** (pedir otro código); cada envío de código gasta un token (`options.captchaToken` de `signInWithOtp`, que GoTrue comprueba con Cloudflare). El script se pide solo al abrir esas pantallas (`src/client/turnstile.ts`), nunca en el JS inicial.
- Sitekey en `VITE_TURNSTILE_SITE_KEY` (variable de GitHub `TURNSTILE_SITE_KEY` en el despliegue). Local y CI: la de prueba de Cloudflare `1x00000000000000000000AA` (siempre pasa y da el token `XXXX.DUMMY.TOKEN.XXXX`), que escribe `pnpm dev:vars`.
- En **Supabase local la protección de bots está apagada**: encenderla obligaría a que todas las pruebas de base y los arneses mandaran token y llamaran a Cloudflare en cada código. Se comprobó una vez encendida (`[auth.captcha]` con el secreto de prueba `1x0000000000000000000000000000000AA`): sin token GoTrue responde 400 `captcha_failed` y los recorridos de `cuenta.spec.ts` por la interfaz pasan.
- Si Supabase rechaza el token, el mensaje es «No pudimos comprobar que usted es una persona. Recargue la página e intente de nuevo.».

## Cron diario

`triggers.crons` `17 9 * * *` (03:17 en Costa Rica) en cada entorno de `wrangler.jsonc` (no se heredan). `src/server/cron.ts`: una lectura de `listings_public` con la anon key (el proyecto gratuito de Supabase se pausa tras 7 días sin actividad), el recorte de telemetría y una línea de log JSON (`{"event":"keepalive","ok":true,"status":200,"ms":…,"cron":…,"environment":…,"pruned":…}`) visible en Workers Logs. Si PostgREST falla, la ejecución queda como fallida en el panel.

## `db-max-rows`

PostgREST devuelve como mucho 200 filas por petición. Local: `[api] max_rows = 200` en `supabase/config.toml`. Alojado: panel del proyecto → **Project Settings → Data API → Max rows** = 200 (paso manual de Daniel; ver `docs/configuracion-supabase.md`, paso 9). Explorar pide 60 como mucho y la cola del admin 50 rechazadas; el sitemap pide hasta 1000 (`SITEMAP_LIMIT`) pero PostgREST lo corta en 200: hay que paginarlo antes de pasar de 200 casas activas.
