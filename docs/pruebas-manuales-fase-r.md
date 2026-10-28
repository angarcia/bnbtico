# Plan de pruebas manual · fase R en nueva.bnbtico.com

> **2026-10-28:** las mejoras del 2026-10-27 (navegación simple, alquiler mensual, ubicación por punto y fotos arrastrando) se prueban con `docs/pruebas-manuales-mejoras-2026-10-27.md`, que manda sobre este plan donde no coincidan.

Fecha: 2026-10-23 (tickets 01–12, la parte preparable del 13 y los arreglos posteriores: segundo factor por app de autenticación, WhatsApp de cualquier país, avisos del perfil). **Actualizado el 2026-10-26** con los arreglos de los tickets 14–20 y las mejoras 21–22 (pasos marcados «actualizado 2026-10-26» o «añadido 2026-10-26»). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas` en Cloudflare, Supabase `bnbtico-pruebas`). Sustituye a `docs/pruebas-manuales-fase-2.md` para la app nueva. Se ejecuta **de una vez, desde el teléfono**, después de desplegar. Marque cada casilla y, si algo falla, anote el número del paso (ver C).

**Revisión UX (2026-10-27):** lo cambiado por la revisión UX (contactar sin cuenta, Ingresar, publicar en tres etapas, calendarios, Inicio y Mis casas, Favoritos, portada…) se prueba con `docs/pruebas-manuales-revision-ux.md`; donde un paso de aquí no coincida (p. ej. «Empezar» al publicar, «Paso n de 9», «País de su WhatsApp»), manda ese documento.

La parte A es para hacer antes, en orden. Cada acción dice si **bloquea** algo y su estado.

**Estado de la parte A (2026-10-23):**

| Paso | Estado |
|---|---|
| A1 Migraciones | ✅ las cinco de la fase R aplicadas · ☐ **nueva (2026-10-26):** `20261027040909_nombre_y_descripcion` (`pnpm exec supabase db push`; sin ella el asistente exige los límites pero la base no) · ☐ **nueva (2026-10-26, ticket 21):** `20261027044539_tipo_de_cambio` (sin ella la ficha sale con el tipo inicial ₡510 y sin caché del borde, y Explorar en dólares también usa ₡510) |
| A2 Segundo factor por app de autenticación | ✅ hecho (TOTP activo; admins Daniel y Ana; falta que cada uno vincule su app, B12a0–B12b) |
| A3 Secretos de Vault | ✅ hecho |
| A4 Access sin PIN | ✅ `/casa/*` y `/_purge/*` hechos · ☐ opcional `/sw.js` y `/manifest.webmanifest` · ☐ `workers.dev` y vistas previas siguen públicas |
| A5 Turnstile | ☐ pendiente (no bloquea) |
| A6 Números de atención | ☐ pendiente (no bloquea; B9e los necesita) |
| A7 Clave de servicio del worker | ✅ existe en GitHub |
| A8 Max rows 200 | ✅ hecho |
| A9 Alerta de gasto en Twilio | ☐ pendiente (no bloquea; ver `docs/antes-de-produccion.md`) |
| A10 Copia a R2 | ☐ pendiente (no bloquea; B24 la necesita) |
| A11 Desplegar | ✅ hecho (último despliegue verde en `develop`) |

Cada acción dice si **bloquea** algo:

- **despliegue**: sin ella el workflow no despliega o despliega algo roto.
- **pruebas**: el despliegue sale, pero algún recorrido de B falla hasta hacerla.
- **no**: se puede dejar para después (lo dice el paso).

---

## A. Acciones previas (Daniel)

### A1. Migraciones en `bnbtico-pruebas` · bloquea: pruebas

En el alojado están aplicadas hasta `20261023051419_cliente_directo`. Faltan, en este orden:

1. `20261023070407_listings_alta_segura.sql` (una casa nueva nace como borrador, con el WhatsApp del perfil)
2. `20261023073359_cliente_directo_fotos.sql` (RPCs de fotos, tope de 15 fotos y de 5 borradores, política de Storage)
3. `20261023075549_admin_aal2_y_purga.sql` (admin solo con segundo código; `pg_net` y purga de la ficha)
4. `20261023084120_telemetria.sql` (tablas `web_vitals`, `client_errors`, `events`)
5. `20261023164211_admin_totp_correo.sql` (`seed_admin` le pone al admin el rótulo que exige la app de autenticación)

Desde la raíz del repo, en `develop` al día: `pnpm exec supabase migration list` (comprobar que esas cinco salen solo en «Local») y `pnpm exec supabase db push`.

**Efecto sobre la app vieja (`pruebas.bnbtico.com`, Vercel):** desde la 3, **el admin de la app vieja ya no puede revisar** (no pide segundo código). Se revisa solo desde `nueva.bnbtico.com`. Lo demás de la app vieja sigue funcionando.

### A2. Segundo código del admin por app de autenticación (TOTP) · bloquea: pruebas (admin)

Supabase → proyecto `bnbtico-pruebas` → **Authentication → Multi-Factor → App Authenticator (TOTP)**: comprobar que está activado (**«Enroll»** y **«Verify»**). Está activo por defecto en proyectos nuevos y es gratis (el MFA por teléfono es solo del plan Pro y no se usa). Nada que configurar en Twilio: el código lo genera la app del teléfono del admin (Google Authenticator, 1Password u otra).

**Quién es admin (hecho el 2026-10-23).** Los admins de pruebas son **Daniel (`+1 778 347 9837`)** y **Ana (`+1 778 347 8492`)**: sus cuentas existen, están marcadas con `seed_admin` (que además les pone el correo-rótulo `<número>@admin.bnbtico.invalid` sin el que Supabase no puede inscribir el factor) y la cuenta de prueba `8899 0001` ya no es admin. Con TOTP el segundo código lo genera la app de **quien escanee el QR la primera vez**, así que **cada admin debe vincular su app cuanto antes** (paso B12a0): hasta entonces, quien tenga su sesión abierta podría vincular otra app en su lugar. Para añadir otro admin: que cree su cuenta y, en el SQL Editor, `select seed_admin('+<código><número>');`.

**Códigos de ingreso en pruebas (hecho el 2026-10-23).** Twilio Verify no envía códigos reales todavía (la prueba gratuita de Twilio no permite el servicio de Verify; pendiente en `docs/antes-de-produccion.md`). Los dos números de los admins están añadidos como números de prueba en Supabase → Authentication → Sign In / Providers → Phone → «Test Phone Numbers and OTPs», con el código fijo `123456`. Cualquier otra persona que vaya a probar necesita lo mismo: añadir `<número sin +>=123456` a esa lista (separado por comas, sin borrar los existentes).

### A3. Secretos de Vault para la purga de la ficha · bloquea: pruebas (B12, ficha actualizada en segundos)

Supabase → SQL Editor, dos sentencias:

```sql
select vault.create_secret('https://nueva.bnbtico.com', 'worker_purge_url');
select vault.create_secret('<el mismo valor que el secreto PURGE_SECRET de GitHub>', 'worker_purge_secret');
```

Comprobar también que en GitHub (Settings → Secrets and variables → Actions) existen los secretos `PURGE_SECRET`, `CLOUDFLARE_ZONE_ID` y `CLOUDFLARE_PURGE_TOKEN` (token con permiso «Zone → Cache Purge» en `bnbtico.com`). Sin ellos el worker responde 503 a la purga y la ficha tarda hasta 24 h (o el siguiente despliegue) en reflejar un cambio. Al cortar a producción: `select vault.update_secret((select id from vault.secrets where name = 'worker_purge_url'), 'https://bnbtico.com');`.

### A4. Cloudflare Access: rutas sin PIN · bloquea: pruebas (B1, B12)

Cloudflare → Zero Trust → Access → Applications → la aplicación de `nueva.bnbtico.com`. Añadir (o comprobar) aplicaciones o reglas **Bypass · Everyone** para:

- `nueva.bnbtico.com/casa/*` (ficha pública y vista previa de WhatsApp; pendiente desde el ticket 03).
- `nueva.bnbtico.com/_purge/*` (lo llama Postgres con `pg_net`; el endpoint ya exige el secreto).
- Opcional: `nueva.bnbtico.com/sw.js` y `nueva.bnbtico.com/manifest.webmanifest`. Si la sesión de Access caduca, Access intercepta estos dos y el registro del service worker falla en silencio (la app sigue). Recomendado para B19–B20.

Pendiente aparte (ticket 01): la URL `*.workers.dev` y las de vista previa no pasan por Access. Worker → Settings → Domains & Routes → desactivar `workers.dev` y «Preview URLs», o «Enable Access» ahí.

### A5. Turnstile · bloquea: no (pero el orden importa)

1. Cloudflare → **Turnstile → Add widget**: nombre `bnbtico`, dominios `nueva.bnbtico.com` (y `bnbtico.com` al cortar), modo **Managed**. Guarde la sitekey y la secret key.
2. GitHub → Settings → Secrets and variables → Actions: `TURNSTILE_SITE_KEY` = la **sitekey** (variable o secreto: el workflow acepta los dos).
3. Desplegar (push a `develop` o «Re-run» del último workflow `app` de `develop`).
4. Solo después: Supabase → **Authentication → Attack Protection** (o «Bot and Abuse Protection») → **Enable Captcha protection**, proveedor **Turnstile**, con la **secret key** → Save.

Si se hace el 4 antes del 3, nadie puede pedir códigos en la app nueva. **Efecto sobre la app vieja:** desde el 4, `pruebas.bnbtico.com` **ya no puede enviar códigos** (no manda token). Hágalo cuando ya solo se pruebe `nueva.bnbtico.com`.

### A6. Números de atención por WhatsApp · bloquea: no

GitHub → Secrets and variables → Actions: `WA_OWNERS` (línea de propietarios) y `WA_GUESTS` (línea de clientes), en formato `50688887777` (variable o secreto). Desplegar. Sin ellos, «Ayuda por WhatsApp» muestra el botón deshabilitado.

### A7. Telemetría: clave de servicio del worker · bloquea: no (pero B23 falla sin ella)

Comprobar que existe el secreto de GitHub `SUPABASE_SERVICE_ROLE_KEY` (la service role de `bnbtico-pruebas`). El workflow la sube al worker; sin ella las balizas se descartan sin error.

### A8. Filas por petición · bloquea: no

Supabase → **Project Settings → Data API → Max rows** = `200` → Save.

### A9. Alerta de gasto en Twilio · bloquea: no

Twilio Console → Billing → **Usage Triggers** (o alertas de gasto): por ejemplo 20 USD al mes, aviso por correo.

### A10. Copia diaria a R2 · bloquea: no

1. Cloudflare → **R2 → Create bucket** `bnbtico-copias` (privado). Opcional: Settings → Object lifecycle rules → borrar a los 31 días.
2. R2 → **Manage API tokens → Create API token**: «Object Read & Write», solo ese bucket. Anote Access Key ID y Secret Access Key.
3. GitHub → Secrets: `SUPABASE_DB_URL` (Supabase → Connect → **Session pooler**, `postgresql://postgres.<ref>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres`), `R2_ACCOUNT_ID` (id de la cuenta de Cloudflare), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Opcionales (variable o secreto): `R2_BUCKET` (por defecto `bnbtico-copias`), `BACKUP_PREFIX` (por defecto `bnbtico-pruebas`).
4. La ejecución manual va en B24.

### A11. Desplegar · bloquea: despliegue

Push a `develop` con todo lo anterior hecho (o «Re-run» del último workflow). El workflow ahora tiene una **puerta de Lighthouse** antes del despliegue (LCP de la ficha < 2,0 s y del shell instalado < 2,5 s en el runner). Si falla, no se despliega: la tabla está en el resumen del job y los informes en el artefacto «lighthouse».

---

## B. Recorridos

Números de prueba con código `123456` para ingresar (no se envía nada): `8888 1234` (cliente), `8777 0001` (propietaria «Yorleny Prueba», dueña de CT-1015), `8888 9999` (libre). Los admins (Daniel y Ana, ver A2) también son números de prueba con `123456`. Para el registro (B6) use otro número de prueba libre (`8888 9999`) o añada uno a la lista de números de prueba. Conviene un segundo teléfono o una pestaña privada para separar propietaria y admin.

Copy que debe verse en toda la app: trato de usted, precios en colones `₡95 000`, nada de «Identidad», «Mensual» en vez de «Largo plazo».

### Ficha pública y WhatsApp (sin sesión)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B1 | En una pestaña privada (sin sesión de Access) abrir `https://nueva.bnbtico.com/casa/CT-1015` | Ficha sin pedir PIN: fotos (la primera aparece enseguida), título, precio en colones, mapa aproximado tras un momento, «Contactar por WhatsApp» (deshabilitado en esta fase) | ☐ |
| B2 | Mandarse por WhatsApp el enlace `https://nueva.bnbtico.com/casa/CT-1015` | La vista previa muestra **la foto de portada y el título** de la casa | ☐ |
| B3 | Abrir `https://nueva.bnbtico.com/casa/CT-999999` | «Este enlace no existe» | ☐ |
| B4 | En la ficha, mirar el precio (actualizado 2026-10-26) | Precio en la moneda elegida (colones por defecto) y debajo la otra como referencia, sin botón («≈ $186 · orientativo…»). La barra no salta al cargar | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M42) |

### Explorar, Filtros y moneda

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B5a | Abrir `https://nueva.bnbtico.com/` (pasa el PIN de Access) | Explorar «¿Para dónde va?», arranca en Limón, CT-1015 en la lista con su foto | ☐ |
| B5b | En Explorar, tocar Vacacional y después Mensual; luego «Más filtros» (actualizado 2026-10-26) | Los chips (Vacacional, Mensual, Más filtros) caben en una fila sin deslizar; los dos quedan marcados a la vez (= todas las casas), uno solo filtra esa modalidad. Filtros: «Modalidad» con los mismos chips; en Zona solo provincias con casas; «Ver N casas» cuenta en vivo al tocar Piscina, Personas o precio | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M2, M39–M41) |
| B5c | Precio mínimo mayor que el máximo (actualizado 2026-10-26) | Aviso «El precio mínimo no puede ser mayor que el máximo.» y «Ver N casas» desactivado; al corregirlo se activa, vuelve a Explorar y la URL lo refleja; «Limpiar» los quita | ☐ |
| B5d | En Explorar, selector «₡ \| $» junto al número de casas → «$»; entrar a una ficha, a Favoritos y a «Más filtros» (actualizado 2026-10-26) | Todo en dólares: tarjetas, ficha (con «≈ ₡…» debajo), Favoritos y los precios de Filtros (se escriben en $). Mi cuenta → «Moneda» cambia lo mismo. Al recargar recuerda la elección | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M43) |
| B5g | Con «$» elegido (ticket 21, añadido 2026-10-26): leer la nota bajo el número de casas en Explorar, la ayuda del precio en «Más filtros» y «Moneda» en Mi cuenta. Después, en el SQL Editor: `select * from fx_rates order by day desc limit 3;` | La nota dice «≈ ₡4xx por US$1 (tipo de referencia del <día>)» con el tipo de la primera fila (redondeado), igual en Filtros y en Mi cuenta («(<día>)»); las tarjetas y la ficha convierten con él. Antes del primer cron la fila es `510 · constante`. Si la primera fila es de `exchangerate-api`, al final de la nota de Explorar y bajo el selector de Mi cuenta aparece «Rates By Exchange Rate API» enlazado; con `fawazahmed0` no aparece en ningún sitio. Nunca en la ficha | ☐ |
| B5f | En Explorar, bajar hasta las últimas tarjetas, abrir una ficha y volver atrás | Explorar vuelve al mismo punto del scroll, sin recargar. **Pendiente (2026-10-26): con una sola casa no se puede probar; repetir cuando haya más casas** | ☐ |
| B5e | Abrir `https://nueva.bnbtico.com/?pronto=1` (añadido con el ticket 13) | La portada de bnbtico.com: foto de Playa Negra, logo, «Muy pronto», «Alquile en el Caribe de Costa Rica, directo con quien lo recibe» y debajo «Qué es bnbtico». Es lo que verá bnbtico.com tras el corte | ☐ |

### Cuenta

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B6 | Mi cuenta → Ingresar (actualizado 2026-10-26: un único flujo, sin «Ya tengo cuenta»): en «País de su WhatsApp» Costa Rica viene por defecto; abrir la lista (14 países y «Otro país») y volver a Costa Rica; un número de prueba **sin cuenta** → «Recibir código por WhatsApp» | No se envía nada todavía: «Es su primera vez en bnbtico» con el número a la vista, campo Nombre y «Cambiar número». Escribir el nombre → «Recibir código por WhatsApp» → «Introduzca el código». Si activó Turnstile, puede aparecer la casilla de Cloudflare | ☐ |
| B7 | Código erróneo, luego el bueno → «Verificar y continuar» | Error «Ese código no es correcto o caducó.»; con el bueno (`123456`) «¡Listo! Su cuenta está creada» con «Añadir correo a mi perfil» y «Ahora no · continuar» (solo sale al crear una cuenta sin correo) | ☐ |
| B8 | Cerrar la app/pestaña del todo y volver a abrir `nueva.bnbtico.com/cuenta` | Sigue con la sesión (Mi cuenta con su nombre) | ☐ |
| B9 | «Cerrar sesión» | Vuelve a Ingresar con la barra inferior en modo cliente y «Mi cuenta» activa (la pantalla del código es la única sin barra; actualizado 2026-10-26) | ☐ |
| B9a | Mi cuenta → «Editar» | «Guardar cambios» está desactivado hasta cambiar algo | ☐ |
| B9b | Escribir un correo mal formado (`ana@`) → «Guardar cambios» | Aviso rojo «Ese correo no parece válido.» | ☐ |
| B9c | Corregir el correo (`ana@ejemplo.com`) y una descripción → «Guardar cambios» | Mientras guarda: «Guardando…»; después aviso verde «Cambios guardados.» y el botón queda desactivado como «Guardado». Al volver a escribir, el aviso desaparece | ☐ |
| B9d | Cerrar sesión y volver a Ingresar con el **mismo** número | No pide el nombre: el código sale al primer paso; tras el código **no** aparece «¡Listo! Su cuenta está creada»: entra directo. (Si en B7 no salió «¡Listo!», el número ya tenía cuenta en `bnbtico-pruebas`: use uno que no la tenga; ver `docs/decisiones.md` 2026-10-26) | ☐ |
| B9e | Mi cuenta → «Ayuda» | Texto según el rol y botón «Abrir WhatsApp». Deshabilitado hasta hacer A6 | ☐ |
| B9f | Barra inferior → «Favoritos» sin sesión y con sesión | Pantalla de marcador («Toque el corazón en una casa…»), sin errores | ☐ |
| B10 | En Ingresar, número sin cuenta → aparece el paso del nombre → «Cambiar número» | Vuelve al primer paso (país y número) sin haber enviado ningún código | ☐ |
| B10b | Ingresar eligiendo «Estados Unidos/Canadá (+1)» y un número de admin (`778 347 9837`), código `123456` | El código sale al primer paso (sin pedir nombre); entra; en Mi cuenta el número se ve como `+1 778 347 9837` | ☐ |
| B10c | Ingresar eligiendo «Otro país» y escribiendo `+1 778 347 9837` | Entra igual. Con «Otro país» y un número sin `+`, aviso de número no válido | ☐ |

### Propietaria: publicar (teléfono con `8777 0001`)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B11a | Entrar con `8777 0001` → «Publicar mi casa» | Modo propietario: barra Inicio, Mis casas, Calendario, Consultas, Cuenta; Inicio con su casa CT-1015 y la tarjeta de la oferta de lanzamiento con las plazas que quedan | ☐ |
| B11b | Inicio → «Publicar casa» (si ofrece «Tiene un borrador sin enviar», «Empezar otro») | Arriba a la derecha «Su casa · 1 de 4». Recorra las ocho pantallas (actualizado 2026-10-28, ubicación por punto): «¿Qué es?», «¿Dónde está su casa?» (mapa con buscador, pin arrastrable y «Usar mi ubicación»), «¿Cuántos caben?», «Características», «Nombre y descripción», fotos, «Precio», «Revisar y enviar». Ya no hay pantalla aparte para el mapa. Ninguna pantalla necesita scroll con el teclado cerrado; con teclado, el campo activo queda visible | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M8–M30) |
| B11b1 | Paso 2 «¿Dónde está su casa?» (ubicación por punto, actualizado 2026-10-28). (a) En «Busque un pueblo, playa o barrio…» escribir «Coc» y elegir «Cocles». (b) Tocar el mapa sobre Cocles; después arrastrar el punto unos cientos de metros. (c) Buscar «Limón centro», tocar allí y mirar la lista «Zona». (d) Volver a Cocles; en «Zona», «Otra…»: escribir «Cocles» y tocar «Usar "Cocles"»; otra vez «Otra…», escribir «Playa Ch» y elegir una sugerencia de Photon; otra vez «Otra…», escribir «Cerca del río» → «Usar "Cerca del río"» → «Continuar». (e) Con el modo avión puesto, mover el punto; quitarlo. (f) Abrir a mano `…/publicar/<id>/3` | (a) El mapa va a Cocles con zoom de calle pero **no pone el punto** y el teclado se cierra. (b) Sale el punto; debajo, la línea **«Talamanca, Limón»** (no se edita) y en «Zona» queda elegida **Cocles**, la más cercana; la lista trae las zonas a 5 km o menos, luego el distrito (Cahuita) y al final «Otra…». Al arrastrar, la línea y la lista se actualizan. (c) La línea pasa a «Limón, Limón» y la lista cambia a las zonas de allí (Limón centro elegida). (d) Con «Usar "Cocles"» queda elegida la Cocles de la lista (no una zona nueva); las sugerencias de «Otra…» son solo de 5 km alrededor del punto, con «Datos © OpenStreetMap · Photon» abajo; «Cerca del río» queda como zona y «Continuar» sigue. (e) Sin red: «No pudimos ubicar el punto. Revise su conexión.» con «Reintentar» y «Continuar» apagado; con red vuelve sola la línea. (f) Lleva al paso 2 (`…/2`). En un teléfono de 375 px: la línea del cantón no hace saltar la pantalla al cambiar de «Buscando el cantón…» a «Talamanca, Limón», y con el teclado abierto en «Otra…» el campo y sus sugerencias se ven y se pueden tocar | ☐ |
| B11b2 | Paso 6 (actualizado 2026-10-26): nombre de 4 letras y una descripción corta → «Continuar» | Contadores «n / 60 · mínimo 5» y «n / 2000 · mínimo 80» (en rojo fuera del rango); avisos «El nombre de la casa debe tener entre 5 y 60 caracteres.» y «La descripción debe tener entre 80 y 2000 caracteres.»; corregidos, sigue al paso 7 | ☐ |
| B11b3 | En cualquier paso, «✕ Cerrar» (arriba a la izquierda; actualizado 2026-10-26) | «Guardando…» un instante si hacía falta y vuelve a Mis casas; Inicio → «Publicar casa» ofrece «Seguir con el borrador» con lo escrito | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M46) |
| B11c | Paso 7: «Añadir fotos» con 5–6 fotos reales del carrete, **incluida una HEIC** si es iPhone | Cada foto muestra su progreso y aparece en la rejilla. La HEIC llega convertida (iPhone) o sale «Ese formato no se puede subir. Use JPG o PNG.» (Android con HEIC). Mantener pulsada una foto la levanta y arrastrarla la cambia de sitio; la primera es la portada; «Quitar foto n» funciona (actualizado 2026-10-28; el detalle, en U54–U58 de `docs/pruebas-manuales-revision-ux.md`) | ☐ |
| B11d | En el paso 5 o 6, cerrar la app del todo; volver a abrir → Inicio → «Publicar casa» | «Tiene un borrador sin enviar» → «Seguir con el borrador» retoma lo escrito y las fotos | ☐ |
| B11e | Terminar y «Enviar a revisión» | Pantalla «Enviada»; en Mis casas la casa «en revisión» | ☐ |
| B11f | Empezar otra casa, rellenar el paso 1 y volver; en Mis casas, «Descartar» ese borrador | Confirma «¿Descartar este borrador? No se puede deshacer.» y desaparece | ☐ |

### Admin (Daniel y Ana, cada uno en su teléfono)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B12a0 | **Cada admin, primero y cuanto antes:** instalar una app de autenticación (Google Authenticator, Microsoft Authenticator o 1Password). Si la app de bnbtico estaba abierta, cerrar sesión y volver a entrar | La app de autenticación está lista | ☐ |
| B12a | Entrar con su número (código `123456`) → Mi cuenta → «Revisión de anuncios · admin» | La primera vez: «Vincule su app de autenticación» con un código QR y la clave en texto. Escanee el QR con su app (o escriba la clave); aparece «bnbtico». No llega nada por WhatsApp | ☐ |
| B12b | Escribir un código equivocado y luego el de 6 dígitos que muestra la app → «Verificar y entrar» | Con el equivocado «Ese código no es correcto o caducó.»; con el bueno, cola «Anuncios»: la casa de B11e en «Por revisar» como «Nueva» | ☐ |
| B12b2 | Cerrar sesión, volver a ingresar y entrar otra vez a la revisión | «Confirme que es usted» sin QR («Abra su app de autenticación y escriba el código de 6 dígitos de bnbtico.»); el código de la app abre la cola | ☐ |
| B12c | Abrirla → «Aprobar y publicar» | Vuelve a la cola sin la casa al instante y «Aprobada y publicada». En otro teléfono, su ficha `/casa/CT-…` se ve activa | ☐ |
| B12d | **Purga:** en el detalle de la propietaria, apagar «Anuncio visible» de CT-1015 (antes «Disponible para consultas»; hoja «Pausar anuncio»); abrir la ficha en otro dispositivo a los pocos segundos | La ficha refleja el cambio en segundos (sin esperar 24 h): «No disponible por ahora». En Explorar la casa ya no aparece. En el detalle: «Pausado: no aparece en Explorar…». Si no: en el SQL Editor `select status_code, content from net._http_response order by id desc limit 5;` dice qué respondió el worker | ☐ |
| B12e | Volver a encender «Anuncio visible» | La ficha vuelve a estar disponible y la casa vuelve a Explorar | ☐ |
| B12f | Con un número que no es admin (`8888 1234`), abrir `https://nueva.bnbtico.com/admin` | «Solo para el equipo de bnbtico»; no pide código ni muestra QR | ☐ |

### Pedir cambios y corregir

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B13 | Propietaria: enviar otra casa (o reutilizar el borrador). Admin: abrirla, escribir un motivo → «Pedir cambios» | Sin motivo: «Escriba un motivo de hasta 2000 caracteres…». Con motivo: pasa a «Cambios pedidos» | ☐ |
| B14 | Propietaria: Mis casas | La casa con «Le pedimos cambios» y el motivo; «Corregir y reenviar» abre el asistente relleno; corregir y enviar | ☐ |
| B15 | Admin: la cola | La casa vuelve como «Corregida» | ☐ |
| B15b | Admin: otra casa en revisión → escribir un motivo → «Rechazar» | Sale de la cola y aparece en «Rechazados». La propietaria la ve «Rechazada» con el motivo y sin botón para reenviar | ☐ |
| B16 | Propietaria: casa activa → editar | Confirma «Su casa dejará de verse mientras la revisamos. ¿Quiere editarla?»; al aceptar, la ficha pública deja de funcionar («Este enlace ya no está activo») | ☐ |

### App instalada y sin red

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B17 | Chrome Android: menú → «Instalar app». iPhone (Safari): Compartir → «Agregar a inicio» | Icono terracota; abre a pantalla completa en Explorar | ☐ |
| B18 | Abrir la app instalada una vez con red; cerrarla; **modo avión**; abrirla | Abre Explorar con las casas de la última vez; tocar una tarjeta muestra la ficha; Mi cuenta abre | ☐ |
| B19 | Aún sin red, propietaria → detalle de una casa activa → tocar «Anuncio visible» | «Sin conexión. Revise su internet e intente de nuevo.» y el interruptor vuelve a su sitio. Con red de nuevo, nada cambió en la base | ☐ |
| B20 | Hacer un segundo despliegue (cualquier push a `develop`); con la app abierta, salir y volver a ella | Aviso «Hay una versión nueva · Actualizar» (no aparece dentro del asistente). «Actualizar» recarga y el aviso desaparece | ☐ |

### Telemetría y copia

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B21 | Tras navegar un rato, SQL Editor: `select name, count(*) from web_vitals group by 1; select name, count(*) from events group by 1;` | Filas de LCP/INP/CLS/FCP/TTFB y de `page_view`/`listing_view` con `country = 'CA'` (o el país desde el que pruebe) | ☐ |
| B22 | `select build, message, count(*) from client_errors group by 1, 2 order by 3 desc limit 10;` | Vacío o errores conocidos; anote los que salgan | ☐ |
| B23 | Al día siguiente (el cron corre a las 03:17 de Costa Rica): Cloudflare → Workers → `bnbtico-pruebas` → Logs | Una línea `{"event":"keepalive","ok":true,...}` y otra `{"event":"fx","ok":true,"crcPerUsd":…,"day":"…","source":"fawazahmed0",…}` (ticket 21); en `fx_rates` una fila de ese día. Si dice `"ok":false,"kept":"último guardado"`, las dos fuentes fallaron: anote los `failures` | ☐ |
| B24 | GitHub → Actions → **copia** → «Run workflow» (rama `develop`) | Job verde; resumen «Copia bnbtico-pruebas-AAAA-MM-DD.dump: … bytes, N tablas con datos»; el archivo está en R2 → `bnbtico-copias/bnbtico-pruebas/` | ☐ |

---

## D. Segunda vuelta (2026-10-27): lo que cambió tras la primera prueba

Cambios hechos entre el 2026-10-26 y el 2026-10-27 a partir de los resultados de la primera vuelta (tickets 14–22 en `.scratch/fase-r/issues/`). Para repetir de una vez, en este orden. Cada fila dice qué paso de B tiene el detalle; los pasos marcados «nuevo» solo están aquí.

**Antes de empezar:** el despliegue de `develop` del 2026-10-27 debe estar en verde (`gh run list` o GitHub → Actions) y las migraciones `nombre_y_descripcion` y `tipo_de_cambio` aplicadas en `bnbtico-pruebas` (ya hechas el 2026-10-27).

| # | Qué probar | Detalle | ✓ |
|---|---|---|---|
| D1 | **Ficha desde WhatsApp con estilos** (B2): abrir el enlace de CT-1015 desde WhatsApp en un teléfono que **nunca** haya entrado en `nueva.bnbtico.com` (p. ej. el de Ana) | Carga con estilos, fotos y tipografías a la primera, sin pedir PIN (bypass de Access ampliado a `/assets/*`, `/fonts/*`, `/icons/*`…) | ☐ |
| D2 | **Moneda única** (B4, B5d) | Selector «₡ \| $» junto al número de casas en Explorar y en Mi cuenta → «Moneda»; cambia toda la app (tarjetas, ficha, Favoritos, filtros). La ficha ya no tiene botón: muestra la otra moneda debajo como referencia. Colones por defecto | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M42–M43) |
| D3 | **Tipo de cambio diario** (B5g; nuevo) | Con «$»: la nota de Explorar, la ayuda del precio en «Más filtros» y «Moneda» en Mi cuenta dicen «tipo de referencia del <día>». Hasta el primer cron (03:17 hora de Costa Rica) el valor es el inicial (₡510). Si algún día sale «· ExchangeRate-API», ese día se usó la fuente de respaldo | ☐ |
| D4 | **Filtros en una fila** (B5b) | En Explorar solo Vacacional, Mensual y «Más filtros» (con contador), sin deslizar a 360 px. Vacacional y Mensual no se excluyen: ninguno o los dos = todas; uno = solo esa. En «Más filtros», sección «Modalidad» igual | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M39–M41) |
| D5 | **Precio mínimo mayor que el máximo** (B5c) | Aviso «El precio mínimo no puede ser mayor que el máximo.» y «Ver N casas» desactivado hasta corregirlo; ya no se intercambian solos. Los precios se escriben en la moneda elegida | ☐ |
| D6 | **Barra inferior en Ingresar** (B9) | En Ingresar y en Mi cuenta se ve la barra (Explorar, Favoritos, Mi cuenta); solo la pantalla del código va sin ella | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M6) |
| D7 | **Entrar solo con el WhatsApp, número sin cuenta** (B6, B10) | Con un número de prueba sin cuenta (p. ej. `8888 9999`, si se borró antes): primero solo país y número; aparece el paso del nombre sin haber enviado código; «Cambiar número» vuelve atrás; con el nombre llega un solo código. Ya no existe «Ya tengo cuenta» | ☐ |
| D8 | **Entrar con un número que ya tiene cuenta** (B9d, B10b, B10c) | El código sale al primer paso, sin pedir nombre. Con el número de un admin (+1 778…) o con «Otro país» y `+1 778 347 9837`, igual. Tras el código **no** aparece «¡Listo! Su cuenta está creada» | ☐ |
| D9 | **Barra de admin en Cuenta** (nuevo) | Daniel o Ana, con el segundo código ya puesto: en Mi cuenta la barra de abajo es la de admin (no la de cliente). «Buscar una casa» vuelve a la barra de cliente | ☐ |
| D10 | **¿Dónde está su casa?** (B11b1; ubicación por punto, 2026-10-28) | Paso 2 del asistente: el buscador solo mueve el mapa (no pone el punto); el punto se pone tocando o arrastrando. Debajo, «Talamanca, Limón» (o el cantón que toque), sin poder editarlo; en «Zona», la más cercana ya elegida y la lista cambia al mover el punto. «Otra…» busca con Photon a 5 km del punto y deja «Usar "…"»; un nombre que ya está en la lista elige esa zona. Sin red, aviso con «Reintentar». El `/3` viejo lleva al `/2`. Como admin, en «Revisar» una casa con zona de «Otra…» lleva la marca **«Zona propuesta por el dueño»**; en Mi cuenta → «Ayuda» se citan los límites de OpenStreetMap (ODbL). A 375 px la línea no salta y «Otra…» se usa con el teclado abierto | ☐ |
| D11 | **Nombre y descripción con límites** (B11b2) | Paso 6: contadores «n / 60 · mínimo 5» y «n / 2000 · mínimo 80»; con menos no deja continuar y lo explica | ☐ |
| D12 | **Salir del asistente** (B11b3) | «✕ Cerrar» arriba a la izquierda en cualquier paso: «Guardando…» si hacía falta y vuelve a Mis casas; el borrador se retoma después | ☐ |
| D13 | **Anuncio visible** (B12d, B12e) | En el detalle de una casa activa, «Anuncio visible» (antes «Disponible para consultas») con su explicación. Al apagarlo («Pausar anuncio»): en Mis casas sale «Pausado», la casa **desaparece de Explorar**, su ficha abre con «No disponible por ahora» y sigue en Favoritos; al encenderlo vuelve a Explorar | ☐ |
| D14 | **Fila del tipo de cambio** (B23; al día siguiente) | Cloudflare → Workers → `bnbtico-pruebas` → Logs: una línea `fx` del cron. O pedirle a Claude que compruebe la fila del día en `fx_rates` | ☐ |

Sigue pendiente B5f (scroll al volver de una ficha): hace falta tener varias casas.

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/fase-r/` (uno por fallo):

1. El número del paso (p. ej. «B11c») y qué esperaba.
2. Captura de pantalla o grabación, con la hora.
3. Teléfono y navegador (p. ej. «iPhone 15, Safari» o «Pixel 7, Chrome, app instalada»), y si tenía red.
4. Para B12d: la salida de `net._http_response`. Para errores de la app: la consulta de B22. Para el despliegue: el enlace al run de GitHub Actions.
5. Si el fallo es de un número que no recibe código: en pruebas todos los números son de prueba (código `123456`, ver A2); compruebe que el número está en «Test Phone Numbers and OTPs» de Supabase. Twilio aún no envía códigos reales (`docs/antes-de-produccion.md`).
