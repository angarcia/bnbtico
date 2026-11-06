# Auditoría: pantallas que encadenan viajes a Supabase

Status: needs-triage (1, 3 y 4 arreglados el 2026-11-05; ver «Estado»)
Fecha: 2026-11-05

## Qué se buscaba

Pantallas donde una petición a Supabase **espera a que termine otra** antes de empezar, como pasaba con el «+» de Mis casas (cuatro viajes seguidos, arreglado en `07ee438`). Cada viaje desde un teléfono en Costa Rica cuesta unos 150–250 ms, así que cada escalón de la cadena se nota.

## Cómo se midió

- **Lectura del código:** métodos de `src/data/postgrest/*` con varias peticiones seguidas, y consultas de las pantallas que esperan datos de otra.
- **Medición:** Playwright en Pixel 7 contra la app local (Vite + Supabase local) y las casas de `pnpm datos:prueba`. Cada pantalla se abre **en frío**: sin caché de datos, con la sesión ya iniciada y sin service worker. A cada petición a Supabase se le añaden **300 ms** de latencia, para que una dependencia real aparezca como un escalón. Se midió como visitante, cliente (`8800 0004`), anfitrión (`8800 0002`) y admin (`8899 0001`, con segundo factor).
- **Límites:**
  - Es el peor caso, una primera visita. Quien vuelve tiene la caché en IndexedDB y ve mucho menos espera.
  - En modo desarrollo los huecos entre peticiones por carga de JS son algo mayores que en producción.
  - No cubre todas las pantallas: quedan fuera los pasos 2–9 del asistente, la edición campo a campo y Revisar edición del admin.

«Niveles» = cuántas peticiones hay en la cadena más larga. Con 1, todo sale en paralelo.

## Resultados (de más a menos importante)

| # | Pantalla | Quién | Cadena | Coste extra aprox. | Prioridad |
| --- | --- | --- | --- | --- | --- |
| 1 | **Explorar** | todos | provincias → `search_listings` | +0,3 s antes de ver las casas | **Alta** |
| 2 | **Favoritos** | cliente | `favorites` → `listings_public` | +0,3 s, **solo en un teléfono donde nunca se usó la cuenta** | Baja (corregido, ver abajo) |
| 3 | **Ficha de mi casa** | anfitrión | casa → (JS de la ficha) → `owner_billing` + `owner_activity` | avisos y cifras ~0,6 s después de la casa | Media |
| 4 | **Calendario** | anfitrión | mis casas → `listing_days` de la primera | +0,3 s antes de ver los días | Media |
| 5 | **Admin: casa, borradores, calendario** | admin | `profiles.is_admin` → lectura (y en calendario, otra vez) | +0,3 s por lectura; el calendario del admin, 4 niveles (~1,5 s) | Media-baja |
| 6 | **Cuenta** | anfitrión | mis casas → `owner_inquiries` → `owner_billing` | lo secundario aparece a ~1,1 s | Baja |
| 7 | **Tarjeta «Publique gratis»** en Explorar y Cuenta | todos | (lista) → `launch_offer_taken` | aparece ~1,2 s después, debajo de la lista | Baja |
| 8 | **Guardar un cambio de una casa publicada** | anfitrión | `save_edit` → leer `listing_edits` | +0,3 s al guardar | Baja-media |

Bien resueltas, sin cadena o con 1 nivel: la ficha pública (`/casa/CT-####`, renderizada en el servidor, 0 peticiones al abrir), Mis casas, la cola de Anuncios del admin (todo en paralelo), Revisar anuncio, el paso 1 del asistente, Actividad y Consultas. La subida de fotos manda las tres variantes en paralelo.

## Detalle y arreglo propuesto

### 1. Explorar: la búsqueda espera a las provincias (alta)

- **Causa:** `ExplorarScreen` no monta `Results` (ni lanza `search_listings`) hasta tener `provincesQuery`, porque `parseFilters` necesita la lista de provincias para decidir la provincia por defecto (`apps/app/src/client/screens/explorar.tsx`, `loading = !provinces || …`).
- **Por qué importa:** es la primera pantalla de cualquiera que llega por primera vez, la de captar clientes, y en frío espera un viaje entero antes de pedir las casas.
- **Arreglo propuesto, de menos a más trabajo:**
  1. Si la URL no trae `prov`, lanzar la búsqueda de Limón (el valor por defecto del Caribe) a la vez que las provincias. Si al llegar las provincias Limón no está, se corrige con una segunda búsqueda, lo que solo pasaría con la base sin casas en Limón.
  2. O que `search_listings` acepte provincia vacía y aplique en SQL la misma regla del valor por defecto: un solo viaje.

### 2. Favoritos: dos lecturas seguidas (baja; corregido tras revisar el código)

**Corrección:** los favoritos se guardan en el teléfono (`favoritesStore`) y la pantalla pide las tarjetas directamente con esos ids: en el uso normal es **un solo viaje**. La cadena medida solo aparece en un teléfono donde la cuenta nunca se había usado, porque la sincronización de arranque (`apps/app/src/client/favorites-sync.ts`) tiene que bajar los favoritos antes. No se arregla por ahora: obligaría a mezclar la sincronización con la caché de tarjetas.


- **Causa:** `favorites.list()` solo trae los `public_id` (`apps/app/src/data/postgrest/inquiries.ts`, `select("created_at, listings_public!inner(public_id)")`), y la pantalla pide después las tarjetas con `getManyPublic(ids)` (`apps/app/src/client/screens/favoritos.tsx`, `favoriteListingsQuery`).
- **Arreglo propuesto:** que la lista de favoritos traiga ya las columnas de la tarjeta con el mismo `listings_public!inner(…)` y guardarlas en la caché de las tarjetas. Un viaje. Sin cuenta, los favoritos están en el teléfono y no cambia nada.

### 3. Ficha de mi casa: suscripción y actividad llegan tarde (media)

- **Causa:** `owner_billing` y `owner_activity` se piden desde componentes que solo se montan cuando ya llegó la casa y se descargó su JS (`EditableFicha`, `lazy`, en `apps/app/src/client/screens/propietario.tsx`). No dependen de los datos de la casa.
- **Arreglo propuesto:** lanzar las dos consultas al abrir la pantalla, en paralelo con la casa, con `prefetchQuery` o `useBilling(userId)` arriba en `CasaPropietarioScreen`. Los avisos de pago y las cifras aparecen a la vez que la casa.

### 4. Calendario: los días esperan a la lista de casas (media)

- **Causa:** el calendario necesita saber qué casa mostrar (la primera de `ownListingsQuery`) antes de pedir `listing_days` (`apps/app/src/client/screens/calendario.tsx`).
- **Arreglo propuesto:** guardar en el teléfono la última casa vista en el calendario y lanzar sus días a la vez que la lista. Si la casa ya no existe, se corrige al llegar la lista. Alternativa: una RPC que devuelva los días de la primera casa junto con la lista.

### 5. Admin: comprobar «es admin» antes de cada lectura (media-baja)

- **Causa:** en `apps/app/src/data/postgrest/admin-edit.ts`, `reader()` hace `profiles.is_admin` **antes** de leer (`drafts`, `days`, `saveStep` sin `known`, que llega a 4 viajes). `admin.ts` lo hace bien, en paralelo con `Promise.all`, pero lanza la misma consulta de `profiles` 2–3 veces a la vez en `/admin`. El calendario del admin la repite: perfil → casa → perfil → días.
- **Arreglo propuesto:** hacer la comprobación como en `admin.ts` (en paralelo con la lectura, descartando el resultado si no es admin) y guardarla en una consulta de TanStack (`["admin-access", userId]`) para que no se repita en cada lectura. La seguridad no cambia: la que manda es la de SQL (`is_admin()` con `aal2`); esta comprobación solo sirve para enseñar el mensaje correcto.

### 6. Cuenta del anfitrión (baja)

- **Causa:** la lista de casas decide si la cuenta es de anfitrión, y solo entonces se piden consultas y suscripción, una tras otra.
- **Arreglo propuesto:** con la sesión de un anfitrión conocido (dato en caché), lanzar `owner_inquiries` y `owner_billing` en paralelo con la lista.

### 7. Tarjeta «Publique su casa gratis» (baja)

- **Causa:** `launch_offer_taken` se pide al montar la tarjeta, que va en un trozo `lazy` debajo de la lista.
- **Arreglo propuesto:** precargarla en reposo, o dejarlo así porque no tapa nada de la pantalla.

### 8. Escrituras con dos viajes (baja-media)

- `owner.saveEdit`: `save_edit` y después leer `listing_edits`. La RPC podría devolver la edición. Se nota al guardar un cambio de una casa publicada.
- `admin-edit.saveStep`: hasta 4 viajes (comprobar admin, leer, guardar, releer). Se arregla en buena parte con el punto 5.
- Favoritos `add` y `remove`: traducen `CT-####` a id y después escriben. La pantalla es optimista, así que no se nota.
- `photos.remove`: la RPC devuelve la ruta y después se borra en Storage. El borrado podría no bloquear la pantalla.

## Estado (2026-11-05)

Arreglados 1, 3 y 4, cada uno con una prueba E2E que retiene la primera petición y comprueba que la otra ya ha salido. Las tres fallaban antes del arreglo. Medido otra vez con 300 ms por petición:

| Pantalla | Antes | Ahora |
| --- | --- | --- |
| Explorar: ver las casas | 2 viajes (~0,85 s) | 1 viaje (~0,5 s): búsqueda y provincias a la vez |
| Ficha de mi casa: avisos y cifras | ~1,1 s, después de la casa | ~0,5 s, a la vez que la casa |
| Calendario (casa en la URL o última usada) | 2 viajes (~0,86 s) | 1 viaje (~0,48 s) |

- **Explorar:** `usePrefetchSearch` en `apps/app/src/client/screens/explorar.tsx`.
- **Ficha:** precarga de `billingQuery`, `activityQuery` y del JS de la ficha editable en `CasaPropietarioScreen`.
- **Calendario:** precarga de `calendarQuery` con `?casa=` o la última casa usada.

Siguen en segundo nivel, sin tapar nada: la tarjeta «Publique gratis» (punto 7) y el contador de Consultas en Explorar y Calendario. Pendientes: 5, 6, 7 y 8.

## Siguiente paso

Elegir qué puntos se arreglan y abrir un ticket por cada uno en esta carpeta, con «No tocar», según la forma de trabajar de las rondas. Mi orden recomendado para lo que queda: 5 y después 8.
