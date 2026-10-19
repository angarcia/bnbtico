# Fase 2 · Publicar una casa, aprobarla y verla · diseño

Fecha: 2026-10-19. Estado: aprobado; plan en `docs/superpowers/plans/2026-10-19-fase-2-publicar-aprobar-ver.md`.
Manda sobre este documento el prototipo (vista Móvil) y, si se contradicen, `docs/plan-implementacion.md` por ser más reciente que `docs/publicacion.md`.

## 1. Objetivo y criterio de «hecho»

Un propietario publica su casa desde el móvil, el admin la aprueba y cualquiera abre `bnbtico.com/casa/CT-####` en otro teléfono y ve la casa completa, con vista previa en WhatsApp. El flujo entero está en Playwright contra Supabase local.

Dentro: formulario de publicación en cinco pasos, fotos a Storage, admin mínimo, catálogo con filtros, ficha pública, Mis casas con detalle de gestión.
Fuera: contacto, calendario editable, suscripción y estados de pago, Veriff, reclamaciones, «Buscan casa».

## 2. Decisiones tomadas en este diseño

| Decisión | Elegido | Alternativa descartada |
|---|---|---|
| Dónde viven las casas | Solo Supabase (local, pruebas, producción). El proveedor `demo` sigue para la cuenta; las pantallas de casas muestran un aviso si no hay Supabase. | Almacén en memoria para demo, con doble implementación. |
| Mapa aproximado | Pin real con Leaflet + teselas de OpenStreetMap; se guarda lat/lng; la ficha muestra un círculo con jitter determinista de ~500 m. | Solo texto; geocodificación por zona. |
| Quién es admin | `profiles.is_admin`, que RLS ya conoce. En pruebas lo activa Daniel con SQL; en local lo pone el seed sobre el número `8899 0001`. | Lista de números en variable de entorno con clave de servicio. |
| Acceso a datos | Server Components y Server Actions con el cliente de Supabase del usuario; RLS es la única capa de permisos. Sin rutas API, sin clave de servicio. | API intermedia; repositorio abstracto. |
| Borrador | Se guarda en base de datos desde el paso 1 y cada «Continuar» persiste su paso. Sobrevive a recargas. | Borrador en memoria como el prototipo. |
| WhatsApp de la casa | Se copia del perfil al crear y se muestra en solo lectura en el paso Precio. Editarlo por casa con su propia verificación va con el contacto (fase 3). | Verificación por casa ahora. |
| Al aprobar | La casa pasa directo a `active` (oferta gratuita de lanzamiento; la suscripción es fase 5) y `is_owner` del dueño pasa a `true`. | Pasar por `payment_due`. |
| Tipo de cambio | Constante de configuración (`FX_CRC_PER_USD = 510`, ya en `money.ts`), con variable de entorno opcional para cambiarla. | Fuente externa. |
| Fotos | Máximo 15 por casa, mínimo 5 para enviar. Redimensión en el navegador a 1600 px de lado mayor, JPEG, subida directa a Storage con la sesión del usuario. | Subida por Server Action (límite de cuerpo). |

## 3. Esquema · migración `0002_fase2.sql`

No se edita `0001_init.sql`.

### Columnas nuevas en `listings`

- `canton text not null default ''` (el prototipo lo pide junto a provincia y zona).
- `min_nights int not null default 1 check (min_nights >= 1)`.
- `min_months int check (min_months is null or min_months >= 1)` (solo si acepta mensual; opcional).
- `parking_paid boolean` (null cuando no hay parqueo; `true` de pago, `false` gratuito).
- `monthly_mode text check (monthly_mode in ('amount','contact'))` (sin esta columna un borrador que aún no eligió y «consultar» eran indistinguibles).

### Trigger de protección

`listings_protect` (`before update`): si quien escribe no es admin y no viene de una RPC (`set_config('app.allow_status','on',true)`), `owner_id`, `public_id`, `reviewed_at`, `reviewed_by` y `review_note` no cambian, y `status` solo puede pasar a `draft` desde `active`, `changes` o `rejected`. Sin esto, la política de `update` de `0001` permitía al dueño activar su propia casa por REST.

### Storage

- Bucket `listings`, lectura pública, límite 10 MiB por archivo, tipos `image/jpeg` y `image/webp`.
- Políticas sobre `storage.objects`: insertar, actualizar y borrar solo si el primer segmento de la ruta es el id de una casa cuyo `owner_id = auth.uid()`. Ruta: `<listing_id>/<uuid>.jpg`.

### Funciones (RPC, `security definer`, `search_path = public`)

- `submit_listing(p_listing uuid) returns listing_status`. Solo el dueño. Exige estado `draft` o `changes`, al menos 5 fotos, título y descripción no vacíos, `nightly_price_crc > 0`, `capacity >= 1`, `bathrooms >= 1`, `bedrooms >= 0` (y `>= 1` salvo apartamento), provincia, cantón y zona no vacíos, lat/lng presentes, coherencia mensual (`accepts_monthly = false` ⇒ `monthly_price_crc is null and min_months is null`), `parking_paid` null si no hay `parking` en `features`. Pasa a `review`, limpia `review_note`. Devuelve el estado o lanza excepción con mensaje en español.
- `review_listing(p_listing uuid, p_decision text, p_note text) returns listing_status`. Solo `is_admin()`. Exige estado `review`. `approve`: nota opcional, 5 fotos mínimo, pasa a `active`, marca `is_owner = true` al dueño. `changes`: nota obligatoria (1–2000 caracteres), pasa a `changes`. `reject`: nota obligatoria, pasa a `rejected`. Siempre guarda `review_note`, `reviewed_at`, `reviewed_by` e inserta en `admin_actions` (`listing.approve` | `listing.changes` | `listing.reject`).
- `set_listing_available(p_listing uuid, p_available boolean) returns void`. Solo el dueño, solo casas `active`. Actualiza `available`; `reopen_at` queda null en esta fase.
- `listing_link_state(p_public_id text) returns text`. Para cualquiera: `'active'` si la casa está activa, `'blocked'` si existe en otro estado distinto de `draft`, `null` si no existe o es borrador.

### Política adicional

- `listings_owner_delete`: el dueño puede borrar sus casas en estado `draft`.
- La vista `listings_public` se recrea añadiendo `canton`, `min_nights`, `min_months`, `parking_paid`. Sigue sin número ni dirección.
- `.env.local` gana `SUPABASE_SERVICE_ROLE_KEY` solo para Playwright (ver seed).

### Seed local (`supabase/seed/seed.sql`)

- Añade a `config.toml` el número de prueba `50688990001 = "123456"`.
- El seed no puede crear usuarios de `auth.users` de forma portable; en su lugar, la migración define `seed_admin(phone text)` (`security definer`), que marca `is_admin = true` al perfil con ese teléfono si existe. Se revoca `execute` a `anon` y `authenticated`: solo la clave de servicio puede llamarla. Playwright registra `8899 0001` por la UI y luego llama a `POST {SUPABASE_URL}/rest/v1/rpc/seed_admin` con la clave de servicio local (`SUPABASE_SERVICE_ROLE_KEY`, en `.env.local`; en local es la clave pública de demostración de la CLI). La app nunca usa esa clave.
- Documento `docs/configuracion-supabase.md` gana un paso «8. Marcar tu cuenta como admin» con la sentencia `update profiles set is_admin = true where phone = '+506…'`.

## 4. Módulos en `apps/web/src`

### `lib/supabase/server.ts`

Fábrica del cliente de Supabase para datos con las cookies de Next (`createServerClient`), extraída de `lib/auth/supabase.ts` para no duplicarla. Devuelve `null` si no hay variables. `lib/auth/supabase.ts` pasa a usarla.

### `lib/listings/schema.ts`

- Tipos: `Listing` (fila completa mapeada a camelCase), `PublicListing` (lo de la vista pública más fotos), `ListingDraft` (campos editables por paso), `Feature` (los 9 valores del enum), `Kind`.
- `FEATURES: [Feature, string][]` en el orden del prototipo: Piscina, Mascotas, Wifi, Aire acondicionado, Parqueo, ⚡ Cargador eléctrico, Niños pequeños gratis, Frente al mar, Rancho / BBQ.
- `PROVINCES` en el orden del prototipo: Guanacaste, Puntarenas, Limón, Alajuela, San José, Heredia, Cartago. `DEFAULT_PROVINCE = "Limón"`.
- `KIND_LABELS`: casa → Casa, apartamento → Apartamento, habitacion → Habitación.
- `validateStep(step, draft): string | null`. Mensajes del prototipo con «mensual»:
  1. Tipo obligatorio; «¿Aceptás alquiler mensual?» con respuesta explícita (`acceptsMonthly` es `boolean | null`; null falla).
  2. Provincia de la lista, cantón y zona no vacíos, lat/lng presentes.
  3. Personas entero ≥ 1; habitaciones entero ≥ 0 si apartamento, ≥ 1 si no; baños entero ≥ 1; título (≤ 100) y descripción (≤ 3000) no vacíos; si `parking` marcado, `parkingPaid` debe ser `true` o `false`.
  4. Entre 5 y 15 fotos.
  5. Precio por noche entero > 0 (colones, sin decimales); mínimo de noches entero ≥ 1; si acepta mensual: `monthlyMode` «amount» o «contact»; con «amount», importe entero > 0; `minMonths` vacío o entero ≥ 1.
- `validateAll(draft)`: primer paso con error, para «Enviar a revisión».
- `normalize(draft)`: desmarcar parqueo limpia `parkingPaid`; `acceptsMonthly = false` limpia mensual; «contact» limpia importe. Se aplica en cada guardado.

### `lib/listings/repo.ts`

Funciones que reciben el cliente de Supabase. Devuelven objetos del dominio, nunca filas crudas.

- `createDraft(ownerPhone)`: inserta `listings` con los `not null` mínimos (`title ''`, `province 'Limón'`, `capacity 1`, `bedrooms 1`, `bathrooms 1`, `nightly_price_crc 1`, `whatsapp_phone`) en `draft`; devuelve id y `public_id`.
- `getOwnListing(id)`, `listOwnListings()`.
- `saveStep(id, step, patch)`: `update` con los campos del paso tras `normalize`.
- `submit(id)`, `review(id, decision, note)`, `setAvailable(id, value)`: llaman a las RPC y traducen errores a mensajes.
- `listPhotos(id)`, `addPhoto(id, path, position)`, `removePhoto(photoId)`, `reorderPhotos(id, orderedIds)`.
- `queue()`: para admin, casas en `review` primero (más antiguas arriba), luego las decididas en los últimos 30 días.
- `getPublic(publicId)`: desde `listings_public` + fotos; `null` si no es `active`. También `linkState(publicId)`: llama a la RPC `listing_link_state(p_public_id text)` (`security definer`, devuelve `'active'`, `'blocked'` o `null`) para distinguir «no existe» de «ya no está activo» sin exponer nada más de una casa no pública.
- `search(filters)`: consulta sobre `listings_public` con `province`, `capacity >= ppl`, `bedrooms >= beds`, `features @> {…}`, `nightly_price_crc between`, orden por `created_at desc`. Y `provincesWithListings()`: `select distinct province`.

### `lib/listings/filters.ts`

- `parseFilters(searchParams, provinces)`: `prov` (una de las provincias con casas o «Todas»; por defecto Limón si tiene casas, si no «Todas»), `ppl` ∈ {0,2,4,6,8,12}, `beds` ∈ {0,1,2,3,4}, cada característica como `1`, `min`, `max` enteros ≥ 0.
- `toSearchParams(filters)`: sin valores por defecto, para enlaces limpios.
- `extrasCount(filters)`: personas, habitaciones, características y precios activos (lo que muestra el contador de «Más filtros»); la provincia no cuenta.
- `provinceChips(provinces)`: «Todas» más las provincias con casas en el orden de `PROVINCES`.

### `lib/listings/geo.ts`

- `approximate(lat, lng, seed)`: desplaza el punto hasta 500 m con un ángulo y una distancia derivados de un hash del `public_id`, para que la ficha muestre siempre el mismo círculo. Radio dibujado: 500 m.
- `inCostaRica(lat, lng)`: rechaza puntos fuera del rectángulo del país (validación del paso 2).

### `lib/listings/share.ts`

- `publicUrl(publicId)`: `https://bnbtico.com/casa/CT-####` en producción; en pruebas y local usa el origen actual.
- `previewText(listing)`: descripción para Open Graph: `Casa en Manzanillo, Limón · 5 personas · ₡85 000 por noche` (sin «total», con «orientativo»).

### `lib/currency.ts`

- Cookie `bnbtico_currency` (`CRC` | `USD`), `currentCurrency()` y `setCurrencyAction`. Solo afecta a la visualización.

### `actions/listings.ts`

Server Actions: `createDraftAction`, `saveStepAction(step)`, `addPhotoAction`, `removePhotoAction`, `reorderPhotosAction`, `submitAction`, `setAvailableAction`, `deleteDraftAction`. Todas exigen sesión (`auth().current()`), devuelven `{ error }` o redirigen.

### `actions/admin.ts`

`reviewAction(id, decision, note)`. Exige sesión y perfil admin (la RPC lo vuelve a comprobar).

## 5. Pantallas y rutas

Todas en móvil primero, con las clases de `globals.css` (`card`, `stack`, `row`, `chip`, `badge`, `note`, `btn`…). Se añaden las clases que falten del prototipo: `listing`, `photo`, `gallery`, `photos-grid`, `steps`, `cta-bar`, `seg`, `amen`, `cal`, `avatar`, `eyebrow` ya existe.

### Propietario

- `/propietario`: deja de ser marcador. Saludo, botón «Publicar casa», lista de casas con `OwnerCard`. Sin estadísticas (vistas y consultas llegan después).
- `/propietario/publicar`: crea el borrador y redirige a `/propietario/publicar/[id]/1`. Si ya hay un borrador en `draft` sin enviar, ofrece «Seguir con el borrador» o «Empezar otro».
- `/propietario/publicar/[id]/[paso]` (paso 1–5): cabecera «Publicar alojamiento · Paso n de 5», barra de pasos, tarjeta con el formulario del paso, «Atrás» y «Continuar» (paso 5: «Enviar a revisión»). Cada envío es una Server Action que valida con `validateStep`, guarda y redirige al siguiente paso; con error, vuelve al mismo paso con `role="alert"`. Nota fija: «* Obligatorio».
  - Paso 1 «Alojamiento»: tipo (select), «¿Aceptás alquiler mensual?» Sí/No sin preselección, texto «Todos los anuncios son de alquiler vacacional. También podés aceptar alquiler mensual.»
  - Paso 2 «Ubicación»: provincia (select con las 7), cantón, zona / playa / barrio, mapa Leaflet con pin arrastrable (componente cliente, carga perezosa; centro inicial por provincia), lat/lng en campos ocultos. Texto «Mostramos una zona aproximada (radio ~500 m). La dirección exacta solo la compartís vos cuando lo decidás.»
  - Paso 3 «Detalles»: personas, habitaciones (con la nota de estudio), baños; «Características principales» con las 9 casillas de `FEATURES`; al marcar Parqueo aparece «Tipo de parqueo» Gratuito / De pago sin preselección (JS progresivo: el select existe oculto y se muestra con la casilla); título, descripción; nota «Sin enlaces, teléfonos ni publicidad de agencias. El contenido se revisa antes de publicar.»
  - Paso 4 «Fotos»: componente cliente `PhotoUploader`: input múltiple, redimensión con `canvas`, subida a Storage con `@supabase/ssr` en el navegador (`createBrowserClient`), alta de la fila por Server Action, cuadrícula con portada (posición 0), botones «Hacer portada» y «Quitar». Estado `role="status"` con «n fotos». «Continuar» exige 5–15 (validado también en servidor).
  - Paso 5 «Precio»: precio por noche en colones (entero), nota «Los precios se ingresan en colones (₡). Los clientes pueden verlos convertidos a dólares solo como referencia.», estancia mínima en noches; si acepta mensual: «Precio mensual» con «Indicar precio mensual orientativo» / «Consultar con el propietario», importe condicional, «Estancia mínima del alquiler mensual (meses, opcional)». Tarjeta «WhatsApp de tu cuenta» con el número en solo lectura y texto «Un único número para todos tus anuncios. No se muestra en la ficha pública.» Nota «Precios orientativos. bnbtico no gestiona reservas ni pagos entre las partes.» Botón «Enviar a revisión» → `submit` → redirige a `/propietario/casas` con aviso «Anuncio enviado a revisión».
- `/propietario/casas`: cabecera «Mis casas» con botón «Nueva». Lista de `OwnerCard`: foto de portada, título (enlace al detalle), badge de estado (Borrador, Pendiente de revisión, Cambios solicitados, Rechazada, Activa, No disponible cuando `available = false`), precio por noche, y en activas «Compartir ficha». En «Cambios solicitados» y «Rechazada», la nota del admin en una `note`. Borradores: «Seguir» y «Descartar».
- `/propietario/casas/[id]`: cabecera con el título y volver; portada; tarjeta con precio y estado y su explicación; tarjeta «Ficha» con «Compartir ficha» (Web Share API si existe, si no copia el enlace y avisa) deshabilitado si no está activa; tarjeta «Gestión»: «Editar» (abre el paso 1 del formulario sobre esa casa; al guardar una casa `active` vuelve a `review` al enviar), «Disponible» / «No disponible» (solo activas), «Descartar borrador» (solo `draft`).
- La cookie de rol sigue mandando en la interfaz. Publicar no exige `is_owner`; se activa al aprobar la primera casa.

### Admin

- Visible solo con perfil `is_admin`; si no, `/admin` devuelve 404.
- `/admin`: «Revisión de anuncios» con contador de pendientes; lista de tarjetas (propietario, título, enviado hace…, estado) con «Revisar». Sin nada de identidad.
- `/admin/casas/[id]`: estado y `CT-####`; galería con ampliación (anterior/siguiente); descripción; «Ubicación y alojamiento» (provincia, cantón, zona, tipo, personas, habitaciones, baños); «Características» (las 9, Sí/No; parqueo «Gratuito» / «De pago»); «Precios y condiciones» (precio por noche, mínimo de noches, acepta mensual, precio mensual o «Consultar con el propietario», mínimo de meses); mapa aproximado; «Revisión y decisión» con textarea «Motivo o indicaciones» (≤ 2000), botones «Aprobar anuncio» (deshabilitado con menos de 5 fotos, con nota «Faltan fotos»), «Pedir cambios», «Rechazar anuncio». Tras decidir, la tarjeta muestra la decisión y el motivo y los botones desaparecen. Cambios y rechazo sin motivo devuelven error.

### Público

- `/casa/[publicId]` dentro del grupo `(app)` (hereda `Shell` y la barrera de etapa; la barra inferior es la de cliente). SSR. `generateMetadata`: título «{título} · bnbtico», descripción `previewText`, `openGraph.images` con la portada, `canonical` a `publicUrl`. `robots` sigue indexando solo bnbtico.com.
  - Activa: cabecera con «Volver» a Explorar y «Compartir»; galería; badges «WhatsApp verificado» y «Ref CT-####»; título; zona, cantón, provincia; descripción; «Lo que ofrece» solo con lo que sí tiene (personas, habitaciones, baños y las características marcadas); «Disponibilidad y precio orientativo» con selector ₡/$ y un calendario de solo lectura del mes actual sin cifras por día, con la nota «₡85 000 por noche, salvo los días marcados con otro precio. Precios orientativos.» (fase 4 pondrá los días); «Ubicación aproximada» con mapa Leaflet y círculo; tarjeta del dueño con inicial, nombre y «WhatsApp verificado · en bnbtico desde {año}»; una sola `note`: «Sin comisiones: fechas, precio y pago los acordás con {nombre} por WhatsApp. bnbtico no procesa pagos; no transfieras sin confirmar la casa. Para escribirle necesitás tu WhatsApp verificado.»; barra fija con precio una vez («₡85 000 / noche · orientativo») y botón «Contactar por WhatsApp» deshabilitado con «Disponible pronto» (fase 3). Si acepta mensual, línea «Mensual: ₡… / mes · orientativo» o «Mensual: consultar precio con el propietario». Si `available = false`: badge «No disponible por ahora».
  - No activa pero existe: «Ficha no disponible» con «Este enlace ya no está activo», texto «Este anuncio no está disponible en este momento.» y botón «Explorar otras casas». Devuelve 200 con `robots: noindex`.
  - No existe: 404 de Next.
- `/explorar`: título «¿A dónde vas?»; filtros en la URL (`?prov=Limón&ppl=4&pool=1&min=30000`); sección «Zona» con chips de provincias con casas (y «Todas»); «Para quiénes» con dos selects (Personas, Habitaciones) que envían el formulario al cambiar (`GET`); en móvil «Qué necesitan» (9 chips) y «Precio por noche» (mín/máx) plegados tras «Más filtros» con contador y «Menos filtros»; «Limpiar» si hay extras; abiertos si hay algún extra activo. Línea «n casas en Limón · precios orientativos, acordalos con el propietario» con el selector ₡/$ al lado y, en dólares, la nota «Precios convertidos a dólares solo para orientarte (≈ ₡510 por US$1)…». Tarjetas: portada, título, «Manzanillo, Limón», «5 personas · 2 habitaciones», precio por noche. Sin resultados: «Sin resultados con esos filtros.» Sin casas en la base: «Todavía no hay casas publicadas.»
- `sitemap.ts` añade las fichas activas.
- `proxy.ts`: `/casa/*` y sus imágenes siguen detrás de la contraseña en pruebas (es lo que queremos hasta el lanzamiento).

## 6. Flujo de datos

1. Propietario con sesión → `createDraftAction` → fila `draft` con su `whatsapp_phone` → pasos 1–5 con `saveStepAction` (RLS: `owner_id = auth.uid()`).
2. Fotos: navegador → Storage (política por carpeta) → `addPhotoAction` inserta `listing_photos`.
3. «Enviar a revisión» → RPC `submit_listing` → `review`.
4. Admin → `/admin` (RLS `is_admin()`) → RPC `review_listing` → `active` | `changes` | `rejected`, `admin_actions`, `is_owner`.
5. Visitante → `/casa/CT-####` → `listings_public` + `listing_photos` con clave anónima → SSR con metadatos.
6. Cliente → `/explorar` → `listings_public` con filtros.

## 7. Errores y casos límite

- Sin Supabase configurado: las rutas de casas muestran una `note` «Esta pantalla necesita Supabase. En local: `pnpm db:start`.» y nada más. Las de cuenta siguen con demo.
- Sesión caducada en una Server Action: redirige a `/cuenta?next=…` conservando la ruta del paso.
- Error de RLS o RPC: mensaje genérico «No pudimos guardar. Intentá de nuevo.» más el mensaje de la RPC cuando lo trae en español.
- Subida de foto fallida: la foto no aparece y se muestra el error junto al botón; no queda fila huérfana (la fila se crea solo tras subir bien). Al quitar una foto se borra el objeto de Storage y la fila.
- Editar una casa activa: al pulsar «Editar» se avisa «Tu casa dejará de verse mientras la revisamos» y, con confirmación, la casa pasa a `draft` (la ficha deja de ser pública en ese momento, así nunca se publica contenido sin revisar); al enviar vuelve a `review`. Una casa en `changes` se edita sin cambiar de estado.
- `public_id` con formato inválido en la URL: 404 sin consultar.
- Entradas HTML en título o descripción: React escapa por defecto; la descripción se muestra con `white-space: pre-wrap`.
- Fotos mayores de 10 MiB tras redimensionar: no debería ocurrir; si Storage rechaza, se muestra el error.

## 8. Pruebas

### Vitest (`apps/web/tests/unit`)

- `listings-schema.test.ts`: portada de `tests/prototype/publication.cjs`: mensual explícito, ubicación obligatoria, estudio con 0 habitaciones, habitaciones vacías o decimales fallan, baños ≥ 1, parqueo exige tipo y desmarcar lo limpia, 4 fotos fallan y 5 pasan, precio entero > 0, mensual sin modo falla, importe negativo falla, «contact» deja importe null, apagar mensual limpia importe.
- `listings-filters.test.ts`: portada de `explorar-filtros.cjs` y `zona-caribe.cjs`: Limón por defecto si tiene casas, «Todas» si no; solo provincias con casas; una provincia nueva aparece; contador de extras; `parseFilters` ignora valores fuera de lista; `toSearchParams` omite defaults.
- `geo.test.ts`: jitter determinista, dentro de 500 m, mismo resultado para el mismo id, rechazo fuera de Costa Rica.
- `share.test.ts`: URL pública por entorno y texto de vista previa.
- `currency.test.ts`: cookie y formato en dólares con la constante.

### Playwright (`apps/web/tests/e2e/casas.spec.ts`), viewport móvil, contra Supabase local

Antes: `pnpm db:reset`. Fixtures: 5 imágenes JPEG pequeñas en `tests/e2e/fixtures/`.

1. Propietario `8777 0001` se registra, pasa a modo propietario, publica una casa en Limón (Manzanillo) con 5 fotos y mensual «consultar». Mis casas muestra «Pendiente de revisión».
2. Admin `8899 0001` entra, abre `/admin`, ve la casa, intenta «Pedir cambios» sin motivo y recibe error, aprueba. La tarjeta muestra «Aprobado».
3. Contexto nuevo sin sesión abre `/casa/CT-####`: título, «WhatsApp verificado», «Lo que ofrece» con lo marcado, precio una vez en la barra, `meta[property="og:title"]` y `og:image` presentes. Cambia a dólares y ve «$».
4. `/explorar` muestra la casa bajo Limón y «1 casa en Limón»; con filtro Piscina no aparece; «Limpiar» la devuelve.
5. Propietario marca «No disponible»; la ficha muestra «No disponible por ahora». Edita y reenvía; la ficha muestra «Este enlace ya no está activo» hasta que el admin vuelve a aprobar.
6. Segunda casa: admin «Pedir cambios» con motivo; el propietario ve el motivo en Mis casas, corrige y reenvía; el admin la ve de nuevo pendiente.

Las pruebas de la fase 1 siguen pasando contra demo y contra Supabase local.

## 9. Orden de construcción (un commit por paso, pruebas en verde)

1. Migración `0002`, bucket y políticas, RPCs, vista `listings_status`, número de prueba y `seed_admin`; `pnpm db:reset` limpio; prueba SQL mínima con `supabase db query` documentada.
2. `lib/supabase/server.ts`, `lib/listings/schema.ts` con Vitest, `repo.ts` para borrador y pasos.
3. Formulario pasos 1, 2 (con mapa), 3 y 5 sin fotos; Playwright del borrador persistente.
4. Paso 4: `PhotoUploader`, Storage, filas de fotos.
5. `submit_listing` desde la UI; Mis casas con estados y notas.
6. Admin: cola, revisión, decisiones.
7. Ficha pública con metadatos, mapa, moneda; «ya no está activo» con `listing_link_state`; sitemap.
8. Explorar con filtros en URL, provincias con casas, moneda.
9. Detalle de la casa del propietario: compartir, disponible, editar y reenviar.
10. Playwright del flujo completo (`casas.spec.ts`); `decisiones.md`, `plan-implementacion.md` (estado), `configuracion-supabase.md` (admin), `CLAUDE.md` si cambia alguna regla.

## 10. Dependencias nuevas

- `leaflet` + `@types/leaflet` (mapa). Teselas de OpenStreetMap con atribución; sin clave.
- Nada más. Las imágenes se procesan con `canvas` del navegador.

## 11. Pendiente de Daniel

- Ejecutar en el proyecto `bnbtico-pruebas`: `pnpm exec supabase db push` para la migración `0002`, crear el bucket si la migración no lo crea en el proyecto alojado (lo intenta vía `storage.buckets`), y marcar su cuenta como admin con la sentencia del paso 8 de `docs/configuracion-supabase.md`.
- Probar desde el móvil en pruebas.bnbtico.com el flujo del criterio de «hecho».
